import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

// O Socket.IO fica na raiz do servidor, não em /api.
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');

let socket: Socket | null = null;

/** Socket único da aplicação. Reconecta automaticamente e entra no canal do usuário logado. */
export function getSocket() {
	if (!socket) {
		socket = io(SOCKET_URL, {
			auth: (cb) => cb({ token: localStorage.getItem('token') }),
			transports: ['websocket', 'polling'],
		});
	}
	return socket;
}

/** Reabre a conexão para o servidor reconhecer o novo token (após login/logout). */
export function reconnectSocket() {
	const current = getSocket();
	current.disconnect();
	current.connect();
}
