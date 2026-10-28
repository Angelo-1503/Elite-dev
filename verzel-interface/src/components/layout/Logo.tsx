import { Gavel } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Logo() {
	return (
		<Link to="/" className="flex items-center gap-2" aria-label="Arremate — página inicial">
			<span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm dark:bg-brand-500 dark:text-stone-950">
				<Gavel className="size-5" />
			</span>
			<span className="font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
				Arremate
			</span>
		</Link>
	);
}
