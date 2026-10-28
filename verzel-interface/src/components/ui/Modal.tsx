import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface ModalProps {
	open: boolean;
	title: string;
	onClose: () => void;
	children: ReactNode;
}

export default function Modal({ open, title, onClose, children }: ModalProps) {
	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button
				type="button"
				aria-label="Fechar"
				className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
				onClick={onClose}
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-800 dark:bg-stone-900"
			>
				<div className="mb-4 flex items-start justify-between gap-4">
					<h2 className="font-serif text-xl font-semibold">{title}</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Fechar"
						className="rounded-md p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
					>
						<X className="size-5" />
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}
