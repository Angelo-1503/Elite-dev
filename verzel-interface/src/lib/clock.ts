/**
 * Diferença entre o relógio do servidor e o do navegador. As contagens regressivas
 * usam serverNow() para não depender do relógio (às vezes errado) do usuário.
 */
let offsetMs = 0;

export function syncClock(serverTime: string) {
	const server = new Date(serverTime).getTime();
	if (!Number.isNaN(server)) offsetMs = server - Date.now();
}

export function serverNow() {
	return Date.now() + offsetMs;
}
