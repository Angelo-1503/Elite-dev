import {
	ArrowLeft,
	CheckCircle2,
	Laptop,
	RefreshCw,
	Server,
	ShieldAlert,
	ShieldCheck,
	XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import LotImage from '../components/lots/LotImage';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { PageLoader } from '../components/ui/Spinner';
import { getErrorMessage } from '../lib/errors';
import { formatBRL, formatDateTime, formatTime, shortHash } from '../lib/format';
import {
	type BrowserAuditResult,
	UnsupportedCryptoError,
	verifyAuditInBrowser,
} from '../lib/verify';
import api from '../services/api';
import type { AuditCheck, AuditResponse } from '../types';

function CheckList({ checks }: { checks: AuditCheck[] }) {
	return (
		<ul className="flex flex-col gap-2">
			{checks.map((check) => (
				<li key={check.key} className="flex items-start gap-2 text-sm">
					{check.ok ? (
						<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
					) : (
						<XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
					)}
					<span>
						{check.label}
						{check.detail && <span className="block text-xs text-red-600">{check.detail}</span>}
					</span>
				</li>
			))}
		</ul>
	);
}

export default function Audit() {
	const { lotId = '' } = useParams();
	const [audit, setAudit] = useState<AuditResponse | null>(null);
	const [browser, setBrowser] = useState<BrowserAuditResult | null>(null);
	const [browserError, setBrowserError] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [version, setVersion] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: version é o gatilho do botão "Verificar de novo"
	useEffect(() => {
		let active = true;

		api
			.get<AuditResponse>(`/audit/${lotId}`)
			.then(async (response) => {
				let browserResult: BrowserAuditResult | null = null;
				let browserMessage: string | null = null;
				try {
					browserResult = await verifyAuditInBrowser(response.data);
				} catch (verifyError) {
					browserMessage =
						verifyError instanceof UnsupportedCryptoError
							? 'Seu navegador não suporta Ed25519; atualize-o para verificar localmente.'
							: 'Não foi possível verificar no navegador.';
				}
				if (!active) return;
				setAudit(response.data);
				setBrowser(browserResult);
				setBrowserError(browserMessage);
				setError(null);
				setLoading(false);
			})
			.catch((requestError) => {
				if (!active) return;
				setError(getErrorMessage(requestError, 'Erro ao carregar a auditoria.'));
				setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [lotId, version]);

	function runAudit() {
		setLoading(true);
		setVersion((value) => value + 1);
	}

	if (error) {
		return (
			<Layout>
				<div className="py-24 text-center">
					<h1 className="font-serif text-2xl font-semibold">{error}</h1>
					<Link to="/" className="mt-4 inline-block text-sm underline">
						Voltar para a vitrine
					</Link>
				</div>
			</Layout>
		);
	}

	if (!audit) {
		return (
			<Layout>
				<PageLoader />
			</Layout>
		);
	}

	const intact = audit.report.intact && (browser ? browser.intact : true);
	const serverBad = new Set(audit.report.bids.filter((bid) => !bid.ok).map((bid) => bid.seq));

	return (
		<Layout>
			<Link
				to={`/lotes/${audit.lot.id}`}
				className="mb-6 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
			>
				<ArrowLeft className="size-4" /> Voltar ao lote
			</Link>

			<div className="flex flex-col gap-6 sm:flex-row sm:items-center">
				<LotImage item={audit.lot.item} alt={audit.lot.title} className="size-20 rounded-xl" />
				<div className="flex-1">
					<p className="text-sm font-semibold tracking-widest text-brand-700 uppercase dark:text-brand-400">
						Auditoria pública
					</p>
					<h1 className="font-serif text-3xl font-semibold tracking-tight">{audit.lot.title}</h1>
					<p className="text-sm text-stone-500">
						{audit.lot.bidCount} {audit.lot.bidCount === 1 ? 'lance' : 'lances'} · verificado em{' '}
						{formatDateTime(audit.checkedAt)}
					</p>
				</div>
				<Button variant="secondary" onClick={runAudit} loading={loading}>
					<RefreshCw className="size-4" /> Verificar de novo
				</Button>
			</div>

			<div
				className={`mt-8 flex items-start gap-4 rounded-2xl p-6 ${
					intact
						? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
						: 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100'
				}`}
				role="status"
			>
				{intact ? (
					<ShieldCheck className="size-10 shrink-0" />
				) : (
					<ShieldAlert className="size-10 shrink-0" />
				)}
				<div>
					<h2 className="font-serif text-2xl font-semibold text-inherit">
						{intact ? 'Histórico íntegro' : 'Histórico adulterado'}
					</h2>
					<p className="mt-1 text-sm opacity-90">
						{intact
							? 'Nenhum lance foi alterado, removido ou inserido depois de registrado. Os parâmetros e o resultado do lote conferem com as assinaturas da casa de leilões.'
							: 'Os dados deste lote não batem com a cadeia assinada. Veja abaixo quais verificações falharam e quais lances foram afetados.'}
					</p>
				</div>
			</div>

			<div className="mt-6 grid gap-6 md:grid-cols-2">
				<Card className="p-6">
					<h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
						<Laptop className="size-5" /> Verificado no seu navegador
					</h3>
					<p className="mt-1 mb-4 text-xs text-stone-500">
						Recalculado aqui com a Web Crypto API e a chave pública da casa, sem confiar no
						servidor.
					</p>
					{browser ? (
						<CheckList checks={browser.checks} />
					) : (
						<p className="text-sm text-amber-700 dark:text-amber-300">{browserError}</p>
					)}
				</Card>
				<Card className="p-6">
					<h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
						<Server className="size-5" /> Verificado pelo servidor
					</h3>
					<p className="mt-1 mb-4 text-xs text-stone-500">
						Inclui checagens que só o servidor pode fazer, como a identidade por trás de cada
						pseudônimo.
					</p>
					<CheckList checks={audit.report.checks} />
				</Card>
			</div>

			<Card className="mt-6 overflow-hidden">
				<h3 className="px-6 pt-6 font-serif text-lg font-semibold">Cadeia de lances</h3>
				{audit.bids.length === 0 ? (
					<p className="px-6 py-6 text-sm text-stone-500">Este lote não recebeu lances.</p>
				) : (
					<div className="mt-3 overflow-x-auto">
						<table className="w-full min-w-[720px] text-sm">
							<thead className="bg-stone-50 text-left text-xs text-stone-500 uppercase dark:bg-stone-800/50">
								<tr>
									<th className="px-6 py-2 font-medium">#</th>
									<th className="px-6 py-2 font-medium">Licitante</th>
									<th className="px-6 py-2 text-right font-medium">Valor</th>
									<th className="px-6 py-2 font-medium">Horário</th>
									<th className="px-6 py-2 font-medium">Hash</th>
									<th className="px-6 py-2 font-medium">Status</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-stone-200 dark:divide-stone-800">
								{audit.bids.map((bid) => {
									const problems =
										audit.report.bids.find((item) => item.seq === bid.seq)?.problems ?? [];
									const bad = serverBad.has(bid.seq) || browser?.badBids.has(bid.seq);
									return (
										<tr key={bid.seq} className={bad ? 'bg-red-50/60 dark:bg-red-950/30' : ''}>
											<td className="px-6 py-3 tabular text-stone-500">{bid.seq}</td>
											<td className="px-6 py-3">{bid.bidderAlias}</td>
											<td className="px-6 py-3 text-right font-semibold tabular">
												{formatBRL(bid.amountCents)}
											</td>
											<td className="px-6 py-3 whitespace-nowrap text-stone-500 tabular">
												{new Date(bid.placedAt).toLocaleDateString('pt-BR')}{' '}
												{formatTime(bid.placedAt)}
											</td>
											<td className="px-6 py-3 font-mono text-xs text-stone-500" title={bid.hash}>
												{shortHash(bid.hash)}
											</td>
											<td className="px-6 py-3">
												{bad ? (
													<span className="text-xs text-red-700 dark:text-red-300">
														{problems.length > 0
															? problems.join('; ')
															: 'Falhou na verificação local'}
													</span>
												) : (
													<span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
														<CheckCircle2 className="size-3.5" /> Íntegro
													</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</Card>

			<div className="mt-6 grid gap-6 lg:grid-cols-2">
				<Card className="p-6">
					<h3 className="font-serif text-lg font-semibold">Como funciona</h3>
					<ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-stone-600 dark:text-stone-300">
						<li>
							Ao criar o lote, seus parâmetros (lance inicial, incremento, datas) viram o{' '}
							<strong>gênesis</strong> da cadeia.
						</li>
						<li>
							Cada lance guarda o hash SHA-256 de seus dados{' '}
							<strong>mais o hash do lance anterior</strong>. Mudar, remover ou inserir um lance
							quebra todos os elos seguintes.
						</li>
						<li>
							Cada lance e o <strong>selo</strong> do lote (quantidade de lances, último hash, prazo
							e resultado) são assinados com a chave Ed25519 privada da casa. Sem ela, ninguém
							consegue refazer a cadeia, nem quem tem acesso direto ao banco.
						</li>
						<li>
							Esta página baixa os dados crus e confere tudo com a <strong>chave pública</strong>.
							Os licitantes aparecem só por pseudônimo.
						</li>
					</ol>
				</Card>
				<Card className="p-6">
					<h3 className="font-serif text-lg font-semibold">Dados técnicos</h3>
					<dl className="mt-3 space-y-3 text-xs">
						{[
							['Chave pública (Ed25519)', audit.publicKey],
							['Hash gênesis', audit.lot.genesisHash],
							['Último elo (cabeça)', audit.lot.headHash],
							['Assinatura do selo', audit.lot.sealSignature],
						].map(([label, value]) => (
							<div key={label}>
								<dt className="text-stone-500">{label}</dt>
								<dd className="font-mono break-all text-stone-800 dark:text-stone-200">{value}</dd>
							</div>
						))}
					</dl>
				</Card>
			</div>
		</Layout>
	);
}
