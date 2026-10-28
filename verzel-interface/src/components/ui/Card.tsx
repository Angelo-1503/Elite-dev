import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode;
}

export default function Card({ children, className = '', ...props }: CardProps) {
	return (
		<div
			{...props}
			className={`rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900 ${className}`}
		>
			{children}
		</div>
	);
}

export function StatCard({
	label,
	value,
	hint,
	icon,
	tone = 'default',
}: {
	label: string;
	value: ReactNode;
	hint?: ReactNode;
	icon?: ReactNode;
	tone?: 'default' | 'brand' | 'muted';
}) {
	const tones = {
		default: 'text-stone-900 dark:text-stone-50',
		brand: 'text-brand-700 dark:text-brand-300',
		muted: 'text-stone-500 dark:text-stone-400',
	};

	return (
		<Card className="p-5">
			<div className="flex items-center justify-between text-sm text-stone-500 dark:text-stone-400">
				<span>{label}</span>
				{icon}
			</div>
			<p className={`mt-2 text-2xl font-semibold tabular ${tones[tone]}`}>{value}</p>
			{hint && <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{hint}</p>}
		</Card>
	);
}
