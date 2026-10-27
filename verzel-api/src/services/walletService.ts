import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { HttpError } from "../utils/httpError";
import { isValidAmount } from "../utils/money";
import { lockUser, runTransaction } from "../utils/transaction";
import { emitToUser } from "./realtime";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Saldo comprometido = soma dos lances que o usuário lidera em lotes ainda ativos.
 * É derivado (não armazenado): quando alguém supera o lance, o lote troca de líder
 * e o valor volta ao disponível na mesma transação, sem chance de ficar dessincronizado.
 */
export async function committedCents(
	db: Db,
	userId: string,
	excludeLotId?: string,
) {
	const result = await db.lot.aggregate({
		_sum: { currentBidCents: true },
		where: {
			leaderId: userId,
			status: "ACTIVE",
			...(excludeLotId ? { id: { not: excludeLotId } } : {}),
		},
	});
	return result._sum.currentBidCents ?? 0;
}

export async function getWalletSummary(userId: string) {
	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) throw new HttpError(404, "Usuário não encontrado");

	const [committed, commitments, entries] = await Promise.all([
		committedCents(prisma, userId),
		prisma.lot.findMany({
			where: { leaderId: userId, status: "ACTIVE" },
			select: { id: true, title: true, currentBidCents: true, endsAt: true },
			orderBy: { endsAt: "asc" },
		}),
		prisma.ledgerEntry.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
			take: 50,
		}),
	]);

	return {
		totalCents: user.balanceCents,
		committedCents: committed,
		availableCents: user.balanceCents - committed,
		commitments: commitments.map((lot) => ({
			lotId: lot.id,
			title: lot.title,
			amountCents: lot.currentBidCents ?? 0,
			endsAt: lot.endsAt,
		})),
		entries,
	};
}

/** Limite por depósito simulado (R$ 1 milhão). */
export const MAX_DEPOSIT_CENTS = 100_000_000;

export async function deposit(userId: string, amountCents: unknown) {
	if (!isValidAmount(amountCents) || amountCents > MAX_DEPOSIT_CENTS) {
		throw new HttpError(
			400,
			"Informe um valor de depósito entre R$ 0,01 e R$ 1.000.000,00",
			"INVALID_AMOUNT",
		);
	}

	await runTransaction(async (tx) => {
		const user = await lockUser(tx, userId);
		if (!user) throw new HttpError(404, "Usuário não encontrado");
		if (user.role !== "BIDDER") {
			throw new HttpError(
				403,
				"Somente licitantes possuem carteira",
				"NOT_A_BIDDER",
			);
		}

		const balanceAfter = user.balanceCents + amountCents;
		await tx.user.update({
			where: { id: userId },
			data: { balanceCents: balanceAfter },
		});
		await tx.ledgerEntry.create({
			data: {
				userId,
				type: "DEPOSIT",
				amountCents,
				balanceAfterCents: balanceAfter,
			},
		});
	});

	const summary = await getWalletSummary(userId);
	emitToUser(userId, "wallet:updated", summary);
	return summary;
}
