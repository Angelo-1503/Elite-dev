import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env";

/**
 * Canais:
 * - "lot:<id>": todos que estão na sala do lote (lances novos, prorrogação, encerramento);
 * - "user:<id>": notificações privadas (você foi superado, carteira atualizada).
 */
let io: Server | null = null;

export function initRealtime(httpServer: HttpServer) {
	io = new Server(httpServer, {
		cors: { origin: env.corsOrigins },
	});

	io.on("connection", (socket) => {
		const token = socket.handshake.auth?.token;
		if (typeof token === "string" && token) {
			try {
				const decoded = jwt.verify(token, env.jwtSecret) as { id: string };
				socket.join(`user:${decoded.id}`);
			} catch {
				// Token inválido: segue como visitante (só canais públicos).
			}
		}

		socket.on("lot:join", (lotId: unknown) => {
			if (typeof lotId === "string" && lotId.length <= 64) {
				socket.join(`lot:${lotId}`);
			}
		});

		socket.on("lot:leave", (lotId: unknown) => {
			if (typeof lotId === "string") socket.leave(`lot:${lotId}`);
		});

		// Permite ao cliente sincronizar o relógio da contagem regressiva.
		socket.on("time", (ack: unknown) => {
			if (typeof ack === "function") ack(Date.now());
		});
	});

	return io;
}

export function emitToLot(lotId: string, event: string, payload: unknown) {
	io?.to(`lot:${lotId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
	io?.to(`user:${userId}`).emit(event, payload);
}

/** Avisa a vitrine que algo mudou (ela refaz a busca). */
export function emitShowcaseChanged() {
	io?.emit("showcase:changed");
}
