import {
	bidPayload,
	genesisPayload,
	sealPayload,
	sha256Hex,
	verifyMessage,
} from "./chain";

export interface AuditLot {
	id: string;
	itemId: string;
	sellerId: string;
	startingBidCents: number;
	minIncrementCents: number;
	startsAt: Date;
	endsAt: Date;
	originalEndsAt: Date;
	status: string;
	bidCount: number;
	currentBidCents: number | null;
	genesisHash: string;
	headHash: string;
	sealSignature: string;
	winnerAlias: string | null;
	finalPriceCents: number | null;
}

export interface AuditBid {
	seq: number;
	bidderAlias: string;
	amountCents: number;
	placedAt: Date;
	prevHash: string;
	hash: string;
	signature: string;
}

export interface AuditCheck {
	key: string;
	label: string;
	ok: boolean;
	detail?: string;
}

export interface AuditBidResult {
	seq: number;
	ok: boolean;
	problems: string[];
}

export interface AuditReport {
	intact: boolean;
	checks: AuditCheck[];
	bids: AuditBidResult[];
}

/**
 * Recalcula toda a cadeia do lote e confere assinaturas e regras do leilão.
 * `bids` deve vir ordenado por seq.
 */
export function verifyLotChain(
	lot: AuditLot,
	bids: AuditBid[],
	publicKeyHex: string,
): AuditReport {
	const checks: AuditCheck[] = [];
	const bidResults: AuditBidResult[] = bids.map((bid) => ({
		seq: bid.seq,
		ok: true,
		problems: [],
	}));

	const flag = (index: number, problem: string) => {
		const result = bidResults[index];
		if (!result) return;
		result.ok = false;
		result.problems.push(problem);
	};

	// 1. Gênesis: os parâmetros do lote batem com o primeiro elo?
	const genesisOk =
		sha256Hex(genesisPayload({ ...lot, lotId: lot.id })) === lot.genesisHash;
	checks.push({
		key: "genesis",
		label:
			"Parâmetros do lote (lance inicial, incremento, datas) não foram alterados",
		ok: genesisOk,
	});

	// 2. Encadeamento, hashes e assinaturas de cada lance
	let expectedPrev = lot.genesisHash;
	let sequenceOk = true;
	let linksOk = true;
	let hashesOk = true;
	let signaturesOk = true;

	bids.forEach((bid, index) => {
		if (bid.seq !== index + 1) {
			sequenceOk = false;
			flag(index, `Numeração fora de ordem (esperado #${index + 1})`);
		}

		if (bid.prevHash !== expectedPrev) {
			linksOk = false;
			flag(
				index,
				"Não aponta para o lance anterior (lance removido ou inserido)",
			);
		}

		const recomputed = sha256Hex(
			bidPayload({
				lotId: lot.id,
				seq: bid.seq,
				bidderAlias: bid.bidderAlias,
				amountCents: bid.amountCents,
				placedAt: bid.placedAt,
				prevHash: bid.prevHash,
			}),
		);
		if (recomputed !== bid.hash) {
			hashesOk = false;
			flag(index, "Conteúdo alterado (hash não confere)");
		}

		if (!verifyMessage(publicKeyHex, bid.hash, bid.signature)) {
			signaturesOk = false;
			flag(index, "Assinatura inválida");
		}

		expectedPrev = bid.hash;
	});

	checks.push({
		key: "sequence",
		label: "Numeração dos lances é contínua",
		ok: sequenceOk,
	});
	checks.push({
		key: "links",
		label:
			"Cada lance aponta para o anterior (nada removido ou inserido no meio)",
		ok: linksOk,
	});
	checks.push({
		key: "hashes",
		label: "Conteúdo de cada lance confere com o seu hash",
		ok: hashesOk,
	});
	checks.push({
		key: "signatures",
		label: "Todos os lances têm assinatura válida da casa de leilões",
		ok: signaturesOk,
	});

	// 3. Selo do lote: amarra a quantidade de lances, o último elo e o resultado
	const lastHash =
		bids.length > 0 ? (bids[bids.length - 1]?.hash ?? "") : lot.genesisHash;
	const sealMatchesChain =
		lot.bidCount === bids.length && lot.headHash === lastHash;
	const sealSigned = verifyMessage(
		publicKeyHex,
		sealPayload({
			lotId: lot.id,
			bidCount: lot.bidCount,
			headHash: lot.headHash,
			status: lot.status,
			endsAt: lot.endsAt,
			winnerAlias: lot.winnerAlias,
			finalPriceCents: lot.finalPriceCents,
		}),
		lot.sealSignature,
	);
	checks.push({
		key: "seal",
		label:
			"Selo do lote confere (nenhum lance removido do final, resultado e prazo intactos)",
		ok: sealMatchesChain && sealSigned,
		detail: !sealMatchesChain
			? `O selo registra ${lot.bidCount} lance(s), mas o histórico tem ${bids.length}`
			: !sealSigned
				? "Assinatura do selo inválida"
				: undefined,
	});

	// 4. Regras do leilão reaplicadas sobre o histórico
	let rulesOk = true;
	bids.forEach((bid, index) => {
		const previous = index > 0 ? bids[index - 1] : undefined;
		const minimum = previous
			? previous.amountCents + lot.minIncrementCents
			: lot.startingBidCents;

		if (bid.amountCents < minimum) {
			rulesOk = false;
			flag(index, "Valor abaixo do mínimo permitido naquele momento");
		}
		if (previous && previous.bidderAlias === bid.bidderAlias) {
			rulesOk = false;
			flag(index, "Licitante cobriu o próprio lance");
		}
		if (bid.placedAt < lot.startsAt || bid.placedAt >= lot.endsAt) {
			rulesOk = false;
			flag(index, "Lance fora do horário do lote");
		}
		if (previous && bid.placedAt < previous.placedAt) {
			rulesOk = false;
			flag(index, "Horário anterior ao lance precedente");
		}
	});

	const last = bids[bids.length - 1];
	if (last && lot.currentBidCents !== last.amountCents) rulesOk = false;
	if (lot.status === "SETTLED" && last) {
		if (
			lot.winnerAlias !== last.bidderAlias ||
			lot.finalPriceCents !== last.amountCents
		) {
			rulesOk = false;
		}
	}
	checks.push({
		key: "rules",
		label:
			"Histórico respeita as regras (mínimos, horários, ninguém cobriu o próprio lance)",
		ok: rulesOk,
	});

	return {
		intact: checks.every((check) => check.ok),
		checks,
		bids: bidResults,
	};
}
