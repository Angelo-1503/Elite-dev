import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";

const roleMessages: Record<Role, string> = {
	AUCTIONEER: "Acesso restrito a leiloeiros",
	BIDDER: "Acesso restrito a licitantes",
};

export const requireRole = (role: Role) => {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!req.user) {
			return res.status(401).json({ message: "Usuário não autenticado" });
		}

		if (req.user.role !== role) {
			return res
				.status(403)
				.json({ message: roleMessages[role], code: "FORBIDDEN_ROLE" });
		}

		next();
	};
};
