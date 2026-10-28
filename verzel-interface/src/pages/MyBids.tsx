import { FileText, Gavel, Share2, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import Layout, { PageHeader } from '../components/layout/Layout';
import Countdown from '../components/lots/Countdown';
import LotImage from '../components/lots/LotImage';
import { Badge } from '../components/lots/PhaseBadge';
import Button, { ButtonLink } from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { PageLoader } from '../components/ui/Spinner';
import { useFetch } from '../hooks/useFetch';
import { getErrorMessage } from '../lib/errors';
import { formatBRL, formatDateTime } from '../lib/format';
import { receiptUrl, shareLink } from '../lib/share';
import { getSocket } from '../services/socket';
import type { Participation, ParticipationStatus } from '../types';

type Tab = 'active' | 'won' | 'closed';

const TABS: { value: Tab; label: string; statuses: ParticipationStatus[] }[] = [
	{ value: 'active', label: 'Em disputa', statuses: ['WINNING', 'OUTBID', 'CLOSING'] },
	{ value: 'won', label: 'Arrematados', statuses: ['WON'] },
	{ value: 'closed', label: 'Encerrados', statuses: ['LOST', 'CANCELLED'] },
];

const STATUS_BADGE: Record<
	ParticipationStatus,
	{ label: string; tone: 'green' | 'red' | 'amber' | 'stone' | 'sky' }
> = {
	WINNING: { label: 'Você está ganhando', tone: 'green' },
	OUTBID: { label: 'Você foi superado', tone: 'red' },
	CLOSING: { label: 'Encerrando', tone: 'amber' },
	WON: { label: 'Arrematado', tone: 'green' },
	LOST: { label: 'Não arrematado', tone: 'stone' },
	CANCELLED: { label: 'Lote cancelado', tone: 'stone' },
};

export default function MyBids() {
	const { data: participations, error, reload } = useFetch<Participation[]>('/me/bids');
	const [tab, setTab] = useState<Tab>('active');

	useEffect(() => {
		if (error) toast.error(getErrorMessage(error, 'Erro ao carregar seus lances'));
	}, [error]);

	// A situação muda quando alguém dá lance ou um lote encerra (a carteira é avisada nesses casos).
	useEffect(() => {
		const socket = getSocket();
		socket.on('wallet:updated', reload);
		return () => {
			socket.off('wallet:updated', reload);
		};
	}, [reload]);

	const grouped = useMemo(() => {
		const result: Record<Tab, Participation[]> = { active: [], won: [], closed: [] };
		for (const participation of participations ?? []) {
			const group = TABS.find((item) => item.statuses.includes(participation.status));
			if (group) result[group.value].push(participation);
		}
		return result;
	}, [participations]);

	if (!participations) {
		return (
			<Layout>
				<PageLoader />
			</Layout>
		);
	}

	const list = grouped[tab];

	return (
		<Layout>
			<PageHeader
				title="Meus arremates"
				description="Lotes em que você deu lance e os comprovantes dos que você arrematou."
			/>

			<div className="mb-6 flex gap-2 border-b border-stone-200 dark:border-stone-800">
				{TABS.map((item) => (
					<button
						key={item.value}
						type="button"
						onClick={() => setTab(item.value)}
						className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
							tab === item.value
								? 'border-brand-600 text-stone-900 dark:text-stone-50'
								: 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
						}`}
					>
						{item.label}{' '}
						<span className="text-xs text-stone-400 tabular">({grouped[item.value].length})</span>
					</button>
				))}
			</div>

			{list.length === 0 ? (
				<EmptyState
					icon={tab === 'won' ? <Trophy className="size-10" /> : <Gavel className="size-10" />}
					title={
						tab === 'active'
							? 'Você não está disputando nenhum lote'
							: tab === 'won'
								? 'Nenhum arremate ainda'
								: 'Nada por aqui'
					}
					description="Explore a vitrine e participe dos lotes ao vivo."
					action={<ButtonLink to="/">Ir para a vitrine</ButtonLink>}
				/>
			) : (
				<div className="flex flex-col gap-4">
					{list.map((participation) => {
						const { lot } = participation;
						const badge = STATUS_BADGE[participation.status];
						return (
							<Card key={lot.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
								<Link to={`/lotes/${lot.id}`} className="shrink-0">
									<LotImage
										item={lot.item}
										alt={lot.title}
										className="h-28 w-full rounded-xl sm:w-36"
									/>
								</Link>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<Badge tone={badge.tone}>{badge.label}</Badge>
										{(participation.status === 'WINNING' || participation.status === 'OUTBID') && (
											<span className="text-xs text-stone-500">
												<Countdown lot={lot} />
											</span>
										)}
									</div>
									<Link
										to={`/lotes/${lot.id}`}
										className="mt-1 block font-serif text-lg font-semibold hover:underline"
									>
										{lot.title}
									</Link>
									<p className="text-sm text-stone-500">
										Seu maior lance:{' '}
										<strong className="tabular">
											{formatBRL(participation.myHighestBidCents)}
										</strong>{' '}
										· {participation.myBidCount}{' '}
										{participation.myBidCount === 1 ? 'lance' : 'lances'} · você aparece como{' '}
										{participation.myAlias}
									</p>
									<p className="text-sm text-stone-500">
										{participation.status === 'WON'
											? `Arrematado por ${formatBRL(lot.finalPriceCents)} em ${formatDateTime(lot.settledAt)}`
											: participation.status === 'LOST'
												? `Arrematado por outro licitante por ${formatBRL(lot.finalPriceCents)}`
												: participation.status === 'CANCELLED'
													? 'O leiloeiro cancelou este lote; nenhum valor foi cobrado.'
													: `Lance atual: ${formatBRL(lot.currentBidCents)}`}
									</p>
								</div>
								<div className="flex gap-2 sm:flex-col">
									{participation.receiptId ? (
										<>
											<ButtonLink
												to={`/comprovantes/${participation.receiptId}`}
												size="sm"
												fullWidth
											>
												<FileText className="size-4" /> Comprovante
											</ButtonLink>
											<Button
												size="sm"
												variant="secondary"
												onClick={() =>
													shareLink(
														receiptUrl(participation.receiptId as string),
														`Arrematei "${lot.title}"`,
													)
												}
											>
												<Share2 className="size-4" /> Compartilhar
											</Button>
										</>
									) : (
										<ButtonLink
											to={`/lotes/${lot.id}`}
											size="sm"
											variant={participation.status === 'OUTBID' ? 'primary' : 'secondary'}
											fullWidth
										>
											{participation.status === 'OUTBID' ? 'Dar novo lance' : 'Ver lote'}
										</ButtonLink>
									)}
								</div>
							</Card>
						);
					})}
				</div>
			)}
		</Layout>
	);
}
