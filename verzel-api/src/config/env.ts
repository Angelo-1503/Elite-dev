import dotenv from "dotenv";

dotenv.config({ quiet: true });

const isProduction = process.env.NODE_ENV === "production";

// Em desenvolvimento usamos valores padrão para facilitar o setup; em produção
// os segredos são obrigatórios (sem eles, qualquer um poderia forjar a cadeia de lances).
function secret(name: string, devFallback: string): string {
	const value = process.env[name];
	if (value) return value;
	if (isProduction) {
		throw new Error(`Variável de ambiente ${name} é obrigatória em produção`);
	}
	console.warn(`[env] ${name} não definida — usando valor de desenvolvimento`);
	return devFallback;
}

/**
 * Origens liberadas no CORS (HTTP e Socket.IO). "*" libera qualquer origem; numa
 * lista o "*" seria comparado como texto, então ele vira `true` aqui. A barra final
 * é removida porque o navegador envia a origem sem ela.
 */
function parseCorsOrigins(value: string): true | string[] {
	const origins = value
		.split(",")
		.map((origin) => origin.trim().replace(/\/+$/, ""))
		.filter(Boolean);
	return origins.includes("*") ? true : origins;
}

export const env = {
	isProduction,
	port: Number(process.env.PORT) || 3000,
	corsOrigins: parseCorsOrigins(
		process.env.CORS_ORIGIN ?? "http://localhost:5173",
	),
	jwtSecret: secret("JWT_SECRET", "dev-jwt-secret"),
	aliasSecret: secret("ALIAS_SECRET", "dev-alias-secret"),
	signingKeySeed: secret(
		"SIGNING_KEY_SEED",
		"0000000000000000000000000000000000000000000000000000000000000001",
	),
	aicUserAgent:
		process.env.AIC_USER_AGENT ?? "verzel-leiloes (teste tecnico Elite Dev)",
};
