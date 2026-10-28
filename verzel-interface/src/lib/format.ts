const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(cents: number | null | undefined) {
	return currency.format((cents ?? 0) / 100);
}

/** Converte o texto digitado ("1.250,50", "1250.5", "1250") em centavos. */
export function parseBRL(value: string): number | null {
	const clean = value.replace(/[^\d,.-]/g, '').trim();
	if (!clean) return null;

	let normalized = clean;
	if (clean.includes(',')) {
		normalized = clean.replace(/\./g, '').replace(',', '.');
	} else if ((clean.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(clean)) {
		normalized = clean.replace(/\./g, '');
	}

	const number = Number(normalized);
	if (!Number.isFinite(number)) return null;
	return Math.round(number * 100);
}

/** Centavos para o formato do campo de digitação: 125050 -> "1.250,50". */
export function centsToInput(cents: number) {
	return (cents / 100).toLocaleString('pt-BR', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

export function formatDateTime(value: string | Date | null | undefined) {
	if (!value) return '-';
	return new Date(value).toLocaleString('pt-BR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function formatTime(value: string | Date) {
	return new Date(value).toLocaleTimeString('pt-BR', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
}

/** Tempo restante legível: "2d 03h", "04:12:09", "00:45". */
export function formatCountdown(ms: number) {
	if (ms <= 0) return '00:00';
	const totalSeconds = Math.floor(ms / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const pad = (n: number) => String(n).padStart(2, '0');

	if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
	if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
	return `${pad(minutes)}:${pad(seconds)}`;
}

export function shortHash(hash: string, size = 10) {
	return `${hash.slice(0, size)}…${hash.slice(-4)}`;
}

/** Valor para <input type="datetime-local"> no fuso do navegador. */
export function toDateTimeLocal(date: Date) {
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}
