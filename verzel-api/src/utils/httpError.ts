import type { Response } from "express";

/** Erro de negócio com status HTTP, código estável (para o front) e dados extras. */
export class HttpError extends Error {
	constructor(
		public status: number,
		message: string,
		public code?: string,
		public extra?: Record<string, unknown>,
	) {
		super(message);
	}
}

export function handleError(
	res: Response,
	error: unknown,
	fallbackMessage: string,
) {
	if (error instanceof HttpError) {
		return res
			.status(error.status)
			.json({ message: error.message, code: error.code, ...error.extra });
	}

	console.error(error);
	return res.status(500).json({ message: fallbackMessage });
}
