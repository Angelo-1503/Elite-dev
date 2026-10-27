/**
 * Sobe um PostgreSQL 17 real, embutido via npm (sem Docker e sem instalar nada),
 * na porta 5433 com usuário/senha postgres/postgres e banco verzel_leiloes.
 * Os dados ficam em .pgdata/. Deixe este terminal aberto enquanto desenvolve.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(".pgdata");
const firstRun = !existsSync(dataDir);

const pg = new EmbeddedPostgres({
	databaseDir: dataDir,
	user: "postgres",
	password: "postgres",
	port: 5433,
	persistent: true,
	// Sem isso o Windows inicializa o banco em WIN1252 e recusa caracteres como "ū".
	initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

if (firstRun) await pg.initialise();
await pg.start();

try {
	await pg.createDatabase("verzel_leiloes");
	console.log("Banco verzel_leiloes criado");
} catch {
	// Já existe.
}

console.log(
	"Postgres rodando em postgres://postgres:postgres@localhost:5433/verzel_leiloes (Ctrl+C para parar)",
);

const stop = async () => {
	await pg.stop();
	process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
