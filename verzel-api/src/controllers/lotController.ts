import type { Request, Response } from "express";
import { placeBid } from "../services/bidService";
import {
	cancelLot,
	createLot,
	getLotDetail,
	listMyBids,
	listSellerLots,
	listShowcase,
} from "../services/lotService";
import { handleError } from "../utils/httpError";

export const listLots = async (req: Request, res: Response) => {
	try {
		return res.json(await listShowcase(req.query));
	} catch (error) {
		return handleError(res, error, "Erro ao listar lotes");
	}
};

export const getLotById = async (req: Request, res: Response) => {
	try {
		const { id } = req.params as { id: string };
		return res.json(await getLotDetail(id, req.user?.id));
	} catch (error) {
		return handleError(res, error, "Erro ao buscar lote");
	}
};

export const createLotHandler = async (req: Request, res: Response) => {
	try {
		const lot = await createLot(req.user!.id, req.body ?? {});
		return res.status(201).json(lot);
	} catch (error) {
		return handleError(res, error, "Erro ao criar lote");
	}
};

export const cancelLotHandler = async (req: Request, res: Response) => {
	try {
		const { id } = req.params as { id: string };
		return res.json(await cancelLot(req.user!.id, id));
	} catch (error) {
		return handleError(res, error, "Erro ao cancelar lote");
	}
};

export const placeBidHandler = async (req: Request, res: Response) => {
	try {
		const { id } = req.params as { id: string };
		const result = await placeBid(req.user!.id, id, req.body?.amountCents);
		return res.status(201).json(result);
	} catch (error) {
		return handleError(res, error, "Erro ao registrar lance");
	}
};

export const listSellerLotsHandler = async (req: Request, res: Response) => {
	try {
		return res.json(await listSellerLots(req.user!.id));
	} catch (error) {
		return handleError(res, error, "Erro ao listar seus lotes");
	}
};

export const listMyBidsHandler = async (req: Request, res: Response) => {
	try {
		return res.json(await listMyBids(req.user!.id));
	} catch (error) {
		return handleError(res, error, "Erro ao listar seus lances");
	}
};
