import crypto from "node:crypto";

/**
 * Pseudônimo do licitante em um lote: "Licitante 3FA2C1".
 *
 * É um HMAC de (lote, usuário) com um segredo do servidor, então:
 * - é estável dentro do lote (dá para acompanhar a disputa);
 * - muda de lote para lote (não dá para rastrear a pessoa entre leilões);
 * - não revela nome/e-mail e não pode ser revertido sem o segredo.
 */
export function bidderAlias(secret: string, lotId: string, userId: string) {
	const digest = crypto
		.createHmac("sha256", secret)
		.update(`${lotId}:${userId}`)
		.digest("hex");

	return `Licitante ${digest.slice(0, 6).toUpperCase()}`;
}
