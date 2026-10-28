import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { apiUrl } from '../../services/api';
import type { Item } from '../../types';

interface LotImageProps {
	item?: Item;
	alt: string;
	className?: string;
}

/** Imagem servida pelo nosso backend (snapshot), com placeholder se não houver. */
export default function LotImage({ item, alt, className = '' }: LotImageProps) {
	const [failed, setFailed] = useState(false);

	if (!item || failed) {
		return (
			<div
				className={`flex items-center justify-center bg-stone-100 text-stone-400 dark:bg-stone-800 ${className}`}
			>
				<ImageOff className="size-8" aria-label="Imagem indisponível" />
			</div>
		);
	}

	return (
		<img
			src={apiUrl(item.imagePath)}
			alt={alt}
			loading="lazy"
			onError={() => setFailed(true)}
			className={`bg-stone-100 object-cover dark:bg-stone-800 ${className}`}
		/>
	);
}
