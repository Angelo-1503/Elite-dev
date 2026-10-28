export type Role = 'AUCTIONEER' | 'BIDDER';

export interface User {
	id: string;
	name: string;
	email: string;
	role: Role;
}

export type LotPhase = 'SCHEDULED' | 'LIVE' | 'CLOSING' | 'ENDED' | 'CANCELLED';
export type LotStatus = 'ACTIVE' | 'CANCELLED' | 'SETTLED';

export interface Item {
	id: string;
	source: string;
	externalId: string;
	title: string;
	artist: string | null;
	dateDisplay: string | null;
	medium: string | null;
	dimensions: string | null;
	origin: string | null;
	attributes: Record<string, string>;
	imagePath: string;
}

export interface Lot {
	id: string;
	title: string;
	description: string | null;
	phase: LotPhase;
	status: LotStatus;
	startingBidCents: number;
	minIncrementCents: number;
	currentBidCents: number | null;
	minNextBidCents: number;
	bidCount: number;
	startsAt: string;
	endsAt: string;
	originalEndsAt: string;
	extensionCount: number;
	leaderAlias: string | null;
	winnerAlias: string | null;
	finalPriceCents: number | null;
	settledAt: string | null;
	cancelledAt: string | null;
	seller?: { name: string };
	item?: Item;
}

export interface Bid {
	seq: number;
	bidderAlias: string;
	amountCents: number;
	placedAt: string;
}

export interface LotDetail {
	lot: Lot;
	bids: Bid[];
	myAlias: string | null;
	isSeller: boolean;
	receiptId: string | null;
	serverTime: string;
}

export interface ShowcaseResponse {
	lots: Lot[];
	page: number;
	totalPages: number;
	counts: { live: number; scheduled: number; ended: number };
	serverTime: string;
}

export interface LedgerEntry {
	id: string;
	type: 'DEPOSIT' | 'PURCHASE' | 'SALE';
	amountCents: number;
	balanceAfterCents: number;
	lotId: string | null;
	createdAt: string;
}

export interface Wallet {
	totalCents: number;
	committedCents: number;
	availableCents: number;
	commitments: { lotId: string; title: string; amountCents: number; endsAt: string }[];
	entries: LedgerEntry[];
}

export type ParticipationStatus = 'WINNING' | 'OUTBID' | 'WON' | 'LOST' | 'CANCELLED' | 'CLOSING';

export interface Participation {
	lot: Lot;
	status: ParticipationStatus;
	myAlias: string;
	myHighestBidCents: number;
	myBidCount: number;
	lastBidAt: string;
	receiptId: string | null;
}

export interface SellerLotsResponse {
	lots: Lot[];
	summary: {
		totalReceivedCents: number;
		soldCount: number;
		unsoldCount: number;
		liveCount: number;
		scheduledCount: number;
		cancelledCount: number;
	};
}

export interface Artwork {
	externalId: string;
	title: string;
	artist: string | null;
	dateDisplay: string | null;
	medium: string | null;
	dimensions: string | null;
	origin: string | null;
	imageUrl: string | null;
	thumbnailUrl: string | null;
	attributes: Record<string, string>;
}

export interface CatalogSearch {
	items: Artwork[];
	page: number;
	totalPages: number;
	stale: boolean;
}

export interface AuditCheck {
	key: string;
	label: string;
	ok: boolean;
	detail?: string;
}

export interface AuditReport {
	intact: boolean;
	checks: AuditCheck[];
	bids: { seq: number; ok: boolean; problems: string[] }[];
}

export interface AuditChainBid extends Bid {
	prevHash: string;
	hash: string;
	signature: string;
}

export interface AuditResponse {
	publicKey: string;
	lot: {
		id: string;
		itemId: string;
		sellerId: string;
		title: string;
		status: LotStatus;
		startingBidCents: number;
		minIncrementCents: number;
		startsAt: string;
		endsAt: string;
		originalEndsAt: string;
		bidCount: number;
		currentBidCents: number | null;
		genesisHash: string;
		headHash: string;
		sealSignature: string;
		winnerAlias: string | null;
		finalPriceCents: number | null;
		item: Item;
	};
	bids: AuditChainBid[];
	report: AuditReport;
	checkedAt: string;
}

export interface Receipt {
	id: string;
	lotId: string;
	lotTitle: string;
	sellerName: string;
	item: Item;
	winnerAlias: string;
	amountCents: number;
	bidCount: number;
	headHash: string;
	issuedAt: string;
	payload: string;
	signature: string;
	publicKey: string;
	valid: boolean;
	isMine: boolean;
}
