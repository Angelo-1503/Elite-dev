import { describe, expect, it } from "vitest";
import {
	ANTI_SNIPING_EXTENSION_MS,
	applyAntiSniping,
	type BidContext,
	minimumNextBid,
	validateBid,
} from "../src/utils/bidRules";

const NOW = new Date("2026-10-26T12:00:00Z");
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

function context(
	overrides: Partial<BidContext> = {},
	lot: Partial<BidContext["lot"]> = {},
): BidContext {
	return {
		lot: {
			status: "ACTIVE",
			startsAt: minutes(-60),
			endsAt: minutes(60),
			leaderId: null,
			currentBidCents: null,
			startingBidCents: 10_000,
			minIncrementCents: 1_000,
			...lot,
		},
		bidder: { id: "bidder-1", role: "BIDDER", balanceCents: 100_000 },
		committedElsewhereCents: 0,
		amountCents: 10_000,
		now: NOW,
		...overrides,
	};
}

describe("minimumNextBid", () => {
	it("primeiro lance precisa ser pelo menos o lance inicial", () => {
		expect(minimumNextBid(context().lot)).toBe(10_000);
	});

	it("lances seguintes precisam ser lance atual + incremento mínimo", () => {
		expect(minimumNextBid(context({}, { currentBidCents: 15_000 }).lot)).toBe(
			16_000,
		);
	});
});

describe("validateBid", () => {
	it("aceita o primeiro lance igual ao lance inicial", () => {
		expect(validateBid(context())).toEqual({ ok: true, amountCents: 10_000 });
	});

	it("recusa abaixo do mínimo informando o valor mínimo", () => {
		const result = validateBid(
			context(
				{ amountCents: 15_500 },
				{ currentBidCents: 15_000, leaderId: "outro" },
			),
		);
		expect(result).toMatchObject({
			ok: false,
			code: "BELOW_MINIMUM",
			minimumCents: 16_000,
		});
	});

	it("aceita exatamente lance atual + incremento", () => {
		const result = validateBid(
			context(
				{ amountCents: 16_000 },
				{ currentBidCents: 15_000, leaderId: "outro" },
			),
		);
		expect(result.ok).toBe(true);
	});

	it("não deixa o líder cobrir o próprio lance", () => {
		const result = validateBid(
			context(
				{ amountCents: 50_000 },
				{ currentBidCents: 15_000, leaderId: "bidder-1" },
			),
		);
		expect(result).toMatchObject({ ok: false, code: "ALREADY_WINNING" });
	});

	it("recusa lote ainda não iniciado", () => {
		const result = validateBid(context({}, { startsAt: minutes(5) }));
		expect(result).toMatchObject({ ok: false, code: "LOT_NOT_STARTED" });
	});

	it("recusa lote já encerrado (no instante exato do fim)", () => {
		expect(validateBid(context({}, { endsAt: NOW }))).toMatchObject({
			ok: false,
			code: "LOT_ENDED",
		});
		expect(validateBid(context({}, { status: "SETTLED" }))).toMatchObject({
			ok: false,
			code: "LOT_ENDED",
		});
	});

	it("recusa lote cancelado", () => {
		expect(validateBid(context({}, { status: "CANCELLED" }))).toMatchObject({
			ok: false,
			code: "LOT_CANCELLED",
		});
	});

	it("leiloeiro não pode dar lances", () => {
		const result = validateBid(
			context({ bidder: { id: "x", role: "AUCTIONEER", balanceCents: 1e9 } }),
		);
		expect(result).toMatchObject({ ok: false, code: "NOT_A_BIDDER" });
	});

	it("considera o saldo comprometido em outros lotes", () => {
		const result = validateBid(
			context({ amountCents: 30_000, committedElsewhereCents: 80_000 }),
		);
		expect(result).toMatchObject({
			ok: false,
			code: "INSUFFICIENT_FUNDS",
			availableCents: 20_000,
		});
	});

	it("aceita usar exatamente todo o saldo disponível", () => {
		const result = validateBid(
			context({ amountCents: 20_000, committedElsewhereCents: 80_000 }),
		);
		expect(result.ok).toBe(true);
	});

	it.each([
		0,
		-100,
		10.5,
		Number.NaN,
		"10000",
		null,
	])("recusa valor inválido: %s", (amountCents) => {
		expect(validateBid(context({ amountCents }))).toMatchObject({
			ok: false,
			code: "INVALID_AMOUNT",
		});
	});
});

describe("applyAntiSniping", () => {
	it("lance nos últimos 2 minutos prorroga o fim em +2 minutos", () => {
		const endsAt = minutes(1);
		const result = applyAntiSniping(endsAt, NOW);
		expect(result.extended).toBe(true);
		expect(result.endsAt.getTime()).toBe(
			endsAt.getTime() + ANTI_SNIPING_EXTENSION_MS,
		);
	});

	it("lance com exatamente 2 minutos restantes também prorroga", () => {
		expect(applyAntiSniping(minutes(2), NOW).extended).toBe(true);
	});

	it("lance antes da janela final não prorroga", () => {
		const endsAt = minutes(10);
		expect(applyAntiSniping(endsAt, NOW)).toEqual({ endsAt, extended: false });
	});
});
