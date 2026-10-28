import type { AuditCheck, AuditResponse, Receipt } from '../types';

/**
 * Verificação independente, feita no navegador com a Web Crypto API.
 * Reproduz exatamente os payloads do backend (src/utils/chain.ts): se alguém
 * adulterar o banco, os hashes/assinaturas não fecham e a página mostra isso
 * sem depender do "veredito" enviado pelo servidor.
 */
const VERSION = 'v1';
const encoder = new TextEncoder();

function hexToBytes(hex: string) {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

async function sha256Hex(text: string) {
	const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

export class UnsupportedCryptoError extends Error {}

async function importPublicKey(publicKeyHex: string) {
	try {
		return await crypto.subtle.importKey(
			'raw',
			hexToBytes(publicKeyHex),
			{ name: 'Ed25519' },
			false,
			['verify'],
		);
	} catch {
		throw new UnsupportedCryptoError('Este navegador não suporta verificação Ed25519.');
	}
}

async function verifySignature(key: CryptoKey, message: string, signatureHex: string) {
	try {
		return await crypto.subtle.verify(
			{ name: 'Ed25519' },
			key,
			hexToBytes(signatureHex),
			encoder.encode(message),
		);
	} catch {
		return false;
	}
}

const iso = (value: string) => new Date(value).toISOString();

export interface BrowserAuditResult {
	intact: boolean;
	checks: AuditCheck[];
	badBids: Set<number>;
}

export async function verifyAuditInBrowser(audit: AuditResponse): Promise<BrowserAuditResult> {
	const { lot, bids } = audit;
	const key = await importPublicKey(audit.publicKey);
	const badBids = new Set<number>();
	const checks: AuditCheck[] = [];

	const genesis = await sha256Hex(
		JSON.stringify([
			'genesis',
			VERSION,
			lot.id,
			lot.itemId,
			lot.sellerId,
			lot.startingBidCents,
			lot.minIncrementCents,
			iso(lot.startsAt),
			iso(lot.originalEndsAt),
		]),
	);
	checks.push({
		key: 'genesis',
		label: 'Parâmetros do lote conferem com o gênesis',
		ok: genesis === lot.genesisHash,
	});

	let expectedPrev = lot.genesisHash;
	let linksOk = true;
	let hashesOk = true;
	let signaturesOk = true;
	let sequenceOk = true;

	for (const [index, bid] of bids.entries()) {
		if (bid.seq !== index + 1) {
			sequenceOk = false;
			badBids.add(bid.seq);
		}
		if (bid.prevHash !== expectedPrev) {
			linksOk = false;
			badBids.add(bid.seq);
		}
		const hash = await sha256Hex(
			JSON.stringify([
				'bid',
				VERSION,
				lot.id,
				bid.seq,
				bid.bidderAlias,
				bid.amountCents,
				iso(bid.placedAt),
				bid.prevHash,
			]),
		);
		if (hash !== bid.hash) {
			hashesOk = false;
			badBids.add(bid.seq);
		}
		if (!(await verifySignature(key, bid.hash, bid.signature))) {
			signaturesOk = false;
			badBids.add(bid.seq);
		}
		expectedPrev = bid.hash;
	}

	checks.push({ key: 'sequence', label: 'Numeração contínua', ok: sequenceOk });
	checks.push({ key: 'links', label: 'Encadeamento entre lances', ok: linksOk });
	checks.push({ key: 'hashes', label: 'Hash de cada lance', ok: hashesOk });
	checks.push({ key: 'signatures', label: 'Assinatura de cada lance', ok: signaturesOk });

	const lastHash = bids.length > 0 ? bids[bids.length - 1].hash : lot.genesisHash;
	const sealSigned = await verifySignature(
		key,
		JSON.stringify([
			'seal',
			VERSION,
			lot.id,
			lot.bidCount,
			lot.headHash,
			lot.status,
			iso(lot.endsAt),
			lot.winnerAlias,
			lot.finalPriceCents,
		]),
		lot.sealSignature,
	);
	checks.push({
		key: 'seal',
		label: 'Selo do lote (quantidade de lances, prazo e resultado)',
		ok: sealSigned && lot.bidCount === bids.length && lot.headHash === lastHash,
	});

	return { intact: checks.every((check) => check.ok), checks, badBids };
}

export interface BrowserReceiptResult {
	signatureValid: boolean;
	/** Os dados exibidos na tela são exatamente os que foram assinados. */
	matchesDisplay: boolean;
}

export async function verifyReceiptInBrowser(receipt: Receipt): Promise<BrowserReceiptResult> {
	const key = await importPublicKey(receipt.publicKey);
	const signatureValid = await verifySignature(key, receipt.payload, receipt.signature);

	let matchesDisplay: boolean;
	try {
		const [kind, version, id, lotId, , winnerAlias, amountCents, headHash] = JSON.parse(
			receipt.payload,
		) as unknown[];
		matchesDisplay =
			kind === 'receipt' &&
			version === VERSION &&
			id === receipt.id &&
			lotId === receipt.lotId &&
			winnerAlias === receipt.winnerAlias &&
			amountCents === receipt.amountCents &&
			headHash === receipt.headHash;
	} catch {
		matchesDisplay = false;
	}

	return { signatureValid, matchesDisplay };
}
