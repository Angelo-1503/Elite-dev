import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

interface FetchState<T> {
	data: T | null;
	error: unknown;
	/** Para qual requisição (url + params) este estado vale. */
	key: string | null;
}

/**
 * GET com estado de carregamento. Ignora respostas que chegam fora de ordem
 * (ex.: o usuário trocou o filtro antes da busca anterior terminar).
 * `reload()` refaz a busca em segundo plano, mantendo os dados atuais na tela.
 */
export function useFetch<T>(url: string | null, params?: Record<string, unknown>) {
	const requestKey = url ? JSON.stringify([url, params ?? {}]) : null;
	const [state, setState] = useState<FetchState<T>>({ data: null, error: null, key: null });
	const [version, setVersion] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: version é o gatilho do reload()
	useEffect(() => {
		if (!requestKey) return;
		const [path, query] = JSON.parse(requestKey) as [string, Record<string, unknown>];
		let active = true;

		api
			.get<T>(path, { params: query })
			.then((response) => {
				if (active) setState({ data: response.data, error: null, key: requestKey });
			})
			.catch((error) => {
				if (active) setState((current) => ({ ...current, error, key: requestKey }));
			});

		return () => {
			active = false;
		};
	}, [requestKey, version]);

	const reload = useCallback(() => setVersion((value) => value + 1), []);
	const setData = useCallback((update: (current: T | null) => T | null) => {
		setState((current) => ({ ...current, data: update(current.data) }));
	}, []);

	return {
		data: state.data,
		error: state.error,
		loading: state.key !== requestKey,
		reload,
		setData,
	};
}
