/**
 * Types partagés avec l'API JSON du serveur (voir CONTRACT.md §8).
 * Volontairement minimaux : uniquement ce que le client manipule.
 */

export interface Quota {
  remaining: number | null;
  limit: number | null;
  resetIn: number | null;
}

export interface LiveEvent {
  id: number;
  leagueId: number;
  leagueName?: string;
  homeTeamId: number;
  homeTeam: string;
  awayTeamId: number;
  awayTeam: string;
  date: string;
  status: string;
  period?: string | null;
  minute: number | null;
  homeScore: number | null;
  awayScore: number | null;
  isLive: boolean;
}

export interface ApiLiveResponse {
  live: LiveEvent[];
  quota: Quota;
  demo: boolean;
  updatedAt: string;
}

export interface ApiTeam {
  id: number;
  name: string;
  shortName?: string;
  country?: string;
  countryCode?: string;
}

export interface ApiPlayer {
  id: number;
  name: string;
  position?: string;
  currentTeamId?: number | null;
  currentTeamName?: string | null;
  nationality?: string | null;
  marketValueEur?: number | null;
}

export interface ApiLeague {
  id: number;
  name: string;
  country?: string;
  isWomen?: boolean;
  logoUrl?: string | null;
}

export interface ApiSearchResponse {
  teams: ApiTeam[];
  players: ApiPlayer[];
  leagues: ApiLeague[];
}
