import type { ReactNode } from 'react';

interface EmptyStateProps {
	icon: ReactNode;
	title: string;
	description?: ReactNode;
	action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 px-6 py-14 text-center dark:border-stone-700">
			<div className="mb-3 text-stone-400">{icon}</div>
			<h3 className="font-serif text-lg font-semibold">{title}</h3>
			{description && (
				<p className="mt-1 max-w-sm text-sm text-stone-500 dark:text-stone-400">{description}</p>
			)}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}
