/**
 * check-views — rend chaque template EJS avec un jeu de données factice
 * STRICTEMENT conforme aux view models du contrat (§7) et rend le layout.
 *
 * Usage : npx tsx tools/check-views.ts
 * Code de sortie : 0 si tous les templates se rendent sans erreur.
 */

import ejs from "ejs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIEWS = path.resolve(HERE, "..", "server", "views");

/* ===================================================================== */
/* Helpers `fmt` (implémentation locale minimale, cf. CONTRACT.md §6.1)   */
/* ===================================================================== */

const STATUS_MAP: Record<string, { label: string; tone: "live" | "done" | "upcoming" | "alert" | "muted"; live: boolean }> = {
  notstarted: { label: "À venir", tone: "upcoming", live: false },
  upcoming: { label: "À venir", tone: "upcoming", live: false },
  inprogress: { label: "En direct", tone: "live", live: true },
  live: { label: "En direct", tone: "live", live: true },
  delayed: { label: "Retard", tone: "alert", live: true },
  halftime: { label: "Mi-temps", tone: "live", live: true },
  penalties: { label: "Sép. des penalties", tone: "live", live: true },
  finished: { label: "Terminé", tone: "done", live: false },
  postponed: { label: "Reporté", tone: "alert", live: false },
  cancelled: { label: "Annulé", tone: "alert", live: false },
  unresolved: { label: "Non joué", tone: "muted", live: false }
};

const PERIOD_MAP: Record<string, string> = {
  "1st_half": "1re période",
  halftime: "Mi-temps",
  "2nd_half": "2e période",
  extra_time: "Prolongations",
  FT: "Fin du match"
};

const NBSP = " ";

function toDate(value: Date | string | null): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const fmt = {
  date(value: Date | string | null, opts?: { withTime?: boolean }): string {
    const date = toDate(value);
    if (!date) return "—";
    const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" }).format(date);
    if (!opts || !opts.withTime) return day;
    return `${day} · ${fmt.time(date)}`;
  },
  time(value: Date | string | null): string {
    const date = toDate(value);
    if (!date) return "—";
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(date);
  },
  dayLabel(value: Date | string | null): string {
    const date = toDate(value);
    if (!date) return "—";
    const today = new Date();
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((startOf(date) - startOf(today)) / 86400000);
    if (diff === 0) return "aujourd'hui";
    if (diff === 1) return "demain";
    if (diff === -1) return "hier";
    return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(date);
  },
  relative(value: Date | string | null): string {
    const date = toDate(value);
    if (!date) return "—";
    const diff = Date.now() - date.getTime();
    const minutes = Math.round(diff / 60000);
    if (Math.abs(minutes) < 1) return "à l'instant";
    if (minutes > 0) return `il y a ${minutes} min`;
    return `dans ${Math.abs(minutes)} min`;
  },
  shortDay(value: Date | string | null): string {
    const date = toDate(value);
    if (!date) return "—";
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      timeZone: "Europe/Paris",
    }).format(date);
  },
  outcome(value: string | null | undefined): string {
    if (!value) return "";
    const key = value.toUpperCase();
    if (key === "HOME" || key === "H" || key === "1") return "1";
    if (key === "DRAW" || key === "D" || key === "X") return "X";
    if (key === "AWAY" || key === "A" || key === "2") return "2";
    return value;
  },
  status(status: string) {
    const key = String(status || "unknown");
    return STATUS_MAP[key] || { label: "Inconnu", tone: "muted", live: false };
  },
  period(period: string | null): string {
    if (!period) return "—";
    return PERIOD_MAP[period] || period;
  },
  number(value: number | null | undefined, opts?: { decimals?: number }): string {
    if (value === null || value === undefined) return "—";
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: opts?.decimals ?? 0,
      maximumFractionDigits: opts?.decimals ?? 0
    }).format(value).replace(/ | /g, NBSP);
  },
  eur(value: number | null | undefined): string {
    if (value === null || value === undefined) return "Gratuit";
    if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(".", ",")}${NBSP}M€`;
    if (value >= 1000) return `${Math.round(value / 1000)}${NBSP}k€`;
    return `${fmt.number(value)}${NBSP}€`;
  },
  percent(value: number | null | undefined, opts?: { decimals?: number }): string {
    if (value === null || value === undefined) return "—";
    const decimals = opts?.decimals ?? 1;
    return `${(value * 100).toFixed(decimals).replace(".", ",")}${NBSP}%`;
  },
  initials(name: string | null): string {
    if (!name) return "—";
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  },
  age(dob: string | null): string {
    const date = toDate(dob);
    if (!date) return "—";
    const now = new Date();
    let years = now.getFullYear() - date.getFullYear();
    const before = now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate());
    if (before) years -= 1;
    return `${years}${NBSP}ans`;
  },
  ago(value: Date | string | null): string {
    const date = toDate(value);
    if (!date) return "—";
    const minutes = Math.round((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    return `il y a ${Math.round(hours / 24)} j`;
  }
};

/* ===================================================================== */
/* Données factices — conformes aux types domaine (CONTRACT.md §6)       */
/* ===================================================================== */

const season = { id: 2026, name: "2026/2027", year: 2026, isCurrent: true, startDate: "2026-08-01", endDate: "2027-05-20" };

const team = { id: 100, name: "Manchester City", shortName: "Man City", country: "England", countryCode: "GB", venueId: 900, logoUrl: "https://sports.bzzoiro.com/img/team/100/" };
const team2 = { id: 101, name: "Arsenal", shortName: "Arsenal", country: "England", countryCode: "GB", venueId: 901, logoUrl: "https://sports.bzzoiro.com/img/team/101/" };

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 1001,
    leagueId: 10,
    leagueName: "Premier League",
    seasonId: season.id,
    homeTeamId: team.id,
    homeTeam: team.name,
    awayTeamId: team2.id,
    awayTeam: team2.name,
    date: new Date("2026-11-10T20:00:00Z"),
    status: "inprogress",
    period: "2nd_half",
    minute: 67,
    homeScore: 2,
    awayScore: 1,
    homeScoreHt: 1,
    awayScoreHt: 0,
    penaltyShootout: null,
    extraTime: null,
    roundLabel: "Journée 12",
    stage: "league-phase",
    roundNumber: 12,
    venueId: 900,
    refereeId: 42,
    attendance: 52300,
    isLocalDerby: false,
    highlights: [],
    isLive: true,
    ...overrides
  };
}

const liveEvent = { ...makeEvent(), leagueName: "Premier League", lastUpdated: new Date().toISOString() };
const finishedEvent = makeEvent({ id: 1000, status: "finished", period: "FT", minute: 90, isLive: false, date: new Date("2026-11-09T18:00:00Z") });
const upcomingEvent = makeEvent({ id: 1002, status: "notstarted", period: null, minute: null, homeScore: null, awayScore: null, isLive: false, date: new Date("2026-11-11T21:00:00Z") });

const league = { id: 10, name: "Premier League", country: "England", isWomen: false, isActive: true, currentSeason: season, logoUrl: "https://sports.bzzoiro.com/img/league/10/" };
const league2 = { id: 11, name: "Ligue 1", country: "France", isWomen: false, isActive: true, currentSeason: season, logoUrl: "https://sports.bzzoiro.com/img/league/11/" };
const league3 = { id: 12, name: "Première Ligue Féminine", country: "France", isWomen: true, isActive: true, currentSeason: null, logoUrl: "https://sports.bzzoiro.com/img/league/12/" };

const standing = {
  position: 1,
  teamId: team.id,
  teamName: team.name,
  played: 12,
  won: 9,
  drawn: 2,
  lost: 1,
  gf: 31,
  ga: 11,
  gd: 20,
  pts: 29,
  xgf: 28.4,
  xga: 10.9,
  xgd: 17.5,
  xgGames: 12,
  form: "WWDWL",
  live: false,
  zone: "champions_league"
};
const standing2 = { ...standing, position: 2, teamId: team2.id, teamName: team2.name, pts: 28, gd: 14, zone: "champions_league", form: "WWDDW" };
const standing3 = { ...standing, position: 18, teamName: "Leeds United", pts: 9, gd: -18, zone: "relegation", form: "LLDWL" };

const standings = { grouped: false, groups: {}, flat: [standing, standing2, standing3], season, leagueId: league.id };

const topScorers = [
  { rank: 1, playerId: 500, playerName: "Erling Haaland", position: "F", teamId: team.id, teamName: team.name, value: 14, matches: 12, photoUrl: "https://sports.bzzoiro.com/img/player/500/?sor=true" },
  { rank: 2, playerId: 501, playerName: "Bukayo Saka", position: "M", teamId: team2.id, teamName: team2.name, value: 11, matches: 12, photoUrl: "https://sports.bzzoiro.com/img/player/501/?sor=true" }
];

const player = {
  id: 500,
  name: "Erling Haaland",
  shortName: "H. Haaland",
  position: "F",
  specificPosition: "FW",
  jerseyNumber: 9,
  dateOfBirth: "2000-07-21",
  heightCm: 194,
  weightKg: 93,
  nationality: "Norvège",
  currentTeamId: team.id,
  currentTeamName: team.name,
  marketValueEur: 180000000,
  availability: "available",
  injuryType: "",
  rating: 8.4,
  photoUrl: "https://sports.bzzoiro.com/img/player/500/?sor=true",
  strengths: ["Puissance", "Finition"],
  weaknesses: ["Jeu de pieds"]
};

const squad = [
  { id: 500, name: "Erling Haaland", shortName: "Haaland", position: "F", jerseyNumber: 9, nationality: "Norvège", dateOfBirth: "2000-07-21", availability: "available", injuryType: "", injuryExpectedReturn: null, photoUrl: "https://sports.bzzoiro.com/img/player/500/?sor=true" },
  { id: 501, name: "Rúben Dias", shortName: "Dias", position: "D", jerseyNumber: 3, nationality: "Portugal", dateOfBirth: "1997-05-14", availability: "injured", injuryType: "Muscle", injuryExpectedReturn: "2026-11-24", photoUrl: "https://sports.bzzoiro.com/img/player/501/?sor=true" },
  { id: 502, name: "Ederson", shortName: "Ederson", position: "G", jerseyNumber: 31, nationality: "Brésil", dateOfBirth: "1993-08-17", availability: "available", injuryType: "", injuryExpectedReturn: null, photoUrl: "https://sports.bzzoiro.com/img/player/502/?sor=true" },
  { id: 503, name: "Rodri", shortName: "Rodri", position: "M", jerseyNumber: 16, nationality: "Espagne", dateOfBirth: "1996-06-22", availability: "suspended", injuryType: "", injuryExpectedReturn: null, photoUrl: "https://sports.bzzoiro.com/img/player/503/?sor=true" }
];

const playerStats = [
  { playerId: 500, teamId: team.id, minutesPlayed: 90, rating: 8.6, goals: 2, assists: 0, xg: 1.82, xa: 0.21, shots: 5, shotsOnTarget: 3, passes: 31, accuratePasses: 24, tackles: 0, duelsWon: 6, duelsLost: 3, yellowCards: 0, redCards: 0, saves: 0, bigChances: 2, bigChancesMissed: 0, progressivePasses: 12, aerialWon: 4, aerialLost: 1 },
  { playerId: 500, teamId: team.id, minutesPlayed: 76, rating: 7.4, goals: 1, assists: 1, xg: 1.05, xa: 0.4, shots: 3, shotsOnTarget: 2, passes: 22, accuratePasses: 17, tackles: 0, duelsWon: 3, duelsLost: 4, yellowCards: 1, redCards: 0, saves: 0, bigChances: 1, bigChancesMissed: 1, progressivePasses: 8, aerialWon: 2, aerialLost: 2 }
];

const teamStats = {
  possession: 58.4,
  shots: 14,
  shotsOnTarget: 6,
  corners: 7,
  fouls: 9,
  offsides: 2,
  yellowCards: 2,
  redCards: 0,
  passes: 512,
  accuratePasses: 441,
  tackles: 8,
  xg: 2.14,
  xgot: 3.02,
  bigChances: 3,
  saves: 2
};

const eventStats = {
  home: teamStats,
  away: { ...teamStats, possession: 41.6, shots: 8, shotsOnTarget: 3, xg: 0.87, xgot: 1.24, corners: 3, passes: 388, accuratePasses: 311 },
  shotmap: [
    { playerId: 500, playerName: "Haaland", minute: 23, added: null, home: true, type: "goal", sit: "on_target", body: "right_foot", gtype: "open_play", xg: 0.42, xgot: 0.9, xgEstimated: false, x: 88, y: 46 },
    { playerId: 501, playerName: "Saka", minute: 41, added: null, home: false, type: "shot", sit: "off_target", body: "left_foot", gtype: null, xg: 0.08, xgot: null, xgEstimated: false, x: 31, y: 22 },
    { playerId: 502, playerName: "Ederson", minute: 55, added: null, home: true, type: "shot", sit: "on_target", body: "head", gtype: null, xg: 0.05, xgot: 0.12, xgEstimated: null, x: 92, y: 60 }
  ],
  momentum: [
    { minute: 5, value: -12 },
    { minute: 15, value: 24 },
    { minute: 25, value: 41 },
    { minute: 40, value: 12 },
    { minute: 55, value: -8 },
    { minute: 70, value: 33 },
    { minute: 85, value: 5 }
  ],
  xgPerMinute: [
    { minute: 10, home: 0.1, away: 0.0, cumHome: 0.1, cumAway: 0.0 },
    { minute: 45, home: 0.6, away: 0.2, cumHome: 0.7, cumAway: 0.2 }
  ],
  xgEstimated: false,
  averagePositions: {}
};

const lineups = {
  status: "confirmed" as const,
  home: [
    { id: 502, name: "Ederson", shortName: "Ederson", position: "G", jerseyNumber: 31, isStarter: true, isCaptain: false, subIn: null, subOut: null },
    { id: 501, name: "Rúben Dias", shortName: "Dias", position: "D", jerseyNumber: 3, isStarter: true, isCaptain: true, subIn: null, subOut: null },
    { id: 504, name: "Kevin De Bruyne", shortName: "De Bruyne", position: "M", jerseyNumber: 17, isStarter: true, isCaptain: false, subIn: null, subOut: null },
    { id: 500, name: "Erling Haaland", shortName: "Haaland", position: "F", jerseyNumber: 9, isStarter: true, isCaptain: false, subIn: null, subOut: null },
    { id: 505, name: "Jack Grealish", shortName: "Grealish", position: "F", jerseyNumber: 10, isStarter: true, isCaptain: false, subIn: 62, subOut: null }
  ],
  away: [
    { id: 506, name: "David Raya", shortName: "Raya", position: "G", jerseyNumber: 22, isStarter: true, isCaptain: false, subIn: null, subOut: null }
  ],
  homeFormation: "4-3-3",
  awayFormation: "4-2-3-1",
  unavailable: [
    { id: 507, name: "Nathan Aké", shortName: "Aké", position: "D", jerseyNumber: 6, nationality: "Pays-Bas", dateOfBirth: "1995-04-26", availability: "injured", injuryType: "Jambe", injuryExpectedReturn: "2026-12-01", photoUrl: "https://sports.bzzoiro.com/img/player/507/?sor=true" }
  ],
  updatedAt: new Date().toISOString()
};

const incidents = [
  { type: "goal", player: "Erling Haaland", minute: 23, isHome: true, assist: "Kevin De Bruyne", reason: null },
  { type: "yellow_card", player: "Bukayo Saka", minute: 31, isHome: false, assist: null, reason: null },
  { type: "goal", player: "Bukayo Saka", minute: 41, isHome: false, assist: null, reason: null },
  { type: "substitution", player: "Jack Grealish", minute: 62, isHome: true, assist: null, reason: null }
];

const commentary = [
  { id: "c1", minute: 23, addedTime: null, type: "goal", team: team.name, player: "Erling Haaland", relatedPlayer: "Kevin De Bruyne", text: "But ! Haaland prend la passe de De Bruyne et place le ballon au premier poteau.", score: "1-0", important: true },
  { id: "c2", minute: 41, addedTime: null, type: "goal", team: team2.name, player: "Bukayo Saka", relatedPlayer: null, text: "Égalisation de Saka sur un contre-attaque impeccable.", score: "1-1", important: true },
  { id: "c3", minute: 55, addedTime: null, type: "shot", team: team.name, player: "Erling Haaland", relatedPlayer: null, text: "Tir de la tête, le gardien dévie.", score: "1-1", important: false }
];

const h2h = {
  totalMatches: 24,
  homeWins: 12,
  draws: 5,
  awayWins: 7,
  homeGoals: 38,
  awayGoals: 27,
  avgTotalGoals: 2.7,
  homeWinRate: 0.5,
  awayWinRate: 0.29,
  recentMatches: [
    { eventId: 900, date: "2026-04-12", home: team.name, away: team2.name, score: "2-1", homeTeamId: team.id, awayTeamId: team2.id },
    { eventId: 901, date: "2025-11-30", home: team2.name, away: team.name, score: "1-1", homeTeamId: team2.id, awayTeamId: team.id }
  ]
};

const odds = {
  markets: [
    {
      market: "1x2",
      label: "1X2",
      line: null,
      outcomes: [
        { outcome: "HOME", label: team.name, decimal: 1.85, implied: 0.54, movement: "up" },
        { outcome: "DRAW", label: "Nul", decimal: 3.6, implied: 0.28, movement: null },
        { outcome: "AWAY", label: team2.name, decimal: 4.2, implied: 0.24, movement: "down" }
      ]
    },
    {
      market: "over_under_25",
      label: "Plus ou moins de 2,5 buts",
      line: 2.5,
      outcomes: [
        { outcome: "over", label: "Plus de 2,5", decimal: 1.95, implied: 0.51, movement: null },
        { outcome: "under", label: "Moins de 2,5", decimal: 1.88, implied: 0.53, movement: null }
      ]
    },
    {
      market: "btts",
      label: "Les deux équipes marquent",
      line: null,
      outcomes: [
        { outcome: "yes", label: "Oui", decimal: 1.72, implied: 0.58, movement: null },
        { outcome: "no", label: "Non", decimal: 2.15, implied: 0.46, movement: null }
      ]
    }
  ],
  lastUpdateAt: new Date().toISOString(),
  nextUpdateAt: null,
  updateIntervalSeconds: 300,
  bookmakersCount: 8
};

const prediction = {
  id: 700,
  eventId: 1001,
  homeTeam: team.name,
  awayTeam: team2.name,
  homeTeamId: team.id,
  awayTeamId: team2.id,
  leagueId: league.id,
  leagueName: "Premier League",
  date: new Date("2026-11-10T20:00:00Z"),
  homeProb: 0.56,
  drawProb: 0.24,
  awayProb: 0.2,
  topOutcome: "Victoire Manchester City",
  topProbability: 0.56,
  expectedHomeGoals: 1.82,
  expectedAwayGoals: 1.05,
  over25: 0.61,
  btts: 0.54,
  score: "2-1",
  model: "CatBoost v2",
  updatedAt: new Date().toISOString()
};

const availability = {
  eventId: 1001,
  status: "available",
  lineupStatus: "confirmed",
  available: { stats: true, lineups: true, incidents: true, commentary: true, h2h: true, odds: true, prediction: true },
  statKeys: ["possession", "shots", "xg", "corners"],
  oddsMarkets: ["1x2", "over_under_25", "btts"]
};

const bestXI = {
  formation: "4-3-3",
  lineup: [
    { position: "GK", player, rating: 8.1 },
    { position: "CB", player: { ...player, id: 501, name: "Rúben Dias" }, rating: 7.6 },
    { position: "ST", player, rating: 8.4 }
  ]
};

const bestOddsRows = [
  {
    eventId: 1001,
    date: new Date("2026-11-11T21:00:00Z"),
    leagueId: league.id,
    leagueName: league.name,
    homeTeam: team.name,
    awayTeam: team2.name,
    homeTeamId: team.id,
    awayTeamId: team2.id,
    market: "1x2",
    outcomes: [
      { outcome: "HOME", label: team.name, decimal: 1.85, implied: 0.54 },
      { outcome: "DRAW", label: "Nul", decimal: 3.6, implied: 0.28 },
      { outcome: "AWAY", label: team2.name, decimal: 4.2, implied: 0.24 }
    ]
  }
];

const transfers = [
  { id: 800, date: "2026-08-31", playerId: 500, playerName: "Erling Haaland", fromTeamId: 200, fromTeamName: "Borussia Dortmund", toTeamId: team.id, toTeamName: team.name, feeEur: 180000000, feeDescription: "180 M€" },
  { id: 801, date: "2026-07-12", playerId: null, playerName: "Lucas Paquetá", fromTeamId: team2.id, fromTeamName: team2.name, toTeamId: 201, toTeamName: "West Ham", feeEur: null, feeDescription: "Prêt" }
];

const teamForm = {
  teamId: team.id,
  teamName: team.name,
  matches: 12,
  requested: 5,
  overall: { results: "WWDWL", wins: 7, draws: 3, losses: 2, goalsFor: 24, goalsAgainst: 9, pointsPerMatch: 2.08, stats: { possession: 0.61 } },
  home: { results: "WWDW", wins: 4, draws: 1, losses: 0, goalsFor: 15, goalsAgainst: 4, pointsPerMatch: 2.5, stats: {} },
  away: { results: "WDL", wins: 3, draws: 2, losses: 1, goalsFor: 9, goalsAgainst: 5, pointsPerMatch: 1.83, stats: {} },
  vs_stronger: null,
  vs_weaker: null
};

/* ===================================================================== */
/* Palmarès (§7.2) — formes exactes ClubRank / PlayerRank / CompetitionRank */
/* ===================================================================== */

const CLUB_NAMES = [
  "Manchester City", "Arsenal", "Liverpool", "Real Madrid", "FC Barcelone",
  "Bayern Munich", "Inter Milan", "Paris Saint-Germain", "Marseille", "Benfica",
  "Porto", "Ajax"
];
const LEAGUE_NAMES = [
  "Premier League", "Premier League", "Premier League", "La Liga", "La Liga",
  "Bundesliga", "Serie A", "Ligue 1", "Ligue 1", "Liga Portugal",
  "Liga Portugal", "Eredivisie"
];

const clubRanks: Record<string, unknown>[] = CLUB_NAMES.map((name, i) => {
  const played = 12 - (i % 2);
  const pts = Math.max(6, 30 - i * 2);
  const gd = Math.max(-9, 20 - i * 3);
  const xgdPerGame = Number(((gd * 0.08 + 0.6) - i * 0.05).toFixed(2));
  const ptsPerGame = Number((pts / played).toFixed(2));
  // score = 60 × (ptsPerGame / 3) + 20 × xgdPerGame + 20 × (gd / played)
  const score = Number((60 * (ptsPerGame / 3) + 20 * xgdPerGame + 20 * (gd / played)).toFixed(1));
  return {
    rank: i + 1,
    teamId: 100 + i,
    teamName: name,
    leagueId: 10 + (i % 5),
    leagueName: LEAGUE_NAMES[i],
    logoUrl: `https://sports.bzzoiro.com/img/team/${100 + i}/`,
    played,
    pts,
    ptsPerGame,
    gd,
    xgd: Number((xgdPerGame * played).toFixed(1)),
    xgdPerGame,
    form: "WWDWL".slice(0, Math.max(2, 5 - Math.floor(i / 3))),
    score,
    detail: `${pts} pts · +${xgdPerGame.toFixed(1).replace(".", ",")} xG/match`
  };
});

const PLAYER_NAMES = [
  "Erling Haaland", "Bukayo Saka", "Mohamed Salah", "Kylian Mbappé", "Jude Bellingham",
  "Vinícius Júnior", "Robert Lewandowski", "Kylian Mbappé", "Pierre-Emerick Aubameyang",
  "Álvaro Morata", "Gonçalo Ramos", "Mats Wieffer"
];
const PLAYER_TEAMS = [
  "Manchester City", "Arsenal", "Liverpool", "Paris Saint-Germain", "Real Madrid",
  "Real Madrid", "Barcelona", "Paris Saint-Germain", "Marseille",
  "Atletico Madrid", "Benfica", "Ajax"
];

const playerRanks: Record<string, unknown>[] = PLAYER_NAMES.map((name, i) => {
  const rating = Number((8.9 - i * 0.15).toFixed(1));
  const goals = 14 - i;
  const assists = 9 - Math.floor(i / 2);
  const matches = 12 - (i % 3);
  // score = 10 × note moyenne
  const score = Number((10 * rating).toFixed(1));
  return {
    rank: i + 1,
    playerId: 500 + i,
    playerName: name,
    teamId: 100 + (i % 12),
    teamName: PLAYER_TEAMS[i],
    leagueId: 10 + (i % 5),
    leagueName: LEAGUE_NAMES[i % LEAGUE_NAMES.length],
    position: ["F", "M", "F", "F", "M", "F", "F", "F", "F", "F", "F", "M"][i],
    rating,
    goals,
    assists,
    matches,
    photoUrl: `https://sports.bzzoiro.com/img/player/${500 + i}/?sor=true`,
    score,
    detail: `note ${rating.toFixed(1).replace(".", ",")} · ${goals} buts`
  };
});

const COMP_NAMES = [
  "Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1",
  "Champions League", "Liga Portugal", "Eredivisie"
];
const COMP_COUNTRIES = [
  "England", "Spain", "Italy", "Germany", "France",
  "Europe", "Portugal", "Netherlands"
];

const competitionRanks: Record<string, unknown>[] = COMP_NAMES.map((name, i) => {
  const teams = 20 - i;
  const matches = 150 - i * 7;
  const avgGoals = Number((3.1 - i * 0.12).toFixed(2));
  const avgXgDiff = Number((1.4 - i * 0.08).toFixed(2));
  const avgPoints = Number((2.4 - i * 0.05).toFixed(2));
  // score = 12 × avgGoals + 30 × |avgXgDiff| + 20 × (avgPoints / 3)
  const score = Number((12 * avgGoals + 30 * Math.abs(avgXgDiff) + 20 * (avgPoints / 3)).toFixed(1));
  return {
    rank: i + 1,
    leagueId: 10 + i,
    leagueName: name,
    country: COMP_COUNTRIES[i],
    logoUrl: `https://sports.bzzoiro.com/img/league/${10 + i}/`,
    teams,
    matches,
    avgGoals,
    avgXgDiff,
    avgPoints,
    leader: CLUB_NAMES[i],
    leaderPoints: 30 - i * 2,
    /* Champ optionnel (hors §7.2) : s'il est fourni, la page propose un
       lien vers la fiche du match. Le template tolère son absence. */
    matchId: i === 0 ? 1001 : null,
    score,
    detail: `${avgGoals.toFixed(1).replace(".", ",")} buts/match · +${avgXgDiff.toFixed(1).replace(".", ",")} xG`
  };
});

const palmaresVm = {
  featured: {
    club: clubRanks[0],
    player: playerRanks[0],
    competition: competitionRanks[0]
  },
  competitions: competitionRanks,
  clubs: clubRanks,
  players: playerRanks,
  leaguesAnalysed: competitionRanks.length,
  generatedAt: new Date("2026-11-11T09:30:00Z")
};

const palmaresEmptyVm = {
  featured: { club: null, player: null, competition: null },
  competitions: [],
  clubs: [],
  players: [],
  leaguesAnalysed: 0,
  generatedAt: new Date("2026-11-11T09:30:00Z")
};

/* ===================================================================== */
/* View models (§7)                                                      */
/* ===================================================================== */

const nav = [
  { href: "/", label: "Accueil", icon: "home" },
  { href: "/live", label: "Direct", icon: "radio" },
  { href: "/fixtures", label: "Calendrier", icon: "calendar" },
  { href: "/leagues", label: "Ligues", icon: "trophy" },
  { href: "/palmares", label: "Palmarès", icon: "star" },
  { href: "/predictions", label: "Prédictions", icon: "sparkles" },
  { href: "/odds", label: "Cotes", icon: "chart" },
  { href: "/transfers", label: "Mercato", icon: "swap" },
  { href: "/recherche", label: "Recherche", icon: "search" }
];

const common = {
  demo: true,
  quota: { remaining: 7420, limit: 7500, resetIn: 3600 },
  nav
};

type Vm = Record<string, unknown>;

const pages: { name: string; vm: Vm; title: string; description: string; currentPath: string }[] = [
  {
    name: "home",
    title: "Accueil",
    description: "Scores en direct, calendrier et classements.",
    currentPath: "/",
    vm: {
      live: [liveEvent],
      today: [liveEvent, finishedEvent, upcomingEvent],
      tomorrow: [upcomingEvent],
      leagues: [league, league2, league3],
      topScorers,
      predictions: [prediction],
      lastResults: [finishedEvent],
      featured: palmaresVm.featured
    }
  },
  {
    name: "home",
    title: "Accueil sans block palmarès",
    description: "Accueil sans données de palmarès.",
    currentPath: "/",
    vm: {
      live: [],
      today: [],
      tomorrow: [],
      leagues: [],
      topScorers: [],
      predictions: [],
      lastResults: []
    }
  },
  {
    name: "live",
    title: "Direct",
    description: "Tous les matchs en direct.",
    currentPath: "/live",
    vm: { live: [liveEvent, { ...liveEvent, id: 1003, leagueId: 11, leagueName: "Ligue 1" }], leagues: [league, league2], updatedAt: new Date() }
  },
  {
    name: "fixtures",
    title: "Calendrier",
    description: "Calendrier des rencontres.",
    currentPath: "/fixtures",
    vm: {
      date: "2026-11-10",
      dateFrom: "2026-11-10",
      dateTo: "2026-11-10",
      events: [liveEvent, finishedEvent, upcomingEvent],
      leagues: [league, league2],
      prevDate: "2026-11-09",
      nextDate: "2026-11-11"
    }
  },
  {
    name: "match",
    title: "Manchester City vs Arsenal",
    description: "Fiche du match.",
    currentPath: "/match/1001",
    vm: {
      event: liveEvent,
      stats: eventStats,
      lineups,
      incidents,
      commentary,
      h2h,
      odds,
      prediction,
      availability,
      playerStats,
      standings,
      homeStanding: standing,
      awayStanding: standing2,
      venue: { id: 900, name: "Etihad Stadium" },
      referee: { id: 42, name: "Michael Oliver" }
    }
  },
  {
    name: "match",
    title: "Match sans données",
    description: "Fiche d'un match sans données.",
    currentPath: "/match/1002",
    vm: {
      event: upcomingEvent,
      stats: null,
      lineups: null,
      incidents: [],
      commentary: [],
      h2h: null,
      odds: null,
      prediction: null,
      availability: null,
      playerStats: [],
      standings: null,
      homeStanding: null,
      awayStanding: null,
      venue: null,
      referee: null
    }
  },
  {
    name: "leagues",
    title: "Ligues",
    description: "Liste des compétitions.",
    currentPath: "/leagues",
    vm: { leagues: [league, league2, league3], countries: ["England", "France"], womenCount: 1, menCount: 2 }
  },
  {
    name: "league",
    title: league.name,
    description: "Classement et statistiques.",
    currentPath: "/leagues/10",
    vm: {
      league,
      season,
      seasons: [season],
      standings,
      topScorers,
      bestXI,
      events: [liveEvent, finishedEvent, upcomingEvent],
      venues: [{ id: 900, name: "Etihad Stadium" }]
    }
  },
  {
    name: "team",
    title: team.name,
    description: "Effectif et résultats.",
    currentPath: "/teams/100",
    vm: { team, squad, form: teamForm, events: [upcomingEvent, finishedEvent], transfers }
  },
  {
    name: "player",
    title: player.name,
    description: "Fiche joueur.",
    currentPath: "/players/500",
    vm: { player, stats: playerStats, transfers, events: [finishedEvent] }
  },
  {
    name: "predictions",
    title: "Prédictions",
    description: "Prédictions du modèle.",
    currentPath: "/predictions",
    vm: {
      rows: [
        {
          ...prediction,
          dateKey: "2026-11-13",
          calls: [
            { key: "1X", label: "Liverpool gagne ou fait match nul", probability: 0.88 },
            { key: "O25", label: "Plus de 2,5 buts", probability: 0.84 }
          ]
        }
      ],
      predLeagues: [{ id: 1, name: "Premier League" }],
      counts: { today: 1, tomorrow: 0, week: 1, all: 1 },
      scanned: 40,
      threshold: 0.8,
      modelName: "dc-blend-v1",
      callShortLabel: (c: { key: string }) => (c.key === "O25" ? "+2,5 buts" : "double chance"),
      dates: { today: "2026-11-13", tomorrow: "2026-11-14", weekEnd: "2026-11-19" }
    }
  },
  {
    name: "odds",
    title: "Cotes",
    description: "Meilleures cotes.",
    currentPath: "/odds",
    vm: { odds: bestOddsRows, markets: ["1x2", "over_under_25", "btts"], market: "1x2" }
  },
  {
    name: "transfers",
    title: "Mercato",
    description: "Transferts.",
    currentPath: "/transfers",
    vm: { transfers, leagues: [league, league2] }
  },
  {
    name: "palmares",
    title: "Palmarès",
    description: "Meilleur club, meilleur joueur et meilleure compétition.",
    currentPath: "/palmares",
    vm: palmaresVm
  },
  {
    name: "palmares",
    title: "Palmarès sans données",
    description: "Palmarès vide.",
    currentPath: "/palmares",
    vm: palmaresEmptyVm
  },
  {
    name: "search",
    title: "Recherche",
    description: "Recherche unifiée.",
    currentPath: "/recherche",
    vm: { query: "manchester", teams: [team], players: [player], leagues: [league] }
  },
  {
    name: "error",
    title: "Introuvable",
    description: "Page d'erreur.",
    currentPath: "/oops",
    vm: { status: 404, title: "Page introuvable", message: "Ce contenu n’existe pas.", detail: "" }
  }
];

/* ===================================================================== */
/* Rendu                                                                  */
/* ===================================================================== */

async function renderPage(name: string, vm: Vm, title: string, description: string, currentPath: string): Promise<string> {
  const data = { ...vm, ...common, fmt, title, description, currentPath };
  const pageHtml = await ejs.renderFile(path.join(VIEWS, `${name}.ejs`), data);
  const layoutHtml = await ejs.renderFile(path.join(VIEWS, "layout.ejs"), { ...data, body: pageHtml });
  return layoutHtml;
}

async function main(): Promise<void> {
  let failures = 0;
  const warnings: string[] = [];

  for (const page of pages) {
    const label = `${page.name}${page.title.includes("sans données") ? " (vide)" : ""}`;
    try {
      const html = await renderPage(page.name, page.vm, page.title, page.description, page.currentPath);
      if (html.length < 200) {
        warnings.push(`${label} : rendu anormalement court (${html.length} caractères)`);
      }
      if (html.includes("[object Object]")) {
        warnings.push(`${label} : « [object Object] » présent dans le HTML`);
      }
      if (html.includes("undefined")) {
        warnings.push(`${label} : « undefined » présent dans le HTML`);
      }
      if (html.includes("NaN")) {
        warnings.push(`${label} : « NaN » présent dans le HTML`);
      }
      process.stdout.write(`  OK   ${label.padEnd(24)} ${String(html.length).padStart(7)} caractères\n`);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      const lines = message.split("\n");
      // EJS : cadre de code en tête, cause réelle en fin de message.
      const head = lines.slice(0, 6).join("\n       ");
      const tail = lines.slice(-4).join("\n       ");
      process.stdout.write(`  FAIL ${label}\n       ${head}\n       …\n       ${tail}\n`);
    }
  }

  if (warnings.length) {
    process.stdout.write("\nAvertissements :\n");
    warnings.forEach((w) => process.stdout.write(`  - ${w}\n`));
  }

  process.stdout.write(`\n${pages.length - failures}/${pages.length} templates rendus.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
