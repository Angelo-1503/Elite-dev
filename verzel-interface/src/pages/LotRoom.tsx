import {
	ArrowLeft,
	BadgeCheck,
	CircleAlert,
	Clock,
	FileCheck2,
	Gavel,
	ShieldCheck,
	Timer,
	TrendingUp,
	Trophy,
	UserRound,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import Countdown from '../components/lots/Countdown';
import LotImage from '../components/lots/LotImage';
import PhaseBadge from '../components/lots/PhaseBadge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { inputClass } from '../components/ui/Input';
import { PageLoader } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import { useFetch } from '../hooks/useFetch';
import { useLotTiming } from '../hooks/useLotTiming';
import { getErrorMessage } from '../lib/errors';
import { centsToInput, formatBRL, formatDateTime, formatTime, parseBRL } from '../lib/format';
import api from '../services/api';
import { getSocket } from '../services/socket';
import type { Bid, Lot, LotDetail } from '../types';

interface BidEvent {
	lot: Lot;
	bid: Bid;
	extended: boolean;
}

/**
 * Aplica o estado novo do lote vindo de um evento. Os eventos trazem só os campos
 * que mudam, sem a obra e o leiloeiro, então esses são preservados.
 */
function mergeLot(current: Lot, incoming: Lot): Lot {
	return { ...current, ...incoming, item: current.item, seller: current.seller };
}

/** Ranking dos licitantes pelo maior lance de cada um (posição do usuário na disputa). */
function rankBidders(bids: Bid[]) {
	const best = new Map<string, number>();
	for (const bid of bids) {
		best.set(bid.bidderAlias, Math.max(best.get(bid.bidderAlias) ?? 0, bid.amountCents));
	}
	return [...best.entries()].sort((a, b) => b[1] - a[1]).map(([alias]) => alias);
}

export default function LotRoom() {
	const { id = '' } = useParams();
	const navigate = useNavigate();
	const { user } = useAuth();
	const { wallet } = useWallet();

	const {
		data: detail,
		error: loadError,
		reload: fetchDetail,
		setData: setDetail,
	} = useFetch<LotDetail>(`/lots/${id}`);
	const notFound = !!loadError && !detail;
	const [draft, setDraft] = useState<{ value: string; min: number } | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(
		null,
	);
	const [flashSeq, setFlashSeq] = useState<number | null>(null);
	const myAliasRef = useRef<string | null>(null);
	useEffect(() => {
		myAliasRef.current = detail?.myAlias ?? null;
	}, [detail?.myAlias]);

	// Sala ao vivo: entra no canal do lote e aplica cada evento sem recarregar a página.
	useEffect(() => {
		const socket = getSocket();
		const join = () => socket.emit('lot:join', id);
		join();
		socket.on('connect', join);

		const onBid = (event: BidEvent) => {
			setDetail((current) => {
				if (!current || current.bids.some((bid) => bid.seq === event.bid.seq)) return current;
				return {
					...current,
					lot: mergeLot(current.lot, event.lot),
					bids: [event.bid, ...current.bids],
				};
			});
			setFlashSeq(event.bid.seq);
			// Um lance de outra pessoa torna a mensagem anterior ("você está ganhando") desatualizada.
			if (event.bid.bidderAlias !== myAliasRef.current) setFeedback(null);
			if (event.extended) {
				toast('Lance nos minutos finais: o lote foi prorrogado em +2 minutos.', { icon: '⏱️' });
			}
		};
		const onSettled = () => {
			fetchDetail();
		};
		const onCancelled = (event: { lot: Lot }) => {
			setDetail((current) =>
				current ? { ...current, lot: mergeLot(current.lot, event.lot) } : current,
			);
		};

		socket.on('lot:bid', onBid);
		socket.on('lot:settled', onSettled);
		socket.on('lot:cancelled', onCancelled);
		return () => {
			socket.emit('lot:leave', id);
			socket.off('connect', join);
			socket.off('lot:bid', onBid);
			socket.off('lot:settled', onSettled);
			socket.off('lot:cancelled', onCancelled);
		};
	}, [id, fetchDetail, setDetail]);

	const lot = detail?.lot;
	const minNext = lot?.minNextBidCents ?? 0;

	// Valor sugerido = próximo lance mínimo. Se o usuário digitou um valor e o mínimo
	// subiu (alguém deu lance), o campo volta para o novo mínimo caso tenha ficado abaixo.
	let amount = centsToInput(minNext);
	if (draft) {
		const typed = parseBRL(draft.value) ?? 0;
		if (draft.min === minNext || typed >= minNext) amount = draft.value;
	}
	const setAmount = (value: string) => setDraft({ value, min: minNext });

	const timing = useLotTiming(
		lot ?? {
			phase: 'SCHEDULED',
			startsAt: new Date().toISOString(),
			endsAt: new Date().toISOString(),
			status: 'ACTIVE',
		},
	);

	// Quando o relógio passa do fim, o job do servidor liquida em ~2s e avisa pelo socket;
	// esta busca é só uma garantia caso o evento se perca.
	useEffect(() => {
		if (timing.phase !== 'CLOSING') return;
		const timer = setTimeout(fetchDetail, 5000);
		return () => clearTimeout(timer);
	}, [timing.phase, fetchDetail]);

	const ranking = useMemo(() => rankBidders(detail?.bids ?? []), [detail?.bids]);

	if (notFound) {
		return (
			<Layout>
				<div className="py-24 text-center">
					<h1 className="font-serif text-2xl font-semibold">Lote não encontrado</h1>
					<Button variant="secondary" className="mt-6" onClick={() => navigate('/')}>
						Voltar para a vitrine
					</Button>
				</div>
			</Layout>
		);
	}

	if (!detail || !lot) {
		return (
			<Layout>
				<PageLoader />
			</Layout>
		);
	}

	const { phase } = timing;
	const myAlias = detail.myAlias;
	const iAmLeader = !!myAlias && lot.leaderAlias === myAlias;
	const iHaveBid = !!myAlias && detail.bids.some((bid) => bid.bidderAlias === myAlias);
	const myPosition = myAlias ? ranking.indexOf(myAlias) + 1 : 0;
	const isBidder = user?.role === 'BIDDER';
	const canBid = isBidder && phase === 'LIVE' && !iAmLeader;

	async function handleBid(event: FormEvent) {
		event.preventDefault();
		const amountCents = parseBRL(amount);
		if (!amountCents || amountCents <= 0) {
			setFeedback({ type: 'error', message: 'Informe um valor de lance válido.' });
			return;
		}

		setSubmitting(true);
		setFeedback(null);
		try {
			const response = await api.post<BidEvent>(`/lots/${id}/bids`, { amountCents });
			const { bid } = response.data;
			setDetail((current) => {
				if (!current || current.bids.some((item) => item.seq === bid.seq)) return current;
				return {
					...current,
					lot: mergeLot(current.lot, response.data.lot),
					bids: [bid, ...current.bids],
				};
			});
			setFlashSeq(bid.seq);
			setDraft(null);
			setFeedback({
				type: 'success',
				message: `Lance de ${formatBRL(amountCents)} registrado. Você está ganhando!`,
			});
			toast.success('Lance registrado!');
		} catch (error) {
			const message = getErrorMessage(error, 'Não foi possível registrar o lance.');
			setFeedback({ type: 'error', message });
			toast.error(message);
		} finally {
			setSubmitting(false);
		}
	}

	const quickBids = [minNext, minNext + lot.minIncrementCents, minNext + lot.minIncrementCents * 5];

	const attributes = [
		['Artista', lot.item?.artist],
		['Data', lot.item?.dateDisplay],
		['Técnica', lot.item?.medium],
		['Dimensões', lot.item?.dimensions],
		['Origem', lot.item?.origin],
		...Object.entries(lot.item?.attributes ?? {}),
	].filter((entry): entry is [string, string] => Boolean(entry[1]));

	return (
		<Layout>
			<Link
				to="/"
				className="mb-6 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
			>
				<ArrowLeft className="size-4" /> Vitrine
			</Link>

			<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
				{/* Obra */}
				<div>
					<Card className="overflow-hidden">
						<LotImage
							item={lot.item}
							alt={lot.title}
							className="max-h-[560px] w-full object-contain"
						/>
					</Card>

					<div className="mt-6">
						<div className="flex flex-wrap items-center gap-2">
							<PhaseBadge phase={phase} />
							{lot.extensionCount > 0 && (
								<span className="inline-flex items-center gap-1 text-xs text-stone-500">
									<Timer className="size-3.5" /> Prorrogado {lot.extensionCount}x
								</span>
							)}
						</div>
						<h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
							{lot.title}
						</h1>
						{lot.item?.artist && (
							<p className="mt-1 text-stone-600 dark:text-stone-400">{lot.item.artist}</p>
						)}
						{lot.description && (
							<p className="mt-4 leading-relaxed text-stone-700 dark:text-stone-300">
								{lot.description}
							</p>
						)}
						{lot.seller && (
							<p className="mt-4 text-sm text-stone-500">
								Leiloeiro:{' '}
								<strong className="text-stone-700 dark:text-stone-300">{lot.seller.name}</strong>
							</p>
						)}
					</div>

					{attributes.length > 0 && (
						<Card className="mt-6 p-5">
							<h2 className="font-serif text-lg font-semibold">Ficha da obra</h2>
							<dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
								{attributes.map(([label, value]) => (
									<div key={label}>
										<dt className="text-xs text-stone-500 uppercase tracking-wide">{label}</dt>
										<dd className="text-sm text-stone-800 dark:text-stone-200">{value}</dd>
									</div>
								))}
							</dl>
						</Card>
					)}
				</div>

				{/* Painel de lances */}
				<div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
					<Card className="p-6">
						<div className="flex items-center justify-between text-sm text-stone-500">
							<span className="flex items-center gap-1.5">
								<Clock className="size-4" />
								{phase === 'LIVE' && `Até ${formatDateTime(lot.endsAt)}`}
								{phase === 'SCHEDULED' && `Início ${formatDateTime(lot.startsAt)}`}
								{(phase === 'ENDED' || phase === 'CLOSING') &&
									`Encerrado em ${formatDateTime(lot.endsAt)}`}
								{phase === 'CANCELLED' && `Cancelado em ${formatDateTime(lot.cancelledAt)}`}
							</span>
						</div>
						<p className="mt-2 text-2xl font-semibold">
							<Countdown lot={lot} />
						</p>
						{timing.inExtensionWindow && (
							<p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
								Reta final! Lances agora prorrogam o lote em +2 minutos.
							</p>
						)}

						<div className="mt-6 border-t border-stone-200 pt-5 dark:border-stone-800">
							<p className="text-sm text-stone-500">
								{phase === 'ENDED'
									? lot.winnerAlias
										? 'Arrematado por'
										: 'Resultado'
									: lot.currentBidCents
										? 'Lance atual'
										: 'Lance inicial'}
							</p>
							<p className="mt-1 font-serif text-4xl font-semibold tabular text-stone-900 dark:text-stone-50">
								{phase === 'ENDED' && !lot.winnerAlias
									? 'Sem lances'
									: formatBRL(
											phase === 'ENDED'
												? lot.finalPriceCents
												: (lot.currentBidCents ?? lot.startingBidCents),
										)}
							</p>
							<p className="mt-1 text-sm text-stone-500">
								{lot.bidCount} {lot.bidCount === 1 ? 'lance' : 'lances'} · incremento mínimo{' '}
								{formatBRL(lot.minIncrementCents)}
							</p>
							{phase === 'ENDED' && lot.winnerAlias && (
								<p className="mt-1 text-sm text-stone-500">
									Vencedor:{' '}
									<strong>{lot.winnerAlias === myAlias ? 'Você' : lot.winnerAlias}</strong>
								</p>
							)}
						</div>

						{/* Indicador "ganhando / superado" */}
						{isBidder && iHaveBid && (phase === 'LIVE' || phase === 'CLOSING') && (
							<div
								className={`mt-5 flex items-start gap-3 rounded-xl p-4 ${
									iAmLeader
										? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
										: 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200'
								}`}
								role="status"
								aria-live="polite"
							>
								{iAmLeader ? (
									<BadgeCheck className="size-6 shrink-0" />
								) : (
									<CircleAlert className="size-6 shrink-0" />
								)}
								<div>
									<p className="font-semibold">
										{iAmLeader ? 'Você está ganhando!' : 'Você foi superado'}
									</p>
									<p className="text-sm opacity-90">
										{iAmLeader
											? 'Seu lance é o maior. O valor está comprometido no seu saldo.'
											: `Você está em ${myPosition}º lugar entre ${ranking.length} licitantes. Dê um novo lance para voltar à liderança.`}
									</p>
								</div>
							</div>
						)}

						{phase === 'ENDED' && detail.receiptId && (
							<div className="mt-5 flex items-start gap-3 rounded-xl bg-brand-50 p-4 text-brand-900 dark:bg-brand-900/30 dark:text-brand-100">
								<Trophy className="size-6 shrink-0" />
								<div>
									<p className="font-semibold">Você arrematou este lote!</p>
									<Link
										to={`/comprovantes/${detail.receiptId}`}
										className="text-sm font-semibold underline"
									>
										Ver comprovante de arremate
									</Link>
								</div>
							</div>
						)}
						{phase === 'ENDED' && isBidder && iHaveBid && !detail.receiptId && (
							<p className="mt-5 rounded-xl bg-stone-100 p-4 text-sm text-stone-600 dark:bg-stone-800 dark:text-stone-300">
								Este lote foi arrematado por outro licitante. O valor dos seus lances não foi
								debitado.
							</p>
						)}

						{/* Formulário de lance */}
						{phase === 'LIVE' && (
							<div className="mt-5">
								{!user && (
									<Button
										fullWidth
										size="lg"
										onClick={() => navigate('/login', { state: { from: `/lotes/${id}` } })}
									>
										<Gavel className="size-5" /> Entre para dar um lance
									</Button>
								)}
								{user?.role === 'AUCTIONEER' && (
									<p className="rounded-xl bg-stone-100 p-4 text-sm text-stone-600 dark:bg-stone-800 dark:text-stone-300">
										{detail.isSeller ? 'Este lote é seu. ' : ''}Leiloeiros acompanham a disputa, mas
										não podem dar lances.
									</p>
								)}
								{isBidder && (
									<form onSubmit={handleBid} className="flex flex-col gap-3">
										<label htmlFor="bid-amount" className="text-sm font-medium">
											Seu lance (mínimo {formatBRL(minNext)})
										</label>
										<div className="relative">
											<span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone-500">
												R$
											</span>
											<input
												id="bid-amount"
												inputMode="decimal"
												autoComplete="off"
												value={amount}
												onChange={(event) => {
													setAmount(event.target.value);
													setFeedback(null);
												}}
												disabled={!canBid || submitting}
												className={`${inputClass} pl-10 text-lg font-semibold tabular`}
											/>
										</div>
										<div className="grid grid-cols-3 gap-2">
											{quickBids.map((value) => (
												<button
													key={value}
													type="button"
													disabled={!canBid || submitting}
													onClick={() => setAmount(centsToInput(value))}
													className="rounded-lg border border-stone-200 px-2 py-1.5 text-xs font-semibold tabular transition hover:border-brand-500 hover:text-brand-700 disabled:opacity-50 dark:border-stone-700 dark:hover:text-brand-300"
												>
													{formatBRL(value)}
												</button>
											))}
										</div>
										<Button
											type="submit"
											size="lg"
											fullWidth
											loading={submitting}
											disabled={!canBid}
										>
											<Gavel className="size-5" />
											{iAmLeader ? 'Você já está ganhando' : 'Dar lance'}
										</Button>
										{wallet && (
											<p className="text-center text-xs text-stone-500">
												Saldo disponível:{' '}
												<strong className="tabular">{formatBRL(wallet.availableCents)}</strong> ·{' '}
												<Link to="/carteira" className="underline">
													depositar
												</Link>
											</p>
										)}
									</form>
								)}
								{feedback && (
									<p
										role="alert"
										className={`mt-3 rounded-lg px-3 py-2 text-sm ${
											feedback.type === 'error'
												? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
												: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
										}`}
									>
										{feedback.message}
									</p>
								)}
							</div>
						)}

						{phase === 'SCHEDULED' && (
							<p className="mt-5 rounded-xl bg-sky-50 p-4 text-sm text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
								Este lote ainda não foi iniciado. Os lances abrem em {formatDateTime(lot.startsAt)},
								com lance inicial de {formatBRL(lot.startingBidCents)}.
							</p>
						)}
						{phase === 'CANCELLED' && (
							<p className="mt-5 rounded-xl bg-stone-100 p-4 text-sm text-stone-600 dark:bg-stone-800 dark:text-stone-300">
								Este lote foi cancelado pelo leiloeiro. Nenhum valor foi cobrado e o saldo
								comprometido foi liberado.
							</p>
						)}
					</Card>

					{/* Histórico */}
					<Card className="p-6">
						<div className="flex items-center justify-between">
							<h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
								<TrendingUp className="size-5" /> Histórico de lances
							</h2>
							<Link
								to={`/auditoria/${lot.id}`}
								className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400"
							>
								<ShieldCheck className="size-4" /> Auditar
							</Link>
						</div>

						{detail.bids.length === 0 ? (
							<p className="mt-4 text-sm text-stone-500">
								Nenhum lance ainda. {phase === 'LIVE' && 'Seja o primeiro!'}
							</p>
						) : (
							<ol className="mt-4 flex max-h-96 flex-col gap-1 overflow-y-auto">
								{detail.bids.map((bid, index) => {
									const mine = bid.bidderAlias === myAlias;
									return (
										<li
											key={bid.seq}
											className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
												bid.seq === flashSeq ? 'animate-flash' : ''
											} ${index === 0 ? 'bg-stone-50 dark:bg-stone-800/60' : ''}`}
										>
											<span className="flex items-center gap-2">
												<UserRound className="size-4 text-stone-400" />
												<span
													className={mine ? 'font-semibold text-brand-700 dark:text-brand-300' : ''}
												>
													{mine ? 'Você' : bid.bidderAlias}
												</span>
												{index === 0 && phase !== 'CANCELLED' && (
													<span className="rounded bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700 uppercase dark:bg-emerald-900/50 dark:text-emerald-300">
														{phase === 'ENDED' ? 'vencedor' : 'líder'}
													</span>
												)}
											</span>
											<span className="text-right">
												<span className="block font-semibold tabular">
													{formatBRL(bid.amountCents)}
												</span>
												<span className="text-xs text-stone-500 tabular">
													{formatTime(bid.placedAt)}
												</span>
											</span>
										</li>
									);
								})}
							</ol>
						)}
						<p className="mt-4 flex items-start gap-2 text-xs text-stone-500">
							<FileCheck2 className="size-4 shrink-0" />
							Licitantes aparecem por pseudônimo. Cada lance é encadeado e assinado: qualquer
							alteração é detectada na auditoria.
						</p>
					</Card>
				</div>
			</div>
		</Layout>
	);
}
