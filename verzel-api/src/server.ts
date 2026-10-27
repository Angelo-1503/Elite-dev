import "./config/env";
import { createServer } from "node:http";
import app from "./app";
import { prisma } from "./config/database";
import { env } from "./config/env";
import { startSettlementJob } from "./jobs/settlementJob";
import { initRealtime } from "./services/realtime";

const server = createServer(app);
initRealtime(server);

prisma
	.$connect()
	.then(() => {
		console.log("Banco conectado com sucesso");
		startSettlementJob();
		server.listen(env.port, () => {
			console.log(`Servidor rodando na porta ${env.port}`);
		});
	})
	.catch((err) => {
		console.error("Erro ao conectar no banco:", err);
		process.exit(1);
	});
