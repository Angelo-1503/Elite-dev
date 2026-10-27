import { Router } from "express";
import { depositHandler, getWallet } from "../controllers/walletController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireRole } from "../middlewares/roleMiddleware";

const router = Router();

router.get("/", authMiddleware, requireRole("BIDDER"), getWallet);
router.post("/deposit", authMiddleware, requireRole("BIDDER"), depositHandler);

export default router;
