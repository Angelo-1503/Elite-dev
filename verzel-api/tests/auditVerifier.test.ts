import crypto from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
	type AuditBid,
	type AuditLot,
	verifyLotChain,
} from "../src/utils/auditVerifier";
import {
	bidPayload,
	genesisPayload,
	keysFromSeed,
	sealPayload,
	sha256Hex,
	signMessage,
} from "../src/utils/chain";

const keys = keysFromSeed("11".repeat(32));
const otherKeys = keysFromSeed("22".repeat(32));

const t0 = new Date("2026-10-26T10:00:00Z");
const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

/** Monta um lote com uma cadeia válida, exatamente como o servidor faz. */
function buildLot(
	bidsSpec: { alias: string; amount: number; minute: number }[],
) {
	const base = {
		id: crypto.randomUUID(),
		itemId: "item-1",
		sellerId: "seller-1",
		startingBidCents: 10_000,
		minIncrementCents: 1_000,
		startsAt: at(0),
		originalEndsAt: at(120),
	};
	const genesisHash = sha256Hex(genesisPayload({ ...base, lotId: base.id }));

	let prevHash = genesisHash;
	const bids: AuditBid[] = bidsSpec.map((spec, index) => {
		const link = {
			lotId: base.id,
			seq: index + 1,
			bidderAlias: spec.alias,
			amountCents: spec.amount,
			placedAt: at(spec.minute),
			prevHash,
		};
		const hash = sha256Hex(bidPayload(link));
		prevHash = hash;
		return { ...link, hash, signature: signMessage(keys.privateKey, hash) };
	});

	const last = bids[bids.length - 1];
	const lot: AuditLot = {
		...base,
		endsAt: at(120),
		status: "ACTIVE",
		bidCount: bids.length,
		currentBidCents: last?.amountCents ?? null,
		genesisHash,
		headHash: prevHash,
		sealSignature: "",
		winnerAlias: null,
		finalPriceCents: null,
	};
	lot.sealSignature = reseal(lot);
	return { lot, bids };
}

function reseal(lot: AuditLot, privateKey = keys.privateKey) {
	return signMessage(
		privateKey,
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

const failedChecks = (report: ReturnType<typeof verifyLotChain>) =>
	report.checks.filter((check) => !check.ok).map((check) => check.key);

describe("verifyLotChain", () => {
	let lot: AuditLot;
	let bids: AuditBid[];

	beforeEach(() => {
		({ lot, bids } = buildLot([
			{ alias: "Licitante AAAAAA", amount: 10_000, minute: 5 },
			{ alias: "Licitante BBBBBB", amount: 12_000, minute: 10 },
			{ alias: "Licitante AAAAAA", amount: 13_000, minute: 15 },
		]));
	});

	it("cadeia sem alterações é íntegra", () => {
		const report = verifyLotChain(lot, bids, keys.publicKeyHex);
		expect(report.intact).toBe(true);
		expect(report.bids.every((bid) => bid.ok)).toBe(true);
	});

	it("lote sem lances também é íntegro", () => {
		const empty = buildLot([]);
		expect(
			verifyLotChain(empty.lot, empty.bids, keys.publicKeyHex).intact,
		).toBe(true);
	});

	it("detecta alteração do valor de um lance", () => {
		bids[1] = { ...bids[1]!, amountCents: 11_000 };
		const report = verifyLotChain(lot, bids, keys.publicKeyHex);
		expect(report.intact).toBe(false);
		expect(failedChecks(report)).toContain("hashes");
		expect(report.bids[1]?.ok).toBe(false);
	});

	it("detecta alteração com hash recalculado (sem a chave não há assinatura válida)", () => {
		const forged = { ...bids[1]!, amountCents: 11_000 };
		forged.hash = sha256Hex(bidPayload({ ...forged, lotId: lot.id }));
		bids[1] = forged;
		const report = verifyLotChain(lot, bids, keys.publicKeyHex);
		expect(failedChecks(report)).toEqual(
			expect.arrayContaining(["signatures", "links"]),
		);
	});

	it("detecta remoção de um lance do meio", () => {
		bids.splice(1, 1);
		const report = verifyLotChain(lot, bids, keys.publicKeyHex);
		expect(failedChecks(report)).toEqual(
			expect.arrayContaining(["sequence", "links", "seal"]),
		);
	});

	it("detecta remoção do último lance mesmo ajustando a cabeça no lote", () => {
		bids.pop();
		lot = {
			...lot,
			bidCount: 2,
			headHash: bids[1]!.hash,
			currentBidCents: 12_000,
		};
		expect(
			failedChecks(verifyLotChain(lot, bids, keys.publicKeyHex)),
		).toContain("seal");
	});

	it("detecta inserção de um lance assinado com outra chave", () => {
		const fake = {
			...bids[2]!,
			seq: 4,
			amountCents: 20_000,
			prevHash: bids[2]!.hash,
		};
		fake.hash = sha256Hex(bidPayload({ ...fake, lotId: lot.id }));
		fake.signature = signMessage(otherKeys.privateKey, fake.hash);
		bids.push(fake);
		lot = { ...lot, bidCount: 4, headHash: fake.hash, currentBidCents: 20_000 };
		lot.sealSignature = reseal(lot, otherKeys.privateKey);
		const report = verifyLotChain(lot, bids, keys.publicKeyHex);
		expect(failedChecks(report)).toEqual(
			expect.arrayContaining(["signatures", "seal"]),
		);
	});

	it("detecta alteração dos parâmetros do lote", () => {
		lot = { ...lot, startingBidCents: 1_000 };
		expect(
			failedChecks(verifyLotChain(lot, bids, keys.publicKeyHex)),
		).toContain("genesis");
	});

	it("detecta prorrogação do prazo direto no banco", () => {
		lot = { ...lot, endsAt: at(500) };
		expect(
			failedChecks(verifyLotChain(lot, bids, keys.publicKeyHex)),
		).toContain("seal");
	});

	it("detecta resultado de arremate adulterado", () => {
		lot = {
			...lot,
			status: "SETTLED",
			winnerAlias: "Licitante AAAAAA",
			finalPriceCents: 13_000,
		};
		lot.sealSignature = reseal(lot);
		expect(verifyLotChain(lot, bids, keys.publicKeyHex).intact).toBe(true);

		lot = { ...lot, winnerAlias: "Licitante BBBBBB" };
		expect(failedChecks(verifyLotChain(lot, bids, keys.publicKeyHex))).toEqual(
			expect.arrayContaining(["seal", "rules"]),
		);
	});

	it("aponta violação de regra mesmo com cadeia assinada (licitante cobrindo o próprio lance)", () => {
		const bad = buildLot([
			{ alias: "Licitante AAAAAA", amount: 10_000, minute: 5 },
			{ alias: "Licitante AAAAAA", amount: 11_000, minute: 6 },
		]);
		const report = verifyLotChain(bad.lot, bad.bids, keys.publicKeyHex);
		expect(failedChecks(report)).toEqual(["rules"]);
		expect(report.bids[1]?.problems).toContain(
			"Licitante cobriu o próprio lance",
		);
	});
});

describe("keysFromSeed", () => {
	it("gera sempre a mesma chave pública para a mesma semente", () => {
		expect(keysFromSeed("11".repeat(32)).publicKeyHex).toBe(keys.publicKeyHex);
		expect(keys.publicKeyHex).toHaveLength(64);
	});

	it("aceita semente em texto livre, derivando a chave de forma estável", () => {
		const fromText = keysFromSeed("segredo-qualquer-do-render");
		expect(fromText.publicKeyHex).toHaveLength(64);
		expect(keysFromSeed("segredo-qualquer-do-render").publicKeyHex).toBe(
			fromText.publicKeyHex,
		);
		expect(() => keysFromSeed("")).toThrow();
	});
});
