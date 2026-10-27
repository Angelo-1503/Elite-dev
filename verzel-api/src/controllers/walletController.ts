import type { Request, Response } from "express";
import { deposit, getWalletSummary } from "../services/walletService";
import { handleError } from "../utils/httpError";

export const getWallet = async (req: Request, res: Response) => {
	try {
		return res.json(await getWalletSummary(req.user!.id));
	} catch (error) {
		return handleError(res, error, "Erro ao buscar carteira");
	}
};

export const depositHandler = async (req: Request, res: Response) => {
	try {
		return res
			.status(201)
			.json(await deposit(req.user!.id, req.body?.amountCents));
	} catch (error) {
		return handleError(res, error, "Erro ao realizar depósito");
	}
};
