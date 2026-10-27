import { Router } from "express";
import {
	getCatalogArtwork,
	searchCatalog,
} from "../controllers/catalogController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireRole } from "../middlewares/roleMiddleware";

const router = Router();

router.get("/search", authMiddleware, requireRole("AUCTIONEER"), searchCatalog);
router.get(
	"/artworks/:id",
	authMiddleware,
	requireRole("AUCTIONEER"),
	getCatalogArtwork,
);

export default router;
