import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database";
import { env } from "../config/env";

async function userFromHeader(authHeader?: string) {
	if (!authHeader) return null;
	const [, token] = authHeader.split(" ");
	if (!token) return null;

	const decoded = jwt.verify(token, env.jwtSecret) as { id: string };
	return prisma.user.findUnique({ where: { id: decoded.id } });
}

export const authMiddleware = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	if (!req.headers.authorization) {
		return res.status(401).json({ message: "Token não fornecido" });
	}

	try {
		const user = await userFromHeader(req.headers.authorization);

		if (!user) {
			return res.status(401).json({ message: "Usuário não encontrado" });
		}

		req.user = user;
		next();
	} catch {
		return res.status(401).json({ message: "Token inválido" });
	}
};

/** Para rotas públicas que mudam um pouco quando há alguém logado (ex.: "você está ganhando"). */
export const optionalAuth = async (
	req: Request,
	_res: Response,
	next: NextFunction,
) => {
	try {
		const user = await userFromHeader(req.headers.authorization);
		if (user) req.user = user;
	} catch {
		// Token inválido em rota pública: segue como visitante.
	}
	next();
};
