import type { ReactNode } from 'react';
import type { LotPhase } from '../../types';

const styles: Record<LotPhase, { label: string; className: string }> = {
	LIVE: {
		label: 'Ao vivo',
		className:
			'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900',
	},
	SCHEDULED: {
		label: 'Agendado',
		className:
			'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-900',
	},
	CLOSING: {
		label: 'Encerrando',
		className:
			'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900',
	},
	ENDED: {
		label: 'Encerrado',
		className:
			'bg-stone-100 text-stone-600 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700',
	},
	CANCELLED: {
		label: 'Cancelado',
		className:
			'bg-stone-100 text-stone-500 ring-stone-200 line-through dark:bg-stone-800 dark:text-stone-400 dark:ring-stone-700',
	},
};

export default function PhaseBadge({
	phase,
	className = '',
}: {
	phase: LotPhase;
	className?: string;
}) {
	const style = styles[phase];
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.className} ${className}`}
		>
			{phase === 'LIVE' && (
				<span className="relative flex size-2">
					<span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
					<span className="relative inline-flex size-2 rounded-full bg-red-500" />
				</span>
			)}
			{style.label}
		</span>
	);
}

export function Badge({
	children,
	tone = 'stone',
}: {
	children: ReactNode;
	tone?: 'stone' | 'green' | 'red' | 'amber' | 'sky';
}) {
	const tones = {
		stone: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
		green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
		red: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300',
		amber: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
		sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
	};
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
		>
			{children}
		</span>
	);
}
