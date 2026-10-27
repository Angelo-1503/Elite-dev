import { Router } from "express";
import {
	getAudit,
	getPublicKey,
	getReceiptHandler,
} from "../controllers/auditController";
import { getItemImage } from "../controllers/itemController";
import { optionalAuth } from "../middlewares/authMiddleware";

/** Rotas abertas, sem login: imagens, auditoria e comprovantes. */
const router = Router();

router.get("/items/:id/image", getItemImage);
router.get("/audit/public-key", getPublicKey);
router.get("/audit/:lotId", getAudit);
router.get("/receipts/:id", optionalAuth, getReceiptHandler);

export default router;
