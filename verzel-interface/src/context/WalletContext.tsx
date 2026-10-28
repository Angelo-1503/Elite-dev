import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { formatBRL } from '../lib/format';
import api from '../services/api';
import { getSocket } from '../services/socket';
import type { Wallet } from '../types';
import { useAuth } from './AuthContext';

interface WalletContextType {
	wallet: Wallet | null;
	refreshWallet: () => Promise<void>;
	setWallet: (wallet: Wallet) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

/**
 * Carteira do licitante sempre atualizada: busca ao logar e recebe pelo socket
 * cada mudança (lance dado, superado, arremate, depósito). Também mostra as
 * notificações pessoais em tempo real.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth();
	const [wallet, setWallet] = useState<Wallet | null>(null);
	const isBidder = user?.role === 'BIDDER';

	const refreshWallet = useCallback(async () => {
		if (!isBidder) return;
		try {
			const response = await api.get<Wallet>('/wallet');
			setWallet(response.data);
		} catch {
			// A navbar só não mostra o saldo.
		}
	}, [isBidder]);

	useEffect(() => {
		if (!isBidder) return;
		let active = true;
		api
			.get<Wallet>('/wallet')
			.then((response) => {
				if (active) setWallet(response.data);
			})
			.catch(() => {
				// A navbar só não mostra o saldo.
			});
		return () => {
			active = false;
		};
	}, [isBidder]);

	useEffect(() => {
		if (!user) return;
		const socket = getSocket();

		const onWallet = (data: Wallet) => setWallet(data);
		const onOutbid = (data: { lotId: string; title: string; currentBidCents: number }) => {
			toast(
				(t) => (
					<span>
						Você foi superado em <strong>{data.title}</strong> ({formatBRL(data.currentBidCents)}).{' '}
						<Link
							to={`/lotes/${data.lotId}`}
							onClick={() => toast.dismiss(t.id)}
							className="font-semibold text-brand-700 underline"
						>
							Dar novo lance
						</Link>
					</span>
				),
				{ icon: '⚠️', duration: 8000 },
			);
		};
		const onWon = (data: { lotId: string; title: string; receiptId: string }) => {
			toast.success(
				(t) => (
					<span>
						Você arrematou <strong>{data.title}</strong>!{' '}
						<Link
							to={`/comprovantes/${data.receiptId}`}
							onClick={() => toast.dismiss(t.id)}
							className="font-semibold text-brand-700 underline"
						>
							Ver comprovante
						</Link>
					</span>
				),
				{ duration: 12000 },
			);
		};
		const onCancelled = (data: { title: string; refunded: boolean }) => {
			toast(
				data.refunded
					? `O lote "${data.title}" foi cancelado e o valor do seu lance voltou ao saldo disponível.`
					: `O lote "${data.title}" foi cancelado pelo leiloeiro.`,
				{ icon: 'ℹ️', duration: 8000 },
			);
		};

		socket.on('wallet:updated', onWallet);
		socket.on('bid:outbid', onOutbid);
		socket.on('lot:won', onWon);
		socket.on('notify:lot-cancelled', onCancelled);
		return () => {
			socket.off('wallet:updated', onWallet);
			socket.off('bid:outbid', onOutbid);
			socket.off('lot:won', onWon);
			socket.off('notify:lot-cancelled', onCancelled);
		};
	}, [user]);

	return (
		// Ao sair da conta (ou entrar como leiloeiro), a carteira anterior deixa de valer.
		<WalletContext.Provider value={{ wallet: isBidder ? wallet : null, refreshWallet, setWallet }}>
			{children}
		</WalletContext.Provider>
	);
}

export function useWallet() {
	const context = useContext(WalletContext);
	if (!context) {
		throw new Error('useWallet must be used inside WalletProvider');
	}
	return context;
}
