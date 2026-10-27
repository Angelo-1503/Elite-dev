import type { Request, Response } from "express";
import { prisma } from "../config/database";

/** Serve a imagem guardada no banco (não depende da API externa estar no ar). */
export const getItemImage = async (req: Request, res: Response) => {
	try {
		const { id } = req.params as { id: string };
		const item = await prisma.item.findUnique({
			where: { id },
			select: { imageData: true, imageMime: true, imageUrl: true },
		});

		if (!item) {
			return res.status(404).json({ message: "Item não encontrado" });
		}

		if (item.imageData) {
			res.setHeader("Content-Type", item.imageMime ?? "image/jpeg");
			res.setHeader("Cache-Control", "public, max-age=86400, immutable");
			return res.send(Buffer.from(item.imageData));
		}

		// Snapshot sem imagem (download falhou na criação): tenta a original.
		if (item.imageUrl) return res.redirect(item.imageUrl);

		return res.status(404).json({ message: "Imagem indisponível" });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Erro ao carregar imagem" });
	}
};
