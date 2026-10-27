import type { Lot, Prisma } from "@prisma/client";
import { env } from "../config/env";
import { bidderAlias } from "../utils/alias";
import {
	bidPayload,
	genesisPayload,
	keysFromSeed,
	type ReceiptInput,
	receiptPayload,
	sealPayload,
	sha256Hex,
	signMessage,
} from "../utils/chain";

const keys = keysFromSeed(env.signingKeySeed);

export const publicKeyHex = keys.publicKeyHex;

export function aliasFor(lotId: string, userId: string) {
	return bidderAlias(env.aliasSecret, lotId, userId);
}

type SealFields = Pick<
	Lot,
	| "id"
	| "bidCount"
	| "headHash"
	| "status"
	| "endsAt"
	| "winnerAlias"
	| "finalPriceCents"
>;

/** Assina o estado atual do lote. Deve ser chamado a cada mudança de estado. */
export function signSeal(lot: SealFields) {
	return signMessage(
		keys.privateKey,
		sealPayload({
			lotId: lot.id,
			bidCount: lot.bidCount,
			headHash: lot.headHash,
			status: lot.status,
			endsAt: lot.endsAt,
			winnerAlias: lot.winnerAlias,
			finalPriceCents: lot.finalPriceCents,
		}),
	);
}

interface NewLotChainInput {
	lotId: string;
	itemId: string;
	sellerId: string;
	startingBidCents: number;
	minIncrementCents: number;
	startsAt: Date;
	endsAt: Date;
}

/** Gera o gênesis e o selo inicial de um lote novo (ainda sem lances). */
export function createLotChain(input: NewLotChainInput) {
	const genesisHash = sha256Hex(
		genesisPayload({ ...input, originalEndsAt: input.endsAt }),
	);
	const sealSignature = signSeal({
		id: input.lotId,
		bidCount: 0,
		headHash: genesisHash,
		status: "ACTIVE",
		endsAt: input.endsAt,
		winnerAlias: null,
		finalPriceCents: null,
	});

	return { genesisHash, headHash: genesisHash, sealSignature };
}

interface AppendBidInput {
	lot: Lot;
	bidderId: string;
	amountCents: number;
	placedAt: Date;
	/** Novo fim do lote (já considerando o anti-sniping). */
	endsAt: Date;
	extended: boolean;
}

/**
 * Grava um lance como novo elo da cadeia e atualiza o lote (líder, cabeça, selo).
 * Não valida regras: quem chama precisa ter validado e travado o lote.
 */
export async function appendBid(
	tx: Prisma.TransactionClient,
	input: AppendBidInput,
) {
	const { lot } = input;
	const seq = lot.bidCount + 1;
	const alias = aliasFor(lot.id, input.bidderId);
	const hash = sha256Hex(
		bidPayload({
			lotId: lot.id,
			seq,
			bidderAlias: alias,
			amountCents: input.amountCents,
			placedAt: input.placedAt,
			prevHash: lot.headHash,
		}),
	);

	const bid = await tx.bid.create({
		data: {
			lotId: lot.id,
			bidderId: input.bidderId,
			seq,
			amountCents: input.amountCents,
			bidderAlias: alias,
			placedAt: input.placedAt,
			prevHash: lot.headHash,
			hash,
			signature: signMessage(keys.privateKey, hash),
		},
	});

	const sealSignature = signSeal({
		...lot,
		bidCount: seq,
		headHash: hash,
		endsAt: input.endsAt,
	});

	const updatedLot = await tx.lot.update({
		where: { id: lot.id },
		data: {
			currentBidCents: input.amountCents,
			leaderId: input.bidderId,
			bidCount: seq,
			headHash: hash,
			endsAt: input.endsAt,
			extensionCount: input.extended ? { increment: 1 } : undefined,
			sealSignature,
		},
	});

	return { bid, lot: updatedLot };
}

export function signReceipt(input: ReceiptInput) {
	const payload = receiptPayload(input);
	return { payload, signature: signMessage(keys.privateKey, payload) };
}
