import {
	ArrowDownLeft,
	ArrowUpRight,
	Lock,
	PiggyBank,
	Plus,
	Wallet as WalletIcon,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import Layout, { PageHeader } from '../components/layout/Layout';
import Button from '../components/ui/Button';
import Card, { StatCard } from '../components/ui/Card';
import Input from '../components/ui/Input';
import { PageLoader } from '../components/ui/Spinner';
import { useWallet } from '../context/WalletContext';
import { getErrorMessage } from '../lib/errors';
import { formatBRL, formatDateTime, parseBRL } from '../lib/format';
import api from '../services/api';
import type { Wallet as WalletType } from '../types';

const QUICK_DEPOSITS = [1_000_00, 10_000_00, 50_000_00];

const ENTRY_LABELS = {
	DEPOSIT: 'Depósito simulado',
	PURCHASE: 'Arremate',
	SALE: 'Venda',
};

export default function Wallet() {
	const { wallet, refreshWallet, setWallet } = useWallet();
	const [amount, setAmount] = useState('');
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		refreshWallet();
	}, [refreshWallet]);

	async function deposit(amountCents: number | null) {
		if (!amountCents || amountCents <= 0) {
			toast.error('Informe um valor válido.');
			return;
		}
		setLoading(true);
		try {
			const response = await api.post<WalletType>('/wallet/deposit', { amountCents });
			setWallet(response.data);
			setAmount('');
			toast.success(`Depósito de ${formatBRL(amountCents)} realizado!`);
		} catch (error) {
			toast.error(getErrorMessage(error, 'Erro ao depositar'));
		} finally {
			setLoading(false);
		}
	}

	function handleSubmit(event: FormEvent) {
		event.preventDefault();
		deposit(parseBRL(amount));
	}

	if (!wallet) {
		return (
			<Layout>
				<PageLoader />
			</Layout>
		);
	}

	return (
		<Layout>
			<PageHeader
				title="Carteira"
				description="O valor dos lotes que você está liderando fica comprometido. Se for superado, volta na hora para o disponível."
			/>

			<div className="grid gap-4 sm:grid-cols-3">
				<StatCard
					label="Saldo total"
					value={formatBRL(wallet.totalCents)}
					icon={<WalletIcon className="size-5" />}
				/>
				<StatCard
					label="Comprometido em lances"
					value={formatBRL(wallet.committedCents)}
					hint={`${wallet.commitments.length} ${wallet.commitments.length === 1 ? 'lote liderado' : 'lotes liderados'}`}
					icon={<Lock className="size-5" />}
					tone="muted"
				/>
				<StatCard
					label="Disponível para lances"
					value={formatBRL(wallet.availableCents)}
					hint="Total − comprometido"
					icon={<PiggyBank className="size-5" />}
					tone="brand"
				/>
			</div>

			<div className="mt-8 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
				<div className="flex flex-col gap-6">
					<Card className="p-6">
						<h2 className="font-serif text-lg font-semibold">Depósito simulado</h2>
						<p className="mt-1 text-sm text-stone-500">Nenhum valor real é movimentado.</p>
						<form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
							<Input
								label="Valor"
								prefix="R$"
								inputMode="decimal"
								placeholder="0,00"
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
								hint="Até R$ 1.000.000,00 por depósito."
							/>
							<div className="grid grid-cols-3 gap-2">
								{QUICK_DEPOSITS.map((value) => (
									<Button
										key={value}
										variant="secondary"
										size="sm"
										disabled={loading}
										onClick={() => deposit(value)}
									>
										+{formatBRL(value).replace(',00', '')}
									</Button>
								))}
							</div>
							<Button type="submit" loading={loading}>
								<Plus className="size-4" /> Depositar
							</Button>
						</form>
					</Card>

					<Card className="p-6">
						<h2 className="font-serif text-lg font-semibold">Valores comprometidos</h2>
						{wallet.commitments.length === 0 ? (
							<p className="mt-3 text-sm text-stone-500">
								Você não está liderando nenhum lote agora.
							</p>
						) : (
							<ul className="mt-3 flex flex-col divide-y divide-stone-200 dark:divide-stone-800">
								{wallet.commitments.map((commitment) => (
									<li
										key={commitment.lotId}
										className="flex items-center justify-between gap-3 py-2.5"
									>
										<Link
											to={`/lotes/${commitment.lotId}`}
											className="line-clamp-1 text-sm hover:underline"
										>
											{commitment.title}
										</Link>
										<span className="font-semibold tabular text-sm">
											{formatBRL(commitment.amountCents)}
										</span>
									</li>
								))}
							</ul>
						)}
					</Card>
				</div>

				<Card className="overflow-hidden">
					<h2 className="px-6 pt-6 font-serif text-lg font-semibold">Extrato</h2>
					{wallet.entries.length === 0 ? (
						<p className="px-6 py-6 text-sm text-stone-500">
							Nenhuma movimentação ainda. Faça um depósito para começar.
						</p>
					) : (
						<div className="mt-3 overflow-x-auto">
							<table className="w-full text-sm">
								<thead className="bg-stone-50 text-left text-xs text-stone-500 uppercase dark:bg-stone-800/50">
									<tr>
										<th className="px-6 py-2 font-medium">Data</th>
										<th className="px-6 py-2 font-medium">Movimentação</th>
										<th className="px-6 py-2 text-right font-medium">Valor</th>
										<th className="px-6 py-2 text-right font-medium">Saldo</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-stone-200 dark:divide-stone-800">
									{wallet.entries.map((entry) => (
										<tr key={entry.id}>
											<td className="px-6 py-3 whitespace-nowrap text-stone-500">
												{formatDateTime(entry.createdAt)}
											</td>
											<td className="px-6 py-3">
												<span className="flex items-center gap-2">
													{entry.amountCents >= 0 ? (
														<ArrowDownLeft className="size-4 text-emerald-600" />
													) : (
														<ArrowUpRight className="size-4 text-red-600" />
													)}
													{entry.lotId ? (
														<Link to={`/lotes/${entry.lotId}`} className="hover:underline">
															{ENTRY_LABELS[entry.type]}
														</Link>
													) : (
														ENTRY_LABELS[entry.type]
													)}
												</span>
											</td>
											<td
												className={`px-6 py-3 text-right font-semibold tabular ${
													entry.amountCents >= 0
														? 'text-emerald-700 dark:text-emerald-400'
														: 'text-red-700 dark:text-red-400'
												}`}
											>
												{entry.amountCents >= 0 ? '+' : '−'}
												{formatBRL(Math.abs(entry.amountCents))}
											</td>
											<td className="px-6 py-3 text-right tabular text-stone-600 dark:text-stone-400">
												{formatBRL(entry.balanceAfterCents)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</Card>
			</div>
		</Layout>
	);
}
