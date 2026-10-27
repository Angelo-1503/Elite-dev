import type { LotStatus, Role } from "@prisma/client";
import { formatBRL, isValidAmount } from "./money";

/** Lance aceito nos últimos 2 minutos prorroga o fim do lote em +2 minutos. */
export const ANTI_SNIPING_WINDOW_MS = 2 * 60 * 1000;
export const ANTI_SNIPING_EXTENSION_MS = 2 * 60 * 1000;

export type BidErrorCode =
	| "INVALID_AMOUNT"
	| "NOT_A_BIDDER"
	| "LOT_CANCELLED"
	| "LOT_NOT_STARTED"
	| "LOT_ENDED"
	| "ALREADY_WINNING"
	| "BELOW_MINIMUM"
	| "INSUFFICIENT_FUNDS";

interface LotForBid {
	status: LotStatus;
	startsAt: Date;
	endsAt: Date;
	leaderId: string | null;
	currentBidCents: number | null;
	startingBidCents: number;
	minIncrementCents: number;
}

interface BidderForBid {
	id: string;
	role: Role;
	balanceCents: number;
}

export interface BidContext {
	lot: LotForBid;
	bidder: BidderForBid;
	/** Quanto o licitante já tem comprometido liderando OUTROS lotes. */
	committedElsewhereCents: number;
	amountCents: unknown;
	now: Date;
}

export type BidValidation =
	| { ok: true; amountCents: number }
	| {
			ok: false;
			code: BidErrorCode;
			message: string;
			minimumCents?: number;
			availableCents?: number;
	  };

/** Primeiro lance: >= lance inicial. Seguintes: >= lance atual + incremento mínimo. */
export function minimumNextBid(lot: LotForBid) {
	if (lot.currentBidCents == null) return lot.startingBidCents;
	return lot.currentBidCents + lot.minIncrementCents;
}

/**
 * Valida um lance contra todas as regras do leilão. A ordem das checagens define
 * qual motivo o usuário vê quando mais de uma regra falha.
 */
export function validateBid(ctx: BidContext): BidValidation {
	const { lot, bidder, now } = ctx;

	if (!isValidAmount(ctx.amountCents)) {
		return {
			ok: false,
			code: "INVALID_AMOUNT",
			message: "Valor de lance inválido.",
		};
	}
	const amountCents = ctx.amountCents;

	if (bidder.role !== "BIDDER") {
		return {
			ok: false,
			code: "NOT_A_BIDDER",
			message: "Somente licitantes podem dar lances.",
		};
	}

	if (lot.status === "CANCELLED") {
		return {
			ok: false,
			code: "LOT_CANCELLED",
			message: "Este lote foi cancelado.",
		};
	}

	if (lot.status === "SETTLED" || now >= lot.endsAt) {
		return {
			ok: false,
			code: "LOT_ENDED",
			message: "Este lote já foi encerrado.",
		};
	}

	if (now < lot.startsAt) {
		return {
			ok: false,
			code: "LOT_NOT_STARTED",
			message: "Este lote ainda não foi iniciado.",
		};
	}

	if (lot.leaderId === bidder.id) {
		return {
			ok: false,
			code: "ALREADY_WINNING",
			message: "Você já está ganhando este lote.",
		};
	}

	const minimumCents = minimumNextBid(lot);
	if (amountCents < minimumCents) {
		return {
			ok: false,
			code: "BELOW_MINIMUM",
			message: `Lance abaixo do mínimo. O próximo lance deve ser de pelo menos ${formatBRL(minimumCents)}.`,
			minimumCents,
		};
	}

	const availableCents = bidder.balanceCents - ctx.committedElsewhereCents;
	if (amountCents > availableCents) {
		return {
			ok: false,
			code: "INSUFFICIENT_FUNDS",
			message: `Saldo insuficiente. Seu saldo disponível é ${formatBRL(Math.max(availableCents, 0))}.`,
			availableCents: Math.max(availableCents, 0),
		};
	}

	return { ok: true, amountCents };
}

/** Anti-sniping: lance nos últimos 2 minutos empurra o fim do lote em +2 minutos. */
export function applyAntiSniping(endsAt: Date, now: Date) {
	const remaining = endsAt.getTime() - now.getTime();

	if (remaining <= ANTI_SNIPING_WINDOW_MS) {
		return {
			endsAt: new Date(endsAt.getTime() + ANTI_SNIPING_EXTENSION_MS),
			extended: true,
		};
	}

	return { endsAt, extended: false };
}
