import { Router } from "express";
import { listSellerLotsHandler } from "../controllers/lotController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireRole } from "../middlewares/roleMiddleware";

const router = Router();

router.get(
	"/lots",
	authMiddleware,
	requireRole("AUCTIONEER"),
	listSellerLotsHandler,
);

export default router;
