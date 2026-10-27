import { Router } from "express";
import {
	cancelLotHandler,
	createLotHandler,
	getLotById,
	listLots,
	placeBidHandler,
} from "../controllers/lotController";
import { authMiddleware, optionalAuth } from "../middlewares/authMiddleware";
import { bidLimiter } from "../middlewares/rateLimit";
import { requireRole } from "../middlewares/roleMiddleware";

const router = Router();

router.get("/", listLots);
router.get("/:id", optionalAuth, getLotById);
router.post("/", authMiddleware, requireRole("AUCTIONEER"), createLotHandler);
router.post(
	"/:id/cancel",
	authMiddleware,
	requireRole("AUCTIONEER"),
	cancelLotHandler,
);
router.post(
	"/:id/bids",
	authMiddleware,
	requireRole("BIDDER"),
	bidLimiter,
	placeBidHandler,
);

export default router;
