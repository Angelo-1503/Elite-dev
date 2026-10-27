import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

/**
 * Cliente da API pública do Art Institute of Chicago (https://api.artic.edu/docs).
 *
 * Resiliência:
 * - timeout em toda chamada (a API não pode travar a nossa);
 * - cache em memória com TTL; se a API falhar, servimos a última resposta conhecida (stale);
 * - circuit breaker: após falhas seguidas, paramos de chamar por um tempo e respondemos
 *   do cache (ou com 503 amigável) em vez de empilhar requisições lentas.
 * Só a busca de itens do painel do leiloeiro depende da API. Vitrine, salas, auditoria
 * e comprovantes usam o snapshot salvo no banco quando o lote foi criado.
 */
const API_URL = "https://api.artic.edu/api/v1";
const IIIF_URL = "https://www.artic.edu/iiif/2";
const TIMEOUT_MS = 6000;
const SEARCH_TTL_MS = 10 * 60 * 1000;
const ARTWORK_TTL_MS = 60 * 60 * 1000;
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 30 * 1000;
const MAX_CACHE_ENTRIES = 500;

const FIELDS = [
	"id",
	"title",
	"artist_display",
	"date_display",
	"medium_display",
	"dimensions",
	"place_of_origin",
	"image_id",
	"artwork_type_title",
	"department_title",
	"classification_title",
	"style_title",
	"credit_line",
	"is_public_domain",
].join(",");

interface AicArtworkRaw {
	id: number;
	title: string | null;
	artist_display: string | null;
	date_display: string | null;
	medium_display: string | null;
	dimensions: string | null;
	place_of_origin: string | null;
	image_id: string | null;
	artwork_type_title: string | null;
	department_title: string | null;
	classification_title: string | null;
	style_title: string | null;
	credit_line: string | null;
	is_public_domain: boolean | null;
}

export interface Artwork {
	externalId: string;
	title: string;
	artist: string | null;
	dateDisplay: string | null;
	medium: string | null;
	dimensions: string | null;
	origin: string | null;
	imageId: string | null;
	imageUrl: string | null;
	thumbnailUrl: string | null;
	attributes: Record<string, string>;
}

export interface SearchResult {
	items: Artwork[];
	page: number;
	totalPages: number;
	/** true quando a resposta veio do cache porque a API está fora. */
	stale: boolean;
}

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string) {
	return cache.get(key) as CacheEntry<T> | undefined;
}

function cacheSet<T>(key: string, value: T, ttlMs: number) {
	if (cache.size >= MAX_CACHE_ENTRIES) {
		const oldestKey = cache.keys().next().value;
		if (oldestKey) cache.delete(oldestKey);
	}
	cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

const breaker = { failures: 0, openUntil: 0 };

function breakerOpen() {
	return Date.now() < breaker.openUntil;
}

function recordSuccess() {
	breaker.failures = 0;
	breaker.openUntil = 0;
}

function recordFailure() {
	breaker.failures++;
	if (breaker.failures >= BREAKER_THRESHOLD) {
		breaker.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
	}
}

async function fetchWithTimeout(url: string) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		return await fetch(url, {
			signal: controller.signal,
			headers: { "AIC-User-Agent": env.aicUserAgent },
		});
	} finally {
		clearTimeout(timer);
	}
}

const unavailable = () =>
	new HttpError(
		503,
		"O catálogo de obras está temporariamente indisponível. Tente novamente em instantes.",
		"EXTERNAL_API_UNAVAILABLE",
	);

/** Busca JSON com cache + circuit breaker. Em falha, devolve o cache vencido se houver. */
async function cachedJson<T>(
	key: string,
	url: string,
	ttlMs: number,
): Promise<{ data: T; stale: boolean }> {
	const cached = cacheGet<T>(key);
	if (cached && cached.expiresAt > Date.now()) {
		return { data: cached.value, stale: false };
	}

	if (breakerOpen()) {
		if (cached) return { data: cached.value, stale: true };
		throw unavailable();
	}

	try {
		const response = await fetchWithTimeout(url);
		if (response.status === 404) {
			throw new HttpError(404, "Obra não encontrada no catálogo", "NOT_FOUND");
		}
		if (!response.ok) throw new Error(`AIC respondeu ${response.status}`);

		const data = (await response.json()) as T;
		recordSuccess();
		cacheSet(key, data, ttlMs);
		return { data, stale: false };
	} catch (error) {
		if (error instanceof HttpError) throw error;
		recordFailure();
		console.warn("[aic] falha ao consultar API:", (error as Error).message);
		if (cached) return { data: cached.value, stale: true };
		throw unavailable();
	}
}

function imageUrl(imageId: string, width: number) {
	return `${IIIF_URL}/${imageId}/full/${width},/0/default.jpg`;
}

function toArtwork(raw: AicArtworkRaw): Artwork {
	const attributes: Record<string, string> = {};
	const add = (label: string, value: string | null) => {
		if (value) attributes[label] = value;
	};
	add("Tipo", raw.artwork_type_title);
	add("Classificação", raw.classification_title);
	add("Estilo", raw.style_title);
	add("Departamento", raw.department_title);
	add("Procedência", raw.credit_line);
	add(
		"Domínio público",
		raw.is_public_domain == null ? null : raw.is_public_domain ? "Sim" : "Não",
	);

	return {
		externalId: String(raw.id),
		title: raw.title?.trim() || "Sem título",
		artist: raw.artist_display,
		dateDisplay: raw.date_display,
		medium: raw.medium_display,
		dimensions: raw.dimensions,
		origin: raw.place_of_origin,
		imageId: raw.image_id,
		imageUrl: raw.image_id ? imageUrl(raw.image_id, 843) : null,
		thumbnailUrl: raw.image_id ? imageUrl(raw.image_id, 400) : null,
		attributes,
	};
}

export async function searchArtworks(
	query: string,
	page = 1,
): Promise<SearchResult> {
	const limit = 12;
	const q = query.trim();
	const params = new URLSearchParams({
		fields: FIELDS,
		limit: String(limit),
		page: String(page),
		// Só obras com imagem — sem imagem o lote fica pobre na vitrine.
		"query[exists][field]": "image_id",
	});
	if (q) params.set("q", q);

	const key = `search:${q.toLowerCase()}:${page}`;
	const { data, stale } = await cachedJson<{
		data: AicArtworkRaw[];
		pagination: { total_pages: number; current_page: number };
	}>(key, `${API_URL}/artworks/search?${params}`, SEARCH_TTL_MS);

	return {
		items: data.data.map(toArtwork),
		page: data.pagination.current_page,
		totalPages: Math.min(data.pagination.total_pages, 100),
		stale,
	};
}

export async function getArtwork(externalId: string): Promise<Artwork> {
	if (!/^\d+$/.test(externalId)) {
		throw new HttpError(400, "Identificador de obra inválido", "INVALID_ID");
	}
	const { data } = await cachedJson<{ data: AicArtworkRaw }>(
		`artwork:${externalId}`,
		`${API_URL}/artworks/${externalId}?fields=${FIELDS}`,
		ARTWORK_TTL_MS,
	);
	return toArtwork(data.data);
}

/** Baixa a imagem para guardarmos no banco. Falha não impede a criação do lote. */
export async function downloadImage(url: string) {
	try {
		const response = await fetchWithTimeout(url);
		if (!response.ok) return null;
		const mime = response.headers.get("content-type") ?? "image/jpeg";
		if (!mime.startsWith("image/")) return null;
		const buffer = Buffer.from(await response.arrayBuffer());
		return { data: buffer, mime };
	} catch (error) {
		console.warn("[aic] falha ao baixar imagem:", (error as Error).message);
		return null;
	}
}
