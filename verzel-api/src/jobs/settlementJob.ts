import { settleDueLots } from "../services/settlementService";

const INTERVAL_MS = 2000;

/** Verifica a cada 2s se há lotes vencidos para liquidar (sem sobrepor execuções). */
export function startSettlementJob() {
	let running = false;

	const tick = async () => {
		if (running) return;
		running = true;
		try {
			await settleDueLots();
		} catch (error) {
			console.error("[settlement] erro no job:", error);
		} finally {
			running = false;
		}
	};

	tick();
	return setInterval(tick, INTERVAL_MS);
}
