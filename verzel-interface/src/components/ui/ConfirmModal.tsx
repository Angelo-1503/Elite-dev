import type { ReactNode } from 'react';
import Button from './Button';
import Modal from './Modal';

interface ConfirmModalProps {
	open: boolean;
	title: string;
	message: ReactNode;
	confirmLabel?: string;
	danger?: boolean;
	loading?: boolean;
	onConfirm: () => void;
	onClose: () => void;
}

export default function ConfirmModal({
	open,
	title,
	message,
	confirmLabel = 'Confirmar',
	danger = false,
	loading = false,
	onConfirm,
	onClose,
}: ConfirmModalProps) {
	return (
		<Modal open={open} title={title} onClose={onClose}>
			<div className="text-sm text-stone-600 dark:text-stone-300">{message}</div>
			<div className="mt-6 flex justify-end gap-3">
				<Button variant="secondary" onClick={onClose} disabled={loading}>
					Voltar
				</Button>
				<Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
					{confirmLabel}
				</Button>
			</div>
		</Modal>
	);
}
