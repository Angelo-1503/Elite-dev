import crypto from "node:crypto";
import { prisma } from "../config/database";
import { lockLot, lockUser, runTransaction } from "../utils/transaction";
import { aliasFor, signReceipt, signSeal } from "./chainService";
import { serializeLot } from "./lotView";
import { emitShowcaseChanged, emitToLot, emitToUser } from "./realtime";

/**
 * Liquida um lote vencido: debita o vencedor, credita o leiloeiro, gera o
 * comprovante assinado e sela o resultado. Lote sem lances fecha sem vencedor.
 * É idempotente: se o lote já foi liquidado (ou ainda não venceu), não faz nada.
 */
export async function settleLot(lotId: string) {
	const result = await runTransaction(async (tx) => {
		const lot = await lockLot(tx, lotId);
		const now = new Date();
		if (!lot || lot.status !== "ACTIVE" || lot.endsAt > now) return null;

		if (!lot.leaderId || lot.currentBidCents == null) {
			const settled = await tx.lot.update({
				where: { id: lot.id },
				data: {
					status: "SETTLED",
					settledAt: now,
					sealSignature: signSeal({ ...lot, status: "SETTLED" }),
				},
			});
			return { lot: settled, winnerId: null, receiptId: null };
		}

		const price = lot.currentBidCents;
		const winnerId = lot.leaderId;
		const winnerAlias = aliasFor(lot.id, winnerId);

		// Trava os dois usuários em ordem de id para não haver deadlock entre liquidações.
		const [firstId, secondId] = [winnerId, lot.sellerId].sort();
		await lockUser(tx, firstId as string);
		await lockUser(tx, secondId as string);

		const winner = await tx.user.update({
			where: { id: winnerId },
			data: { balanceCents: { decrement: price } },
		});
		const seller = await tx.user.update({
			where: { id: lot.sellerId },
			data: { balanceCents: { increment: price } },
		});

		await tx.ledgerEntry.createMany({
			data: [
				{
					userId: winnerId,
					type: "PURCHASE",
					amountCents: -price,
					balanceAfterCents: winner.balanceCents,
					lotId: lot.id,
				},
				{
					userId: lot.sellerId,
					type: "SALE",
					amountCents: price,
					balanceAfterCents: seller.balanceCents,
					lotId: lot.id,
				},
			],
		});

		const receiptId = crypto.randomBytes(12).toString("base64url");
		const { payload, signature } = signReceipt({
			receiptId,
			lotId: lot.id,
			lotTitle: lot.title,
			winnerAlias,
			amountCents: price,
			headHash: lot.headHash,
			issuedAt: now,
		});
		await tx.receipt.create({
			data: {
				id: receiptId,
				lotId: lot.id,
				winnerId,
				winnerAlias,
				amountCents: price,
				headHash: lot.headHash,
				payload,
				signature,
				issuedAt: now,
			},
		});

		const settled = await tx.lot.update({
			where: { id: lot.id },
			data: {
				status: "SETTLED",
				settledAt: now,
				winnerId,
				winnerAlias,
				finalPriceCents: price,
				sealSignature: signSeal({
					...lot,
					status: "SETTLED",
					winnerAlias,
					finalPriceCents: price,
				}),
			},
		});

		return { lot: settled, winnerId, receiptId };
	});

	if (!result) return null;

	emitToLot(lotId, "lot:settled", { lot: serializeLot(result.lot) });
	emitShowcaseChanged();
	if (result.winnerId) {
		emitToUser(result.winnerId, "lot:won", {
			lotId,
			title: result.lot.title,
			receiptId: result.receiptId,
		});
	}

	return result;
}

/** Liquida todos os lotes que já passaram do fim. Chamado periodicamente pelo job. */
export async function settleDueLots() {
	const due = await prisma.lot.findMany({
		where: { status: "ACTIVE", endsAt: { lte: new Date() } },
		select: { id: true },
		orderBy: { endsAt: "asc" },
		take: 50,
	});

	for (const { id } of due) {
		try {
			await settleLot(id);
		} catch (error) {
			console.error(`[settlement] falha ao liquidar lote ${id}:`, error);
		}
	}

	return due.length;
}
