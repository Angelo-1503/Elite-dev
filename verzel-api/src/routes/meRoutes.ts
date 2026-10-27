import { Router } from "express";
import { listMyBidsHandler } from "../controllers/lotController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireRole } from "../middlewares/roleMiddleware";

const router = Router();

router.get("/bids", authMiddleware, requireRole("BIDDER"), listMyBidsHandler);

export default router;
