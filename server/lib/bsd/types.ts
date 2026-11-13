/**
 * Types domaine normalisés (contrat §6).
 * Ces formes sontindependantes de la réponse brute de l'API BSD.
 */

export type MatchStatus =
  | 'notstarted'
  | 'inprogress'
  | 'delayed'
  | 'penalties'
  | 'finished'
  | 'postponed'
  | 'cancelled'
  | 'unresolved'
  | 'upcoming'
  | 'live'
  | 'halftime'
  | '1st_half'
  | '2nd_half'
  | 'extra_time'
  | 'unknown';

export interface FootballEvent {
  id: number;
  leagueId: number;
  leagueName?: string;
  seasonId: number | null;
  homeTeamId: number;
  homeTeam: string;
  awayTeamId: number;
  awayTeam: string;
  date: Date;
  status: MatchStatus;
  period?: string | null;
  minute: number | null;
  homeScore: number | null;
  awayScore: number | null;
  homeScoreHt: number | null;
  awayScoreHt: number | null;
  penaltyShootout: { home: number; away: number } | null;
  extraTime: { home: number; away: number } | null;
  roundLabel?: string | null;
  stage?: string | null;
  roundNumber?: number | null;
  venueId?: number | null;
  refereeId?: number | null;
  attendance?: number | null;
  isLocalDerby?: boolean;
  highlights: Highlight[];
  isLive: boolean;
}

export interface LiveEvent extends FootballEvent {
  leagueName: string;
  lastUpdated: string | null;
}

export interface Season {
  id: number;
  name: string;
  year: number | null;
  isCurrent: boolean;
  startDate: string | null;
  endDate: string | null;
}

export interface League {
  id: number;
  name: string;
  country: string;
  isWomen: boolean;
  isActive: boolean;
  currentSeason: Season | null;
  logoUrl: string | null;
}

export interface Team {
  id: number;
  name: string;
  shortName: string;
  country: string;
  countryCode: string;
  venueId: number | null;
  logoUrl: string | null;
}

export interface Standing {
  position: number;
  teamId: number | null;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  xgf: number | null;
  xga: number | null;
  xgd: number | null;
  xgGames: number | null;
  form: string;
  live: boolean;
  zone: string | null;
}

export interface StandingsResult {
  grouped: boolean;
  groups: Record<string, Standing[]>;
  flat: Standing[];
  season: Season | null;
  leagueId: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: number;
  playerName: string;
  position: string;
  teamId: number;
  teamName: string;
  value: number;
  matches: number;
  /** Portrait du joueur (URL d'image BSD), pour affichage en logo/image. */
  photoUrl: string | null;
}

export interface Player {
  id: number;
  name: string;
  shortName: string | null;
  position: string;
  specificPosition: string | null;
  jerseyNumber: number | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  nationality: string | null;
  currentTeamId: number | null;
  currentTeamName: string | null;
  marketValueEur: number | null;
  availability: string | null;
  injuryType: string | null;
  rating: number | null;
  photoUrl: string | null;
  strengths: string[];
  weaknesses: string[];
}

export interface SquadPlayer {
  id: number;
  name: string;
  shortName: string;
  position: string;
  jerseyNumber: number | null;
  nationality: string;
  dateOfBirth: string | null;
  availability: string;
  injuryType: string;
  injuryExpectedReturn: string | null;
  photoUrl: string | null;
}

export interface PlayerStat {
  playerId: number;
  teamId: number;
  /** Nom du joueur, résolu via l'effectif du club (2 appels mis en cache). */
  playerName?: string | null;
  /** Nom du club du joueur. */
  teamName?: string | null;
  /** Numéro de maillot du joueur. */
  jerseyNumber?: number | null;
  minutesPlayed: number;
  rating: number | null;
  goals: number;
  assists: number;
  xg: number | null;
  xa: number | null;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  accuratePasses: number;
  tackles: number;
  duelsWon: number;
  duelsLost: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  bigChances: number;
  bigChancesMissed: number;
  progressivePasses: number | null;
  aerialWon: number | null;
  aerialLost: number | null;
}

export interface TeamStats {
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  fouls: number | null;
  offsides: number | null;
  yellowCards: number | null;
  redCards: number | null;
  passes: number | null;
  accuratePasses: number | null;
  tackles: number | null;
  xg: number | null;
  xgot: number | null;
  bigChances: number | null;
  saves: number | null;
}

export interface Shot {
  playerId: number | null;
  playerName?: string | null;
  minute: number;
  added: number | null;
  home: boolean;
  type: string;
  sit: string;
  body: string;
  gtype: string | null;
  xg: number | null;
  xgot: number | null;
  xgEstimated: boolean | null;
  x: number | null;
  y: number | null;
}

export interface MomentumPoint {
  minute: number;
  value: number;
}

export interface XgMinute {
  minute: number;
  home: number;
  away: number;
  cumHome: number;
  cumAway: number;
}

export interface EventStats {
  home: TeamStats;
  away: TeamStats;
  shotmap: Shot[];
  momentum: MomentumPoint[];
  xgPerMinute: XgMinute[];
  xgEstimated: boolean;
  averagePositions: unknown;
}

export interface LineupPlayer {
  id: number;
  name: string;
  shortName: string;
  position: string;
  jerseyNumber: number | null;
  isStarter: boolean;
  isCaptain: boolean;
  subIn: number | null;
  subOut: number | null;
}

export interface EventLineups {
  status: 'confirmed' | 'predicted' | 'unavailable';
  home: LineupPlayer[];
  away: LineupPlayer[];
  homeFormation: string | null;
  awayFormation: string | null;
  unavailable: SquadPlayer[];
  updatedAt: string | null;
}

export interface Incident {
  type: string;
  player: string | null;
  minute: number | null;
  isHome: boolean;
  assist: string | null;
  reason: string | null;
  /** Substitution : joueur entrant. */
  playerIn?: string | null;
  /** Substitution : joueur sortant. */
  playerOut?: string | null;
  /** Type de carton (yellow / red). */
  cardType?: string | null;
  /** Minutes de temps additionnel annoncé. */
  addedTime?: number | null;
}

export interface CommentaryLine {
  id: string;
  minute: number;
  addedTime: number | null;
  type: string;
  team: string;
  player: string | null;
  relatedPlayer: string | null;
  text: string;
  score: string | null;
  important: boolean;
}

export interface H2HMatch {
  eventId: number | null;
  date: string;
  home: string;
  away: string;
  score: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
}

export interface H2H {
  totalMatches: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  homeGoals: number;
  awayGoals: number;
  avgTotalGoals: number | null;
  homeWinRate: number | null;
  awayWinRate: number | null;
  recentMatches: H2HMatch[];
}

export interface OddsOutcome {
  outcome: string;
  label: string;
  decimal: number | null;
  implied: number | null;
  movement: string | null;
}

export interface OddsMarket {
  market: string;
  label: string;
  line: number | null;
  outcomes: OddsOutcome[];
}

export interface EventOdds {
  markets: OddsMarket[];
  lastUpdateAt: string | null;
  nextUpdateAt: string | null;
  updateIntervalSeconds: number | null;
  bookmakersCount: number;
}

export interface Prediction {
  id: number;
  eventId: number | null;
  homeTeam: string | null;
  awayTeam: string | null;
  /** Identifiant du club à domicile (pour affichage en logo). */
  homeTeamId: number | null;
  /** Identifiant du club à l'extérieur (pour affichage en logo). */
  awayTeamId: number | null;
  /** Identifiant de la compétition (logo + filtre). */
  leagueId: number | null;
  leagueName: string | null;
  date: Date | null;
  homeProb: number | null;
  drawProb: number | null;
  awayProb: number | null;
  topOutcome: string | null;
  topProbability: number | null;
  expectedHomeGoals: number | null;
  expectedAwayGoals: number | null;
  over15: number | null;
  over25: number | null;
  over35: number | null;
  btts: number | null;
  score: string | null;
  model: string | null;
  updatedAt: string | null;
}

export interface Availability {
  eventId: number;
  status: string;
  lineupStatus: string;
  available: Record<string, boolean>;
  statKeys: string[];
  oddsMarkets: string[];
}

export interface BestOddsRow {
  eventId: number;
  date: Date;
  leagueId: number;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  /** Identifiant du club à domicile (pour affichage en logo). */
  homeTeamId: number | null;
  /** Identifiant du club à l'extérieur (pour affichage en logo). */
  awayTeamId: number | null;
  market: string;
  outcomes: { outcome: string; label: string; decimal: number | null; implied: number | null; movement?: string | null }[];
  /** Nombre de bookmakers derrière le prix de consensus. */
  bookmakerCount?: number;
}

/** Ligne du flux de cotes (/odds/) : prix de consensus par match et marché. */
export interface OddsRow {
  id: number;
  eventId: number;
  market: string;
  outcome: string;
  line: number | null;
  outcomeName: string | null;
  bookmakerSlug: string;
  bookmakerName: string;
  decimal: number;
  previousDecimalOdds: number | null;
  openingDecimalOdds: number | null;
  impliedProbability: number | null;
  movement: string | null;
  isLive: boolean | null;
  updatedAt: string;
  bookmakerCount: number;
}

export interface Transfer {
  id: number;
  date: string | null;
  playerId: number | null;
  playerName: string | null;
  fromTeamId: number | null;
  fromTeamName: string;
  toTeamId: number | null;
  toTeamName: string;
  feeEur: number | null;
  feeDescription: string;
}

export interface Broadcast {
  id: number;
  eventId: number;
  leagueName: string | null;
  homeTeam: string;
  awayTeam: string;
  date: Date;
  countryCode: string;
  channelName: string;
  channelLink: string;
  scheduledStart: Date | null;
}

export interface Coverage {
  generatedAt: string;
  sports: {
    sport: string;
    name: string;
    status: string;
    eventsNext7d: number;
    liveNow: number;
    nextEventAt: string | null;
  }[];
}

export interface Highlight {
  kind: string;
  title: string;
  url: string;
  thumbnail: string | null;
  publishedAt: string;
}

export interface FormSplit {
  results: string | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  pointsPerMatch: number | null;
  stats: Record<string, number | null>;
}

export interface TeamForm {
  teamId: number;
  teamName: string;
  matches: number;
  requested: number;
  overall: FormSplit | null;
  home: FormSplit | null;
  away: FormSplit | null;
}

export interface BestXI {
  formation: string | null;
  lineup: {
    position: string;
    player: Player | null;
    rating: number | null;
    /** Buts du joueur dans le meilleur XI (donnée brute BSD). */
    goals?: number;
    /** Passes décisives du joueur dans le meilleur XI (donnée brute BSD). */
    assists?: number;
    /** Matchs joués dans le meilleur XI (donnée brute BSD). */
    matches?: number;
    /** Identifiant du club du joueur. */
    teamId?: number | null;
    /** Nom du club du joueur. */
    teamName?: string;
  }[];
}

/* ------------------------------------------------------------------ */
/* Palmarès (contrat §7.2)                                             */
/* ------------------------------------------------------------------ */

export interface ClubRank {
  rank: number;
  teamId: number;
  teamName: string;
  leagueId: number;
  leagueName: string;
  logoUrl: string | null;
  played: number;
  pts: number;
  ptsPerGame: number;
  gd: number;
  xgd: number | null;
  xgdPerGame: number | null;
  form: string;
  score: number;
  /** Détail lisible de l'indice (ex. "26 pts · +1,4 xG/match"). */
  detail: string;
}

export interface PlayerRank {
  rank: number;
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
  photoUrl: string | null;
  score: number;
  detail: string;
}

export interface CompetitionRank {
  rank: number;
  leagueId: number;
  leagueName: string;
  country: string;
  logoUrl: string | null;
  teams: number;
  matches: number;
  avgGoals: number | null;
  avgXgDiff: number | null;
  avgPoints: number | null;
  leader: string | null;
  leaderPoints: number | null;
  score: number;
  detail: string;
}

export interface PalmarèsFeatured {
  club: ClubRank | null;
  player: PlayerRank | null;
  competition: CompetitionRank | null;
}

/** Résultat complet de `getHighlights` (contrat §7.2). */
export interface PalmarèsHighlights {
  featured: PalmarèsFeatured;
  competitions: CompetitionRank[];
  clubs: ClubRank[];
  players: PlayerRank[];
  leaguesAnalysed: number;
  generatedAt: Date;
}

/** Quota BSD exposé par l'API. */
export interface Quota {
  remaining: number | null;
  limit: number | null;
  resetIn: number | null;
}
