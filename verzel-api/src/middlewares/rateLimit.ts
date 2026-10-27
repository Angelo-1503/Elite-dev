import { ipKeyGenerator, rateLimit } from "express-rate-limit";

export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 30,
	standardHeaders: "draft-8",
	legacyHeaders: false,
	message: {
		message: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
	},
});

export const bidLimiter = rateLimit({
	windowMs: 10 * 1000,
	limit: 10,
	standardHeaders: "draft-8",
	legacyHeaders: false,
	keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? ""),
	message: { message: "Muitos lances em sequência. Aguarde alguns segundos." },
});
