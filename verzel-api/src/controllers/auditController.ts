import type { Request, Response } from "express";
import { getLotAudit, getReceipt } from "../services/auditService";
import { publicKeyHex } from "../services/chainService";
import { handleError } from "../utils/httpError";

export const getAudit = async (req: Request, res: Response) => {
	try {
		const { lotId } = req.params as { lotId: string };
		res.setHeader("Cache-Control", "no-store");
		return res.json(await getLotAudit(lotId));
	} catch (error) {
		return handleError(res, error, "Erro ao auditar lote");
	}
};

export const getPublicKey = async (_req: Request, res: Response) => {
	return res.json({ algorithm: "Ed25519", publicKey: publicKeyHex });
};

export const getReceiptHandler = async (req: Request, res: Response) => {
	try {
		const { id } = req.params as { id: string };
		return res.json(await getReceipt(id, req.user?.id));
	} catch (error) {
		return handleError(res, error, "Erro ao buscar comprovante");
	}
};
