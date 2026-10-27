import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import router from "./routes/router";

const app = express();

// Atrás do proxy do Render: necessário para o rate limit enxergar o IP real.
app.set("trust proxy", 1);

app.use(
	helmet({
		// As imagens são carregadas pelo front, que roda em outro domínio.
		crossOriginResourcePolicy: { policy: "cross-origin" },
	}),
);
app.use(cors({ origin: env.corsOrigins }));
app.use(express.json({ limit: "100kb" }));

app.use("/api", router);

app.use((_req, res) => {
	res.status(404).json({ message: "Rota não encontrada" });
});

export default app;
