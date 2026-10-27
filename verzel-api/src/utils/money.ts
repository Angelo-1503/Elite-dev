const formatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

export function formatBRL(cents: number) {
	return formatter.format(cents / 100);
}

/** Maior valor aceito em qualquer campo de dinheiro (R$ 10 milhões). */
export const MAX_AMOUNT_CENTS = 1_000_000_000;

export function isValidAmount(value: unknown): value is number {
	return (
		typeof value === "number" &&
		Number.isInteger(value) &&
		value > 0 &&
		value <= MAX_AMOUNT_CENTS
	);
}
