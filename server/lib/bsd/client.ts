import { config } from '../../config';
import type { Quota } from './types';

/**
 * Client BSD : fetch + gestion des erreurs + quota (contrat §3).
 * La clé API n'est jamais exposée au navigateur.
 */

export class BsdError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  /** true si l'appel ne doit pas être rejoué (ex. quota épuisé). */
  readonly fatal: boolean;

  constructor(status: number, code: string, message: string, fatal = false) {
    super(message);
    this.name = 'BsdError';
    this.status = status;
    this.code = code;
    this.detail = message;
    this.fatal = fatal;
  }
}

/** Quota courant, mis à jour à chaque réponse. */
let quotaState: Quota = { remaining: null, limit: config.quotaLimit, resetIn: null };

export function getQuota(): Quota {
  return { ...quotaState };
}

/** Met à jour le quota depuis les en-têtes (structured fields, format simple). */
export function updateQuotaFromHeaders(headers: Headers): void {
  const policy = headers.get('ratelimit-policy');
  const limit = headers.get('ratelimit');
  if (policy) {
    const q = /(?:^|;)\s*q=(\d+)/i.exec(policy);
    if (q) quotaState.limit = Number.parseInt(q[1], 10);
    const w = /(?:^|;)\s*w=(\d+)/i.exec(policy);
    if (w) {
      // w = fenêtre en secondes → temps avant reset
      const window = Number.parseInt(w[1], 10);
      if (Number.isFinite(window)) quotaState.resetIn = window;
    }
  }
  if (limit) {
    const r = /(?:^|;)\s*r=(\d+)/i.exec(limit);
    if (r) quotaState.remaining = Number.parseInt(r[1], 10);
    const t = /(?:^|;)\s*t=(\d+)/i.exec(limit);
    if (t) quotaState.resetIn = Number.parseInt(t[1], 10);
  }
}

/** Analyse le corps d'erreur BSD pour en extraire le code métier. */
function parseErrorCode(body: unknown): string {
  if (body && typeof body === 'object') {
    const rec = body as Record<string, unknown>;
    for (const key of ['code', 'error', 'detail', 'message']) {
      const v = rec[key];
      if (typeof v === 'string' && v.trim()) {
        if (v.includes('taster_exhausted')) return 'taster_exhausted';
        if (v.includes('rate_limited')) return 'rate_limited';
        if (v.includes('bookmakers_not_entitled')) return 'bookmakers_not_entitled';
        return v.trim();
      }
    }
  }
  return '';
}

function errorMessage(status: number, code: string, fallback: string): string {
  switch (status) {
    case 401:
      return code || 'Clé API absente ou invalide. Créez une clé gratuite sur https://sports.bzzoiro.com/register/';
    case 402:
      return code || 'Fonctionnalité payante (add-on) indisponible sur le quota gratuit.';
    case 403:
      return code === 'bookmakers_not_entitled'
        ? 'Comparaison bookmakers non incluse dans votre abonnement.'
        : code || 'Accès refusé par l’API BSD.';
    case 404:
      return 'Ressource introuvable.';
    case 429:
      return code === 'taster_exhausted'
        ? 'Quota quotidien BSD épuisé (7 500 req/jour). Réessayez après la réinitialisation à minuit UTC.'
        : code === 'rate_limited'
          ? 'Débit dépassé (burst IP). Nouvelle tentative effectuée.'
          : code || 'Quota API dépassé.';
    case 503:
      return code || 'Service BSD momentanément indisponible.';
    default:
      return code || fallback;
  }
}

export interface BsdRequestOptions {
  /** Méthode HTTP (GET par défaut). */
  method?: string;
  /** Corps JSON optionnel. */
  body?: unknown;
  /** Timeout réseau en ms. */
  timeoutMs?: number;
  /** Désactive le retry sur 429 rate_limited. */
  noRetry?: boolean;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Limiteur de concurrence : l'API BSD plafonne les rafales à 25 req/s par IP.
 * Une page de match déclenche une dizaine d'appels en parallèle : on les
 * sérialise pour ne jamais approcher la limite (et ne pas se faire
 * couper par un 429).
 */
const MAX_CONCURRENT = 6;
let active = 0;
const waiting: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waiting.push(() => {
      active += 1;
      resolve();
    });
  });
}

function release(): void {
  active -= 1;
  const next = waiting.shift();
  if (next) next();
}

/**
 * Appel brut de l'API BSD. Renvoie le JSON parsé.
 * Lève une `BsdError` pour les erreurs HTTP.
 */
export async function bsdFetch<T = unknown>(
  path: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
  opts: BsdRequestOptions = {},
): Promise<T> {
  if (config.isDemo) {
    throw new BsdError(500, 'demo_mode', 'Le client BSD ne doit pas être appelé en mode démo.');
  }

  // La base contient déjà un chemin ("/api/v2") : on résout le chemin de l'endpoint
  // RELATIF à cette base, sinon "/leagues/1/" remplacerait "/api/v2" et on
  // recevrait la page HTML du site au lieu du JSON.
  const base = new URL(config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`);
  const url = new URL(path.replace(/^\/+/, ''), base);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Token ${config.apiKey ?? ''}`,
  };
  let payload: string | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(opts.body);
  }

  const timeoutMs = opts.timeoutMs ?? 15000;
  const maxAttempts = opts.noRetry ? 1 : 2;

  let lastError: BsdError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    await acquire();
    try {
      const res = await fetch(url.toString(), {
        method,
        headers,
        body: payload,
        signal: controller.signal,
      });

      updateQuotaFromHeaders(res.headers);

      if (res.ok) {
        const text = await res.text();
        if (!text) return null as T;
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new BsdError(res.status, 'invalid_json', 'Réponse BSD illisible.', true);
        }
      }

      let body: unknown = null;
      try {
        const text = await res.text();
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
      const code = parseErrorCode(body);

      if (res.status === 429) {
        if (code === 'taster_exhausted') {
          // Ne pas réessayer avant le reset.
          throw new BsdError(429, 'taster_exhausted', errorMessage(429, code, ''), true);
        }
        if (code === 'rate_limited' && attempt < maxAttempts) {
          const retryAfter = Number.parseInt(res.headers.get('retry-after') ?? '', 10);
          const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000;
          await sleep(wait);
          continue;
        }
      }

      throw new BsdError(res.status, code || `http_${res.status}`, errorMessage(res.status, code, `Erreur BSD ${res.status}`));
    } catch (err) {
      if (err instanceof BsdError) {
        lastError = err;
        if (err.fatal) throw err;
        throw err;
      }
      // Erreur réseau / timeout.
      lastError = new BsdError(
        503,
        'network_error',
        err instanceof Error && err.name === 'AbortError'
          ? 'Délai dépassé lors de l’appel à l’API BSD.'
          : 'Impossible de joindre l’API BSD.',
        true,
      );
      if (attempt < maxAttempts) {
        await sleep(1000);
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
      release();
    }
  }

  throw lastError ?? new BsdError(503, 'network_error', 'Échec de l’appel à l’API BSD.', true);
}

/** URLs d'images BSD (gratuites, sans authentification). */
export const imageUrls = {
  team: (id: number): string => `https://sports.bzzoiro.com/img/team/${id}/`,
  league: (id: number): string => `https://sports.bzzoiro.com/img/league/${id}/`,
  player: (id: number): string => `https://sports.bzzoiro.com/img/player/${id}/?sor=true`,
  venue: (id: number): string => `https://sports.bzzoiro.com/img/venue/${id}/`,
  manager: (id: number): string => `https://sports.bzzoiro.com/img/manager/${id}/`,
};

/** Conversion d'un objet BSD en objet domaine, en tolérant les champs absents. */
export function extractResults(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const rec = payload as Record<string, unknown>;
    if (Array.isArray(rec.results)) return rec.results;
    if (Array.isArray(rec.events)) return rec.events;
    if (Array.isArray(rec.data)) return rec.data;
  }
  return [];
}
