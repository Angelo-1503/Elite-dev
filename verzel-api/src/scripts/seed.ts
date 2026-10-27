/**
 * Dados de teste: 1 leiloeiro, 2 licitantes e lotes em todas as fases
 * (ao vivo com lances, agendado, encerrado com comprovante, sem lances e cancelado).
 *
 *   npm run db:seed            -> só popula se o banco estiver vazio
 *   npm run db:seed -- --force -> apaga tudo e popula de novo (datas relativas a agora)
 *
 * Os lances são gravados pela mesma rotina da cadeia de hashes usada em produção,
 * então a auditoria de todos os lotes do seed fica íntegra.
 */

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../config/database";
import { downloadImage, getArtwork } from "../services/aicService";
import { appendBid, createLotChain, signSeal } from "../services/chainService";
import { settleLot } from "../services/settlementService";

const PASSWORD = "senha123";
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Metadados de reserva caso a API esteja fora no momento do seed. */
const ARTWORKS: Record<
	string,
	{ title: string; artist: string; date: string }
> = {
	"16568": {
		title: "Water Lilies",
		artist: "Claude Monet (French, 1840–1926)",
		date: "1906",
	},
	"28560": {
		title: "The Bedroom",
		artist: "Vincent van Gogh (Dutch, 1853–1890)",
		date: "1889",
	},
	"20684": {
		title: "Paris Street; Rainy Day",
		artist: "Gustave Caillebotte (French, 1848–1894)",
		date: "1877",
	},
	"16571": {
		title: "Arrival of the Normandy Train, Gare Saint-Lazare",
		artist: "Claude Monet (French, 1840–1926)",
		date: "1877",
	},
	"27992": {
		title: "A Sunday on La Grande Jatte — 1884",
		artist: "Georges Seurat (French, 1859–1891)",
		date: "1884–86",
	},
	"64818": {
		title: "Stacks of Wheat (End of Summer)",
		artist: "Claude Monet (French, 1840–1926)",
		date: "1890–91",
	},
	"80607": {
		title: "Self-Portrait",
		artist: "Vincent van Gogh (Dutch, 1853–1890)",
		date: "1887",
	},
	"14655": {
		title: "Two Sisters (On the Terrace)",
		artist: "Pierre-Auguste Renoir (French, 1841–1919)",
		date: "1881",
	},
};

async function createItem(externalId: string) {
	try {
		const artwork = await getArtwork(externalId);
		const image = artwork.imageUrl
			? await downloadImage(artwork.imageUrl)
			: null;
		return prisma.item.create({
			data: {
				source: "aic",
				externalId,
				title: artwork.title,
				artist: artwork.artist,
				dateDisplay: artwork.dateDisplay,
				medium: artwork.medium,
				dimensions: artwork.dimensions,
				origin: artwork.origin,
				attributes: artwork.attributes,
				imageUrl: artwork.imageUrl,
				imageData: image?.data,
				imageMime: image?.mime,
			},
		});
	} catch {
		const fallback = ARTWORKS[externalId];
		console.warn(
			`  API indisponível para a obra ${externalId}; usando dados de reserva`,
		);
		return prisma.item.create({
			data: {
				source: "aic",
				externalId,
				title: fallback?.title ?? `Obra ${externalId}`,
				artist: fallback?.artist,
				dateDisplay: fallback?.date,
				attributes: {},
			},
		});
	}
}

interface LotSeed {
	externalId: string;
	description: string;
	startingBidCents: number;
	minIncrementCents: number;
	startsAt: Date;
	endsAt: Date;
	bids?: { bidderId: string; amountCents: number; placedAt: Date }[];
}

async function createSeedLot(sellerId: string, seed: LotSeed) {
	const item = await createItem(seed.externalId);
	const lotId = crypto.randomUUID();

	let lot = await prisma.lot.create({
		data: {
			id: lotId,
			sellerId,
			itemId: item.id,
			title: item.title,
			description: seed.description,
			startingBidCents: seed.startingBidCents,
			minIncrementCents: seed.minIncrementCents,
			startsAt: seed.startsAt,
			endsAt: seed.endsAt,
			originalEndsAt: seed.endsAt,
			...createLotChain({
				lotId,
				itemId: item.id,
				sellerId,
				startingBidCents: seed.startingBidCents,
				minIncrementCents: seed.minIncrementCents,
				startsAt: seed.startsAt,
				endsAt: seed.endsAt,
			}),
		},
	});

	for (const bid of seed.bids ?? []) {
		const result = await prisma.$transaction((tx) =>
			appendBid(tx, {
				lot,
				bidderId: bid.bidderId,
				amountCents: bid.amountCents,
				placedAt: bid.placedAt,
				endsAt: lot.endsAt,
				extended: false,
			}),
		);
		lot = result.lot;
	}

	return lot;
}

async function deposit(userId: string, amountCents: number) {
	const user = await prisma.user.update({
		where: { id: userId },
		data: { balanceCents: { increment: amountCents } },
	});
	await prisma.ledgerEntry.create({
		data: {
			userId,
			type: "DEPOSIT",
			amountCents,
			balanceAfterCents: user.balanceCents,
		},
	});
}

async function clearDatabase() {
	await prisma.receipt.deleteMany();
	await prisma.ledgerEntry.deleteMany();
	await prisma.bid.deleteMany();
	await prisma.lot.deleteMany();
	await prisma.item.deleteMany();
	await prisma.user.deleteMany();
}

async function main() {
	const force = process.argv.includes("--force");

	if ((await prisma.user.count()) > 0) {
		if (!force) {
			console.log(
				"O banco já tem dados — seed ignorado (use --force para recriar).",
			);
			return;
		}
		console.log("Limpando o banco...");
		await clearDatabase();
	}

	const password = await bcrypt.hash(PASSWORD, 10);
	const seller = await prisma.user.create({
		data: {
			name: "Leiloeiro Demo",
			email: "leiloeiro@verzel.com",
			password,
			role: "AUCTIONEER",
		},
	});
	const ana = await prisma.user.create({
		data: {
			name: "Ana Souza",
			email: "ana@verzel.com",
			password,
			role: "BIDDER",
		},
	});
	const bruno = await prisma.user.create({
		data: {
			name: "Bruno Lima",
			email: "bruno@verzel.com",
			password,
			role: "BIDDER",
		},
	});

	await deposit(ana.id, 150_000_00);
	await deposit(bruno.id, 150_000_00);

	const now = Date.now();
	const at = (offsetMs: number) => new Date(now + offsetMs);

	console.log(
		"Criando lotes (buscando obras na API do Art Institute of Chicago)...",
	);

	await createSeedLot(seller.id, {
		externalId: "16568",
		description:
			"Uma das célebres Ninfeias de Monet, pintada no jardim de Giverny.",
		startingBidCents: 20_000_00,
		minIncrementCents: 1_000_00,
		startsAt: at(-2 * HOUR),
		endsAt: at(20 * DAY),
		bids: [
			{ bidderId: ana.id, amountCents: 20_000_00, placedAt: at(-110 * MINUTE) },
			{
				bidderId: bruno.id,
				amountCents: 22_000_00,
				placedAt: at(-90 * MINUTE),
			},
			{ bidderId: ana.id, amountCents: 25_000_00, placedAt: at(-60 * MINUTE) },
		],
	});

	await createSeedLot(seller.id, {
		externalId: "28560",
		description:
			"O quarto de Van Gogh em Arles, na segunda das três versões que ele pintou.",
		startingBidCents: 15_000_00,
		minIncrementCents: 500_00,
		startsAt: at(-1 * HOUR),
		endsAt: at(10 * DAY),
		bids: [
			{
				bidderId: bruno.id,
				amountCents: 15_000_00,
				placedAt: at(-40 * MINUTE),
			},
		],
	});

	await createSeedLot(seller.id, {
		externalId: "20684",
		description:
			"A Paris de Haussmann num dia de chuva — ícone do impressionismo urbano.",
		startingBidCents: 30_000_00,
		minIncrementCents: 2_000_00,
		startsAt: at(-10 * MINUTE),
		endsAt: at(7 * DAY),
	});

	await createSeedLot(seller.id, {
		externalId: "16571",
		description:
			"Lote curto para testar a prorrogação (anti-sniping) e o encerramento ao vivo.",
		startingBidCents: 5_000_00,
		minIncrementCents: 250_00,
		startsAt: at(-5 * MINUTE),
		endsAt: at(30 * MINUTE),
	});

	await createSeedLot(seller.id, {
		externalId: "27992",
		description: "A obra-prima pontilhista de Seurat. Lote agendado.",
		startingBidCents: 50_000_00,
		minIncrementCents: 2_500_00,
		startsAt: at(1 * DAY),
		endsAt: at(5 * DAY),
	});

	const ended = await createSeedLot(seller.id, {
		externalId: "64818",
		description:
			"Da série dos Montes de Trigo de Monet. Lote encerrado e arrematado.",
		startingBidCents: 10_000_00,
		minIncrementCents: 500_00,
		startsAt: at(-4 * DAY),
		endsAt: at(-2 * DAY),
		bids: [
			{
				bidderId: ana.id,
				amountCents: 10_000_00,
				placedAt: at(-4 * DAY + 2 * HOUR),
			},
			{ bidderId: bruno.id, amountCents: 11_000_00, placedAt: at(-3 * DAY) },
			{
				bidderId: ana.id,
				amountCents: 12_000_00,
				placedAt: at(-3 * DAY + 4 * HOUR),
			},
			{
				bidderId: bruno.id,
				amountCents: 13_500_00,
				placedAt: at(-2 * DAY - 3 * HOUR),
			},
		],
	});
	await settleLot(ended.id);

	const unsold = await createSeedLot(seller.id, {
		externalId: "80607",
		description: "Autorretrato de Van Gogh, de 1887. Encerrado sem lances.",
		startingBidCents: 80_000_00,
		minIncrementCents: 5_000_00,
		startsAt: at(-3 * DAY),
		endsAt: at(-1 * DAY),
	});
	await settleLot(unsold.id);

	const cancelled = await createSeedLot(seller.id, {
		externalId: "14655",
		description: "Lote cancelado pelo leiloeiro (não aparece na vitrine).",
		startingBidCents: 40_000_00,
		minIncrementCents: 2_000_00,
		startsAt: at(2 * DAY),
		endsAt: at(6 * DAY),
	});
	await prisma.lot.update({
		where: { id: cancelled.id },
		data: {
			status: "CANCELLED",
			cancelledAt: new Date(),
			sealSignature: signSeal({ ...cancelled, status: "CANCELLED" }),
		},
	});

	console.log("\nSeed concluído. Contas (senha de todas: senha123):");
	console.log("  Leiloeiro: leiloeiro@verzel.com");
	console.log("  Licitante: ana@verzel.com   (saldo R$ 150.000)");
	console.log("  Licitante: bruno@verzel.com (saldo R$ 150.000)");
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
