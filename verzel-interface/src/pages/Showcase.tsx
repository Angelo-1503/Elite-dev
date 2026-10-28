import { ChevronLeft, ChevronRight, Gavel, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import LotCard from '../components/lots/LotCard';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { inputClass } from '../components/ui/Input';
import { PageLoader } from '../components/ui/Spinner';
import { useFetch } from '../hooks/useFetch';
import { getErrorMessage } from '../lib/errors';
import { parseBRL } from '../lib/format';
import { getSocket } from '../services/socket';
import type { ShowcaseResponse } from '../types';

type Phase = 'live' | 'scheduled' | 'ended';

const TABS: { value: Phase; label: string }[] = [
	{ value: 'live', label: 'Ao vivo' },
	{ value: 'scheduled', label: 'Agendados' },
	{ value: 'ended', label: 'Encerrados' },
];

const SORTS = [
	{ value: '', label: 'Relevância' },
	{ value: 'ending', label: 'Terminando antes' },
	{ value: 'newest', label: 'Mais recentes' },
	{ value: 'price_asc', label: 'Menor preço' },
	{ value: 'price_desc', label: 'Maior preço' },
	{ value: 'bids', label: 'Mais disputados' },
];

export default function Showcase() {
	const [params, setParams] = useSearchParams();
	const phase = (params.get('fase') as Phase) || 'live';
	const search = params.get('busca') ?? '';
	const sort = params.get('ordem') ?? '';
	const minPrice = params.get('min') ?? '';
	const maxPrice = params.get('max') ?? '';
	const page = Number(params.get('pagina') ?? 1);

	const { data, loading, error, reload } = useFetch<ShowcaseResponse>('/lots', {
		phase,
		search: search || undefined,
		sort: sort || undefined,
		minPrice: parseBRL(minPrice) ?? undefined,
		maxPrice: parseBRL(maxPrice) ?? undefined,
		page,
	});
	const [searchText, setSearchText] = useState(search);
	const [showFilters, setShowFilters] = useState(Boolean(minPrice || maxPrice || sort));

	function updateParams(changes: Record<string, string>) {
		const next = new URLSearchParams(params);
		for (const [key, value] of Object.entries(changes)) {
			if (value) next.set(key, value);
			else next.delete(key);
		}
		if (!('pagina' in changes)) next.delete('pagina');
		setParams(next, { replace: true });
	}

	useEffect(() => {
		if (error) toast.error(getErrorMessage(error, 'Erro ao carregar a vitrine'));
	}, [error]);

	// Busca com debounce: só reage ao texto digitado
	// biome-ignore lint/correctness/useExhaustiveDependencies: dispara apenas quando o texto muda
	useEffect(() => {
		if (searchText === search) return;
		const delay = setTimeout(() => updateParams({ busca: searchText.trim() }), 350);
		return () => clearTimeout(delay);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchText]);

	// Atualização ao vivo: qualquer lance/encerramento faz a vitrine se atualizar (com limite de frequência)
	const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		const socket = getSocket();
		const onChange = () => {
			if (pending.current) return;
			pending.current = setTimeout(() => {
				pending.current = null;
				reload();
			}, 1500);
		};
		socket.on('showcase:changed', onChange);
		return () => {
			socket.off('showcase:changed', onChange);
			if (pending.current) clearTimeout(pending.current);
			pending.current = null;
		};
	}, [reload]);

	const emptyMessages: Record<Phase, string> = {
		live: 'Nenhum lote ao vivo no momento.',
		scheduled: 'Nenhum lote agendado.',
		ended: 'Nenhum lote encerrado ainda.',
	};

	return (
		<Layout>
			<section className="mb-8">
				<p className="text-sm font-semibold tracking-widest text-brand-700 uppercase dark:text-brand-400">
					Leilões de obras de arte
				</p>
				<h1 className="mt-2 max-w-2xl font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
					Obras-primas em disputa, lance a lance.
				</h1>
				<p className="mt-3 max-w-2xl text-stone-600 dark:text-stone-400">
					Acompanhe os lotes em tempo real. Todo histórico de lances é público e pode ser auditado
					por qualquer pessoa.
				</p>
			</section>

			<div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div
					role="tablist"
					aria-label="Situação dos lotes"
					className="inline-flex rounded-xl border border-stone-200 bg-white p-1 dark:border-stone-800 dark:bg-stone-900"
				>
					{TABS.map((tab) => (
						<button
							key={tab.value}
							type="button"
							role="tab"
							aria-selected={phase === tab.value}
							onClick={() => updateParams({ fase: tab.value === 'live' ? '' : tab.value })}
							className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
								phase === tab.value
									? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
									: 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
							}`}
						>
							{tab.label}
							{data && (
								<span
									className={`rounded-full px-1.5 text-xs tabular ${
										phase === tab.value ? 'bg-white/20' : 'bg-stone-100 dark:bg-stone-800'
									}`}
								>
									{data.counts[tab.value]}
								</span>
							)}
						</button>
					))}
				</div>

				<div className="flex gap-2">
					<div className="relative flex-1 lg:w-80">
						<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
						<input
							type="search"
							placeholder="Buscar por obra ou artista"
							aria-label="Buscar por obra ou artista"
							value={searchText}
							onChange={(event) => setSearchText(event.target.value)}
							className={`${inputClass} pl-9`}
						/>
					</div>
					<Button
						variant={showFilters ? 'primary' : 'secondary'}
						onClick={() => setShowFilters((value) => !value)}
						aria-expanded={showFilters}
					>
						<SlidersHorizontal className="size-4" />
						<span className="hidden sm:inline">Filtros</span>
					</Button>
				</div>
			</div>

			{showFilters && (
				<div className="mb-6 grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-3 dark:border-stone-800 dark:bg-stone-900">
					<label className="flex flex-col gap-1 text-sm">
						<span className="font-medium text-stone-700 dark:text-stone-300">
							Preço mínimo (R$)
						</span>
						<input
							inputMode="decimal"
							placeholder="0,00"
							defaultValue={minPrice}
							onBlur={(event) => updateParams({ min: event.target.value })}
							className={inputClass}
						/>
					</label>
					<label className="flex flex-col gap-1 text-sm">
						<span className="font-medium text-stone-700 dark:text-stone-300">
							Preço máximo (R$)
						</span>
						<input
							inputMode="decimal"
							placeholder="Sem limite"
							defaultValue={maxPrice}
							onBlur={(event) => updateParams({ max: event.target.value })}
							className={inputClass}
						/>
					</label>
					<label className="flex flex-col gap-1 text-sm">
						<span className="font-medium text-stone-700 dark:text-stone-300">Ordenar por</span>
						<select
							value={sort}
							onChange={(event) => updateParams({ ordem: event.target.value })}
							className={inputClass}
						>
							{SORTS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
				</div>
			)}

			{loading && !data ? (
				<PageLoader />
			) : data && data.lots.length > 0 ? (
				<>
					<div
						className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? 'opacity-60' : ''}`}
					>
						{data.lots.map((lot) => (
							<LotCard key={lot.id} lot={lot} />
						))}
					</div>
					{data.totalPages > 1 && (
						<div className="mt-8 flex items-center justify-center gap-3">
							<Button
								variant="secondary"
								size="sm"
								disabled={page <= 1}
								onClick={() => updateParams({ pagina: String(page - 1) })}
							>
								<ChevronLeft className="size-4" /> Anterior
							</Button>
							<span className="text-sm text-stone-500 tabular">
								Página {data.page} de {data.totalPages}
							</span>
							<Button
								variant="secondary"
								size="sm"
								disabled={page >= data.totalPages}
								onClick={() => updateParams({ pagina: String(page + 1) })}
							>
								Próxima <ChevronRight className="size-4" />
							</Button>
						</div>
					)}
				</>
			) : (
				<EmptyState
					icon={<Gavel className="size-10" />}
					title={search || minPrice || maxPrice ? 'Nenhum lote encontrado' : emptyMessages[phase]}
					description={
						search || minPrice || maxPrice
							? 'Tente outros termos de busca ou ajuste os filtros.'
							: 'Volte em breve: novos lotes são publicados pelos leiloeiros.'
					}
				/>
			)}
		</Layout>
	);
}
