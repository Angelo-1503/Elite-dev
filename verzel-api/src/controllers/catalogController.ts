import type { Request, Response } from "express";
import { getArtwork, searchArtworks } from "../services/aicService";
import { handleError } from "../utils/httpError";

export const searchCatalog = async (req: Request, res: Response) => {
	try {
		const query =
			typeof req.query.q === "string" ? req.query.q.slice(0, 100) : "";
		const page = Math.min(100, Math.max(1, Number(req.query.page) || 1));
		return res.json(await searchArtworks(query, page));
	} catch (error) {
		return handleError(res, error, "Erro ao buscar no catálogo");
	}
};

export const getCatalogArtwork = async (req: Request, res: Response) => {
	try {
		const { id } = req.params as { id: string };
		return res.json(await getArtwork(id));
	} catch (error) {
		return handleError(res, error, "Erro ao buscar obra");
	}
};
