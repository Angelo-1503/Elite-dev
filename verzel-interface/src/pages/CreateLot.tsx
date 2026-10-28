import { ArrowLeft, Check, CloudOff, ImageOff, Search } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import Layout, { PageHeader } from '../components/layout/Layout';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input, { inputClass, Textarea } from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import { getErrorMessage } from '../lib/errors';
import { centsToInput, formatBRL, parseBRL, toDateTimeLocal } from '../lib/format';
import api from '../services/api';
import type { Artwork, CatalogSearch, Lot } from '../types';

const DURATIONS = [
	{ label: '15 min', minutes: 15 },
	{ label: '1 hora', minutes: 60 },
	{ label: '1 dia', minutes: 60 * 24 },
	{ label: '7 dias', minutes: 60 * 24 * 7 },
];

export default function CreateLot() {
	const navigate = useNavigate();

	const [query, setQuery] = useState('');
	const [results, setResults] = useState<CatalogSearch | null>(null);
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<Artwork | null>(null);

	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [startingBid, setStartingBid] = useState(centsToInput(1_000_00));
	const [increment, setIncrement] = useState(centsToInput(100_00));
	const [startNow, setStartNow] = useState(true);
	const [startsAt, setStartsAt] = useState(() =>
		toDateTimeLocal(new Date(Date.now() + 60 * 60_000)),
	);
	const [endsAt, setEndsAt] = useState(() =>
		toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60_000)),
	);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		const delay = setTimeout(async () => {
			setSearching(true);
			setSearchError(null);
			try {
				const response = await api.get<CatalogSearch>('/catalog/search', {
					params: { q: query, page },
				});
				setResults(response.data);
			} catch (error) {
				setSearchError(getErrorMessage(error, 'Não foi possível buscar no catálogo.'));
			} finally {
				setSearching(false);
			}
		}, 400);
		return () => clearTimeout(delay);
	}, [query, page]);

	function selectArtwork(artwork: Artwork) {
		setSelected(artwork);
		setTitle(artwork.title);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function applyDuration(minutes: number) {
		const base = startNow ? new Date() : new Date(startsAt);
		setEndsAt(toDateTimeLocal(new Date(base.getTime() + minutes * 60_000)));
	}

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		if (!selected) {
			toast.error('Selecione uma obra do catálogo.');
			return;
		}
		const startingBidCents = parseBRL(startingBid);
		const minIncrementCents = parseBRL(increment);
		if (!startingBidCents || startingBidCents <= 0) {
			toast.error('Informe um lance inicial válido.');
			return;
		}
		if (!minIncrementCents || minIncrementCents <= 0) {
			toast.error('Informe um incremento mínimo válido.');
			return;
		}
		const start = startNow ? new Date() : new Date(startsAt);
		const end = new Date(endsAt);
		if (end <= start) {
			toast.error('O fim precisa ser depois do início.');
			return;
		}

		setSubmitting(true);
		try {
			const response = await api.post<Lot>('/lots', {
				externalId: selected.externalId,
				title,
				description,
				startingBidCents,
				minIncrementCents,
				startsAt: start.toISOString(),
				endsAt: end.toISOString(),
			});
			toast.success('Lote publicado!');
			navigate(`/lotes/${response.data.id}`);
		} catch (error) {
			toast.error(getErrorMessage(error, 'Erro ao criar lote'));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Layout>
			<Link
				to="/painel"
				className="mb-6 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
			>
				<ArrowLeft className="size-4" /> Painel
			</Link>
			<PageHeader
				title="Novo lote"
				description="Escolha uma obra do acervo do Art Institute of Chicago e defina as regras do leilão."
			/>

			<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
				{/* Catálogo */}
				<div>
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
						<input
							type="search"
							placeholder="Buscar obras: Monet, samurai, vaso grego..."
							aria-label="Buscar obras no catálogo"
							value={query}
							onChange={(event) => {
								setQuery(event.target.value);
								setPage(1);
							}}
							className={`${inputClass} pl-9`}
						/>
						{searching && (
							<Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone-400" />
						)}
					</div>

					{results?.stale && (
						<p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
							<CloudOff className="size-4" /> O catálogo está instável; mostrando resultados
							guardados em cache.
						</p>
					)}
					{searchError && (
						<p className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
							<CloudOff className="size-4" /> {searchError}
						</p>
					)}

					<div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
						{results?.items.map((artwork) => {
							const isSelected = selected?.externalId === artwork.externalId;
							return (
								<button
									key={artwork.externalId}
									type="button"
									onClick={() => selectArtwork(artwork)}
									className={`group relative overflow-hidden rounded-xl border bg-white text-left transition dark:bg-stone-900 ${
										isSelected
											? 'border-brand-500 ring-2 ring-brand-500/40'
											: 'border-stone-200 hover:border-stone-300 dark:border-stone-800'
									}`}
								>
									{artwork.thumbnailUrl ? (
										<img
											src={artwork.thumbnailUrl}
											alt={artwork.title}
											loading="lazy"
											className="aspect-square w-full bg-stone-100 object-cover dark:bg-stone-800"
										/>
									) : (
										<div className="flex aspect-square items-center justify-center bg-stone-100 text-stone-400 dark:bg-stone-800">
											<ImageOff className="size-8" />
										</div>
									)}
									{isSelected && (
										<span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-brand-600 text-white">
											<Check className="size-4" />
										</span>
									)}
									<div className="p-3">
										<p className="line-clamp-2 text-sm font-semibold">{artwork.title}</p>
										<p className="mt-0.5 line-clamp-1 text-xs text-stone-500">
											{artwork.artist ?? 'Autor desconhecido'}
										</p>
									</div>
								</button>
							);
						})}
					</div>

					{results && results.items.length === 0 && !searching && (
						<p className="mt-6 text-center text-sm text-stone-500">
							Nenhuma obra encontrada para “{query}”.
						</p>
					)}

					{results && results.totalPages > 1 && (
						<div className="mt-6 flex items-center justify-center gap-3">
							<Button
								variant="secondary"
								size="sm"
								disabled={page <= 1 || searching}
								onClick={() => setPage(page - 1)}
							>
								Anterior
							</Button>
							<span className="text-sm text-stone-500 tabular">
								{page} / {results.totalPages}
							</span>
							<Button
								variant="secondary"
								size="sm"
								disabled={page >= results.totalPages || searching}
								onClick={() => setPage(page + 1)}
							>
								Próxima
							</Button>
						</div>
					)}
				</div>

				{/* Formulário */}
				<Card className="p-6 lg:sticky lg:top-24 lg:self-start">
					{selected ? (
						<div className="mb-5 flex gap-3">
							{selected.thumbnailUrl && (
								<img
									src={selected.thumbnailUrl}
									alt=""
									className="size-16 rounded-lg object-cover"
								/>
							)}
							<div className="min-w-0">
								<p className="text-xs font-semibold text-brand-700 uppercase dark:text-brand-400">
									Obra selecionada
								</p>
								<p className="line-clamp-2 font-semibold">{selected.title}</p>
								<p className="line-clamp-1 text-xs text-stone-500">
									{[selected.artist, selected.dateDisplay].filter(Boolean).join(' · ')}
								</p>
							</div>
						</div>
					) : (
						<p className="mb-5 rounded-lg bg-stone-100 p-3 text-sm text-stone-600 dark:bg-stone-800 dark:text-stone-300">
							Selecione uma obra ao lado para montar o lote.
						</p>
					)}

					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<Input
							label="Título do lote"
							required
							maxLength={200}
							value={title}
							onChange={(event) => setTitle(event.target.value)}
						/>
						<Textarea
							label="Descrição (opcional)"
							maxLength={2000}
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							placeholder="Estado de conservação, procedência, observações..."
						/>
						<div className="grid grid-cols-2 gap-3">
							<Input
								label="Lance inicial"
								prefix="R$"
								inputMode="decimal"
								required
								value={startingBid}
								onChange={(event) => setStartingBid(event.target.value)}
							/>
							<Input
								label="Incremento mínimo"
								prefix="R$"
								inputMode="decimal"
								required
								value={increment}
								onChange={(event) => setIncrement(event.target.value)}
							/>
						</div>

						<fieldset className="flex flex-col gap-2">
							<legend className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">
								Início
							</legend>
							<label className="flex items-center gap-2 text-sm">
								<input
									type="radio"
									checked={startNow}
									onChange={() => setStartNow(true)}
									className="accent-brand-600"
								/>
								Agora (publicar ao vivo)
							</label>
							<label className="flex items-center gap-2 text-sm">
								<input
									type="radio"
									checked={!startNow}
									onChange={() => setStartNow(false)}
									className="accent-brand-600"
								/>
								Agendar
							</label>
							{!startNow && (
								<input
									type="datetime-local"
									aria-label="Data e hora de início"
									value={startsAt}
									onChange={(event) => setStartsAt(event.target.value)}
									className={inputClass}
								/>
							)}
						</fieldset>

						<div className="flex flex-col gap-1.5">
							<label
								htmlFor="ends-at"
								className="text-sm font-medium text-stone-700 dark:text-stone-300"
							>
								Fim
							</label>
							<input
								id="ends-at"
								type="datetime-local"
								required
								value={endsAt}
								onChange={(event) => setEndsAt(event.target.value)}
								className={inputClass}
							/>
							<div className="flex flex-wrap gap-2">
								{DURATIONS.map((duration) => (
									<button
										key={duration.label}
										type="button"
										onClick={() => applyDuration(duration.minutes)}
										className="rounded-full border border-stone-200 px-2.5 py-1 text-xs font-medium hover:border-brand-500 dark:border-stone-700"
									>
										{duration.label}
									</button>
								))}
							</div>
							<p className="text-xs text-stone-500">
								Lances nos 2 minutos finais prorrogam o fim em +2 minutos (anti-sniping).
							</p>
						</div>

						{parseBRL(startingBid) && parseBRL(increment) ? (
							<p className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600 dark:bg-stone-800/50 dark:text-stone-400">
								Primeiro lance a partir de <strong>{formatBRL(parseBRL(startingBid))}</strong>; os
								seguintes precisam superar o atual em pelo menos{' '}
								<strong>{formatBRL(parseBRL(increment))}</strong>.
							</p>
						) : null}

						<Button type="submit" size="lg" loading={submitting} disabled={!selected}>
							Publicar lote
						</Button>
					</form>
				</Card>
			</div>
		</Layout>
	);
}
