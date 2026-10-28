import type { Lot } from '../types';
import { useNow } from './useNow';

/** Fase e tempos do lote, recalculados a cada segundo com o relógio do servidor. */
export function useLotTiming(lot: Pick<Lot, 'phase' | 'startsAt' | 'endsAt' | 'status'>) {
	const now = useNow();
	const startsAt = new Date(lot.startsAt).getTime();
	const endsAt = new Date(lot.endsAt).getTime();

	// A fase vem do servidor, mas o relógio local a atualiza entre uma resposta e outra.
	let phase = lot.phase;
	if (lot.status === 'ACTIVE') {
		if (now < startsAt) phase = 'SCHEDULED';
		else if (now < endsAt) phase = 'LIVE';
		else phase = 'CLOSING';
	}

	return {
		phase,
		now,
		msToStart: startsAt - now,
		msToEnd: endsAt - now,
		/** Últimos 2 minutos: lances aqui prorrogam o lote. */
		inExtensionWindow: phase === 'LIVE' && endsAt - now <= 2 * 60 * 1000,
	};
}
