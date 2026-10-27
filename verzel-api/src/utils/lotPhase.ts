import type { LotStatus } from "@prisma/client";

/**
 * Fase do lote do ponto de vista do usuário.
 * CLOSING = já passou do fim, mas o job de liquidação ainda não rodou.
 */
export type LotPhase = "SCHEDULED" | "LIVE" | "CLOSING" | "ENDED" | "CANCELLED";

interface PhaseInput {
	status: LotStatus;
	startsAt: Date;
	endsAt: Date;
}

export function getLotPhase(lot: PhaseInput, now = new Date()): LotPhase {
	if (lot.status === "CANCELLED") return "CANCELLED";
	if (lot.status === "SETTLED") return "ENDED";
	if (now < lot.startsAt) return "SCHEDULED";
	if (now < lot.endsAt) return "LIVE";
	return "CLOSING";
}
