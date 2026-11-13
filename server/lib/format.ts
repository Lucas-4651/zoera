/**
 * Helpers d'affichage FR (Europe/Paris).
 * Contrat §6.1 — signatures STRICTES.
 */

const TZ = 'Europe/Paris';

const NBSP = '\u202f'; // espace fine insécable

function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    if (!value.trim()) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TZ,
});

const timeFmt = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TZ,
});

const dayFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: TZ,
});

/** "YYYY-MM-DD" du jour courant dans le fuseau d'affichage. */
function parisDayKey(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TZ,
  }).formatToParts(d);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dayDiff(from: Date, to: Date): number {
  const a = Date.UTC(...(parisDayKey(from).split('-').map(Number) as [number, number, number]));
  const b = Date.UTC(...(parisDayKey(to).split('-').map(Number) as [number, number, number]));
  return Math.round((b - a) / 86400000);
}

export interface FormatOptions {
  withTime?: boolean;
  decimals?: number;
}

export interface StatusInfo {
  label: string;
  tone: 'live' | 'done' | 'upcoming' | 'alert' | 'muted';
  live: boolean;
}

const STATUS_MAP: Record<string, { label: string; tone: StatusInfo['tone'] }> = {
  notstarted: { label: 'À venir', tone: 'upcoming' },
  upcoming: { label: 'À venir', tone: 'upcoming' },
  inprogress: { label: 'En direct', tone: 'live' },
  live: { label: 'En direct', tone: 'live' },
  delayed: { label: 'Retard', tone: 'alert' },
  halftime: { label: 'Mi-temps', tone: 'live' },
  penalties: { label: 'Sép. des penalties', tone: 'live' },
  // L'API BSD utilise aussi les périodes comme statuts (match en cours).
  '1st_half': { label: '1re période', tone: 'live' },
  first_half: { label: '1re période', tone: 'live' },
  '2nd_half': { label: '2e période', tone: 'live' },
  second_half: { label: '2e période', tone: 'live' },
  extra_time: { label: 'Prolongations', tone: 'live' },
  finished: { label: 'Terminé', tone: 'done' },
  postponed: { label: 'Reporté', tone: 'alert' },
  cancelled: { label: 'Annulé', tone: 'muted' },
  unresolved: { label: 'Non joué', tone: 'muted' },
  /* BSD renvoie parfois littéralement "unknown" : on ne l'affiche pas en
     anglais dans la liste. */
  unknown: { label: 'Programmé', tone: 'upcoming' },
};

const LIVE_STATUSES = new Set([
  'inprogress',
  'live',
  'delayed',
  'penalties',
  'halftime',
  '1st_half',
  'first_half',
  '2nd_half',
  'second_half',
  'extra_time',
]);

export function isLiveStatus(status: string): boolean {
  return LIVE_STATUSES.has(status);
}

const PERIOD_MAP: Record<string, string> = {
  '1st_half': '1re période',
  first_half: '1re période',
  halftime: 'Mi-temps',
  '2nd_half': '2e période',
  second_half: '2e période',
  extra_time: 'Prolongations',
  FT: 'Terminé',
};

export const fmt = {
  /** "10 nov. 2026" / "10 nov. 2026 · 20:00" */
  date(d: Date | string | null, opts?: { withTime?: boolean }): string {
    const date = toDate(d);
    if (!date) return '';
    const base = dateFmt.format(date);
    if (!opts?.withTime) return base;
    return `${base} · ${timeFmt.format(date)}`;
  },

  /** "20:00" (Europe/Paris) */
  time(d: Date | string | null): string {
    const date = toDate(d);
    if (!date) return '';
    return timeFmt.format(date);
  },

  /** "aujourd'hui" | "demain" | "hier" | "lun. 10 nov." */
  dayLabel(d: Date | string | null): string {
    const date = toDate(d);
    if (!date) return '';
    const diff = dayDiff(new Date(), date);
    if (diff === 0) return "aujourd'hui";
    if (diff === 1) return 'demain';
    if (diff === -1) return 'hier';
    return dayFmt.format(date);
  },

  /** "il y a 3 min" | "dans 2 h" */
  relative(d: Date | string | null): string {
    const date = toDate(d);
    if (!date) return '';
    const delta = date.getTime() - Date.now();
    const abs = Math.abs(delta);
    const suffix = (v: string): string => (delta >= 0 ? `dans ${v}` : `il y a ${v}`);
    const min = Math.round(abs / 60000);
    if (min < 1) return delta >= 0 ? 'dans moins d\'une minute' : "à l'instant";
    if (min < 60) return suffix(`${min} min`);
    const hours = Math.round(min / 60);
    if (hours < 24) return suffix(`${hours} h`);
    const days = Math.round(hours / 24);
    if (days < 30) return suffix(`${days} j`);
    const months = Math.round(days / 30);
    return suffix(`${months} mois`);
  },

  /** Libellé FR + ton + indicateur live. */
  status(status: string): StatusInfo {
    const key = (status ?? '').toLowerCase();
    const entry = STATUS_MAP[key];
    if (!entry) {
      return { label: status || 'Inconnu', tone: 'muted', live: false };
    }
    return { label: entry.label, tone: entry.tone, live: LIVE_STATUSES.has(key) };
  },

  /** "1re période", "Mi-temps", "2e période", "Prolongations" */
  period(period: string | null): string {
    if (!period) return '';
    return PERIOD_MAP[period] ?? period;
  },

  /**
   * Drapeau emoji à partir d'un code ISO 3166-1 alpha-2 ("PT" → 🇵🇹).
   * Retourne '' si le code est absent ou invalide (l'appelant garde le texte).
   */
  flag(code: string | null | undefined): string {
    if (!code) return '';
    const cc = code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return '';
    // Point de code = 0x1F1E6 + (lettre - 'A') : U+1F1E6 🇦 = A.
    const base = 0x1f1e6;
    return String.fromCodePoint(base + (cc.charCodeAt(0) - 65), base + (cc.charCodeAt(1) - 65));
  },

  /** "1 234" (format fr-FR, espace fine insécable) */
  number(n: number | null | undefined, opts?: { decimals?: number }): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    const decimals = opts?.decimals ?? 0;
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
    return formatted.replace(/[\u00a0\u202f]/g, NBSP);
  },

  /** "12,5 M€" | "800 k€" | "Gratuit" si null */
  eur(n: number | null | undefined): string {
    if (n === null || n === undefined || !Number.isFinite(n)) return 'Gratuit';
    if (n === 0) return 'Gratuit';
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${fmt.number(n / 1_000_000_000, { decimals: 2 })} Md€`;
    if (abs >= 1_000_000) return `${fmt.number(n / 1_000_000, { decimals: 1 })} M€`;
    if (abs >= 1_000) return `${fmt.number(n / 1_000, { decimals: 0 })} k€`;
    return `${fmt.number(n, { decimals: 0 })} €`;
  },

  /** "58,4 %" (n compris entre 0 et 1) */
  percent(n: number | null | undefined, opts?: { decimals?: number }): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    const decimals = opts?.decimals ?? 1;
    return `${fmt.number(n * 100, { decimals })} %`;
  },

  /** "MC" pour "Manchester City" */
  initials(name: string | null): string {
    if (!name) return '';
    const parts = name
      .split(/[\s'-]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  },

  /** "26 ans" */
  age(dob: string | null): string {
    if (!dob) return '';
    const birth = toDate(dob);
    if (!birth) return '';
    const now = new Date();
    let years = now.getUTCFullYear() - birth.getUTCFullYear();
    const m = now.getUTCMonth() - birth.getUTCMonth();
    if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) years -= 1;
    if (years < 0) return '';
    return `${years} ans`;
  },

  /** "il y a 5 min" */
  ago(d: Date | string | null): string {
    const date = toDate(d);
    if (!date) return '';
    const delta = Date.now() - date.getTime();
    const abs = Math.abs(delta);
    const min = Math.floor(abs / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `il y a ${days} j`;
    const months = Math.floor(days / 30);
    return `il y a ${months} mois`;
  },
};

/** Helpers supplémentaires exposés aux templates (contrat §6.1). */
export const nl2br = (text: string | null | undefined): string => {
  if (!text) return '';
  return text.replace(/\r?\n/g, '<br />');
};

export const eq = (a: unknown, b: unknown): boolean => a === b;

export const json = (value: unknown): string =>
  JSON.stringify(value, (_k, v) => (v instanceof Date ? v.toISOString() : v), 2);

export default fmt;
