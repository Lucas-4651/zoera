import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../../config';

/**
 * Cache TTL maison : mémoire + disque (JSON), single-flight.
 * Contrat §3 — le cache disque survit aux redémarrages.
 */

interface DiskEntry<T = unknown> {
  storedAt: number;
  ttl: number;
  data: T;
}

interface MemEntry<T = unknown> {
  storedAt: number;
  ttl: number;
  data: T;
}

const mem = new Map<string, MemEntry>();
/** Promesses en cours : évite les appels réseau concurrents identiques. */
const inflight = new Map<string, Promise<unknown>>();

const PURGE_INTERVAL_MS = 60 * 60 * 1000; // au moins une fois par heure
let lastPurge = 0;

function ensureDir(): string {
  const dir = config.cacheDir;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function fileFor(key: string): string {
  const hash = crypto.createHash('sha1').update(key).digest('hex');
  return path.join(ensureDir(), `${hash}.json`);
}

/** Purge des entrées expirées (mémoire + disque). */
export function purgeExpired(force = false): number {
  const now = Date.now();
  if (!force && now - lastPurge < PURGE_INTERVAL_MS) return 0;
  lastPurge = now;

  let removed = 0;
  for (const [key, entry] of mem) {
    if (now - entry.storedAt >= entry.ttl * 1000) {
      mem.delete(key);
      removed += 1;
    }
  }

  try {
    const dir = ensureDir();
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const full = path.join(dir, file);
      try {
        const raw = fs.readFileSync(full, 'utf8');
        const parsed = JSON.parse(raw) as DiskEntry;
        if (typeof parsed?.storedAt !== 'number' || typeof parsed?.ttl !== 'number') {
          fs.unlinkSync(full);
          removed += 1;
          continue;
        }
        if (now - parsed.storedAt >= parsed.ttl * 1000) {
          fs.unlinkSync(full);
          removed += 1;
        }
      } catch {
        try {
          fs.unlinkSync(full);
          removed += 1;
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* cache dir indisponible */
  }
  return removed;
}

function readDisk<T>(key: string): MemEntry<T> | null {
  try {
    const file = fileFor(key);
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as DiskEntry<T>;
    if (typeof parsed?.storedAt !== 'number' || typeof parsed?.ttl !== 'number') return null;
    if (Date.now() - parsed.storedAt >= parsed.ttl * 1000) {
      try {
        fs.unlinkSync(file);
      } catch {
        /* ignore */
      }
      return null;
    }
    return { storedAt: parsed.storedAt, ttl: parsed.ttl, data: parsed.data };
  } catch {
    return null;
  }
}

function writeDisk<T>(key: string, entry: MemEntry<T>): void {
  try {
    const file = fileFor(key);
    const payload: DiskEntry<T> = { storedAt: entry.storedAt, ttl: entry.ttl, data: entry.data };
    fs.writeFileSync(file, JSON.stringify(payload), 'utf8');
  } catch {
    /* le cache disque est best-effort */
  }
}

/** Lecture (mémoire puis disque) sans appel réseau. */
export function getCached<T>(key: string): T | null {
  const hit = mem.get(key);
  if (hit) {
    if (Date.now() - hit.storedAt < hit.ttl * 1000) return hit.data as T;
    mem.delete(key);
  }
  const disk = readDisk<T>(key);
  if (disk) {
    mem.set(key, disk);
    return disk.data;
  }
  return null;
}

export function setCached<T>(key: string, ttl: number, data: T): void {
  const entry: MemEntry<T> = { storedAt: Date.now(), ttl, data };
  mem.set(key, entry);
  writeDisk(key, entry);
}

export function deleteCached(key: string): void {
  mem.delete(key);
  try {
    const file = fileFor(key);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

/**
 * Récupère la valeur en cache ou l'exécute une seule fois (single-flight).
 */
export async function cached<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  purgeExpired();
  const hit = getCached<T>(key);
  if (hit !== null) return hit;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = (async (): Promise<T> => {
    try {
      const data = await loader();
      setCached(key, ttl, data);
      return data;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/** Purge complète (mémoire + disque). Utilisé par les tests. */
export function clearCache(): void {
  mem.clear();
  inflight.clear();
  try {
    const dir = ensureDir();
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.json')) {
        try {
          fs.unlinkSync(path.join(dir, file));
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
}
