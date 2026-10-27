import { prisma } from "../config/database";
import { verifyLotChain } from "../utils/auditVerifier";
import { verifyMessage } from "../utils/chain";
import { HttpError } from "../utils/httpError";
import { aliasFor, publicKeyHex } from "./chainService";
import { itemSelect, serializeItem } from "./lotView";

/**
 * Auditoria pública de um lote. Devolve:
 * - os dados crus da cadeia (para o navegador refazer a verificação sozinho);
 * - o relatório calculado pelo servidor, que inclui uma checagem extra que só ele
 *   pode fazer: confirmar que cada pseudônimo corresponde mesmo ao licitante gravado
 *   no lance (detecta troca do bidder_id direto no banco).
 */
export async function getLotAudit(lotId: string) {
	const lot = await prisma.lot.findUnique({
		where: { id: lotId },
		include: {
			item: { select: itemSelect },
			bids: { orderBy: { seq: "asc" } },
		},
	});
	if (!lot) throw new HttpError(404, "Lote não encontrado", "LOT_NOT_FOUND");

	const report = verifyLotChain(lot, lot.bids, publicKeyHex);

	const mismatched = lot.bids.filter(
		(bid) => bid.bidderAlias !== aliasFor(lot.id, bid.bidderId),
	);
	for (const bid of mismatched) {
		const result = report.bids.find((entry) => entry.seq === bid.seq);
		if (result) {
			result.ok = false;
			result.problems.push("Licitante gravado não corresponde ao pseudônimo");
		}
	}
	const leaderOk =
		!lot.leaderId ||
		lot.bids.length === 0 ||
		lot.bids[lot.bids.length - 1]?.bidderId === lot.leaderId;
	report.checks.push({
		key: "identity",
		label:
			"Cada lance pertence ao licitante indicado pelo pseudônimo (checagem do servidor)",
		ok: mismatched.length === 0 && leaderOk,
	});
	report.intact = report.checks.every((check) => check.ok);

	return {
		publicKey: publicKeyHex,
		lot: {
			id: lot.id,
			itemId: lot.itemId,
			sellerId: lot.sellerId,
			title: lot.title,
			status: lot.status,
			startingBidCents: lot.startingBidCents,
			minIncrementCents: lot.minIncrementCents,
			startsAt: lot.startsAt,
			endsAt: lot.endsAt,
			originalEndsAt: lot.originalEndsAt,
			bidCount: lot.bidCount,
			currentBidCents: lot.currentBidCents,
			genesisHash: lot.genesisHash,
			headHash: lot.headHash,
			sealSignature: lot.sealSignature,
			winnerAlias: lot.winnerAlias,
			finalPriceCents: lot.finalPriceCents,
			item: serializeItem(lot.item),
		},
		bids: lot.bids.map((bid) => ({
			seq: bid.seq,
			bidderAlias: bid.bidderAlias,
			amountCents: bid.amountCents,
			placedAt: bid.placedAt,
			prevHash: bid.prevHash,
			hash: bid.hash,
			signature: bid.signature,
		})),
		report,
		checkedAt: new Date(),
	};
}

export async function getReceipt(receiptId: string, viewerId?: string) {
	const receipt = await prisma.receipt.findUnique({
		where: { id: receiptId },
		include: {
			lot: {
				select: {
					id: true,
					title: true,
					headHash: true,
					startsAt: true,
					endsAt: true,
					bidCount: true,
					seller: { select: { name: true } },
					item: { select: itemSelect },
				},
			},
		},
	});
	if (!receipt)
		throw new HttpError(404, "Comprovante não encontrado", "NOT_FOUND");

	const signatureValid = verifyMessage(
		publicKeyHex,
		receipt.payload,
		receipt.signature,
	);
	// O comprovante precisa bater com o lote atual (não pode haver lance depois do arremate).
	const matchesLot = receipt.headHash === receipt.lot.headHash;

	return {
		id: receipt.id,
		lotId: receipt.lotId,
		lotTitle: receipt.lot.title,
		sellerName: receipt.lot.seller.name,
		item: serializeItem(receipt.lot.item),
		winnerAlias: receipt.winnerAlias,
		amountCents: receipt.amountCents,
		bidCount: receipt.lot.bidCount,
		headHash: receipt.headHash,
		issuedAt: receipt.issuedAt,
		payload: receipt.payload,
		signature: receipt.signature,
		publicKey: publicKeyHex,
		valid: signatureValid && matchesLot,
		isMine: !!viewerId && viewerId === receipt.winnerId,
	};
}
