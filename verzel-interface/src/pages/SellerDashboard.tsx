import {
	Ban,
	CalendarClock,
	CircleDollarSign,
	Gavel,
	PackageCheck,
	PackageX,
	Plus,
	Radio,
	ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import Layout, { PageHeader } from '../components/layout/Layout';
import Countdown from '../components/lots/Countdown';
import LotImage from '../components/lots/LotImage';
import PhaseBadge from '../components/lots/PhaseBadge';
import Button, { ButtonLink } from '../components/ui/Button';
import Card, { StatCard } from '../components/ui/Card';
import ConfirmModal from '../components/ui/ConfirmModal';
import EmptyState from '../components/ui/EmptyState';
import { PageLoader } from '../components/ui/Spinner';
import { useFetch } from '../hooks/useFetch';
import { useLotTiming } from '../hooks/useLotTiming';
import { getErrorMessage } from '../lib/errors';
import { formatBRL, formatDateTime } from '../lib/format';
import api from '../services/api';
import { getSocket } from '../services/socket';
import type { Lot, SellerLotsResponse } from '../types';

type Filter = 'all' | 'active' | 'ended' | 'cancelled';

const FILTERS: { value: Filter; label: string }[] = [
	{ value: 'all', label: 'Todos' },
	{ value: 'active', label: 'Ao vivo e agendados' },
	{ value: 'ended', label: 'Encerrados' },
	{ value: 'cancelled', label: 'Cancelados' },
];

function matchesFilter(lot: Lot, filter: Filter) {
	if (filter === 'all') return true;
	if (filter === 'cancelled') return lot.status === 'CANCELLED';
	if (filter === 'ended') return lot.phase === 'ENDED' || lot.phase === 'CLOSING';
	return lot.phase === 'LIVE' || lot.phase === 'SCHEDULED';
}

function LotRow({ lot, onCancel }: { lot: Lot; onCancel: (lot: Lot) => void }) {
	const { phase } = useLotTiming(lot);
	const cancellable = phase === 'LIVE' || phase === 'SCHEDULED';

	let result: string;
	if (phase === 'ENDED') {
		result = lot.winnerAlias
			? `Arrematado por ${formatBRL(lot.finalPriceCents)}`
			: 'Encerrado sem lances';
	} else if (phase === 'CANCELLED') {
		result = 'Cancelado';
	} else if (lot.currentBidCents) {
		result = `Lance atual ${formatBRL(lot.currentBidCents)}`;
	} else {
		result = `Lance inicial ${formatBRL(lot.startingBidCents)}`;
	}

	return (
		<tr className="align-middle">
			<td className="px-4 py-3">
				<Link to={`/lotes/${lot.id}`} className="flex items-center gap-3">
					<LotImage item={lot.item} alt={lot.title} className="size-12 shrink-0 rounded-lg" />
					<span className="line-clamp-2 font-medium hover:underline">{lot.title}</span>
				</Link>
			</td>
			<td className="px-4 py-3">
				<PhaseBadge phase={phase} />
				<p className="mt-1 text-xs text-stone-500">
					{phase === 'LIVE' || phase === 'SCHEDULED' ? (
						<Countdown lot={lot} />
					) : (
						formatDateTime(lot.endsAt)
					)}
				</p>
			</td>
			<td className="px-4 py-3">
				<p
					className={`font-semibold tabular ${phase === 'ENDED' && lot.winnerAlias ? 'text-emerald-700 dark:text-emerald-400' : ''}`}
				>
					{result}
				</p>
				<p className="text-xs text-stone-500">
					{lot.bidCount} {lot.bidCount === 1 ? 'lance' : 'lances'}
					{lot.winnerAlias && ` · ${lot.winnerAlias}`}
				</p>
			</td>
			<td className="px-4 py-3">
				<div className="flex justify-end gap-2">
					<ButtonLink to={`/auditoria/${lot.id}`} variant="ghost" size="sm" title="Auditoria">
						<ShieldCheck className="size-4" />
					</ButtonLink>
					{cancellable && (
						<Button variant="secondary" size="sm" onClick={() => onCancel(lot)}>
							<Ban className="size-4" /> Cancelar
						</Button>
					)}
				</div>
			</td>
		</tr>
	);
}

export default function SellerDashboard() {
	const { data, error, reload: fetchLots } = useFetch<SellerLotsResponse>('/seller/lots');
	const [filter, setFilter] = useState<Filter>('all');
	const [cancelling, setCancelling] = useState<Lot | null>(null);
	const [loadingCancel, setLoadingCancel] = useState(false);

	useEffect(() => {
		if (error) toast.error(getErrorMessage(error, 'Erro ao carregar seus lotes'));
	}, [error]);

	// Lances, encerramentos e cancelamentos atualizam o painel em tempo real.
	useEffect(() => {
		const socket = getSocket();
		socket.on('showcase:changed', fetchLots);
		return () => {
			socket.off('showcase:changed', fetchLots);
		};
	}, [fetchLots]);

	async function confirmCancel() {
		if (!cancelling) return;
		setLoadingCancel(true);
		try {
			const response = await api.post<{ refundedCents: number }>(`/lots/${cancelling.id}/cancel`);
			toast.success(
				response.data.refundedCents
					? `Lote cancelado. ${formatBRL(response.data.refundedCents)} foram liberados para o licitante líder.`
					: 'Lote cancelado.',
			);
			setCancelling(null);
			fetchLots();
		} catch (error) {
			toast.error(getErrorMessage(error, 'Erro ao cancelar lote'));
		} finally {
			setLoadingCancel(false);
		}
	}

	if (!data) {
		return (
			<Layout>
				<PageLoader />
			</Layout>
		);
	}

	const lots = data.lots.filter((lot) => matchesFilter(lot, filter));
	const { summary } = data;

	return (
		<Layout>
			<PageHeader
				title="Painel do leiloeiro"
				description="Crie lotes a partir do acervo do Art Institute of Chicago e acompanhe os resultados."
				actions={
					<ButtonLink to="/painel/novo-lote">
						<Plus className="size-4" /> Novo lote
					</ButtonLink>
				}
			/>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					label="Total recebido"
					value={formatBRL(summary.totalReceivedCents)}
					icon={<CircleDollarSign className="size-5" />}
					tone="brand"
				/>
				<StatCard
					label="Arrematados"
					value={summary.soldCount}
					hint={`${summary.unsoldCount} encerrado(s) sem lances`}
					icon={<PackageCheck className="size-5" />}
				/>
				<StatCard label="Ao vivo" value={summary.liveCount} icon={<Radio className="size-5" />} />
				<StatCard
					label="Agendados"
					value={summary.scheduledCount}
					hint={`${summary.cancelledCount} cancelado(s)`}
					icon={<CalendarClock className="size-5" />}
				/>
			</div>

			<div className="mt-8 mb-4 flex flex-wrap gap-2">
				{FILTERS.map((item) => (
					<button
						key={item.value}
						type="button"
						onClick={() => setFilter(item.value)}
						className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
							filter === item.value
								? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
								: 'bg-white text-stone-600 ring-1 ring-stone-200 hover:text-stone-900 dark:bg-stone-900 dark:text-stone-400 dark:ring-stone-700'
						}`}
					>
						{item.label}
					</button>
				))}
			</div>

			{data.lots.length === 0 ? (
				<EmptyState
					icon={<Gavel className="size-10" />}
					title="Você ainda não criou lotes"
					description="Busque uma obra no catálogo e defina lance inicial, incremento e horários."
					action={<ButtonLink to="/painel/novo-lote">Criar primeiro lote</ButtonLink>}
				/>
			) : lots.length === 0 ? (
				<EmptyState icon={<PackageX className="size-10" />} title="Nenhum lote neste filtro" />
			) : (
				<Card className="overflow-x-auto">
					<table className="w-full min-w-[720px] text-sm">
						<thead className="bg-stone-50 text-left text-xs text-stone-500 uppercase dark:bg-stone-800/50">
							<tr>
								<th className="px-4 py-3 font-medium">Lote</th>
								<th className="px-4 py-3 font-medium">Situação</th>
								<th className="px-4 py-3 font-medium">Resultado</th>
								<th className="px-4 py-3 text-right font-medium">Ações</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-stone-200 dark:divide-stone-800">
							{lots.map((lot) => (
								<LotRow key={lot.id} lot={lot} onCancel={setCancelling} />
							))}
						</tbody>
					</table>
				</Card>
			)}

			<ConfirmModal
				open={!!cancelling}
				title="Cancelar lote?"
				danger
				confirmLabel="Cancelar lote"
				loading={loadingCancel}
				onClose={() => setCancelling(null)}
				onConfirm={confirmCancel}
				message={
					cancelling && (
						<>
							<p>
								<strong>{cancelling.title}</strong> deixará de aparecer na vitrine e não aceitará
								mais lances.
							</p>
							{cancelling.bidCount > 0 && (
								<p className="mt-2 rounded-lg bg-amber-50 p-3 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
									Este lote já tem {cancelling.bidCount}{' '}
									{cancelling.bidCount === 1 ? 'lance' : 'lances'}. O valor comprometido do
									licitante líder ({formatBRL(cancelling.currentBidCents)}) será estornado
									automaticamente para o saldo disponível dele.
								</p>
							)}
						</>
					)
				}
			/>
		</Layout>
	);
}
