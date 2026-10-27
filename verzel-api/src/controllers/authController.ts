import type { Role, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database";
import { env } from "../config/env";

const ROLES: Role[] = ["AUCTIONEER", "BIDDER"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user: User) {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};
}

function signToken(user: User) {
	return jwt.sign({ id: user.id, role: user.role }, env.jwtSecret, {
		expiresIn: "7d",
	});
}

export const register = async (req: Request, res: Response) => {
	try {
		const { name, email, password, role } = req.body ?? {};

		if (!name || !email || !password || !role) {
			return res.status(400).json({
				message: "Nome, e-mail, senha e tipo de conta são obrigatórios",
			});
		}

		if (
			typeof name !== "string" ||
			name.trim().length < 2 ||
			name.length > 100
		) {
			return res.status(400).json({ message: "Informe um nome válido" });
		}

		if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
			return res.status(400).json({ message: "E-mail inválido" });
		}

		if (typeof password !== "string" || password.length < 6) {
			return res.status(400).json({
				message: "A senha deve ter pelo menos 6 caracteres",
			});
		}

		if (!ROLES.includes(role)) {
			return res.status(400).json({ message: "Tipo de conta inválido" });
		}

		const normalizedEmail = email.trim().toLowerCase();
		const userExists = await prisma.user.findUnique({
			where: { email: normalizedEmail },
		});

		if (userExists) {
			return res.status(400).json({ message: "E-mail já cadastrado" });
		}

		const user = await prisma.user.create({
			data: {
				name: name.trim(),
				email: normalizedEmail,
				password: await bcrypt.hash(password, 10),
				role,
			},
		});

		return res
			.status(201)
			.json({ token: signToken(user), user: publicUser(user) });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Erro ao registrar usuário" });
	}
};

export const login = async (req: Request, res: Response) => {
	try {
		const { email, password } = req.body ?? {};

		if (typeof email !== "string" || typeof password !== "string") {
			return res
				.status(400)
				.json({ message: "E-mail e senha são obrigatórios" });
		}

		const user = await prisma.user.findUnique({
			where: { email: email.trim().toLowerCase() },
		});

		if (!user || !(await bcrypt.compare(password, user.password))) {
			return res.status(400).json({ message: "Credenciais inválidas" });
		}

		return res.json({ token: signToken(user), user: publicUser(user) });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Erro ao fazer login" });
	}
};

export const me = async (req: Request, res: Response) => {
	return res.json({ user: publicUser(req.user as User) });
};
