import { describe, expect, it } from "vitest";
import { bidderAlias } from "../src/utils/alias";
import { getLotPhase } from "../src/utils/lotPhase";

const now = new Date("2026-10-26T12:00:00Z");
const lot = (
	status: "ACTIVE" | "CANCELLED" | "SETTLED",
	startMin: number,
	endMin: number,
) => ({
	status,
	startsAt: new Date(now.getTime() + startMin * 60_000),
	endsAt: new Date(now.getTime() + endMin * 60_000),
});

describe("getLotPhase", () => {
	it("deriva a fase a partir do status e das datas", () => {
		expect(getLotPhase(lot("ACTIVE", 10, 20), now)).toBe("SCHEDULED");
		expect(getLotPhase(lot("ACTIVE", -10, 20), now)).toBe("LIVE");
		expect(getLotPhase(lot("ACTIVE", -20, -1), now)).toBe("CLOSING");
		expect(getLotPhase(lot("SETTLED", -20, -1), now)).toBe("ENDED");
		expect(getLotPhase(lot("CANCELLED", -10, 20), now)).toBe("CANCELLED");
	});
});

describe("bidderAlias", () => {
	it("é estável no mesmo lote e diferente entre lotes", () => {
		const a1 = bidderAlias("segredo", "lote-1", "user-1");
		expect(bidderAlias("segredo", "lote-1", "user-1")).toBe(a1);
		expect(bidderAlias("segredo", "lote-2", "user-1")).not.toBe(a1);
		expect(a1).toMatch(/^Licitante [0-9A-F]{6}$/);
	});

	it("não contém o id do usuário", () => {
		expect(bidderAlias("segredo", "lote-1", "user-1")).not.toContain("user-1");
	});
});
