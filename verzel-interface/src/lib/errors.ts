import axios from 'axios';

/** Mensagem amigável a partir de um erro da API (o backend sempre envia { message }). */
export function getErrorMessage(error: unknown, fallback = 'Algo deu errado. Tente novamente.') {
	if (axios.isAxiosError(error)) {
		if (!error.response) return 'Não foi possível conectar ao servidor.';
		const message = error.response.data?.message;
		if (typeof message === 'string') return message;
	}
	return fallback;
}

export function getErrorCode(error: unknown): string | undefined {
	if (axios.isAxiosError(error)) return error.response?.data?.code;
	return undefined;
}
