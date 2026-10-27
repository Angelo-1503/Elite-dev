import crypto from "node:crypto";

/**
 * Histórico à prova de adulteração
 * ================================
 * Cada lote tem uma cadeia de hashes (como um mini-blockchain sem mineração):
 *
 *   gênesis = SHA-256(parâmetros do lote)
 *   lance n = SHA-256(lote, n, pseudônimo, valor, horário, hash do lance n-1)
 *
 * Alterar, remover ou inserir um lance quebra o encadeamento a partir dali.
 * Só o hash não basta (quem tem acesso ao banco poderia recalcular tudo), então
 * cada elo e o "selo" do lote (contagem de lances + último hash + resultado) são
 * assinados com Ed25519. A chave privada fica só no servidor (variável de ambiente);
 * a pública é publicada, então qualquer pessoa consegue verificar — inclusive o
 * navegador na página de auditoria, sem confiar na resposta do servidor.
 *
 * Os payloads são serializados com JSON.stringify de um array (ordem fixa e sem
 * ambiguidade de separadores), e o front reproduz exatamente o mesmo formato.
 */
export const CHAIN_VERSION = "v1";

export function sha256Hex(data: string) {
	return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

export interface GenesisInput {
	lotId: string;
	itemId: string;
	sellerId: string;
	startingBidCents: number;
	minIncrementCents: number;
	startsAt: Date;
	originalEndsAt: Date;
}

export function genesisPayload(g: GenesisInput) {
	return JSON.stringify([
		"genesis",
		CHAIN_VERSION,
		g.lotId,
		g.itemId,
		g.sellerId,
		g.startingBidCents,
		g.minIncrementCents,
		g.startsAt.toISOString(),
		g.originalEndsAt.toISOString(),
	]);
}

export interface BidLinkInput {
	lotId: string;
	seq: number;
	bidderAlias: string;
	amountCents: number;
	placedAt: Date;
	prevHash: string;
}

export function bidPayload(b: BidLinkInput) {
	return JSON.stringify([
		"bid",
		CHAIN_VERSION,
		b.lotId,
		b.seq,
		b.bidderAlias,
		b.amountCents,
		b.placedAt.toISOString(),
		b.prevHash,
	]);
}

export interface SealInput {
	lotId: string;
	bidCount: number;
	headHash: string;
	status: string;
	endsAt: Date;
	winnerAlias: string | null;
	finalPriceCents: number | null;
}

/** O selo amarra o estado final do lote: impede truncar o fim da cadeia ou mudar o resultado. */
export function sealPayload(s: SealInput) {
	return JSON.stringify([
		"seal",
		CHAIN_VERSION,
		s.lotId,
		s.bidCount,
		s.headHash,
		s.status,
		s.endsAt.toISOString(),
		s.winnerAlias,
		s.finalPriceCents,
	]);
}

export interface ReceiptInput {
	receiptId: string;
	lotId: string;
	lotTitle: string;
	winnerAlias: string;
	amountCents: number;
	headHash: string;
	issuedAt: Date;
}

export function receiptPayload(r: ReceiptInput) {
	return JSON.stringify([
		"receipt",
		CHAIN_VERSION,
		r.receiptId,
		r.lotId,
		r.lotTitle,
		r.winnerAlias,
		r.amountCents,
		r.headHash,
		r.issuedAt.toISOString(),
	]);
}

// ---------------------------------------------------------------------------
// Ed25519
// ---------------------------------------------------------------------------

// Prefixos DER fixos para montar chaves Ed25519 a partir dos 32 bytes crus.
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export interface SigningKeys {
	privateKey: crypto.KeyObject;
	/** Chave pública crua (32 bytes) em hex — é o que o front usa para verificar. */
	publicKeyHex: string;
}

/**
 * Semente de 32 bytes: usa os 64 caracteres hex diretamente ou, para qualquer
 * outro texto (ex.: valor gerado pelo Render), deriva com SHA-256.
 */
export function keysFromSeed(secret: string): SigningKeys {
	if (!secret) throw new Error("SIGNING_KEY_SEED não pode ser vazio");
	const seed = /^[0-9a-f]{64}$/i.test(secret)
		? Buffer.from(secret, "hex")
		: crypto.createHash("sha256").update(secret, "utf8").digest();

	const privateKey = crypto.createPrivateKey({
		key: Buffer.concat([PKCS8_PREFIX, seed]),
		format: "der",
		type: "pkcs8",
	});
	const spki = crypto
		.createPublicKey(privateKey)
		.export({ format: "der", type: "spki" });

	return { privateKey, publicKeyHex: spki.subarray(-32).toString("hex") };
}

export function signMessage(privateKey: crypto.KeyObject, message: string) {
	return crypto
		.sign(null, Buffer.from(message, "utf8"), privateKey)
		.toString("hex");
}

export function verifyMessage(
	publicKeyHex: string,
	message: string,
	signatureHex: string,
) {
	try {
		const publicKey = crypto.createPublicKey({
			key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]),
			format: "der",
			type: "spki",
		});
		return crypto.verify(
			null,
			Buffer.from(message, "utf8"),
			publicKey,
			Buffer.from(signatureHex, "hex"),
		);
	} catch {
		return false;
	}
}
