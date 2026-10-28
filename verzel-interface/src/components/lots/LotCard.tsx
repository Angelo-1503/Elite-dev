import { Clock, Gavel } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLotTiming } from '../../hooks/useLotTiming';
import { formatBRL } from '../../lib/format';
import type { Lot } from '../../types';
import Countdown from './Countdown';
import LotImage from './LotImage';
import PhaseBadge from './PhaseBadge';

export default function LotCard({ lot }: { lot: Lot }) {
	const { phase } = useLotTiming(lot);
	const ended = phase === 'ENDED';
	const sold = ended && lot.winnerAlias;

	const priceLabel = ended
		? sold
			? 'Arrematado por'
			: 'Sem lances'
		: lot.currentBidCents
			? 'Lance atual'
			: 'Lance inicial';
	const price = ended ? lot.finalPriceCents : (lot.currentBidCents ?? lot.startingBidCents);

	return (
		<Link
			to={`/lotes/${lot.id}`}
			className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-stone-800 dark:bg-stone-900"
		>
			<div className="relative">
				<LotImage item={lot.item} alt={lot.title} className="aspect-[4/3] w-full" />
				<PhaseBadge phase={phase} className="absolute top-3 left-3 shadow-sm" />
			</div>

			<div className="flex flex-1 flex-col p-4">
				<h3 className="line-clamp-2 font-serif text-lg leading-snug font-semibold group-hover:text-brand-700 dark:group-hover:text-brand-300">
					{lot.title}
				</h3>
				{lot.item?.artist && (
					<p className="mt-1 line-clamp-1 text-sm text-stone-500 dark:text-stone-400">
						{lot.item.artist}
					</p>
				)}

				<div className="mt-auto flex items-end justify-between gap-3 pt-4">
					<div>
						<p className="text-xs text-stone-500 dark:text-stone-400">{priceLabel}</p>
						{(!ended || sold) && (
							<p className="text-xl font-semibold tabular text-stone-900 dark:text-stone-50">
								{formatBRL(price)}
							</p>
						)}
					</div>
					<div className="text-right text-xs text-stone-500 dark:text-stone-400">
						<p className="flex items-center justify-end gap-1">
							<Gavel className="size-3.5" /> {lot.bidCount}{' '}
							{lot.bidCount === 1 ? 'lance' : 'lances'}
						</p>
						{!ended && (
							<p className="mt-1 flex items-center justify-end gap-1">
								<Clock className="size-3.5" /> <Countdown lot={lot} />
							</p>
						)}
					</div>
				</div>
			</div>
		</Link>
	);
}
