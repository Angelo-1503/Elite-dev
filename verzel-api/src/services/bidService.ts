import { applyAntiSniping, validateBid } from "../utils/bidRules";
import { HttpError } from "../utils/httpError";
import { lockLot, lockUser, runTransaction } from "../utils/transaction";
import { appendBid } from "./chainService";
import { serializeBid, serializeLot } from "./lotView";
import { emitShowcaseChanged, emitToLot, emitToUser } from "./realtime";
import { committedCents, getWalletSummary } from "./walletService";

/**
 * Registra um lance.
 *
 * Concorrência: a transação trava a linha do lote (dois lances no mesmo lote são
 * processados um de cada vez) e depois a do licitante (o mesmo licitante não
 * compromete o mesmo saldo em dois lotes ao mesmo tempo). A ordem é sempre
 * lote -> usuário, então não há deadlock entre lances.
 */
export async function placeBid(
	userId: string,
	lotId: string,
	amountCents: unknown,
) {
	const result = await runTransaction(async (tx) => {
		const lot = await lockLot(tx, lotId);
		if (!lot) throw new HttpError(404, "Lote não encontrado", "LOT_NOT_FOUND");

		const bidder = await lockUser(tx, userId);
		if (!bidder) throw new HttpError(401, "Usuário não encontrado");

		// O lance atual do licitante neste lote não entra na conta: ele não pode
		// cobrir a si mesmo, então nunca é líder aqui quando o lance é válido.
		const committedElsewhereCents = await committedCents(tx, userId, lot.id);
		const now = new Date();

		const validation = validateBid({
			lot,
			bidder,
			committedElsewhereCents,
			amountCents,
			now,
		});

		if (!validation.ok) {
			const { ok, code, message, ...extra } = validation;
			throw new HttpError(422, message, code, extra);
		}

		const extension = applyAntiSniping(lot.endsAt, now);
		const previousLeaderId = lot.leaderId;

		const appended = await appendBid(tx, {
			lot,
			bidderId: userId,
			amountCents: validation.amountCents,
			placedAt: now,
			endsAt: extension.endsAt,
			extended: extension.extended,
		});

		return { ...appended, previousLeaderId, extended: extension.extended };
	});

	const lotView = serializeLot(result.lot);
	const bidView = serializeBid(result.bid);

	emitToLot(lotId, "lot:bid", {
		lot: lotView,
		bid: bidView,
		extended: result.extended,
	});
	emitShowcaseChanged();

	// O valor do líder anterior volta ao disponível imediatamente.
	if (result.previousLeaderId && result.previousLeaderId !== userId) {
		const previousLeaderId = result.previousLeaderId;
		emitToUser(previousLeaderId, "bid:outbid", {
			lotId,
			title: result.lot.title,
			currentBidCents: result.lot.currentBidCents,
		});
		getWalletSummary(previousLeaderId)
			.then((wallet) => emitToUser(previousLeaderId, "wallet:updated", wallet))
			.catch(() => {});
	}
	getWalletSummary(userId)
		.then((wallet) => emitToUser(userId, "wallet:updated", wallet))
		.catch(() => {});

	return { lot: lotView, bid: bidView, extended: result.extended };
}
