import { LoaderCircle } from 'lucide-react';

export default function Spinner({ className = 'size-6' }: { className?: string }) {
	return <LoaderCircle className={`animate-spin ${className}`} aria-hidden="true" />;
}

export function PageLoader() {
	return (
		<div className="flex justify-center py-24 text-stone-400" role="status" aria-label="Carregando">
			<Spinner className="size-8" />
		</div>
	);
}
