import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { HttpError } from "../utils/httpError";
import { getLotPhase } from "../utils/lotPhase";
import { isValidAmount } from "../utils/money";
import { lockLot, runTransaction } from "../utils/transaction";
import { downloadImage, getArtwork } from "./aicService";
import { aliasFor, createLotChain, signSeal } from "./chainService";
import { itemSelect, serializeBid, serializeLot } from "./lotView";
import { emitShowcaseChanged, emitToLot, emitToUser } from "./realtime";
import { getWalletSummary } from "./walletService";

const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_DURATION_MS = 60 * 1000;

function parseDate(value: unknown, field: string) {
	const date = typeof value === "string" ? new Date(value) : null;
	if (!date || Number.isNaN(date.getTime())) {
		throw new HttpError(400, `Data inválida em ${field}`, "INVALID_DATE");
	}
	return date;
}

export interface CreateLotInput {
	externalId?: unknown;
	title?: unknown;
	description?: unknown;
	startingBidCents?: unknown;
	minIncrementCents?: unknown;
	startsAt?: unknown;
	endsAt?: unknown;
}

/** Busca (ou reaproveita) o snapshot local da obra, com a imagem guardada no banco. */
async function snapshotArtwork(externalId: string) {
	const existing = await prisma.item.findFirst({
		where: { source: "aic", externalId, imageData: { not: null } },
		select: { id: true },
	});
	if (existing) return existing.id;

	const artwork = await getArtwork(externalId);
	const image = artwork.imageUrl ? await downloadImage(artwork.imageUrl) : null;

	const item = await prisma.item.create({
		data: {
			source: "aic",
			externalId: artwork.externalId,
			title: artwork.title,
			artist: artwork.artist,
			dateDisplay: artwork.dateDisplay,
			medium: artwork.medium,
			dimensions: artwork.dimensions,
			origin: artwork.origin,
			attributes: artwork.attributes,
			imageUrl: artwork.imageUrl,
			imageData: image?.data,
			imageMime: image?.mime,
		},
		select: { id: true },
	});
	return item.id;
}

export async function createLot(sellerId: string, input: CreateLotInput) {
	const externalId = String(input.externalId ?? "");
	if (!/^\d+$/.test(externalId)) {
		throw new HttpError(400, "Selecione uma obra do catálogo", "INVALID_ITEM");
	}
	if (!isValidAmount(input.startingBidCents)) {
		throw new HttpError(400, "Lance inicial inválido", "INVALID_STARTING_BID");
	}
	if (!isValidAmount(input.minIncrementCents)) {
		throw new HttpError(400, "Incremento mínimo inválido", "INVALID_INCREMENT");
	}

	const now = new Date();
	// Início "agora" chega alguns segundos atrasado; aceitamos uma pequena folga.
	const startsAt = parseDate(input.startsAt, "início");
	const endsAt = parseDate(input.endsAt, "fim");
	if (startsAt.getTime() < now.getTime() - 5 * 60 * 1000) {
		throw new HttpError(
			400,
			"O início não pode estar no passado",
			"INVALID_DATE",
		);
	}
	if (endsAt.getTime() - startsAt.getTime() < MIN_DURATION_MS) {
		throw new HttpError(
			400,
			"O lote precisa durar pelo menos 1 minuto",
			"INVALID_DATE",
		);
	}
	if (endsAt.getTime() - startsAt.getTime() > MAX_DURATION_MS) {
		throw new HttpError(
			400,
			"O lote pode durar no máximo 30 dias",
			"INVALID_DATE",
		);
	}

	const description =
		typeof input.description === "string"
			? input.description.trim().slice(0, 2000)
			: "";
	const customTitle =
		typeof input.title === "string" ? input.title.trim().slice(0, 200) : "";

	const itemId = await snapshotArtwork(externalId);
	const item = await prisma.item.findUniqueOrThrow({
		where: { id: itemId },
		select: { title: true },
	});

	const lotId = crypto.randomUUID();
	const chain = createLotChain({
		lotId,
		itemId,
		sellerId,
		startingBidCents: input.startingBidCents,
		minIncrementCents: input.minIncrementCents,
		startsAt,
		endsAt,
	});

	const lot = await prisma.lot.create({
		data: {
			id: lotId,
			sellerId,
			itemId,
			title: customTitle || item.title,
			description: description || null,
			startingBidCents: input.startingBidCents,
			minIncrementCents: input.minIncrementCents,
			startsAt,
			endsAt,
			originalEndsAt: endsAt,
			...chain,
		},
		include: {
			item: { select: itemSelect },
			seller: { select: { name: true } },
		},
	});

	emitShowcaseChanged();
	return serializeLot(lot);
}

/**
 * Cancela um lote que ainda não terminou. Se já houver lances, o valor
 * comprometido do líder é liberado na hora (estorno automático): como o
 * comprometido é derivado dos lotes ATIVOS, basta o lote deixar de ser ativo.
 */
export async function cancelLot(sellerId: string, lotId: string) {
	const result = await runTransaction(async (tx) => {
		const lot = await lockLot(tx, lotId);
		if (!lot) throw new HttpError(404, "Lote não encontrado", "LOT_NOT_FOUND");
		if (lot.sellerId !== sellerId) {
			throw new HttpError(
				403,
				"Você só pode cancelar os seus lotes",
				"FORBIDDEN",
			);
		}
		if (lot.status === "CANCELLED") {
			throw new HttpError(409, "Este lote já foi cancelado", "LOT_CANCELLED");
		}
		const now = new Date();
		if (lot.status === "SETTLED" || lot.endsAt <= now) {
			throw new HttpError(
				409,
				"Lotes encerrados não podem ser cancelados",
				"LOT_ENDED",
			);
		}

		const cancelled = await tx.lot.update({
			where: { id: lot.id },
			data: {
				status: "CANCELLED",
				cancelledAt: now,
				sealSignature: signSeal({ ...lot, status: "CANCELLED" }),
			},
		});

		const bidders = await tx.bid.findMany({
			where: { lotId: lot.id },
			distinct: ["bidderId"],
			select: { bidderId: true },
		});

		return {
			lot: cancelled,
			refundedLeaderId: lot.leaderId,
			refundedCents: lot.currentBidCents,
			bidderIds: bidders.map((bid) => bid.bidderId),
		};
	});

	emitToLot(lotId, "lot:cancelled", { lot: serializeLot(result.lot) });
	emitShowcaseChanged();
	for (const bidderId of result.bidderIds) {
		emitToUser(bidderId, "notify:lot-cancelled", {
			lotId,
			title: result.lot.title,
			refunded: bidderId === result.refundedLeaderId,
		});
	}
	if (result.refundedLeaderId) {
		const leaderId = result.refundedLeaderId;
		getWalletSummary(leaderId)
			.then((wallet) => emitToUser(leaderId, "wallet:updated", wallet))
			.catch(() => {});
	}

	return {
		lot: serializeLot(result.lot),
		refundedCents: result.refundedLeaderId ? result.refundedCents : 0,
	};
}

// ---------------------------------------------------------------------------
// Vitrine
// ---------------------------------------------------------------------------

export type ShowcasePhase = "live" | "scheduled" | "ended";

export interface ShowcaseQuery {
	phase?: unknown;
	search?: unknown;
	minPrice?: unknown;
	maxPrice?: unknown;
	sort?: unknown;
	page?: unknown;
}

function phaseWhere(phase: ShowcasePhase, now: Date): Prisma.LotWhereInput {
	if (phase === "live") {
		return { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } };
	}
	if (phase === "scheduled") {
		return { status: "ACTIVE", startsAt: { gt: now } };
	}
	return {
		OR: [{ status: "SETTLED" }, { status: "ACTIVE", endsAt: { lte: now } }],
	};
}

function centsParam(value: unknown) {
	const number = Number(value);
	return value !== undefined &&
		value !== "" &&
		Number.isFinite(number) &&
		number >= 0
		? Math.round(number)
		: undefined;
}

const PAGE_SIZE = 24;

export async function listShowcase(query: ShowcaseQuery) {
	const now = new Date();
	const phase: ShowcasePhase = ["live", "scheduled", "ended"].includes(
		String(query.phase),
	)
		? (query.phase as ShowcasePhase)
		: "live";
	const search =
		typeof query.search === "string" ? query.search.trim().slice(0, 100) : "";
	const minPrice = centsParam(query.minPrice);
	const maxPrice = centsParam(query.maxPrice);
	const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);

	const filters: Prisma.LotWhereInput[] = [];
	if (search) {
		filters.push({
			OR: [
				{ title: { contains: search, mode: "insensitive" } },
				{ item: { artist: { contains: search, mode: "insensitive" } } },
			],
		});
	}
	// Preço de referência = lance atual, ou o lance inicial se ainda não houver lances.
	const priceRange = { gte: minPrice, lte: maxPrice };
	if (minPrice !== undefined || maxPrice !== undefined) {
		filters.push({
			OR: [
				{ currentBidCents: priceRange },
				{ currentBidCents: null, startingBidCents: priceRange },
			],
		});
	}

	const where: Prisma.LotWhereInput = {
		AND: [phaseWhere(phase, now), ...filters],
	};

	const defaultSort: Record<
		ShowcasePhase,
		Prisma.LotOrderByWithRelationInput[]
	> = {
		live: [{ endsAt: "asc" }],
		scheduled: [{ startsAt: "asc" }],
		ended: [{ endsAt: "desc" }],
	};
	const sorts: Record<string, Prisma.LotOrderByWithRelationInput[]> = {
		ending: [{ endsAt: "asc" }],
		newest: [{ createdAt: "desc" }],
		price_asc: [
			{ currentBidCents: { sort: "asc", nulls: "first" } },
			{ startingBidCents: "asc" },
		],
		price_desc: [
			{ currentBidCents: { sort: "desc", nulls: "last" } },
			{ startingBidCents: "desc" },
		],
		bids: [{ bidCount: "desc" }],
	};
	const orderBy = sorts[String(query.sort)] ?? defaultSort[phase];

	const [lots, total, liveCount, scheduledCount, endedCount] =
		await Promise.all([
			prisma.lot.findMany({
				where,
				orderBy,
				skip: (page - 1) * PAGE_SIZE,
				take: PAGE_SIZE,
				include: {
					item: { select: itemSelect },
					seller: { select: { name: true } },
				},
			}),
			prisma.lot.count({ where }),
			prisma.lot.count({
				where: { AND: [phaseWhere("live", now), ...filters] },
			}),
			prisma.lot.count({
				where: { AND: [phaseWhere("scheduled", now), ...filters] },
			}),
			prisma.lot.count({
				where: { AND: [phaseWhere("ended", now), ...filters] },
			}),
		]);

	return {
		lots: lots.map((lot) => serializeLot(lot, now)),
		page,
		totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
		counts: { live: liveCount, scheduled: scheduledCount, ended: endedCount },
		serverTime: now,
	};
}

// ---------------------------------------------------------------------------
// Sala do lote
// ---------------------------------------------------------------------------

export async function getLotDetail(lotId: string, viewerId?: string) {
	const lot = await prisma.lot.findUnique({
		where: { id: lotId },
		include: {
			item: { select: itemSelect },
			seller: { select: { name: true } },
			bids: { orderBy: { seq: "desc" }, take: 100 },
			receipt: { select: { id: true, winnerId: true } },
		},
	});
	if (!lot) throw new HttpError(404, "Lote não encontrado", "LOT_NOT_FOUND");

	const isWinner = !!viewerId && lot.receipt?.winnerId === viewerId;

	return {
		lot: serializeLot(lot),
		bids: lot.bids.map(serializeBid),
		/** Pseudônimo do visitante neste lote — o front usa para marcar "você". */
		myAlias: viewerId ? aliasFor(lot.id, viewerId) : null,
		isSeller: !!viewerId && lot.sellerId === viewerId,
		receiptId: isWinner ? lot.receipt?.id : null,
		serverTime: new Date(),
	};
}

// ---------------------------------------------------------------------------
// Painel do leiloeiro
// ---------------------------------------------------------------------------

export async function listSellerLots(sellerId: string) {
	const now = new Date();
	const lots = await prisma.lot.findMany({
		where: { sellerId },
		orderBy: { createdAt: "desc" },
		include: { item: { select: itemSelect } },
	});

	const serialized = lots.map((lot) => serializeLot(lot, now));
	const sold = lots.filter((lot) => lot.status === "SETTLED" && lot.winnerId);

	return {
		lots: serialized,
		summary: {
			totalReceivedCents: sold.reduce(
				(sum, lot) => sum + (lot.finalPriceCents ?? 0),
				0,
			),
			soldCount: sold.length,
			unsoldCount: lots.filter(
				(lot) => lot.status === "SETTLED" && !lot.winnerId,
			).length,
			liveCount: serialized.filter((lot) => lot.phase === "LIVE").length,
			scheduledCount: serialized.filter((lot) => lot.phase === "SCHEDULED")
				.length,
			cancelledCount: lots.filter((lot) => lot.status === "CANCELLED").length,
		},
	};
}

// ---------------------------------------------------------------------------
// Meus lances / arremates
// ---------------------------------------------------------------------------

export type ParticipationStatus =
	| "WINNING"
	| "OUTBID"
	| "WON"
	| "LOST"
	| "CANCELLED"
	| "CLOSING";

export async function listMyBids(userId: string) {
	const myBids = await prisma.bid.groupBy({
		by: ["lotId"],
		where: { bidderId: userId },
		_max: { amountCents: true, placedAt: true },
		_count: { _all: true },
	});

	const lots = await prisma.lot.findMany({
		where: { id: { in: myBids.map((bid) => bid.lotId) } },
		include: {
			item: { select: itemSelect },
			receipt: { select: { id: true, winnerId: true } },
		},
	});
	const byId = new Map(lots.map((lot) => [lot.id, lot]));
	const now = new Date();

	const participations = myBids.flatMap((bid) => {
		const lot = byId.get(bid.lotId);
		if (!lot) return [];

		const phase = getLotPhase(lot, now);
		let status: ParticipationStatus;
		if (lot.status === "CANCELLED") status = "CANCELLED";
		else if (lot.status === "SETTLED")
			status = lot.winnerId === userId ? "WON" : "LOST";
		else if (phase === "CLOSING") status = "CLOSING";
		else status = lot.leaderId === userId ? "WINNING" : "OUTBID";

		return [
			{
				lot: serializeLot(lot, now),
				status,
				myAlias: aliasFor(lot.id, userId),
				myHighestBidCents: bid._max.amountCents ?? 0,
				myBidCount: bid._count._all,
				lastBidAt: bid._max.placedAt,
				receiptId: lot.receipt?.winnerId === userId ? lot.receipt.id : null,
			},
		];
	});

	participations.sort(
		(a, b) =>
			new Date(b.lastBidAt ?? 0).getTime() -
			new Date(a.lastBidAt ?? 0).getTime(),
	);
	return participations;
}
