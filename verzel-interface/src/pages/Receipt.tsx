import { BadgeCheck, Gavel, Printer, Share2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import LotImage from '../components/lots/LotImage';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { PageLoader } from '../components/ui/Spinner';
import { getErrorMessage } from '../lib/errors';
import { formatBRL, formatDateTime, shortHash } from '../lib/format';
import { receiptUrl, shareLink } from '../lib/share';
import { type BrowserReceiptResult, verifyReceiptInBrowser } from '../lib/verify';
import api from '../services/api';
import type { Receipt as ReceiptType } from '../types';

export default function Receipt() {
	const { id = '' } = useParams();
	const [receipt, setReceipt] = useState<ReceiptType | null>(null);
	const [browser, setBrowser] = useState<BrowserReceiptResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		api
			.get<ReceiptType>(`/receipts/${id}`)
			.then(async (response) => {
				setReceipt(response.data);
				try {
					setBrowser(await verifyReceiptInBrowser(response.data));
				} catch {
					setBrowser(null);
				}
			})
			.catch((requestError) =>
				setError(getErrorMessage(requestError, 'Comprovante não encontrado')),
			);
	}, [id]);

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

	if (!receipt) {
		return (
			<Layout>
				<PageLoader />
			</Layout>
		);
	}

	const valid =
		receipt.valid && (browser ? browser.signatureValid && browser.matchesDisplay : true);

	return (
		<Layout>
			<div className="mx-auto max-w-2xl">
				{receipt.isMine && (
					<div className="mb-6 flex items-center gap-3 rounded-xl bg-brand-50 p-4 text-brand-900 print:hidden dark:bg-brand-900/30 dark:text-brand-100">
						<BadgeCheck className="size-6 shrink-0" />
						<p className="text-sm">
							<strong>Parabéns!</strong> Este é o comprovante do seu arremate. Compartilhe o link:
							ele é público e não mostra seus dados pessoais.
						</p>
					</div>
				)}

				<Card className="overflow-hidden">
					<div className="border-b border-dashed border-stone-300 bg-stone-50 px-8 py-6 text-center dark:border-stone-700 dark:bg-stone-800/40">
						<Gavel className="mx-auto size-8 text-brand-600 dark:text-brand-400" />
						<p className="mt-2 text-xs font-semibold tracking-[0.3em] text-stone-500 uppercase">
							Comprovante de arremate
						</p>
						<p className="mt-1 font-mono text-xs text-stone-400">Nº {receipt.id}</p>
					</div>

					<div className="px-8 py-6">
						<div className="flex gap-4">
							<LotImage
								item={receipt.item}
								alt={receipt.lotTitle}
								className="size-24 shrink-0 rounded-xl"
							/>
							<div>
								<h1 className="font-serif text-2xl font-semibold">{receipt.lotTitle}</h1>
								{receipt.item.artist && (
									<p className="text-sm text-stone-500">{receipt.item.artist}</p>
								)}
								{receipt.item.dateDisplay && (
									<p className="text-sm text-stone-500">{receipt.item.dateDisplay}</p>
								)}
							</div>
						</div>

						<dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
							<div className="col-span-2 rounded-xl bg-stone-50 p-4 dark:bg-stone-800/50">
								<dt className="text-stone-500">Valor do arremate</dt>
								<dd className="font-serif text-3xl font-semibold tabular">
									{formatBRL(receipt.amountCents)}
								</dd>
							</div>
							<div>
								<dt className="text-stone-500">Arrematante</dt>
								<dd className="font-semibold">{receipt.winnerAlias}</dd>
							</div>
							<div>
								<dt className="text-stone-500">Data</dt>
								<dd className="font-semibold">{formatDateTime(receipt.issuedAt)}</dd>
							</div>
							<div>
								<dt className="text-stone-500">Leiloeiro</dt>
								<dd className="font-semibold">{receipt.sellerName}</dd>
							</div>
							<div>
								<dt className="text-stone-500">Lances no lote</dt>
								<dd className="font-semibold">{receipt.bidCount}</dd>
							</div>
						</dl>

						<div
							className={`mt-6 flex items-start gap-3 rounded-xl p-4 text-sm ${
								valid
									? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
									: 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200'
							}`}
						>
							{valid ? (
								<ShieldCheck className="size-5 shrink-0" />
							) : (
								<ShieldAlert className="size-5 shrink-0" />
							)}
							<div>
								<p className="font-semibold">
									{valid ? 'Comprovante autêntico' : 'Comprovante inválido'}
								</p>
								<p className="text-xs opacity-90">
									{valid
										? `Assinatura Ed25519 da casa de leilões conferida${browser ? ' no seu navegador' : ''}. Vinculado ao histórico do lote (último elo ${shortHash(receipt.headHash)}).`
										: 'A assinatura não confere ou o histórico do lote foi alterado depois do arremate.'}
								</p>
							</div>
						</div>
					</div>

					<div className="flex flex-wrap gap-2 border-t border-stone-200 px-8 py-4 print:hidden dark:border-stone-800">
						<Button
							onClick={() => shareLink(receiptUrl(receipt.id), `Comprovante: ${receipt.lotTitle}`)}
						>
							<Share2 className="size-4" /> Compartilhar
						</Button>
						<Button variant="secondary" onClick={() => window.print()}>
							<Printer className="size-4" /> Imprimir
						</Button>
						<Link
							to={`/auditoria/${receipt.lotId}`}
							className="ml-auto inline-flex items-center gap-1 self-center text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400"
						>
							<ShieldCheck className="size-4" /> Auditar o lote
						</Link>
					</div>
				</Card>
			</div>
		</Layout>
	);
}
