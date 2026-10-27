import { Router } from "express";
import authRoutes from "./authRoutes";
import catalogRoutes from "./catalogRoutes";
import lotRoutes from "./lotRoutes";
import meRoutes from "./meRoutes";
import publicRoutes from "./publicRoutes";
import sellerRoutes from "./sellerRoutes";
import walletRoutes from "./walletRoutes";

const router = Router();

router.get("/health", (_req, res) => {
	res.json({ status: "ok", time: new Date() });
});

router.use("/auth", authRoutes);
router.use("/lots", lotRoutes);
router.use("/seller", sellerRoutes);
router.use("/me", meRoutes);
router.use("/wallet", walletRoutes);
router.use("/catalog", catalogRoutes);
router.use("/", publicRoutes);

export default router;
