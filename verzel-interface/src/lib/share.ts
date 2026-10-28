import toast from 'react-hot-toast';

/** Compartilha um link pelo menu nativo (celular) ou copia para a área de transferência. */
export async function shareLink(url: string, title: string) {
	if (navigator.share) {
		try {
			await navigator.share({ title, url });
			return;
		} catch (error) {
			if ((error as DOMException).name === 'AbortError') return;
		}
	}

	try {
		await navigator.clipboard.writeText(url);
		toast.success('Link copiado!');
	} catch {
		window.prompt('Copie o link:', url);
	}
}

export function receiptUrl(receiptId: string) {
	return `${window.location.origin}/comprovantes/${receiptId}`;
}
