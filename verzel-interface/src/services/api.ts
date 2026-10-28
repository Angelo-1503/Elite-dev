import axios from 'axios';
import { syncClock } from '../lib/clock';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

const api = axios.create({
	baseURL: API_URL,
});

api.interceptors.request.use((config) => {
	const token = localStorage.getItem('token');
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

api.interceptors.response.use(
	(response) => {
		// Respostas com o horário do servidor acertam o relógio das contagens regressivas.
		if (response.data && typeof response.data.serverTime === 'string') {
			syncClock(response.data.serverTime);
		}
		return response;
	},
	(error) => {
		if (error.response?.status === 401 && localStorage.getItem('token')) {
			localStorage.removeItem('token');
			localStorage.removeItem('user');
			window.location.href = '/login?expirado=1';
		}
		return Promise.reject(error);
	},
);

/** URL absoluta de um caminho da API (ex.: imagens servidas pelo backend). */
export function apiUrl(path: string) {
	return `${API_URL}${path}`;
}

export default api;
