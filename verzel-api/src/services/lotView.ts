import type { Bid, Item, Lot } from "@prisma/client";
import { minimumNextBid } from "../utils/bidRules";
import { getLotPhase } from "../utils/lotPhase";
import { aliasFor } from "./chainService";

type ItemSummary = Omit<Item, "imageData">;

/** Campos do item que podem ir para o front (sem os bytes da imagem). */
export const itemSelect = {
	id: true,
	source: true,
	externalId: true,
	title: true,
	artist: true,
	dateDisplay: true,
	medium: true,
	dimensions: true,
	origin: true,
	attributes: true,
	imageUrl: true,
	imageMime: true,
	createdAt: true,
} as const;

export function serializeItem(item: ItemSummary) {
	return {
		id: item.id,
		source: item.source,
		externalId: item.externalId,
		title: item.title,
		artist: item.artist,
		dateDisplay: item.dateDisplay,
		medium: item.medium,
		dimensions: item.dimensions,
		origin: item.origin,
		attributes: item.attributes,
		imagePath: `/items/${item.id}/image`,
	};
}

/** Visão pública do lote: nunca expõe ids de licitantes, só pseudônimos. */
export function serializeLot(
	lot: Lot & { item?: ItemSummary; seller?: { name: string } },
	now = new Date(),
) {
	return {
		id: lot.id,
		title: lot.title,
		description: lot.description,
		phase: getLotPhase(lot, now),
		status: lot.status,
		startingBidCents: lot.startingBidCents,
		minIncrementCents: lot.minIncrementCents,
		currentBidCents: lot.currentBidCents,
		minNextBidCents: minimumNextBid(lot),
		bidCount: lot.bidCount,
		startsAt: lot.startsAt,
		endsAt: lot.endsAt,
		originalEndsAt: lot.originalEndsAt,
		extensionCount: lot.extensionCount,
		leaderAlias: lot.leaderId ? aliasFor(lot.id, lot.leaderId) : null,
		winnerAlias: lot.winnerAlias,
		finalPriceCents: lot.finalPriceCents,
		settledAt: lot.settledAt,
		cancelledAt: lot.cancelledAt,
		seller: lot.seller ? { name: lot.seller.name } : undefined,
		item: lot.item ? serializeItem(lot.item) : undefined,
	};
}

export function serializeBid(bid: Bid) {
	return {
		seq: bid.seq,
		bidderAlias: bid.bidderAlias,
		amountCents: bid.amountCents,
		placedAt: bid.placedAt,
	};
}
