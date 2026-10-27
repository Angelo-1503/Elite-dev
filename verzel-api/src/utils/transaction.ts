import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";

/**
 * Executa uma transação interativa, repetindo em caso de conflito/deadlock (P2034).
 * As travas são feitas com SELECT ... FOR UPDATE dentro da transação.
 */
export async function runTransaction<T>(
	fn: (tx: Prisma.TransactionClient) => Promise<T>,
	attempts = 3,
): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await prisma.$transaction(fn, { maxWait: 5000, timeout: 10000 });
		} catch (error) {
			const retryable =
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2034";
			if (!retryable || attempt >= attempts) throw error;
		}
	}
}

/** Trava a linha do lote até o fim da transação (serializa lances concorrentes). */
export async function lockLot(tx: Prisma.TransactionClient, lotId: string) {
	await tx.$queryRaw`SELECT id FROM "lots" WHERE id = ${lotId} FOR UPDATE`;
	return tx.lot.findUnique({ where: { id: lotId } });
}

/** Trava a linha do usuário (serializa operações de saldo do mesmo usuário). */
export async function lockUser(tx: Prisma.TransactionClient, userId: string) {
	await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
	return tx.user.findUnique({ where: { id: userId } });
}
