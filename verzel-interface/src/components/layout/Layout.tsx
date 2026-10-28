import type { ReactNode } from 'react';
import Navbar from './Navbar';

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-screen flex-col">
			<Navbar />
			<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
			<footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500 dark:border-stone-800 dark:text-stone-500">
				Obras do acervo público do{' '}
				<a
					href="https://www.artic.edu/open-access/public-api"
					target="_blank"
					rel="noreferrer"
					className="underline hover:text-stone-700 dark:hover:text-stone-300"
				>
					Art Institute of Chicago
				</a>
				. Valores e saldos são simulados.
			</footer>
		</div>
	);
}

export function PageHeader({
	title,
	description,
	actions,
}: {
	title: string;
	description?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
				{description && <p className="mt-2 text-stone-600 dark:text-stone-400">{description}</p>}
			</div>
			{actions && <div className="flex gap-2">{actions}</div>}
		</div>
	);
}
