import { useLotTiming } from '../../hooks/useLotTiming';
import { formatCountdown } from '../../lib/format';
import type { Lot } from '../../types';

export default function Countdown({
	lot,
}: {
	lot: Pick<Lot, 'phase' | 'startsAt' | 'endsAt' | 'status'>;
}) {
	const { phase, msToStart, msToEnd, inExtensionWindow } = useLotTiming(lot);

	if (phase === 'SCHEDULED') {
		return (
			<span className="tabular">
				Começa em <strong>{formatCountdown(msToStart)}</strong>
			</span>
		);
	}

	if (phase === 'LIVE') {
		return (
			<span className={`tabular ${inExtensionWindow ? 'text-red-600 dark:text-red-400' : ''}`}>
				Termina em <strong>{formatCountdown(msToEnd)}</strong>
			</span>
		);
	}

	if (phase === 'CLOSING') return <span>Encerrando…</span>;
	if (phase === 'CANCELLED') return <span>Cancelado</span>;
	return <span>Encerrado</span>;
}
