import fs from 'node:fs';
import path from 'node:path';

/**
 * Racine du projet (dossier contenant package.json).
 * Stable en dev (tsx -> server/) et en build (dist/server/) : sans cela,
 * les vues et le dossier public seraient introuvables selon le mode d'exécution.
 */
export function findProjectRoot(start: string = __dirname): string {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/**
 * Chargement du .env sans dépendance externe (Node 22 natif).
 * Aucun crash si le fichier est absent.
 */
function loadEnvFileSafe(): void {
  const proc = process as unknown as { loadEnvFile?: (file?: string) => void };
  if (typeof proc.loadEnvFile !== 'function') return;
  for (const candidate of [path.resolve(process.cwd(), '.env'), path.resolve(__dirname, '../.env')]) {
    try {
      proc.loadEnvFile(candidate);
      return;
    } catch {
      /* fichier absent ou illisible -> on continue */
    }
  }
}

loadEnvFileSafe();

function env(key: string): string | undefined {
  const v = process.env[key];
  if (v === undefined) return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

function envInt(key: string, fallback: number): number {
  const v = env(key);
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

const apiKey = env('BSD_API_KEY');

export const projectRoot = findProjectRoot();

export const config = {
  /** Racine du projet (vues EJS, dossier public) : stable dev et build. */
  projectRoot,
  port: envInt('PORT', 3000),
  /** Clé API BSD ; absente => mode démo. */
  apiKey: apiKey ?? null,
  hasKey: apiKey !== undefined,
  /** Mode démo : aucune donnée réelle, tout vient de mock.ts. */
  isDemo: apiKey === undefined,
  baseUrl: env('BSD_BASE_URL') ?? 'https://sports.bzzoiro.com/api/v2',
  cacheDir: path.resolve(process.cwd(), env('CACHE_DIR') ?? './.cache'),
  version: '0.1.0',
  /** Fuseau d'affichage des dates. */
  timezone: 'Europe/Paris',
  /** Quota gratuit BSD : 7500 req/jour, reset minuit UTC. */
  quotaLimit: 7500,
} as const;

export type Config = typeof config;
