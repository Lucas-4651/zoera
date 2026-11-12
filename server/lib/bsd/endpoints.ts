/**
 * Interface publique des endpoints BSD (contrat §6).
 * Normalisation des réponses brutes → objets domaine, avec cache TTL (§3).
 * En mode démo (absence de BSD_API_KEY), les données proviennent de mock.ts.
 */

import { config } from '../../config';
import { bsdFetch, extractResults, imageUrls, BsdError } from './client';
import { cached } from './cache';
import { mock } from './mock';
import {
  asArray,
  asObject,
  isRecord,
  normalizeText,
  pick,
  toBool,
  toDate,
  toFloat,
  toInt,
  toStr,
} from '../utils';
import type {
  Availability,
  BestOddsRow,
  BestXI,
  Broadcast,
  ClubRank,
  CommentaryLine,
  CompetitionRank,
  Coverage,
  EventLineups,
  EventOdds,
  EventStats,
  FootballEvent,
  H2H,
  H2HMatch,
  Highlight,
  Incident,
  LeaderboardEntry,
  League,
  LiveEvent,
  MatchStatus,
  OddsRow,
  PalmarèsFeatured,
  PalmarèsHighlights,
  Player,
  PlayerRank,
  PlayerStat,
  Prediction,
  Season,
  SquadPlayer,
  Standing,
  StandingsResult,
  Team,
  TeamForm,
  Transfer,
} from './types';

/* ------------------------------------------------------------------ */
/* TTL par ressource (contrat §3)                                       */
/* ------------------------------------------------------------------ */

const TTL = {
  live: 15,
  calendar: 300,
  event: 60,
  stats: 120,
  lineups: 300,
  incidents: 60,
  commentaryLive: 30,
  commentaryFinished: 1800,
  h2h: 3600,
  odds: 180,
  prediction: 300,
  availability: 300,
  playerStats: 300,
  standings: 900,
  top: 900,
  bestXi: 3600,
  squad: 3600,
  teamForm: 1800,
  teams: 3600,
  players: 3600,
  leagues: 3600,
  predictions: 300,
  bestOdds: 300,
  transfers: 1800,
  tv: 3600,
  coverage: 3600,
} as const;

/** TTL déduit de l'URL BSD (chemin + paramètres). */
export function ttlForPath(path: string): number {
  if (path.startsWith('/events/live')) return TTL.live;
  if (/^\/events\/\d+\/commentary/.test(path)) return TTL.commentaryLive;
  if (/^\/events\/\d+\/stats/.test(path)) return TTL.stats;
  if (/^\/events\/\d+\/lineups/.test(path)) return TTL.lineups;
  if (/^\/events\/\d+\/incidents/.test(path)) return TTL.incidents;
  if (/^\/events\/\d+\/h2h/.test(path)) return TTL.h2h;
  if (/^\/events\/\d+\/odds/.test(path)) return TTL.odds;
  if (/^\/events\/\d+\/prediction/.test(path)) return TTL.prediction;
  if (/^\/events\/\d+\/availability/.test(path)) return TTL.availability;
  if (/^\/events\/\d+\/player-stats/.test(path)) return TTL.playerStats;
  if (/^\/events\/\d+\/?$/.test(path)) return TTL.event;
  if (path.startsWith('/events')) return TTL.calendar;
  if (/^\/leagues\/\d+\/standings/.test(path)) return TTL.standings;
  if (/^\/leagues\/\d+\/top/.test(path)) return TTL.top;
  if (/^\/leagues\/\d+\/bestxi/.test(path)) return TTL.bestXi;
  if (/^\/teams\/\d+\/squad/.test(path)) return TTL.squad;
  if (/^\/teams\/\d+\/form/.test(path)) return TTL.teamForm;
  if (/^\/teams\/\d+\/fixtures/.test(path)) return TTL.calendar;
  if (path.startsWith('/teams')) return TTL.teams;
  if (path.startsWith('/players')) return TTL.players;
  if (path.startsWith('/leagues')) return TTL.leagues;
  if (path.startsWith('/predictions')) return TTL.predictions;
  if (path.startsWith('/odds')) return TTL.bestOdds;
  if (path.startsWith('/transfers')) return TTL.transfers;
  if (path.startsWith('/tv-channels') || path.startsWith('/broadcasts')) return TTL.tv;
  if (path.startsWith('/coverage')) return TTL.coverage;
  return TTL.teams;
}

/* ------------------------------------------------------------------ */
/* Helper de cache : clé = METHOD path?sortedQuery                      */
/* ------------------------------------------------------------------ */

interface QueryParams {
  [key: string]: string | number | boolean | null | undefined;
}

function buildQuery(params: QueryParams): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return entries.map(([k, v]) => `${k}=${String(v)}`).join('&');
}

/**
 * Appel BSD mis en cache. La clé est `METHOD path?sortedQuery`.
 */
async function request<T>(path: string, params: QueryParams = {}, ttlOverride?: number): Promise<T> {
  const query = buildQuery(params);
  const key = `GET ${path}${query ? `?${query}` : ''}`;
  const ttl = ttlOverride ?? ttlForPath(path);
  return cached<T>(key, ttl, () => bsdFetch<T>(path, params));
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                        */
/* ------------------------------------------------------------------ */

function mapStatus(raw: unknown): MatchStatus {
  const s = (toStr(raw) ?? 'unknown').toLowerCase();
  const known: MatchStatus[] = [
    'notstarted',
    'inprogress',
    'delayed',
    'penalties',
    'finished',
    'postponed',
    'cancelled',
    'unresolved',
    'upcoming',
    'live',
    'halftime',
    // Pendant un match, l'API BSD encode la période dans le statut.
    '1st_half',
    '2nd_half',
    'extra_time',
  ];
  return known.includes(s as MatchStatus) ? (s as MatchStatus) : 'unknown';
}

function isLiveStatus(status: MatchStatus): boolean {
  return (
    status === 'inprogress' ||
    status === 'live' ||
    status === 'delayed' ||
    status === 'penalties' ||
    status === 'halftime' ||
    status === '1st_half' ||
    status === '2nd_half' ||
    status === 'extra_time'
  );
}

function mapHighlights(raw: unknown): Highlight[] {
  return asArray<Record<string, unknown>>(raw).map((h, i) => ({
    kind: toStr(h.kind) ?? toStr(h.type) ?? 'highlight',
    title: toStr(h.title) ?? 'Résumé du match',
    url: toStr(h.url) ?? toStr(h.video_url) ?? toStr(h.link) ?? '',
    thumbnail: toStr(h.thumbnail) ?? toStr(h.thumbnail_url) ?? null,
    publishedAt: toStr(h.published_at) ?? toStr(h.created_at) ?? new Date().toISOString(),
    ...(i < 0 ? {} : {}),
  }));
}

function mapEvent(raw: unknown): FootballEvent | null {
  if (!isRecord(raw)) return null;
  const id = toInt(raw.id);
  if (id === null) return null;
  const homeTeamId = toInt(raw.home_team_id) ?? 0;
  const awayTeamId = toInt(raw.away_team_id) ?? 0;
  const date = toDate(raw.event_date ?? raw.date ?? raw.kickoff);
  const status = mapStatus(raw.status);
  const penalty = asObject(raw.penalty_shootout);
  const extra = asObject(raw.extra_time_score);
  return {
    id,
    leagueId: toInt(raw.league_id) ?? 0,
    leagueName: toStr(raw.league_name) ?? undefined,
    seasonId: toInt(raw.season_id),
    homeTeamId,
    homeTeam: toStr(raw.home_team) ?? '',
    awayTeamId,
    awayTeam: toStr(raw.away_team) ?? '',
    date: date ?? new Date(0),
    status,
    period: toStr(raw.period),
    minute: toInt(raw.current_minute),
    homeScore: toInt(raw.home_score),
    awayScore: toInt(raw.away_score),
    homeScoreHt: toInt(raw.home_score_ht),
    awayScoreHt: toInt(raw.away_score_ht),
    penaltyShootout:
      penalty.home !== undefined || penalty.away !== undefined
        ? { home: toInt(penalty.home) ?? 0, away: toInt(penalty.away) ?? 0 }
        : null,
    extraTime:
      extra.home !== undefined || extra.away !== undefined
        ? { home: toInt(extra.home) ?? 0, away: toInt(extra.away) ?? 0 }
        : null,
    roundLabel: toStr(raw.round_label) ?? toStr(raw.round_name),
    stage: toStr(raw.stage) ?? toStr(raw.stage_name),
    roundNumber: toInt(raw.round_number),
    venueId: toInt(raw.venue_id),
    refereeId: toInt(raw.referee_id),
    attendance: toInt(raw.attendance),
    isLocalDerby: toBool(raw.is_local_derby) ?? false,
    highlights: mapHighlights(raw.highlights),
    isLive: isLiveStatus(status),
  };
}

function mapSeason(raw: unknown): Season | null {
  if (!isRecord(raw)) return null;
  const id = toInt(raw.id);
  if (id === null) return null;
  const name = toStr(raw.name) ?? toStr(raw.label) ?? '';
  return {
    id,
    name,
    year: toInt(raw.year) ?? (/\d{4}/.exec(name)?.[0] ? Number.parseInt(/\d{4}/.exec(name)?.[0] ?? '0', 10) : null),
    isCurrent: toBool(raw.is_current) ?? false,
    startDate: toStr(raw.start_date),
    endDate: toStr(raw.end_date),
  };
}

function mapLeague(raw: unknown): League | null {
  if (!isRecord(raw)) return null;
  const id = toInt(raw.id);
  if (id === null) return null;
  const season = mapSeason(raw.current_season);
  return {
    id,
    name: toStr(raw.name) ?? '',
    country: toStr(raw.country) ?? '',
    isWomen: toBool(raw.is_women) ?? false,
    isActive: toBool(raw.is_active) ?? true,
    currentSeason: season,
    logoUrl: imageUrls.league(id),
  };
}

function mapTeam(raw: unknown): Team | null {
  if (!isRecord(raw)) return null;
  const id = toInt(raw.id);
  if (id === null) return null;
  return {
    id,
    name: toStr(raw.name) ?? '',
    shortName: toStr(raw.short_name) ?? (toStr(raw.name) ?? '').slice(0, 3).toUpperCase(),
    country: toStr(raw.country) ?? '',
    countryCode: toStr(raw.country_code) ?? '',
    venueId: toInt(raw.venue_id),
    logoUrl: imageUrls.team(id),
  };
}

function mapStanding(raw: unknown): Standing | null {
  if (!isRecord(raw)) return null;
  const teamId = toInt(raw.team_id);
  const teamName = toStr(raw.team_name) ?? toStr(raw.team) ?? '';
  if (teamId === null && !teamName) return null;
  const played = toInt(raw.played) ?? toInt(raw.matches_played) ?? 0;
  const won = toInt(raw.won) ?? 0;
  const drawn = toInt(raw.drawn) ?? toInt(raw.draw) ?? 0;
  const lost = toInt(raw.lost) ?? 0;
  const gf = toInt(raw.goals_for) ?? toInt(raw.gf) ?? 0;
  const ga = toInt(raw.goals_against) ?? toInt(raw.ga) ?? 0;
  return {
    position: toInt(raw.position) ?? 0,
    teamId,
    teamName,
    played,
    won,
    drawn,
    lost,
    gf,
    ga,
    gd: toInt(raw.goal_difference) ?? toInt(raw.gd) ?? gf - ga,
    pts: toInt(raw.points) ?? toInt(raw.pts) ?? won * 3 + drawn,
    xgf: toFloat(raw.xgf) ?? toFloat(raw.expected_goals_for),
    xga: toFloat(raw.xga) ?? toFloat(raw.expected_goals_against),
    xgd: toFloat(raw.xgd),
    xgGames: toInt(raw.xg_games),
    form: toStr(raw.form) ?? '',
    live: toBool(raw.live) ?? false,
    zone: toStr(raw.zone),
  };
}

function mapLeaderboardEntry(raw: unknown, rank: number): LeaderboardEntry | null {
  if (!isRecord(raw)) return null;
  const playerId = toInt(raw.player_id) ?? toInt(raw.id);
  if (playerId === null) return null;
  return {
    rank: toInt(raw.rank) ?? rank,
    playerId,
    playerName: toStr(raw.player_name) ?? toStr(raw.player) ?? toStr(raw.name) ?? '',
    position: toStr(raw.position) ?? '',
    teamId: toInt(raw.team_id) ?? 0,
    teamName: toStr(raw.team_name) ?? toStr(raw.team) ?? '',
    value: toFloat(raw.value) ?? toFloat(raw.goals) ?? toFloat(raw.assists) ?? 0,
    matches: toInt(raw.matches) ?? toInt(raw.appearances) ?? 0,
    photoUrl: imageUrls.player(playerId),
  };
}

function mapPlayer(raw: unknown): Player | null {
  if (!isRecord(raw)) return null;
  const id = toInt(raw.id);
  if (id === null) return null;
  const currentTeam = asObject(raw.current_team);
  return {
    id,
    name: toStr(raw.name) ?? '',
    shortName: toStr(raw.short_name),
    position: toStr(raw.position) ?? 'M',
    specificPosition: toStr(raw.specific_position),
    jerseyNumber: toInt(raw.jersey_number),
    dateOfBirth: toStr(raw.date_of_birth),
    heightCm: toInt(raw.height_cm),
    weightKg: toInt(raw.weight_kg),
    nationality: toStr(raw.nationality),
    currentTeamId: toInt(raw.current_team_id) ?? toInt(currentTeam.id),
    currentTeamName: toStr(raw.current_team_name) ?? toStr(currentTeam.name),
    marketValueEur: toInt(raw.market_value_eur),
    availability: toStr(raw.availability),
    injuryType: toStr(raw.injury_type),
    rating: toFloat(raw.rating),
    photoUrl: imageUrls.player(id),
    strengths: asArray<string>(raw.strengths).filter((s): s is string => typeof s === 'string'),
    weaknesses: asArray<string>(raw.weaknesses).filter((s): s is string => typeof s === 'string'),
  };
}

function mapSquadPlayer(raw: unknown): SquadPlayer | null {
  if (!isRecord(raw)) return null;
  const id = toInt(raw.id);
  if (id === null) return null;
  return {
    id,
    name: toStr(raw.name) ?? '',
    shortName: toStr(raw.short_name) ?? (toStr(raw.name) ?? '').slice(0, 2).toUpperCase(),
    position: toStr(raw.position) ?? 'M',
    jerseyNumber: toInt(raw.jersey_number),
    nationality: toStr(raw.nationality) ?? '',
    dateOfBirth: toStr(raw.date_of_birth),
    availability: toStr(raw.availability) ?? 'available',
    injuryType: toStr(raw.injury_type) ?? '',
    injuryExpectedReturn: toStr(raw.injury_expected_return),
    photoUrl: imageUrls.player(id),
  };
}

function mapPlayerStat(raw: unknown): PlayerStat | null {
  if (!isRecord(raw)) return null;
  const playerId = toInt(raw.player_id);
  if (playerId === null) return null;
  return {
    playerId,
    teamId: toInt(raw.team_id) ?? 0,
    minutesPlayed: toInt(raw.minutes_played) ?? 0,
    rating: toFloat(raw.rating),
    goals: toInt(raw.goals) ?? 0,
    assists: toInt(raw.goal_assist) ?? toInt(raw.assists) ?? 0,
    xg: toFloat(raw.expected_goals),
    xa: toFloat(raw.expected_assists),
    shots: toInt(raw.total_shots) ?? 0,
    shotsOnTarget: toInt(raw.shots_on_target) ?? 0,
    passes: toInt(raw.total_pass) ?? 0,
    accuratePasses: toInt(raw.accurate_pass) ?? 0,
    tackles: toInt(raw.total_tackle) ?? 0,
    duelsWon: toInt(raw.duel_won) ?? 0,
    duelsLost: toInt(raw.duel_lost) ?? 0,
    yellowCards: toInt(raw.yellow_card) ?? 0,
    redCards: toInt(raw.red_card) ?? 0,
    saves: toInt(raw.saves) ?? 0,
    bigChances: toInt(raw.big_chance_created) ?? 0,
    bigChancesMissed: toInt(raw.big_chance_missed) ?? 0,
    progressivePasses: toInt(raw.total_progression),
    aerialWon: toInt(raw.aerial_won),
    aerialLost: toInt(raw.aerial_lost),
  };
}

function mapShot(raw: unknown): import('./types').Shot | null {
  if (!isRecord(raw)) return null;
  // L'API BSD utilise "min" pour la minute et "pos" pour les coordonnées.
  const minute = toInt(raw.min ?? raw.minute);
  if (minute === null) return null;
  const pos = asObject(raw.pos);
  return {
    playerId: toInt(raw.player_id),
    playerName: toStr(raw.player_name) ?? toStr(raw.player),
    minute,
    added: toInt(raw.added ?? raw.added_time),
    home: toBool(raw.home) ?? toBool(raw.is_home) ?? false,
    type: toStr(raw.type) ?? 'open_play',
    sit: toStr(raw.sit) ?? 'on_target',
    body: toStr(raw.body) ?? 'right_foot',
    gtype: toStr(raw.gtype),
    xg: toFloat(raw.xg),
    xgot: toFloat(raw.xgot),
    xgEstimated: toBool(raw.xg_estimated),
    x: toFloat(pos.x ?? raw.x),
    y: toFloat(pos.y ?? raw.y),
  };
}

function mapTeamStats(raw: unknown): import('./types').TeamStats {
  const r = asObject(raw);
  // L'APIBSD nomme ses compteurs "ball_possession", "total_shots", "corner_kings"…
  // On accepte les deux conventions pour rester tolérant.
  return {
    possession: toFloat(r.ball_possession ?? r.possession),
    shots: toInt(r.total_shots ?? r.shots),
    shotsOnTarget: toInt(r.shots_on_target ?? r.shots_on_goal),
    corners: toInt(r.corner_kicks ?? r.corners),
    fouls: toInt(r.fouls),
    offsides: toInt(r.offsides),
    yellowCards: toInt(r.yellow_cards),
    redCards: toInt(r.red_cards),
    passes: toInt(r.total_passes ?? r.passes),
    accuratePasses: toInt(r.accurate_passes),
    tackles: toInt(r.total_tackles ?? r.tackles),
    xg: toFloat(r.xg ?? r.expected_goals),
    xgot: toFloat(r.xgot ?? r.expected_goals_on_target),
    bigChances: toInt(r.big_chances),
    saves: toInt(r.saves),
  };
}

function mapEventStats(raw: unknown): EventStats | null {
  if (!isRecord(raw)) return null;
  const stats = asObject(raw.stats);
  const home = asObject(stats.home ?? stats.home_team);
  const away = asObject(stats.away ?? stats.away_team);
  return {
    home: mapTeamStats(home),
    away: mapTeamStats(away),
    shotmap: asArray<unknown>(raw.shotmap).map(mapShot).filter((s): s is import('./types').Shot => s !== null),
    momentum: asArray<Record<string, unknown>>(raw.momentum).map((m) => ({
      minute: toInt(m.m ?? m.minute) ?? 0,
      value: toFloat(m.v ?? m.value) ?? 0,
    })),
    xgPerMinute: asArray<Record<string, unknown>>(raw.xg_per_minute).map((m) => ({
      minute: toInt(m.m ?? m.minute) ?? 0,
      home: toFloat(m.xg_home ?? m.home) ?? 0,
      away: toFloat(m.xg_away ?? m.away) ?? 0,
      cumHome: toFloat(m.cum_home) ?? toFloat(m.cumulative_home) ?? 0,
      cumAway: toFloat(m.cum_away) ?? toFloat(m.cumulative_away) ?? 0,
    })),
    xgEstimated: toBool(raw.xg_estimated) ?? false,
    averagePositions: raw.average_positions ?? null,
  };
}

function mapLineups(raw: unknown): EventLineups | null {
  if (!isRecord(raw)) return null;
  const statusRaw = (toStr(raw.lineup_status) ?? 'unavailable').toLowerCase();
  const status: EventLineups['status'] =
    statusRaw === 'confirmed' ? 'confirmed' : statusRaw === 'predicted' ? 'predicted' : 'unavailable';
  const lineups = asObject(raw.lineups);
  const mapPlayer = (p: Record<string, unknown>, isStarter: boolean): import('./types').LineupPlayer | null => {
    const id = toInt(p.id) ?? toInt(p.player_id);
    if (id === null) return null;
    return {
      id,
      name: toStr(p.name) ?? toStr(p.player_name) ?? '',
      shortName: toStr(p.short_name) ?? '',
      position: toStr(p.position) ?? '',
      jerseyNumber: toInt(p.jersey_number),
      isStarter,
      isCaptain: toBool(p.captain) ?? toBool(p.is_captain) ?? false,
      subIn: toInt(p.sub_in),
      subOut: toInt(p.sub_out),
    };
  };
  // Côté réel : { team_id, team_name, formation, confidence, players[], substitutes[] }
  const mapSide = (side: unknown): import('./types').LineupPlayer[] => {
    const s = asObject(side);
    const starters = asArray<Record<string, unknown>>(s.players ?? s.starters).map((p) => mapPlayer(p, true));
    const subs = asArray<Record<string, unknown>>(s.substitutes ?? s.bench).map((p) => mapPlayer(p, false));
    return [...starters, ...subs].filter((p): p is import('./types').LineupPlayer => p !== null);
  };
  const unavailableRaw = asObject(raw.unavailable_players);
  const unavailable: SquadPlayer[] = [];
  for (const p of [
    ...asArray<Record<string, unknown>>(unavailableRaw.home),
    ...asArray<Record<string, unknown>>(unavailableRaw.away),
  ]) {
    const id = toInt(p.id);
    if (id === null) continue;
    unavailable.push({
      id,
      name: toStr(p.name) ?? '',
      shortName: toStr(p.short_name) ?? '',
      position: toStr(p.position) ?? '',
      jerseyNumber: toInt(p.jersey_number),
      nationality: '',
      dateOfBirth: null,
      availability: toStr(p.status) ?? 'injured',
      injuryType: toStr(p.reason) ?? '',
      injuryExpectedReturn: null,
      photoUrl: null,
    });
  }
  const homeSide = asObject(lineups.home ?? lineups.home_team);
  const awaySide = asObject(lineups.away ?? lineups.away_team);
  return {
    status,
    home: mapSide(lineups.home ?? lineups.home_team),
    away: mapSide(lineups.away ?? lineups.away_team),
    homeFormation: toStr(homeSide.formation) ?? toStr(lineups.home_formation) ?? toStr(lineups.formation),
    awayFormation: toStr(awaySide.formation) ?? toStr(lineups.away_formation),
    unavailable,
    updatedAt: toStr(raw.updated_at),
  };
}

function mapIncidents(raw: unknown): Incident[] {
  return asArray<Record<string, unknown>>(raw).map((i) => ({
    type: toStr(i.type) ?? 'incident',
    player: toStr(i.player) ?? toStr(i.player_name),
    minute: toInt(i.minute),
    isHome: toBool(i.is_home) ?? false,
    assist: toStr(i.assist),
    reason: toStr(i.reason) ?? toStr(i.card_type),
    playerIn: toStr(i.player_in),
    playerOut: toStr(i.player_out),
    cardType: toStr(i.card_type),
    addedTime: toInt(i.added_time) ?? toInt(i.length),
  }));
}

function mapCommentary(raw: unknown): CommentaryLine[] {
  return asArray<Record<string, unknown>>(raw).map((c) => ({
    id: toStr(c.id) ?? String(Math.random()),
    minute: toInt(c.minute) ?? 0,
    addedTime: toInt(c.added_time),
    type: toStr(c.type) ?? 'event',
    team: toStr(c.team) ?? '',
    player: toStr(c.player) ?? toStr(c.player_name),
    relatedPlayer: toStr(c.related_player),
    text: toStr(c.text) ?? '',
    score: toStr(c.score),
    important: toBool(c.important) ?? false,
  }));
}

function mapH2H(raw: unknown): H2H | null {
  if (!isRecord(raw)) return null;
  const total = toInt(raw.total_matches) ?? 0;
  return {
    totalMatches: total,
    homeWins: toInt(raw.home_wins) ?? 0,
    draws: toInt(raw.draws) ?? 0,
    awayWins: toInt(raw.away_wins) ?? 0,
    homeGoals: toInt(raw.home_goals) ?? 0,
    awayGoals: toInt(raw.away_goals) ?? 0,
    avgTotalGoals: toFloat(raw.avg_total_goals),
    homeWinRate: toFloat(raw.home_win_rate),
    awayWinRate: toFloat(raw.away_win_rate),
    recentMatches: asArray<Record<string, unknown>>(raw.recent_matches).map((m): H2HMatch => ({
      eventId: toInt(m.event_id),
      date: toStr(m.date) ?? toStr(m.event_date) ?? '',
      home: toStr(m.home_team) ?? toStr(m.home) ?? '',
      away: toStr(m.away_team) ?? toStr(m.away) ?? '',
      score: toStr(m.score) ?? '',
      homeTeamId: toInt(m.home_team_id),
      awayTeamId: toInt(m.away_team_id),
    })),
  };
}

function mapOdds(raw: unknown): EventOdds | null {
  if (!isRecord(raw)) return null;
  const odds = asObject(raw.odds);
  const marketLabels: Record<string, string> = {
    '1x2': 'Résultat du match',
    over_under_15: 'Plus ou moins 1,5 buts',
    over_under_25: 'Plus ou moins 2,5 buts',
    over_under_35: 'Plus ou moins 3,5 buts',
    btts: 'Les deux équipes marquent',
  };
  const outcomeLabels: Record<string, string> = {
    HOME: 'Équipe à domicile',
    DRAW: 'Match nul',
    AWAY: 'Équipe à l’extérieur',
    over: 'Plus',
    under: 'Moins',
    yes: 'Oui',
    no: 'Non',
  };
  const markets: import('./types').OddsMarket[] = [];

  // Format BSD réel : marché plat (home_win, draw, over_25_goals, btts_yes…).
  const flat: Array<[string, string, number | null]> = [
    ['1x2', 'HOME', toFloat(odds.home_win)],
    ['1x2', 'DRAW', toFloat(odds.draw)],
    ['1x2', 'AWAY', toFloat(odds.away_win)],
    ['over_under_15', 'over', toFloat(odds.over_15_goals)],
    ['over_under_15', 'under', toFloat(odds.under_15_goals)],
    ['over_under_25', 'over', toFloat(odds.over_25_goals)],
    ['over_under_25', 'under', toFloat(odds.under_25_goals)],
    ['over_under_35', 'over', toFloat(odds.over_35_goals)],
    ['over_under_35', 'under', toFloat(odds.under_35_goals)],
    ['btts', 'yes', toFloat(odds.btts_yes)],
    ['btts', 'no', toFloat(odds.btts_no)],
  ];
  const grouped = new Map<string, import('./types').OddsMarket>();
  for (const [market, outcome, decimal] of flat) {
    if (decimal === null) continue;
    let entry = grouped.get(market);
    if (!entry) {
      entry = { market, label: marketLabels[market] ?? market, line: null, outcomes: [] };
      grouped.set(market, entry);
      markets.push(entry);
    }
    entry.outcomes.push({
      outcome,
      label: outcomeLabels[outcome] ?? outcome,
      decimal,
      implied: decimal > 0 ? Math.round((1 / decimal) * 1000) / 1000 : null,
      movement: null,
    });
  }

  // Format imbriqué (autresenvironnements) : on l'ajoute s'il est présent.
  const marketsRaw = isRecord(odds.markets) ? odds.markets : null;
  if (marketsRaw) {
    for (const [key, value] of Object.entries(marketsRaw)) {
      const m = asObject(value);
      const outcomesRaw = asArray<Record<string, unknown>>(m.outcomes ?? m);
      const outcomes: import('./types').OddsOutcome[] = outcomesRaw.map((o) => ({
        outcome: toStr(o.outcome) ?? toStr(o.key) ?? '',
        label: toStr(o.label) ?? outcomeLabels[toStr(o.outcome) ?? ''] ?? toStr(o.outcome) ?? '',
        decimal: toFloat(o.decimal ?? o.decimal_odds),
        implied: toFloat(o.implied ?? o.implied_probability),
        movement: toStr(o.movement),
      }));
      if (outcomes.length === 0) continue;
      markets.push({
        market: key,
        label: marketLabels[key] ?? key,
        line: toFloat(m.line),
        outcomes,
      });
    }
  }

  return {
    markets,
    lastUpdateAt: toStr(raw.last_update_at),
    nextUpdateAt: toStr(raw.next_update_at),
    updateIntervalSeconds: toInt(raw.update_interval_seconds),
    bookmakersCount: toInt(raw.bookmakers_count) ?? 0,
  };
}

function mapPrediction(raw: unknown): Prediction | null {
  if (!isRecord(raw)) return null;
  const id = toInt(raw.id);
  if (id === null) return null;
  const event = asObject(raw.event);
  const markets = asObject(raw.markets);
  const matchResult = asObject(markets.match_result ?? markets.result);
  const expectedGoals = asObject(markets.expected_goals);
  const overUnder = asObject(markets.over_under);
  const btts = asObject(markets.btts);
  const scoreMarket = asObject(markets.score);
  const model = asObject(raw.model);
  // Format réel : { prob_home, prob_draw, prob_away, predicted } (en pourcentage).
  // Le domaine stocke des probabilités 0–1 (contrat §3).
  const pct = (v: number | null): number | null => (v === null ? null : v > 1 ? v / 100 : v);
  const homeProb = pct(toFloat(matchResult.prob_home ?? matchResult.home ?? matchResult.home_probability));
  const drawProb = pct(toFloat(matchResult.prob_draw ?? matchResult.draw ?? matchResult.draw_probability));
  const awayProb = pct(toFloat(matchResult.prob_away ?? matchResult.away ?? matchResult.away_probability));
  let topOutcome: string | null = toStr(matchResult.predicted);
  let topProbability: number | null = null;
  if (topOutcome) {
    const key = topOutcome.toUpperCase();
    topProbability =
      key.includes('HOME') ? homeProb : key.includes('DRAW') ? drawProb : key.includes('AWAY') ? awayProb : null;
  }
  if (topProbability === null && (homeProb !== null || drawProb !== null || awayProb !== null)) {
    const candidates: Array<[string, number | null]> = [
      ['HOME', homeProb],
      ['DRAW', drawProb],
      ['AWAY', awayProb],
    ];
    const best = candidates.reduce<[string, number | null]>(
      (acc, cur) => ((cur[1] ?? -1) > (acc[1] ?? -1) ? cur : acc),
      ['HOME', null],
    );
    topOutcome = best[0];
    topProbability = best[1];
  }
  const eventId = toInt(event.id) ?? toInt(raw.event_id);
  return {
    id,
    eventId,
    homeTeam: toStr(event.home_team) ?? toStr(event.home_team_name),
    awayTeam: toStr(event.away_team) ?? toStr(event.away_team_name),
    homeTeamId: toInt(event.home_team_id),
    awayTeamId: toInt(event.away_team_id),
    leagueName: toStr(event.league_name),
    date: toDate(event.event_date ?? event.date),
    homeProb,
    drawProb,
    awayProb,
    topOutcome,
    topProbability,
    expectedHomeGoals: toFloat(expectedGoals.home ?? expectedGoals.home_expected),
    expectedAwayGoals: toFloat(expectedGoals.away ?? expectedGoals.away_expected),
    over25: pct(toFloat(overUnder.prob_over_25 ?? overUnder.over_25 ?? overUnder.over ?? overUnder.line)),
    btts: pct(toFloat(btts.prob_yes ?? btts.yes ?? btts.btts)),
    score: toStr(scoreMarket.most_likely) ?? (typeof markets.score === 'string' ? (markets.score as string) : null),
    model: toStr(model.version) ?? toStr(model.name) ?? null,
    updatedAt: toStr(raw.updated_at),
  };
}

function mapAvailability(raw: unknown): Availability | null {
  if (!isRecord(raw)) return null;
  const availableRaw = asObject(raw.available);
  const available: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(availableRaw)) {
    available[k] = toBool(v) ?? false;
  }
  return {
    eventId: toInt(raw.event_id) ?? 0,
    status: toStr(raw.status) ?? 'unknown',
    lineupStatus: toStr(raw.lineup_status) ?? 'unavailable',
    available,
    statKeys: asArray<string>(raw.stat_keys).filter((s): s is string => typeof s === 'string'),
    oddsMarkets: asArray<string>(raw.odds_markets).filter((s): s is string => typeof s === 'string'),
  };
}

function mapTransfer(raw: unknown): Transfer | null {
  if (!isRecord(raw)) return null;
  const id = toInt(raw.id);
  if (id === null) return null;
  const player = asObject(raw.player);
  const fee = toInt(raw.fee_eur);
  return {
    id,
    date: toStr(raw.transfer_date),
    playerId: toInt(raw.player_id) ?? toInt(player.id),
    playerName: toStr(raw.player_name) ?? toStr(player.name),
    fromTeamId: toInt(raw.from_team_id),
    fromTeamName: toStr(raw.from_team_name) ?? '',
    toTeamId: toInt(raw.to_team_id),
    toTeamName: toStr(raw.to_team_name) ?? '',
    feeEur: fee,
    feeDescription: toStr(raw.fee_description) ?? (fee === null ? 'Non communiqué' : `${fee} €`),
  };
}

function mapBroadcast(raw: unknown): Broadcast | null {
  if (!isRecord(raw)) return null;
  const id = toInt(raw.id);
  if (id === null) return null;
  return {
    id,
    eventId: toInt(raw.event_id) ?? 0,
    leagueName: toStr(raw.league_name),
    homeTeam: toStr(raw.home_team) ?? '',
    awayTeam: toStr(raw.away_team) ?? '',
    date: toDate(raw.event_date) ?? new Date(0),
    countryCode: toStr(raw.country_code) ?? '',
    channelName: toStr(raw.channel_name) ?? '',
    channelLink: toStr(raw.channel_link) ?? '',
    scheduledStart: toDate(raw.scheduled_start_time),
  };
}

function mapFormSplit(raw: unknown): import('./types').FormSplit | null {
  if (!isRecord(raw)) return null;
  const stats: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(asObject(raw.stats))) {
    // L'API renvoie { average, total, matches } par statistique.
    if (isRecord(v)) stats[k] = toFloat(v.average);
    else stats[k] = toFloat(v);
  }
  return {
    results: toStr(raw.form) ?? toStr(raw.results),
    wins: toInt(raw.won ?? raw.wins),
    draws: toInt(raw.drawn ?? raw.draws),
    losses: toInt(raw.lost ?? raw.losses),
    goalsFor: toInt(raw.goals_for),
    goalsAgainst: toInt(raw.goals_against),
    pointsPerMatch: toFloat(raw.points_per_match),
    stats,
  };
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                            */
/* ------------------------------------------------------------------ */

const demo = config.isDemo;

/**
 * Index des joueurs d'un match : playerId -> { nom, club, numéro }.
 * Construit à partir des effectifs des deux équipes (2 appels, cache 1 h) :
 * l'API des statistiques par joueur ne renvoie que des identifiants.
 */
async function squadIndexOf(event: FootballEvent): Promise<Map<number, { name: string; teamName: string; jerseyNumber: number | null }>> {
  const index = new Map<number, { name: string; teamName: string; jerseyNumber: number | null }>();
  const teams: { id: number; name: string }[] = [
    { id: event.homeTeamId, name: event.homeTeam },
    { id: event.awayTeamId, name: event.awayTeam },
  ];
  await Promise.all(
    teams.map(async (team) => {
      if (!team.id) return;
      const squad = await getTeamSquad(team.id).catch(() => [] as SquadPlayer[]);
      for (const p of squad) {
        if (!p?.id) continue;
        index.set(p.id, { name: p.name || p.shortName || '', teamName: team.name, jerseyNumber: p.jerseyNumber ?? null });
      }
    }),
  );
  return index;
}

export async function getLiveEvents(opts?: { leagueId?: number; teamId?: number }): Promise<LiveEvent[]> {
  if (demo) return mock.getLiveEvents(opts);
  const params: QueryParams = {};
  if (opts?.leagueId) params.league_id = opts.leagueId;
  if (opts?.teamId) params.team_id = opts.teamId;
  const raw = await request<unknown>('/events/live/', params);
  const events = extractResults(raw).map(mapEvent).filter((e): e is FootballEvent => e !== null);
  return events.map((e) => ({ ...e, leagueName: e.leagueName ?? '', lastUpdated: new Date().toISOString() }));
}

export async function getFixtures(opts: {
  dateFrom: string;
  dateTo: string;
  leagueId?: number;
  limit?: number;
}): Promise<FootballEvent[]> {
  if (demo) return mock.getFixtures(opts);
  const params: QueryParams = {
    date_from: opts.dateFrom,
    date_to: opts.dateTo,
    limit: opts.limit ?? 50,
  };
  if (opts.leagueId) params.league_id = opts.leagueId;
  const raw = await request<unknown>('/events/', params);
  return extractResults(raw).map(mapEvent).filter((e): e is FootballEvent => e !== null);
}

export async function getEvent(id: number): Promise<FootballEvent | null> {
  if (demo) return mock.getEvent(id);
  try {
    const raw = await request<unknown>(`/events/${id}/`);
    return mapEvent(raw);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return null;
    throw err;
  }
}

export async function getEventStats(id: number): Promise<EventStats | null> {
  const stats = demo
    ? await mock.getEventStats(id)
    : await (async () => {
        try {
          const raw = await request<unknown>(`/events/${id}/stats/`);
          return mapEventStats(raw);
        } catch (err) {
          if (err instanceof BsdError && (err.status === 404 || err.status === 503)) return null;
          throw err;
        }
      })();
  if (!stats) return null;

  // Noms des tireurs sur la carte des tirs (l'API ne donne que player_id).
  const shots = stats.shotmap ?? [];
  if (shots.some((s) => s.playerId && !s.playerName)) {
    const event = await getEvent(id).catch(() => null);
    if (event) {
      const index = await squadIndexOf(event);
      stats.shotmap = shots.map((s) => ({
        ...s,
        playerName: s.playerName ?? (s.playerId ? index.get(s.playerId)?.name ?? null : null),
      }));
    }
  }
  return stats;
}

export async function getEventLineups(id: number): Promise<EventLineups | null> {
  if (demo) return mock.getEventLineups(id);
  try {
    const raw = await request<unknown>(`/events/${id}/lineups/`);
    return mapLineups(raw);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return null;
    throw err;
  }
}

export async function getEventIncidents(id: number): Promise<Incident[]> {
  if (demo) return mock.getEventIncidents(id);
  try {
    const raw = await request<unknown>(`/events/${id}/incidents/`);
    return mapIncidents(asObject(raw).incidents ?? raw);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return [];
    throw err;
  }
}

export async function getEventCommentary(id: number): Promise<CommentaryLine[]> {
  if (demo) return mock.getEventCommentary(id);
  try {
    const raw = await request<unknown>(`/events/${id}/commentary/`);
    return mapCommentary(asObject(raw).commentary ?? raw);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return [];
    throw err;
  }
}

export async function getEventH2H(id: number): Promise<H2H | null> {
  if (demo) return mock.getEventH2H(id);
  try {
    const raw = await request<unknown>(`/events/${id}/h2h/`);
    return mapH2H(raw);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return null;
    throw err;
  }
}

export async function getEventOdds(id: number): Promise<EventOdds | null> {
  if (demo) return mock.getEventOdds(id);
  try {
    const raw = await request<unknown>(`/events/${id}/odds/`);
    return mapOdds(raw);
  } catch (err) {
    if (err instanceof BsdError && (err.status === 404 || err.status === 402 || err.status === 403)) return null;
    throw err;
  }
}

export async function getEventPrediction(id: number): Promise<Prediction | null> {
  if (demo) return mock.getEventPrediction(id);
  try {
    const raw = await request<unknown>(`/events/${id}/prediction/`);
    return mapPrediction(raw);
  } catch (err) {
    if (err instanceof BsdError && (err.status === 404 || err.status === 503)) return null;
    throw err;
  }
}

export async function getEventAvailability(id: number): Promise<Availability | null> {
  if (demo) return mock.getEventAvailability(id);
  try {
    const raw = await request<unknown>(`/events/${id}/availability/`);
    return mapAvailability(raw);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return null;
    throw err;
  }
}

export async function getEventPlayerStats(id: number): Promise<PlayerStat[]> {
  const rows = demo
    ? await mock.getEventPlayerStats(id)
    : await (async () => {
        try {
          const raw = await request<unknown>(`/events/${id}/player-stats/`);
          // Enveloppe réelle : { event_id, count, player_stats: [...] }
          const list = asArray<Record<string, unknown>>(asObject(raw).player_stats);
          return list.map(mapPlayerStat).filter((s): s is PlayerStat => s !== null);
        } catch (err) {
          if (err instanceof BsdError && err.status === 404) return [];
          throw err;
        }
      })();

  // Noms des joueurs : l'API ne renvoie que des ids, on passe par les effectifs.
  const event = await getEvent(id).catch(() => null);
  if (!event) return rows;
  const index = await squadIndexOf(event);
  return rows.map((row) => {
    const found = index.get(row.playerId);
    return {
      ...row,
      playerName: found?.name ?? null,
      teamName: found?.teamName ?? null,
      jerseyNumber: found?.jerseyNumber ?? null,
    };
  });
}

export async function getLeagues(opts?: {
  country?: string;
  isWomen?: boolean;
  /** Pagination : "limit" et "offset" sont acceptés par l'API (§4). */
  limit?: number;
  offset?: number;
}): Promise<League[]> {
  if (demo) return mock.getLeagues({ country: opts?.country, isWomen: opts?.isWomen });
  const params: QueryParams = {};
  if (opts?.country) params.country = opts.country;
  if (opts?.isWomen !== undefined) params.is_women = opts.isWomen;
  if (opts?.limit) params.limit = opts.limit;
  if (opts?.offset) params.offset = opts.offset;
  const raw = await request<unknown>('/leagues/', params);
  return extractResults(raw).map(mapLeague).filter((l): l is League => l !== null);
}

export async function getLeague(id: number): Promise<League | null> {
  if (demo) return mock.getLeague(id);
  try {
    const raw = await request<unknown>(`/leagues/${id}/`);
    return mapLeague(raw);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return null;
    throw err;
  }
}

export async function getLeagueSeasons(id: number): Promise<Season[]> {
  if (demo) return mock.getLeagueSeasons(id);
  try {
    const raw = await request<unknown>(`/leagues/${id}/seasons/`);
    return asArray<unknown>(asObject(raw).seasons).map(mapSeason).filter((s): s is Season => s !== null);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return [];
    throw err;
  }
}

export async function getStandings(leagueId: number, seasonId?: number): Promise<StandingsResult> {
  if (demo) return mock.getStandings(leagueId, seasonId);
  const params: QueryParams = {};
  if (seasonId) params.season_id = seasonId;
  const raw = await request<unknown>(`/leagues/${leagueId}/standings/`, params);
  const root = asObject(raw);
  const groupsRaw = asObject(root.groups);
  const groups: Record<string, Standing[]> = {};
  for (const [key, value] of Object.entries(groupsRaw)) {
    groups[key] = asArray<unknown>(value).map(mapStanding).filter((s): s is Standing => s !== null);
  }
  const flat = asArray<unknown>(root.standings).map(mapStanding).filter((s): s is Standing => s !== null);
  if (Object.keys(groups).length === 0 && flat.length > 0) groups['Groupe'] = flat;
  return {
    grouped: toBool(root.grouped) ?? Object.keys(groups).length > 1,
    groups,
    flat,
    season: mapSeason(root.season),
    leagueId,
  };
}

export async function getTopScorers(
  leagueId: number,
  opts?: { stat?: string; seasonId?: number; limit?: number },
): Promise<LeaderboardEntry[]> {
  if (demo) return mock.getTopScorers(leagueId, opts);
  const stat = opts?.stat ?? 'scorers';
  const params: QueryParams = {};
  if (opts?.seasonId) params.season_id = opts.seasonId;
  if (opts?.limit) params.limit = opts.limit;
  const raw = await request<unknown>(`/leagues/${leagueId}/top/${stat}/`, params);
  const leaders = asArray<unknown>(asObject(raw).leaders);
  return leaders
    .map((l, i) => mapLeaderboardEntry(l, i + 1))
    .filter((l): l is LeaderboardEntry => l !== null);
}

export async function getBestXI(leagueId: number, seasonId: number, round?: number): Promise<BestXI | null> {
  if (demo) return mock.getBestXI(leagueId, seasonId, round);
  const path = round !== undefined ? `/leagues/${leagueId}/bestxi/${seasonId}/${round}/` : `/leagues/${leagueId}/bestxi/${seasonId}/`;
  try {
    const raw = await request<unknown>(path);
    const root = asObject(raw);
    const lineupRaw = asObject(root.lineup);
    // Format réel : { G: [{ player_id, player_name, team_name, avg_rating }], D: [...], … }
    const lineup = Object.entries(lineupRaw).flatMap(([position, value]) => {
      const entries = Array.isArray(value) ? value : [value];
      return entries.map((entry) => {
        const v = asObject(entry);
        const playerId = toInt(v.player_id) ?? toInt(v.id);
        const playerName = toStr(v.player_name) ?? toStr(v.name);
        return {
          position,
          goals: toInt(v.goals) ?? 0,
          assists: toInt(v.assists) ?? 0,
          matches: toInt(v.matches) ?? 0,
          teamId: toInt(v.team_id),
          teamName: toStr(v.team_name) ?? '',
          player:
            playerId !== null
              ? ({
                  id: playerId,
                  name: playerName ?? '',
                  shortName: toStr(v.short_name),
                  position: toStr(v.position) ?? '',
                  jerseyNumber: toInt(v.jersey_number),
                  currentTeamId: toInt(v.team_id),
                  currentTeamName: toStr(v.team_name),
                  rating: toFloat(v.avg_rating) ?? toFloat(v.rating),
                } as unknown as Player)
              : null,
          rating: toFloat(v.avg_rating) ?? toFloat(v.rating),
        };
      });
    });
    return { formation: toStr(root.formation), lineup };
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return null;
    throw err;
  }
}

export async function getTeams(opts?: {
  leagueId?: number;
  name?: string;
  countryCode?: string;
  limit?: number;
}): Promise<Team[]> {
  if (demo) return mock.getTeams(opts);
  const params: QueryParams = {};
  if (opts?.leagueId) params.league_id = opts.leagueId;
  if (opts?.name) params.name = opts.name;
  if (opts?.countryCode) params.country_code = opts.countryCode;
  if (opts?.limit) params.limit = opts.limit;
  const raw = await request<unknown>('/teams/', params);
  return extractResults(raw).map(mapTeam).filter((t): t is Team => t !== null);
}

export async function getTeam(id: number): Promise<Team | null> {
  if (demo) return mock.getTeam(id);
  try {
    const raw = await request<unknown>(`/teams/${id}/`);
    return mapTeam(raw);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return null;
    throw err;
  }
}

export async function getTeamSquad(id: number): Promise<SquadPlayer[]> {
  if (demo) return mock.getTeamSquad(id);
  try {
    const raw = await request<unknown>(`/teams/${id}/squad/`);
    return asArray<unknown>(asObject(raw).players).map(mapSquadPlayer).filter((p): p is SquadPlayer => p !== null);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return [];
    throw err;
  }
}

export async function getTeamForm(id: number, opts?: { last?: number; leagueId?: number }): Promise<TeamForm | null> {
  if (demo) return mock.getTeamForm(id, opts);
  const params: QueryParams = {};
  if (opts?.last) params.last = opts.last;
  if (opts?.leagueId) params.league_id = opts.leagueId;
  try {
    const raw = await request<unknown>(`/teams/${id}/form/`, params);
    const root = asObject(raw);
    return {
      teamId: toInt(root.team_id) ?? id,
      teamName: toStr(root.team_name) ?? '',
      matches: toInt(root.matches) ?? 0,
      requested: toInt(root.requested) ?? (opts?.last ?? 10),
      overall: mapFormSplit(root.overall),
      home: mapFormSplit(root.home),
      away: mapFormSplit(root.away),
    };
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return null;
    throw err;
  }
}

export async function getTeamFixtures(id: number, opts?: { dateFrom?: string; dateTo?: string }): Promise<FootballEvent[]> {
  if (demo) return mock.getTeamFixtures(id, opts);
  const params: QueryParams = {};
  if (opts?.dateFrom) params.date_from = opts.dateFrom;
  if (opts?.dateTo) params.date_to = opts.dateTo;
  try {
    const raw = await request<unknown>(`/teams/${id}/fixtures/`, params);
    return extractResults(raw).map(mapEvent).filter((e): e is FootballEvent => e !== null);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return [];
    throw err;
  }
}

export async function getPlayers(opts?: {
  name?: string;
  teamId?: number;
  position?: string;
  limit?: number;
}): Promise<Player[]> {
  if (demo) return mock.getPlayers(opts);
  const params: QueryParams = {};
  if (opts?.name) params.name = opts.name;
  if (opts?.teamId) params.team_id = opts.teamId;
  if (opts?.position) params.position = opts.position;
  if (opts?.limit) params.limit = opts.limit;
  const raw = await request<unknown>('/players/', params);
  return extractResults(raw).map(mapPlayer).filter((p): p is Player => p !== null);
}

export async function getPlayer(id: number): Promise<Player | null> {
  if (demo) return mock.getPlayer(id);
  try {
    const raw = await request<unknown>(`/players/${id}/`);
    return mapPlayer(raw);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return null;
    throw err;
  }
}

export async function getPlayerStats(id: number, opts?: { seasonId?: number; limit?: number }): Promise<PlayerStat[]> {
  if (demo) return mock.getPlayerStats(id, opts);
  const params: QueryParams = {};
  if (opts?.seasonId) params.season_id = opts.seasonId;
  if (opts?.limit) params.limit = opts.limit;
  try {
    const raw = await request<unknown>(`/players/${id}/stats/`, params);
    return extractResults(raw).map(mapPlayerStat).filter((s): s is PlayerStat => s !== null);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return [];
    throw err;
  }
}

export async function getPlayerTransfers(id: number): Promise<Transfer[]> {
  if (demo) return mock.getPlayerTransfers(id);
  try {
    const raw = await request<unknown>(`/players/${id}/transfers/`);
    return asArray<unknown>(asObject(raw).transfers).map(mapTransfer).filter((t): t is Transfer => t !== null);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return [];
    throw err;
  }
}

export async function getPredictions(opts?: {
  dateFrom?: string;
  dateTo?: string;
  leagueId?: number;
  limit?: number;
}): Promise<Prediction[]> {
  if (demo) return mock.getPredictions(opts);
  const params: QueryParams = {};
  if (opts?.dateFrom) params.date_from = opts.dateFrom;
  if (opts?.dateTo) params.date_to = opts.dateTo;
  if (opts?.leagueId) params.league_id = opts.leagueId;
  if (opts?.limit) params.limit = opts.limit;
  const raw = await request<unknown>('/predictions/', params);
  return extractResults(raw).map(mapPrediction).filter((p): p is Prediction => p !== null);
}

export async function getBestOdds(opts?: {
  market?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}): Promise<BestOddsRow[]> {
  if (demo) return mock.getBestOdds(opts);
  const params: QueryParams = {
    market: opts?.market ?? '1x2',
    date_from: opts?.dateFrom,
    date_to: opts?.dateTo,
    limit: opts?.limit ?? 20,
  };
  try {
    const raw = await request<unknown>('/odds/best/', params);
    return asArray<Record<string, unknown>>(raw).map((row) => {
      const outcomes = asArray<Record<string, unknown>>(row.best_odds).map((o) => ({
        outcome: toStr(o.outcome) ?? '',
        label: toStr(o.label) ?? toStr(o.outcome_name) ?? '',
        decimal: toFloat(o.decimal_odds ?? o.decimal),
        implied: toFloat(o.implied_probability ?? o.implied),
      }));
      return {
        eventId: toInt(row.event_id) ?? 0,
        date: toDate(row.event_date) ?? new Date(0),
        leagueId: toInt(row.league_id) ?? 0,
        leagueName: toStr(row.league_name) ?? '',
        homeTeam: toStr(row.home_team) ?? '',
        awayTeam: toStr(row.away_team) ?? '',
        homeTeamId: toInt(row.home_team_id),
        awayTeamId: toInt(row.away_team_id),
        market: toStr(row.market) ?? '1x2',
        outcomes,
      };
    });
  } catch (err) {
    // "/odds/best/" est réservé à Football Unlimited (403 bookmakers_not_entitled).
    // Repli gratuit : le prix de consensus exposé par "/events/{id}/odds/".
    if (err instanceof BsdError && err.status === 403) {
      return consensusOddsRows(opts);
    }
    throw err;
  }
}

/**
 * Repli sur le prix de consensus : "/odds/best/" est réservé à Football Unlimited.
 * Le flux "/odds/" est gratuit : une ligne par (match, bookmaker, marché, issue),
 * avec le prix de consensus et le nombre de bookmakers qui le forment.
 */
async function consensusOddsRows(opts?: { market?: string; dateFrom?: string; dateTo?: string; limit?: number }): Promise<BestOddsRow[]> {
  const limit = opts?.limit ?? 20;
  const market = opts?.market ?? '1x2';
  const raw = await request<unknown>('/odds/', {
    market,
    limit: 200,
    updated_after: new Date(Date.now() - 24 * 3600000).toISOString(),
  });
  const rows = extractResults(raw);
  const outcomeLabels: Record<string, string> = {
    HOME: 'Équipe à domicile',
    DRAW: 'Match nul',
    AWAY: 'Équipe à l’extérieur',
  };
  const byEvent = new Map<number, { odds: OddsRow[]; bookmakerCount: number }>();
  for (const row of rows) {
    const r = asObject(row);
    const eventId = toInt(r.event_id);
    if (eventId === null) continue;
    const decimal = toFloat(r.decimal_odds);
    if (decimal === null) continue;
    const entry = byEvent.get(eventId) ?? { odds: [], bookmakerCount: 0 };
    entry.odds.push({
      id: toInt(r.id) ?? 0,
      eventId,
      market: toStr(r.market) ?? '1x2',
      outcome: toStr(r.outcome) ?? '',
      line: toFloat(r.line),
      outcomeName: toStr(r.outcome_name),
      bookmakerSlug: toStr(r.bookmaker_slug) ?? '',
      bookmakerName: toStr(r.bookmaker_name) ?? '',
      decimal,
      previousDecimalOdds: toFloat(r.previous_decimal_odds),
      openingDecimalOdds: toFloat(r.opening_decimal_odds),
      impliedProbability: toFloat(r.implied_probability),
      movement: toStr(r.movement),
      isLive: toBool(r.is_live),
      updatedAt: toStr(r.updated_at) ?? '',
      bookmakerCount: toInt(r.bookmaker_count) ?? 0,
    });
    entry.bookmakerCount = Math.max(entry.bookmakerCount, toInt(r.bookmaker_count) ?? 0);
    byEvent.set(eventId, entry);
  }
  if (byEvent.size === 0) return [];

  // Détails des matchs (équipes, compétition, date) : 1 appel si la fenêtre couvre tout.
  const ids = [...byEvent.keys()].slice(0, limit);
  const details = new Map<number, FootballEvent>();
  const window = await getFixtures({
    dateFrom: new Date(Date.now() - 3 * 86400000).toISOString(),
    dateTo: new Date(Date.now() + 21 * 86400000).toISOString(),
    limit: 200,
  }).catch(() => []);
  for (const event of window) details.set(event.id, event);

  const out: BestOddsRow[] = [];
  for (const eventId of ids) {
    const entry = byEvent.get(eventId);
    if (!entry) continue;
    let event = details.get(eventId) ?? null;
    if (!event) event = await getEvent(eventId).catch(() => null);
    if (!event) continue;
    const line = entry.odds.find((o) => o.line !== null)?.line ?? null;
    out.push({
      eventId,
      date: event.date,
      leagueId: event.leagueId,
      leagueName: event.leagueName ?? '',
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      homeTeamId: event.homeTeamId ?? null,
      awayTeamId: event.awayTeamId ?? null,
      market,
      outcomes: entry.odds.map((o) => ({
        outcome: o.outcome,
        label:
          o.outcome === 'over'
            ? `Plus de ${line ?? 2.5} buts`
            : o.outcome === 'under'
              ? `Moins de ${line ?? 2.5} buts`
              : (outcomeLabels[o.outcome] ?? o.outcomeName ?? o.outcome),
        decimal: o.decimal,
        implied: o.impliedProbability,
        movement: o.movement,
      })),
      bookmakerCount: entry.bookmakerCount,
    });
  }
  // Noms de compétitions (l'endpoint events ne les porte pas) : 1 appel par ligue, mis en cache.
  const leagueIds = [...new Set(out.map((r) => r.leagueId))];
  for (const leagueId of leagueIds) {
    const row = out.find((r) => r.leagueId === leagueId);
    if (row && row.leagueName) continue;
    const league = await getLeague(leagueId).catch(() => null);
    if (league) {
      for (const r of out) if (r.leagueId === leagueId) r.leagueName = league.name;
    }
  }
  return out;
}

export async function getTransfers(opts?: {
  leagueId?: number;
  teamId?: number;
  ordering?: string;
  limit?: number;
}): Promise<Transfer[]> {
  if (demo) return mock.getTransfers(opts);
  const params: QueryParams = {
    league_id: opts?.leagueId,
    team_id: opts?.teamId,
    ordering: opts?.ordering,
    limit: opts?.limit ?? 25,
  };
  const raw = await request<unknown>('/transfers/', params);
  return extractResults(raw).map(mapTransfer).filter((t): t is Transfer => t !== null);
}

export async function getBroadcasts(opts?: {
  dateFrom?: string;
  dateTo?: string;
  countryCode?: string;
}): Promise<Broadcast[]> {
  if (demo) return mock.getBroadcasts(opts);
  const params: QueryParams = {
    date_from: opts?.dateFrom,
    date_to: opts?.dateTo,
    country_code: opts?.countryCode,
  };
  try {
    const raw = await request<unknown>('/broadcasts/', params);
    return extractResults(raw).map(mapBroadcast).filter((b): b is Broadcast => b !== null);
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return [];
    throw err;
  }
}

export async function getCoverage(): Promise<Coverage | null> {
  if (demo) return mock.getCoverage();
  try {
    const raw = await request<unknown>('/coverage/');
    const root = asObject(raw);
    return {
      generatedAt: toStr(root.generated_at) ?? new Date().toISOString(),
      sports: asArray<Record<string, unknown>>(root.sports).map((s) => ({
        sport: toStr(s.sport) ?? 'football',
        name: toStr(s.name) ?? 'Football',
        status: toStr(s.status) ?? 'unknown',
        eventsNext7d: toInt(s.events_next_7d) ?? 0,
        liveNow: toInt(s.live_now) ?? 0,
        nextEventAt: toStr(s.next_event_at),
      })),
    };
  } catch (err) {
    if (err instanceof BsdError && err.status === 404) return null;
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Palmarès (contrat §7.2)                                             */
/* ------------------------------------------------------------------ */

/** Compétitions majeures retenues pour le palmarès (repérage par nom). */
const PALMARES_LEAGUE_NAMES = [
  'Champions League',
  'Premier League',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'Ligue 1',
  'Liga Portugal',
  'Eredivisie',
  'Brasileirão',
  'Europa League',
] as const;

/** Nom normalisé : minuscules, sans accents, sans ponctuation. */
function normalizeLeagueName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Une compétition secondaire ("Serie B", "Liga Portugal 2"…) ne doit pas
 * être retenue à la place de la compétition demandée.
 */
function isSecondaryName(normalized: string): boolean {
  return /(^|\D)\d/.test(normalized) || normalized.includes('serieb');
}

/**
 * Sélectionne les 10 compétitions majeures : correspondance sur le nom normalisé,
 * repli sur les premières compétitions actives disposant d'une saison courante.
 */
function selectPalmaresLeagues(leagues: League[]): League[] {
  const active = leagues.filter((l) => l.isActive && l.currentSeason);
  const used = new Set<number>();
  const selected: League[] = [];

  for (const target of PALMARES_LEAGUE_NAMES) {
    const wanted = normalizeLeagueName(target);
    const candidates = active.filter((l) => !used.has(l.id));
    const exact = candidates.find((l) => normalizeLeagueName(l.name) === wanted);
    const prefix =
      exact ??
      candidates.find(
        (l) => normalizeLeagueName(l.name).startsWith(wanted) && !isSecondaryName(normalizeLeagueName(l.name)),
      );
    if (prefix) {
      used.add(prefix.id);
      selected.push(prefix);
      continue;
    }
    // Repli : première compétition active restante.
    const fallback = candidates.find((l) => !isSecondaryName(normalizeLeagueName(l.name))) ?? candidates[0];
    if (fallback) {
      used.add(fallback.id);
      selected.push(fallback);
    }
  }
  return selected;
}

/** Nombre à la française : 1 décimale, virgule décimale. */
function fr1(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/** Valeur signée à la française : "+1,4" / "-0,3". */
function frSigned(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${fr1(Math.abs(value))}`;
}

interface PalmaresRaw {
  featured: PalmarèsFeatured;
  competitions: CompetitionRank[];
  clubs: ClubRank[];
  players: PlayerRank[];
  leaguesAnalysed: number;
  generatedAt: string;
}

/** Calcul du palmarès à partir des données déjà mises en cache (contrat §7.2). */
async function computeHighlights(limit: number): Promise<PalmaresRaw> {
  const leagues = await getLeagues({ limit: 200 });
  const selected = selectPalmaresLeagues(leagues);

  interface CompetitionData {
    league: League;
    standings: Standing[];
    bestXI: BestXI | null;
    scorers: LeaderboardEntry[];
  }

  const data: CompetitionData[] = [];
  for (const league of selected) {
    // Cache par compétition (3 h) : les 3 appels (classement, meilleur XI,
    // buteurs) ne sont refaits que toutes les 3 heures, même si le palmarès
    // complet est recalculé toutes les 30 minutes.
    const entry = await cached<CompetitionData>(`palmares:league:${league.id}`, 10800, async () => {
      let seasonId = league.currentSeason?.id ?? null;
      if (seasonId === null) {
        const detail = await getLeague(league.id).catch(() => null);
        seasonId = detail?.currentSeason?.id ?? null;
      }
      const [standings, bestXI, scorers] = await Promise.all([
        getStandings(league.id).catch(() => null),
        seasonId !== null ? getBestXI(league.id, seasonId).catch(() => null) : Promise.resolve(null),
        getTopScorers(league.id, { stat: 'scorers', limit: 10 }).catch(() => []),
      ]);
      const rows = standings
        ? (standings.flat.length > 0 ? standings.flat : Object.values(standings.groups).flat())
        : [];
      return { league, standings: rows, bestXI, scorers };
    });
    data.push(entry);
  }

  /* --- Clubs ------------------------------------------------------ */
  const clubRows: Array<{ standing: Standing; league: League }> = [];
  for (const entry of data) {
    const top = [...entry.standings]
      .filter((s) => s.teamId !== null && s.played > 0)
      .sort((a, b) => a.position - b.position)
      .slice(0, 3);
    for (const standing of top) clubRows.push({ standing, league: entry.league });
  }

  const clubs: ClubRank[] = clubRows
    .map(({ standing, league }) => {      const played = standing.played;
      const ptsPerGame = standing.pts / played;
      const xgdPerGame = (standing.xgd ?? 0) / played;
      // Fiabilité : un club classé sur 4 journées ne peut pas dominer un club
      // suivi sur 12 (le facteur monte de 0 à 1 entre 1 et 8 journées jouées).
      const reliability = Math.min(1, played / 8);
      const raw = 60 * (ptsPerGame / 3) + 20 * xgdPerGame + 20 * (standing.gd / played);
      const score = raw * reliability;
      const detail = `${standing.pts} pts · ${frSigned(xgdPerGame)} xG/match`;
      return {
        rank: 0,
        teamId: standing.teamId ?? 0,
        teamName: standing.teamName,
        leagueId: league.id,
        leagueName: league.name,
        logoUrl: standing.teamId !== null ? imageUrls.team(standing.teamId) : null,
        played,
        pts: standing.pts,
        ptsPerGame,
        gd: standing.gd,
        xgd: standing.xgd,
        xgdPerGame,
        form: standing.form,
        score,
        detail: reliability < 1 ? `${detail} · ${played} j.` : detail,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Un club peut figurer dans deux compétitions (ex. Benfica en Europa League et
  // en Liga Portugal) : on ne le garde qu'une fois, avec son meilleur indice.
  const seenTeams = new Set<number>();
  const uniqueClubs: ClubRank[] = [];
  for (const club of clubs) {
    if (seenTeams.has(club.teamId)) continue;
    seenTeams.add(club.teamId);
    uniqueClubs.push(club);
  }
  uniqueClubs.forEach((club, i) => {
    club.rank = i + 1;
  });
  const keptClubs = limit > 0 ? uniqueClubs.slice(0, limit) : uniqueClubs;

  /* --- Compétitions ---------------------------------------------- */
  const competitions: CompetitionRank[] = data.map(({ league, standings }) => {
    const rows = standings;
    const sumPlayed = rows.reduce((acc, s) => acc + s.played, 0);
    const sumGf = rows.reduce((acc, s) => acc + s.gf, 0);
    const sumGa = rows.reduce((acc, s) => acc + s.ga, 0);
    const sumXgf = rows.reduce((acc, s) => acc + (s.xgf ?? 0), 0);
    const sumXga = rows.reduce((acc, s) => acc + (s.xga ?? 0), 0);
    const sumPts = rows.reduce((acc, s) => acc + s.pts, 0);
    const matches = sumPlayed / 2;
    const avgGoals = matches > 0 ? sumGf / matches : null;
    const avgXgDiff = sumPlayed > 0 ? Math.abs(sumXgf - sumXga) / sumPlayed : null;
    const avgPoints = matches > 0 ? sumPts / matches : null;
    const score =
      12 * (avgGoals ?? 0) + 30 * Math.abs(avgXgDiff ?? 0) + 20 * ((avgPoints ?? 0) / 3);
    const leader = rows.length > 0 ? [...rows].sort((a, b) => a.position - b.position)[0] : null;
    const detail = avgGoals !== null
      ? `${fr1(avgGoals)} buts/match · ${avgPoints !== null ? fr1(avgPoints) : '—'} pts/match`
      : 'Données indisponibles';
    return {
      rank: 0,
      leagueId: league.id,
      leagueName: league.name,
      country: league.country,
      logoUrl: league.logoUrl ?? imageUrls.league(league.id),
      teams: rows.length,
      matches: Math.round(matches),
      avgGoals,
      avgXgDiff,
      avgPoints,
      leader: leader ? leader.teamName : null,
      leaderPoints: leader ? leader.pts : null,
      score,
      detail,
    };
  });
  competitions.sort((a, b) => b.score - a.score);
  competitions.forEach((comp, i) => {
    comp.rank = i + 1;
  });

  /* --- Joueurs ---------------------------------------------------- */
  interface PlayerAccumulator {
    playerId: number;
    playerName: string;
    teamId: number;
    teamName: string;
    leagueId: number;
    leagueName: string;
    position: string;
    rating: number | null;
    goals: number;
    assists: number;
    matches: number;
  }
  const playersById = new Map<number, PlayerAccumulator>();

  for (const { league, bestXI, scorers } of data) {
    const scorerById = new Map<number, LeaderboardEntry>();
    for (const entry of scorers) scorerById.set(entry.playerId, entry);

    const bestXIPlayers: Array<{
      playerId: number;
      playerName: string;
      teamId: number;
      teamName: string;
      rating: number | null;
      goals: number;
      assists: number;
      matches: number;
      position: string;
    }> = [];
    if (bestXI) {
      for (const slot of bestXI.lineup) {
        const playerId = slot.player?.id ?? 0;
        if (!playerId) continue;
        bestXIPlayers.push({
          playerId,
          playerName: slot.player?.name ?? '',
          teamId: slot.teamId ?? slot.player?.currentTeamId ?? 0,
          teamName: slot.teamName ?? slot.player?.currentTeamName ?? '',
          rating: slot.rating ?? slot.player?.rating ?? null,
          goals: slot.goals ?? 0,
          assists: slot.assists ?? 0,
          matches: slot.matches ?? 0,
          position: slot.position,
        });
      }
    }

    for (const p of bestXIPlayers) {
      const leader = scorerById.get(p.playerId);
      const existing = playersById.get(p.playerId);
      const rating = p.rating;
      const score = 10 * (rating ?? 0);
      const accumulator: PlayerAccumulator = {
        playerId: p.playerId,
        playerName: p.playerName,
        teamId: p.teamId || leader?.teamId || 0,
        teamName: p.teamName || leader?.teamName || '',
        leagueId: league.id,
        leagueName: league.name,
        position: leader?.position ?? p.position,
        rating,
        goals: leader ? leader.value : p.goals,
        assists: p.assists,
        matches: leader ? leader.matches : p.matches,
      };
      const previousScore = existing ? 10 * (existing.rating ?? 0) : -1;
      if (!existing || score > previousScore) playersById.set(p.playerId, accumulator);
    }

    // Meilleurs buteurs absents du meilleur XI (note nulle → score 0).
    for (const leader of scorers) {
      if (playersById.has(leader.playerId)) continue;
      playersById.set(leader.playerId, {
        playerId: leader.playerId,
        playerName: leader.playerName,
        teamId: leader.teamId,
        teamName: leader.teamName,
        leagueId: league.id,
        leagueName: league.name,
        position: leader.position,
        rating: null,
        goals: leader.value,
        assists: 0,
        matches: leader.matches,
      });
    }
  }

  const players: PlayerRank[] = [...playersById.values()]
    .map((p) => {
      const score = 10 * (p.rating ?? 0);
      const detail = p.rating !== null
        ? `${fr1(p.rating)} de note · ${p.goals} buts`
        : `${p.goals} buts · ${p.matches} matchs`;
      return {
        rank: 0,
        playerId: p.playerId,
        playerName: p.playerName,
        teamId: p.teamId,
        teamName: p.teamName,
        leagueId: p.leagueId,
        leagueName: p.leagueName,
        position: p.position,
        rating: p.rating,
        goals: p.goals,
        assists: p.assists,
        matches: p.matches,
        photoUrl: imageUrls.player(p.playerId),
        score,
        detail,
      };
    })
    .sort((a, b) => b.score - a.score || b.goals - a.goals)
    .slice(0, 15);
  players.forEach((player, i) => {
    player.rank = i + 1;
  });

  return {
    featured: {
      club: keptClubs[0] ?? null,
      player: players[0] ?? null,
      competition: competitions[0] ?? null,
    },
    competitions,
    clubs: keptClubs,
    players,
    leaguesAnalysed: selected.length,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Palmarès : meilleurs clubs, meilleur joueur, meilleure compétition.
 * Le calcul est mis en cache 30 min (clé `palmares:v1:<limit>`).
 */
export async function getHighlights(opts?: { limit?: number }): Promise<PalmarèsHighlights> {
  // Le contrat impose au moins 10 clubs au classement final (10 compétitions × 3).
  const limit = Math.max(10, opts?.limit ?? 30);
  const raw = await cached<PalmaresRaw>(`palmares:v2:${limit}`, 1800, () => computeHighlights(limit));
  return { ...raw, generatedAt: new Date(raw.generatedAt) };
}

/** Recherche transversale (équipes, joueurs, ligues). */
export async function search(query: string): Promise<{ teams: Team[]; players: Player[]; leagues: League[] }> {
  const q = normalizeText(query);
  if (!q) return { teams: [], players: [], leagues: [] };
  const [teams, players, leagues] = await Promise.all([
    getTeams({ name: query }),
    getPlayers({ name: query }),
    getLeagues(),
  ]);
  return {
    teams: teams.filter((t) => normalizeText(t.name).includes(q)).slice(0, 20),
    players: players.filter((p) => normalizeText(p.name).includes(q)).slice(0, 20),
    leagues: leagues.filter((l) => normalizeText(l.name).includes(q)).slice(0, 20),
  };
}

export { pick };
