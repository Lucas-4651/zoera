/**
 * Jeu de données démo — riche et cohérent (contrat §2 mode démo).
 *
 * Les ids sont STABLES et cohérents entre toutes les fonctions :
 * l'id d'un match dans les stats = celui des fixtures = celui de l'URL.
 *
 * Organisation :
 *   - 10 compétitions (ids 1..10), saisons 101..110
 *   - 40 clubs (ids 1..40), joueurs ids 1..60
 *   - matchs ids 1..3 (vedette + 2 directs) puis 4.. (générés)
 *   - classements, forme et xG sont DÉRIVÉS des résultats joués → cohérence.
 */

import type {
  Availability,
  BestOddsRow,
  BestXI,
  Broadcast,
  CommentaryLine,
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
  Player,
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
/* Utilitaires déterministes                                            */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Générateur déterministe par match : les données mock sont stables d'un appel à l'autre. */
function seededRnd(key: number): () => number {
  return mulberry32((0x9e3779b1 + key * 2654435761) >>> 0);
}

const rnd = mulberry32(20260910);
type Rng = () => number;

const pickIdx = <T,>(arr: T[], rng: Rng = rnd): T => arr[Math.floor(rng() * arr.length) % arr.length];
const rint = (min: number, max: number, rng: Rng = rnd): number => min + Math.floor(rng() * (max - min + 1));
const rfloat = (min: number, max: number, rng: Rng = rnd): number => min + rng() * (max - min);

const DAY = 86400000;
const now = new Date();
const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

function atUtc(dayOffset: number, hour: number, minute = 0): Date {
  return new Date(todayUtc + dayOffset * DAY + hour * 3600000 + minute * 60000);
}

/* ------------------------------------------------------------------ */
/* Compétitions                                                        */
/* ------------------------------------------------------------------ */

interface LeagueSeed {
  id: number;
  name: string;
  country: string;
  countryCode: string;
  seasonId: number;
  seasonName: string;
  isWomen: boolean;
}

const leagueSeeds: LeagueSeed[] = [
  { id: 1, name: 'Premier League', country: 'England', countryCode: 'GB', seasonId: 101, seasonName: '2026/2027', isWomen: false },
  { id: 2, name: 'Liga Portugal', country: 'Portugal', countryCode: 'PT', seasonId: 102, seasonName: '2026/2027', isWomen: false },
  { id: 3, name: 'La Liga', country: 'Spain', countryCode: 'ES', seasonId: 103, seasonName: '2026/2027', isWomen: false },
  { id: 4, name: 'Serie A', country: 'Italy', countryCode: 'IT', seasonId: 104, seasonName: '2026/2027', isWomen: false },
  { id: 5, name: 'Bundesliga', country: 'Germany', countryCode: 'DE', seasonId: 105, seasonName: '2026/2027', isWomen: false },
  { id: 6, name: 'Ligue 1', country: 'France', countryCode: 'FR', seasonId: 106, seasonName: '2026/2027', isWomen: false },
  { id: 7, name: 'Champions League', country: 'Europe', countryCode: 'INT', seasonId: 107, seasonName: '2026/2027', isWomen: false },
  { id: 8, name: 'Europa League', country: 'Europe', countryCode: 'INT', seasonId: 108, seasonName: '2026/2027', isWomen: false },
  { id: 9, name: 'Brasileirão', country: 'Brazil', countryCode: 'BR', seasonId: 109, seasonName: '2026/2027', isWomen: false },
  { id: 10, name: 'Eredivisie', country: 'Netherlands', countryCode: 'NL', seasonId: 110, seasonName: '2026/2027', isWomen: false },
];

const leagueById = new Map<number, LeagueSeed>(leagueSeeds.map((l) => [l.id, l]));

/* ------------------------------------------------------------------ */
/* Clubs                                                               */
/* ------------------------------------------------------------------ */

interface TeamSeed {
  id: number;
  name: string;
  shortName: string;
  leagueId: number;
  country: string;
  countryCode: string;
  venueId: number;
}

const teamSeeds: TeamSeed[] = [
  { id: 1, name: 'Liverpool FC', shortName: 'LIV', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2001 },
  { id: 2, name: 'Bournemouth', shortName: 'BOU', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2002 },
  { id: 3, name: 'Aston Villa', shortName: 'AVL', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2003 },
  { id: 4, name: 'Newcastle United', shortName: 'NEW', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2004 },
  { id: 5, name: 'Brighton & Hove Albion', shortName: 'BHA', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2005 },
  { id: 6, name: 'Fulham', shortName: 'FUL', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2006 },
  { id: 7, name: 'Sunderland', shortName: 'SUN', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2007 },
  { id: 8, name: 'West Ham United', shortName: 'WHU', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2008 },
  { id: 9, name: 'Tottenham Hotspur', shortName: 'TOT', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2009 },
  { id: 10, name: 'Burnley', shortName: 'BUR', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2010 },
  { id: 11, name: 'Wolverhampton', shortName: 'WOL', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2011 },
  { id: 12, name: 'Manchester City', shortName: 'MCI', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2012 },
  { id: 13, name: 'Chelsea', shortName: 'CHE', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2013 },
  { id: 14, name: 'Crystal Palace', shortName: 'CRY', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2014 },
  { id: 15, name: 'Nottingham Forest', shortName: 'NFO', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2015 },
  { id: 16, name: 'Brentford', shortName: 'BRE', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2016 },
  { id: 17, name: 'Manchester United', shortName: 'MUN', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2017 },
  { id: 18, name: 'Arsenal', shortName: 'ARS', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2018 },
  { id: 19, name: 'Leeds United', shortName: 'LEE', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2019 },
  { id: 20, name: 'Everton', shortName: 'EVE', leagueId: 1, country: 'England', countryCode: 'GB', venueId: 2020 },
  { id: 21, name: 'Casa Pia', shortName: 'CAS', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2021 },
  { id: 22, name: 'Sporting CP', shortName: 'SCP', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2022 },
  { id: 23, name: 'CD Nacional', shortName: 'NAC', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2023 },
  { id: 24, name: 'Gil Vicente', shortName: 'GIL', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2024 },
  { id: 25, name: 'FC Arouca', shortName: 'ARO', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2025 },
  { id: 27, name: 'Famalicão', shortName: 'FAM', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2026 },
  { id: 28, name: 'Santa Clara', shortName: 'SCL', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2027 },
  { id: 29, name: 'Moreirense', shortName: 'MORE', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2028 },
  { id: 30, name: 'FC Alverca', shortName: 'ALV', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2029 },
  { id: 31, name: 'Sporting Braga', shortName: 'BRA', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2030 },
  { id: 33, name: 'Estoril Praia', shortName: 'EST', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2031 },
  { id: 34, name: 'CF Estrela Amadora', shortName: 'EST', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2032 },
  { id: 35, name: 'FC Porto', shortName: 'POR', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2033 },
  { id: 36, name: 'Vitória SC', shortName: 'VSC', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2034 },
  { id: 37, name: 'Benfica', shortName: 'BEN', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2035 },
  { id: 38, name: 'Rio Ave', shortName: 'RIO', leagueId: 2, country: 'Portugal', countryCode: 'PT', venueId: 2036 },
  { id: 40, name: 'Rayo Vallecano', shortName: 'RAY', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2037 },
  { id: 41, name: 'Villarreal', shortName: 'VIL', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2038 },
  { id: 42, name: 'Real Oviedo', shortName: 'OVI', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2039 },
  { id: 43, name: 'Mallorca', shortName: 'MLL', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2040 },
  { id: 44, name: 'FC Barcelona', shortName: 'BAR', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2041 },
  { id: 45, name: 'Deportivo Alavés', shortName: 'ALV', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2042 },
  { id: 46, name: 'Levante UD', shortName: 'LEV', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2043 },
  { id: 47, name: 'Valencia', shortName: 'VAL', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2044 },
  { id: 48, name: 'Real Sociedad', shortName: 'RSO', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2045 },
  { id: 49, name: 'Celta Vigo', shortName: 'CEL', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2046 },
  { id: 50, name: 'Getafe', shortName: 'GET', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2047 },
  { id: 51, name: 'Athletic Club', shortName: 'ATH', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2048 },
  { id: 52, name: 'Sevilla', shortName: 'SEV', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2049 },
  { id: 53, name: 'Espanyol', shortName: 'ESP', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2050 },
  { id: 54, name: 'Atlético Madrid', shortName: 'ATM', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2051 },
  { id: 55, name: 'Elche', shortName: 'ELC', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2052 },
  { id: 56, name: 'Real Betis', shortName: 'BET', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2053 },
  { id: 57, name: 'Real Madrid', shortName: 'RMA', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2054 },
  { id: 58, name: 'Osasuna', shortName: 'OSA', leagueId: 3, country: 'Spain', countryCode: 'ES', venueId: 2055 },
  { id: 59, name: 'Genoa', shortName: 'GEN', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2056 },
  { id: 60, name: 'Lecce', shortName: 'LEC', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2057 },
  { id: 61, name: 'Sassuolo', shortName: 'SAS', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2058 },
  { id: 62, name: 'SSC Napoli', shortName: 'NAP', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2059 },
  { id: 63, name: 'AC Milan', shortName: 'MIL', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2060 },
  { id: 64, name: 'Cremonese', shortName: 'CRE', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2061 },
  { id: 65, name: 'AS Roma', shortName: 'ROM', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2062 },
  { id: 66, name: 'Bologna', shortName: 'BOL', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2063 },
  { id: 67, name: 'Cagliari', shortName: 'CAG', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2064 },
  { id: 68, name: 'Fiorentina', shortName: 'FIO', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2065 },
  { id: 69, name: 'Como', shortName: 'COM', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2066 },
  { id: 70, name: 'Lazio', shortName: 'LAZ', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2067 },
  { id: 71, name: 'Atalanta', shortName: 'ATA', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2068 },
  { id: 72, name: 'Pisa', shortName: 'PIS', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2069 },
  { id: 73, name: 'Juventus', shortName: 'JUV', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2070 },
  { id: 74, name: 'Parma', shortName: 'PAR', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2071 },
  { id: 75, name: 'Udinese', shortName: 'UDI', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2072 },
  { id: 76, name: 'Hellas Verona', shortName: 'VER', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2073 },
  { id: 77, name: 'Inter', shortName: 'INT', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2074 },
  { id: 78, name: 'Torino', shortName: 'TOR', leagueId: 4, country: 'Italy', countryCode: 'IT', venueId: 2075 },
  { id: 79, name: 'FC Bayern München', shortName: 'BAY', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2076 },
  { id: 80, name: 'RB Leipzig', shortName: 'RBL', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2077 },
  { id: 81, name: '1. FC Heidenheim', shortName: 'FCH', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2078 },
  { id: 82, name: 'VfL Wolfsburg', shortName: 'WOB', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2079 },
  { id: 83, name: '1. FC Union Berlin', shortName: 'FCU', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2080 },
  { id: 84, name: 'VfB Stuttgart', shortName: 'VFB', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2081 },
  { id: 85, name: 'Bayer 04 Leverkusen', shortName: 'B04', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2082 },
  { id: 86, name: 'TSG Hoffenheim', shortName: 'TSG', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2083 },
  { id: 87, name: 'Eintracht Frankfurt', shortName: 'SGE', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2084 },
  { id: 88, name: 'SV Werder Bremen', shortName: 'SVW', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2085 },
  { id: 89, name: 'SC Freiburg', shortName: 'SCF', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2086 },
  { id: 90, name: 'FC Augsburg', shortName: 'AUG', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2087 },
  { id: 91, name: 'FC St. Pauli', shortName: 'STP', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2088 },
  { id: 92, name: 'Borussia Dortmund', shortName: 'BVB', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2089 },
  { id: 93, name: '1. FSV Mainz 05', shortName: 'M05', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2090 },
  { id: 94, name: '1. FC Köln', shortName: 'KOE', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2091 },
  { id: 95, name: 'Borussia M\'gladbach', shortName: 'BMG', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2092 },
  { id: 96, name: 'Hamburger SV', shortName: 'HS', leagueId: 5, country: 'Germany', countryCode: 'DE', venueId: 2093 },
  { id: 97, name: 'Stade Rennais', shortName: 'SR', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2094 },
  { id: 98, name: 'Olympique de Marseille', shortName: 'OM', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2095 },
  { id: 99, name: 'RC Lens', shortName: 'RCL', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2096 },
  { id: 100, name: 'Olympique Lyonnais', shortName: 'OL', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2097 },
  { id: 101, name: 'AS Monaco', shortName: 'ASM', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2098 },
  { id: 102, name: 'Le Havre', shortName: 'HAC', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2099 },
  { id: 103, name: 'OGC Nice', shortName: 'NIC', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2100 },
  { id: 104, name: 'Toulouse', shortName: 'TFC', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2101 },
  { id: 105, name: 'Stade Brestois', shortName: 'SB29', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2102 },
  { id: 106, name: 'LOSC Lille', shortName: 'LIL', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2103 },
  { id: 107, name: 'Angers', shortName: 'ANG', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2104 },
  { id: 108, name: 'Paris FC', shortName: 'PFC', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2105 },
  { id: 109, name: 'AJ Auxerre', shortName: 'AUX', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2106 },
  { id: 110, name: 'Lorient', shortName: 'LOR', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2107 },
  { id: 111, name: 'Metz', shortName: 'MET', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2108 },
  { id: 112, name: 'RC Strasbourg', shortName: 'RCS', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2109 },
  { id: 113, name: 'Nantes', shortName: 'NAN', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2110 },
  { id: 114, name: 'Paris Saint-Germain', shortName: 'PSG', leagueId: 6, country: 'France', countryCode: 'FR', venueId: 2111 },
  { id: 150, name: 'Cruzeiro', shortName: 'CRU', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2112 },
  { id: 151, name: 'Mirassol', shortName: 'MIR', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2113 },
  { id: 152, name: 'Fortaleza', shortName: 'FOR', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2114 },
  { id: 153, name: 'Fluminense', shortName: 'FLU', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2115 },
  { id: 154, name: 'Grêmio', shortName: 'GRE', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2116 },
  { id: 155, name: 'Atlético Mineiro', shortName: 'CAM', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2117 },
  { id: 156, name: 'Juventude', shortName: 'JUV', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2118 },
  { id: 157, name: 'Vitória', shortName: 'VIT', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2119 },
  { id: 158, name: 'São Paulo', shortName: 'SAO', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2120 },
  { id: 159, name: 'Sport Recife', shortName: 'SPT', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2121 },
  { id: 160, name: 'Flamengo', shortName: 'FLA', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2122 },
  { id: 161, name: 'Internacional', shortName: 'INT', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2123 },
  { id: 162, name: 'Palmeiras', shortName: 'PAL', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2124 },
  { id: 163, name: 'Botafogo', shortName: 'BOT', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2125 },
  { id: 164, name: 'Vasco da Gama', shortName: 'VAS', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2126 },
  { id: 165, name: 'Santos', shortName: 'SAN', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2127 },
  { id: 166, name: 'Bahia', shortName: 'BAH', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2128 },
  { id: 167, name: 'Corinthians', shortName: 'COR', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2129 },
  { id: 168, name: 'Red Bull Bragantino', shortName: 'RBB', leagueId: 9, country: 'Brazil', countryCode: 'BR', venueId: 2130 },
  { id: 115, name: 'PSV Eindhoven', shortName: 'PSV', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2131 },
  { id: 122, name: 'AFC Ajax', shortName: 'AJA', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2132 },
  { id: 138, name: 'Feyenoord', shortName: 'FEY', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2133 },
  { id: 139, name: 'Go Ahead Eagles', shortName: 'GAE', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2134 },
  { id: 142, name: 'FC Utrecht', shortName: 'UTR', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2135 },
  { id: 170, name: 'Fortuna Sittard', shortName: 'FOR', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2136 },
  { id: 171, name: 'NEC Nijmegen', shortName: 'NEC', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2137 },
  { id: 172, name: 'Excelsior', shortName: 'EXC', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2138 },
  { id: 174, name: 'SC Heerenveen', shortName: 'HEE', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2139 },
  { id: 176, name: 'Sparta Rotterdam', shortName: 'SPA', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2140 },
  { id: 177, name: 'PEC Zwolle', shortName: 'ZWO', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2141 },
  { id: 178, name: 'FC Twente', shortName: 'TWE', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2142 },
  { id: 179, name: 'SC Telstar', shortName: 'TEL', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2143 },
  { id: 180, name: 'AZ Alkmaar', shortName: 'AZ', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2144 },
  { id: 181, name: 'FC Groningen', shortName: 'GRO', leagueId: 10, country: 'Netherlands', countryCode: 'NL', venueId: 2145 },
  { id: 57, name: 'Real Madrid', shortName: 'RMA', leagueId: 7, country: 'Europe', countryCode: 'INT', venueId: 2146 },
  { id: 12, name: 'Manchester City', shortName: 'MCI', leagueId: 7, country: 'Europe', countryCode: 'INT', venueId: 2147 },
  { id: 79, name: 'FC Bayern München', shortName: 'BAY', leagueId: 7, country: 'Europe', countryCode: 'INT', venueId: 2148 },
  { id: 114, name: 'Paris Saint-Germain', shortName: 'PSG', leagueId: 7, country: 'Europe', countryCode: 'INT', venueId: 2149 },
  { id: 18, name: 'Arsenal', shortName: 'ARS', leagueId: 8, country: 'Europe', countryCode: 'INT', venueId: 2150 },
  { id: 52, name: 'Sevilla', shortName: 'SEV', leagueId: 8, country: 'Europe', countryCode: 'INT', venueId: 2151 },
  { id: 65, name: 'AS Roma', shortName: 'ROM', leagueId: 8, country: 'Europe', countryCode: 'INT', venueId: 2152 },
  { id: 41, name: 'Villarreal', shortName: 'VIL', leagueId: 8, country: 'Europe', countryCode: 'INT', venueId: 2153 },
];

const teamById = new Map<number, TeamSeed>(teamSeeds.map((t) => [t.id, t]));

const leaguesById = new Map<number, LeagueSeed>(leagueSeeds.map((l) => [l.id, l]));

/* ------------------------------------------------------------------ */
/* Joueurs (60)                                                        */
/* ------------------------------------------------------------------ */

interface PlayerSeed {
  id: number;
  name: string;
  shortName: string;
  position: string;
  specificPosition: string;
  number: number;
  dob: string;
  height: number;
  weight: number;
  nationality: string;
  teamId: number;
  value: number;
  rating: number;
}

const playerSeeds: PlayerSeed[] = [
  { id: 1, name: 'Bukayo Saka', shortName: 'B. Saka', position: 'F', specificPosition: 'RW', number: 7, dob: '2001-09-05', height: 176, weight: 70, nationality: 'England', teamId: 18, value: 90000000, rating: 8.4 },
  { id: 2, name: 'Erling Haaland', shortName: 'E. Haaland', position: 'F', specificPosition: 'ST', number: 9, dob: '2000-07-21', height: 195, weight: 93, nationality: 'Norway', teamId: 12, value: 170000000, rating: 8.9 },
  { id: 3, name: 'Mohamed Salah', shortName: 'M. Salah', position: 'F', specificPosition: 'RW', number: 11, dob: '1992-04-15', height: 178, weight: 77, nationality: 'Egypt', teamId: 1, value: 65000000, rating: 8.2 },
  { id: 4, name: 'Cole Palmer', shortName: 'C. Palmer', position: 'M', specificPosition: 'AM', number: 20, dob: '2002-05-06', height: 180, weight: 75, nationality: 'England', teamId: 13, value: 95000000, rating: 7.9 },
  { id: 5, name: 'Jude Bellingham', shortName: 'J. Bellingham', position: 'M', specificPosition: 'AM', number: 5, dob: '2003-06-29', height: 186, weight: 75, nationality: 'England', teamId: 57, value: 150000000, rating: 8.6 },
  { id: 6, name: 'Lamine Yamal', shortName: 'L. Yamal', position: 'F', specificPosition: 'RW', number: 19, dob: '2007-07-13', height: 183, weight: 72, nationality: 'Spain', teamId: 44, value: 160000000, rating: 8.8 },
  { id: 7, name: 'Antoine Griezmann', shortName: 'A. Griezmann', position: 'F', specificPosition: 'ST', number: 7, dob: '1991-03-21', height: 176, weight: 73, nationality: 'France', teamId: 54, value: 30000000, rating: 7.8 },
  { id: 8, name: 'Isaac Romero', shortName: 'I. Romero', position: 'F', specificPosition: 'ST', number: 7, dob: '2000-09-18', height: 180, weight: 74, nationality: 'Spain', teamId: 52, value: 35000000, rating: 7.5 },
  { id: 9, name: 'Lautaro Martínez', shortName: 'L. Martínez', position: 'F', specificPosition: 'ST', number: 10, dob: '1997-08-22', height: 181, weight: 75, nationality: 'Argentina', teamId: 77, value: 85000000, rating: 8.3 },
  { id: 10, name: 'Rafael Leão', shortName: 'R. Leão', position: 'F', specificPosition: 'LW', number: 10, dob: '1999-07-10', height: 179, weight: 71, nationality: 'Portugal', teamId: 63, value: 70000000, rating: 8.0 },
  { id: 11, name: 'Dušan Vlahović', shortName: 'D. Vlahović', position: 'F', specificPosition: 'ST', number: 9, dob: '2000-03-16', height: 190, weight: 80, nationality: 'Serbia', teamId: 73, value: 60000000, rating: 7.7 },
  { id: 12, name: 'Khvicha Kvaratskhelia', shortName: 'K. Kvaratskhelia', position: 'F', specificPosition: 'LW', number: 77, dob: '2001-04-12', height: 183, weight: 78, nationality: 'Georgia', teamId: 62, value: 80000000, rating: 8.1 },
  { id: 13, name: 'Harry Kane', shortName: 'H. Kane', position: 'F', specificPosition: 'ST', number: 9, dob: '1993-07-28', height: 188, weight: 89, nationality: 'England', teamId: 79, value: 100000000, rating: 8.5 },
  { id: 14, name: 'Patrik Schick', shortName: 'P. Schick', position: 'F', specificPosition: 'ST', number: 14, dob: '1996-01-24', height: 187, weight: 84, nationality: 'Czechia', teamId: 85, value: 45000000, rating: 7.6 },
  { id: 15, name: 'Serhou Guirassy', shortName: 'S. Guirassy', position: 'F', specificPosition: 'ST', number: 9, dob: '1996-03-14', height: 182, weight: 80, nationality: 'Guinea', teamId: 92, value: 55000000, rating: 7.9 },
  { id: 16, name: 'Loïs Openda', shortName: 'L. Openda', position: 'F', specificPosition: 'LW', number: 11, dob: '2000-03-16', height: 180, weight: 78, nationality: 'Belgium', teamId: 80, value: 60000000, rating: 7.7 },
  { id: 17, name: 'Ousmane Dembélé', shortName: 'O. Dembélé', position: 'F', specificPosition: 'RW', number: 10, dob: '1997-05-15', height: 178, weight: 70, nationality: 'France', teamId: 114, value: 70000000, rating: 8.3 },
  { id: 18, name: 'Mason Greenwood', shortName: 'M. Greenwood', position: 'F', specificPosition: 'RW', number: 10, dob: '2001-10-02', height: 180, weight: 73, nationality: 'England', teamId: 98, value: 55000000, rating: 7.4 },
  { id: 19, name: 'Maghnes Akliouche', shortName: 'M. Akliouche', position: 'F', specificPosition: 'RW', number: 27, dob: '2002-05-17', height: 179, weight: 70, nationality: 'France', teamId: 101, value: 40000000, rating: 7.3 },
  { id: 20, name: 'Jonathan David', shortName: 'J. David', position: 'F', specificPosition: 'ST', number: 9, dob: '2000-01-20', height: 176, weight: 68, nationality: 'Canada', teamId: 106, value: 55000000, rating: 7.8 },
  { id: 21, name: 'Vinícius Júnior', shortName: 'V. Júnior', position: 'F', specificPosition: 'LW', number: 7, dob: '2000-07-12', height: 179, weight: 72, nationality: 'Brazil', teamId: 57, value: 140000000, rating: 8.4 },
  { id: 22, name: 'Kevin De Bruyne', shortName: 'K. De Bruyne', position: 'M', specificPosition: 'CM', number: 17, dob: '1991-06-28', height: 181, weight: 70, nationality: 'Belgium', teamId: 12, value: 40000000, rating: 8.4 },
  { id: 23, name: 'Jamal Musiala', shortName: 'J. Musiala', position: 'M', specificPosition: 'AM', number: 42, dob: '2003-02-13', height: 178, weight: 71, nationality: 'Germany', teamId: 79, value: 110000000, rating: 8.5 },
  { id: 24, name: 'Achraf Hakimi', shortName: 'A. Hakimi', position: 'D', specificPosition: 'RB', number: 2, dob: '1998-11-04', height: 180, weight: 75, nationality: 'Morocco', teamId: 114, value: 70000000, rating: 8.1 },
  { id: 25, name: 'Declan Rice', shortName: 'D. Rice', position: 'M', specificPosition: 'DM', number: 41, dob: '1999-01-14', height: 185, weight: 84, nationality: 'England', teamId: 18, value: 95000000, rating: 8.2 },
  { id: 26, name: 'Nabil Fekir', shortName: 'N. Fekir', position: 'M', specificPosition: 'AM', number: 8, dob: '1993-12-18', height: 175, weight: 72, nationality: 'Algeria', teamId: 52, value: 15000000, rating: 7.2 },
  { id: 27, name: 'Paulo Dybala', shortName: 'P. Dybala', position: 'M', specificPosition: 'AM', number: 21, dob: '1993-11-15', height: 177, weight: 75, nationality: 'Argentina', teamId: 65, value: 40000000, rating: 7.8 },
  { id: 28, name: 'Alexander Sørloth', shortName: 'A. Sørloth', position: 'F', specificPosition: 'ST', number: 9, dob: '1995-12-05', height: 195, weight: 95, nationality: 'Norway', teamId: 41, value: 25000000, rating: 7.1 },
  { id: 29, name: 'Rafa Silva', shortName: 'R. Silva', position: 'M', specificPosition: 'AM', number: 10, dob: '1993-03-17', height: 173, weight: 66, nationality: 'Portugal', teamId: 37, value: 25000000, rating: 7.6 },
  { id: 30, name: 'Bruno Fernandes', shortName: 'B. Fernandes', position: 'M', specificPosition: 'AM', number: 8, dob: '1994-09-08', height: 179, weight: 72, nationality: 'Portugal', teamId: 35, value: 80000000, rating: 8.2 },
  { id: 31, name: 'Gonçalo Ramos', shortName: 'G. Ramos', position: 'F', specificPosition: 'ST', number: 9, dob: '2001-05-05', height: 183, weight: 76, nationality: 'Portugal', teamId: 22, value: 40000000, rating: 7.4 },
  { id: 32, name: 'Ricardo Horta', shortName: 'R. Horta', position: 'F', specificPosition: 'LW', number: 7, dob: '1994-09-16', height: 168, weight: 63, nationality: 'Portugal', teamId: 31, value: 22000000, rating: 7.0 },
  { id: 33, name: 'Mohammed Kudus', shortName: 'M. Kudus', position: 'M', specificPosition: 'AM', number: 20, dob: '2000-08-02', height: 172, weight: 70, nationality: 'Ghana', teamId: 122, value: 50000000, rating: 7.7 },
  { id: 34, name: 'Cody Gakpo', shortName: 'C. Gakpo', position: 'F', specificPosition: 'LW', number: 11, dob: '1998-05-18', height: 183, weight: 78, nationality: 'Netherlands', teamId: 115, value: 55000000, rating: 7.9 },
  { id: 35, name: 'Xavi Simons', shortName: 'X. Simons', position: 'M', specificPosition: 'AM', number: 7, dob: '2003-04-25', height: 178, weight: 74, nationality: 'Netherlands', teamId: 138, value: 70000000, rating: 8.0 },
  { id: 36, name: 'Wout Weghorst', shortName: 'W. Weghorst', position: 'F', specificPosition: 'ST', number: 9, dob: '1992-08-10', height: 197, weight: 92, nationality: 'Netherlands', teamId: 180, value: 14000000, rating: 6.9 },
  { id: 37, name: 'Pedro', shortName: 'Pedro', position: 'F', specificPosition: 'ST', number: 9, dob: '1997-08-25', height: 188, weight: 82, nationality: 'Brazil', teamId: 160, value: 30000000, rating: 7.3 },
  { id: 38, name: 'Raphael Veiga', shortName: 'R. Veiga', position: 'M', specificPosition: 'CM', number: 5, dob: '1995-02-14', height: 173, weight: 68, nationality: 'Brazil', teamId: 162, value: 25000000, rating: 7.4 },
  { id: 39, name: 'Yuri Alberto', shortName: 'Y. Alberto', position: 'F', specificPosition: 'ST', number: 9, dob: '1996-03-18', height: 177, weight: 75, nationality: 'Brazil', teamId: 167, value: 18000000, rating: 7.0 },
  { id: 40, name: 'André', shortName: 'André', position: 'M', specificPosition: 'CM', number: 8, dob: '1996-12-30', height: 172, weight: 68, nationality: 'Brazil', teamId: 158, value: 12000000, rating: 6.8 },
  { id: 41, name: 'Martin Ødegaard', shortName: 'M. Ødegaard', position: 'M', specificPosition: 'AM', number: 8, dob: '1998-12-17', height: 178, weight: 68, nationality: 'Norway', teamId: 18, value: 110000000, rating: 8.5 },
  { id: 42, name: 'David Raya', shortName: 'D. Raya', position: 'G', specificPosition: 'GK', number: 22, dob: '1997-06-10', height: 192, weight: 88, nationality: 'Spain', teamId: 18, value: 55000000, rating: 7.7 },
  { id: 43, name: 'William Saliba', shortName: 'W. Saliba', position: 'D', specificPosition: 'CB', number: 2, dob: '1999-10-21', height: 190, weight: 90, nationality: 'France', teamId: 18, value: 75000000, rating: 8.0 },
  { id: 44, name: 'Gabriel Magalhães', shortName: 'G. Magalhães', position: 'D', specificPosition: 'CB', number: 6, dob: '1997-12-19', height: 189, weight: 82, nationality: 'Brazil', teamId: 18, value: 70000000, rating: 7.9 },
  { id: 45, name: 'Kai Havertz', shortName: 'K. Havertz', position: 'F', specificPosition: 'CF', number: 29, dob: '1999-06-15', height: 193, weight: 84, nationality: 'Germany', teamId: 18, value: 60000000, rating: 7.6 },
  { id: 46, name: 'Jorginho', shortName: 'Jorginho', position: 'M', specificPosition: 'CM', number: 20, dob: '1991-12-20', height: 175, weight: 68, nationality: 'Italy', teamId: 18, value: 25000000, rating: 7.2 },
  { id: 47, name: 'Jakub Kiwior', shortName: 'J. Kiwior', position: 'D', specificPosition: 'LB', number: 35, dob: '2000-04-15', height: 179, weight: 72, nationality: 'Poland', teamId: 18, value: 30000000, rating: 7.4 },
  { id: 48, name: 'Takehiro Tomiyasu', shortName: 'T. Tomiyasu', position: 'D', specificPosition: 'RB', number: 18, dob: '2001-08-05', height: 185, weight: 76, nationality: 'Japan', teamId: 18, value: 28000000, rating: 7.2 },
  { id: 49, name: 'Ollie Watkins', shortName: 'O. Watkins', position: 'F', specificPosition: 'ST', number: 11, dob: '1999-10-01', height: 175, weight: 70, nationality: 'England', teamId: 18, value: 45000000, rating: 7.5 },
  { id: 50, name: 'Rúben Dias', shortName: 'R. Dias', position: 'D', specificPosition: 'CB', number: 3, dob: '1997-05-14', height: 190, weight: 87, nationality: 'Portugal', teamId: 12, value: 80000000, rating: 8.2 },
  { id: 51, name: 'John Stones', shortName: 'J. Stones', position: 'D', specificPosition: 'CB', number: 5, dob: '1994-05-12', height: 190, weight: 87, nationality: 'England', teamId: 12, value: 60000000, rating: 7.6 },
  { id: 52, name: 'Ederson', shortName: 'Ederson', position: 'G', specificPosition: 'GK', number: 31, dob: '1993-08-17', height: 188, weight: 88, nationality: 'Brazil', teamId: 12, value: 45000000, rating: 7.4 },
  { id: 53, name: 'Rodri', shortName: 'Rodri', position: 'M', specificPosition: 'DM', number: 16, dob: '1996-06-22', height: 190, weight: 82, nationality: 'Spain', teamId: 12, value: 100000000, rating: 8.6 },
  { id: 54, name: 'Phil Foden', shortName: 'P. Foden', position: 'M', specificPosition: 'AM', number: 47, dob: '2000-05-28', height: 173, weight: 70, nationality: 'England', teamId: 12, value: 110000000, rating: 8.3 },
  { id: 55, name: 'Bernardo Silva', shortName: 'B. Silva', position: 'M', specificPosition: 'CM', number: 20, dob: '1994-08-10', height: 183, weight: 78, nationality: 'Portugal', teamId: 12, value: 70000000, rating: 8.1 },
  { id: 56, name: 'Jack Grealish', shortName: 'J. Grealish', position: 'F', specificPosition: 'LW', number: 10, dob: '1995-09-10', height: 173, weight: 70, nationality: 'England', teamId: 12, value: 45000000, rating: 7.1 },
  { id: 57, name: 'Julián Álvarez', shortName: 'J. Álvarez', position: 'F', specificPosition: 'ST', number: 19, dob: '2000-01-31', height: 180, weight: 78, nationality: 'Argentina', teamId: 12, value: 80000000, rating: 8.0 },
  { id: 58, name: 'Jérémy Doku', shortName: 'J. Doku', position: 'F', specificPosition: 'LW', number: 11, dob: '2002-04-11', height: 172, weight: 68, nationality: 'Belgium', teamId: 12, value: 55000000, rating: 7.6 },
  { id: 59, name: 'Virgil van Dijk', shortName: 'V. van Dijk', position: 'D', specificPosition: 'CB', number: 4, dob: '1991-07-08', height: 193, weight: 92, nationality: 'Netherlands', teamId: 1, value: 45000000, rating: 7.8 },
  { id: 60, name: 'Alisson Becker', shortName: 'A. Becker', position: 'G', specificPosition: 'GK', number: 1, dob: '1992-10-02', height: 195, weight: 93, nationality: 'Brazil', teamId: 1, value: 45000000, rating: 7.5 },
];

const playerById = new Map<number, PlayerSeed>(playerSeeds.map((p) => [p.id, p]));

const playerStrengths: Record<string, string[]> = {
  F: ['Dribble', 'Vitesse', 'Finition'],
  M: ['Passage', 'Vision', 'Contrôle'],
  D: ['Duel', 'Positionnement', 'Relances'],
  G: ['Arrêts', 'Jeux de pieds', 'Relance'],
};
const playerWeaknesses: Record<string, string[]> = {
  F: ['Défense', 'Duels aériens'],
  M: ['Vitesse', 'Tirs à distance'],
  D: ['Vitesse', 'Offensif'],
  G: ['Jeu au sol', 'Sorties'],
};

/** Prénoms/pays pour générer des joueurs de complément au nom plausible. */
const firstNames = [
  'Lucas', 'Hugo', 'Nathan', 'Théo', 'Léo', 'Enzo', 'Matteo', 'Ruben', 'Diego', 'Marco',
  'Adam', 'Youssef', 'Karim', 'Amadou', 'Samuel', 'Emil', 'Anton', 'Dani', 'Iker', 'Joris',
  'Kasper', 'Viktor', 'Aleksi', 'Petar', 'Milos', 'Filip', 'Tomás', 'Rodrigo', 'Facundo', 'Julián',
];
const lastNames = [
  'Moreau', 'Dubois', 'Bernard', 'Lefèvre', 'García', 'Fernández', 'Rossi', 'Conti', 'Müller', 'Schmidt',
  'Silva', 'Santos', 'Ferreira', 'Costa', 'Pereira', 'Mendes', 'Nunes', 'Oliveira', 'Sánchez', 'Ramírez',
  'Van Dijk', 'De Jong', 'Bakker', 'Visser', 'Jensen', 'Nilsen', 'Hansen', 'Berg', 'Larsen', 'Sørensen',
];

/** Joueurs « filler » pour compléter les effectif (ids >= 1000, hors catalogue principal). */
const fillerByTeam = new Map<number, PlayerSeed[]>();

function buildFillers(): void {
  const positions = ['G', 'D', 'D', 'D', 'D', 'M', 'M', 'M', 'M', 'F', 'F', 'F', 'F', 'F', 'F', 'F'];
  let counter = 1000;
  for (const team of teamSeeds) {
    const existing = playerSeeds.filter((p) => p.teamId === team.id).length;
    const need = Math.max(0, 18 - existing);
    const list: PlayerSeed[] = [];
    for (let i = 0; i < need; i += 1) {
      counter += 1;
      const position = positions[i % positions.length];
      const first = firstNames[(team.id * 7 + i * 3) % firstNames.length];
      const last = lastNames[(team.id * 11 + i * 5) % lastNames.length];
      list.push({
        id: counter,
        name: `${first} ${last}`,
        shortName: `${first[0]}. ${last}`,
        position,
        specificPosition: position === 'G' ? 'GK' : position === 'D' ? 'CB' : position === 'M' ? 'CM' : 'ST',
        number: i + 1,
        dob: `${1994 + (i % 8)}-0${(i % 9) + 1}-1${i % 10}`,
        height: 178 + (i % 12),
        weight: 70 + (i % 15),
        nationality: team.country,
        teamId: team.id,
        value: 1000000 + i * 250000,
        rating: 6.2 + (i % 20) / 10,
      });
    }
    fillerByTeam.set(team.id, list);
  }
}
buildFillers();

function squadOf(teamId: number): PlayerSeed[] {
  const main = playerSeeds.filter((p) => p.teamId === teamId);
  const fillers = fillerByTeam.get(teamId) ?? [];
  return [...main, ...fillers];
}

/** Effectif avec les joueurs nommés du catalogue en tête. */
function namedFirst(squad: PlayerSeed[]): PlayerSeed[] {
  const named = squad.filter((p) => p.id <= 60);
  const rest = squad.filter((p) => p.id > 60);
  return [...named, ...rest];
}

/* ------------------------------------------------------------------ */
/* Matchs                                                              */
/* ------------------------------------------------------------------ */

const STATUS_BY_DATE = new Map<string, MatchStatus>();

interface EventSeed {
  id: number;
  leagueId: number;
  homeTeamId: number;
  awayTeamId: number;
  date: Date;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  minute: number | null;
  period: string | null;
  round: number;
  roundLabel: string;
  stage: string;
  attendance: number;
  highlights: Highlight[];
  isLocalDerby: boolean;
}

function buildEvent(
  id: number,
  leagueId: number,
  homeTeamId: number,
  awayTeamId: number,
  date: Date,
  status: MatchStatus,
  opts: { round?: number; roundLabel?: string; stage?: string; minute?: number; period?: string | null; homeScore?: number | null; awayScore?: number | null; attendance?: number } = {},
): EventSeed {
  const home = teamById.get(homeTeamId)!;
  const away = teamById.get(awayTeamId)!;
  const round = opts.round ?? 1;
  const roundLabel = opts.roundLabel ?? `Journée ${round}`;
  const stage = opts.stage ?? 'regular';
  const isFinished = status === 'finished';
  const homeScore = opts.homeScore ?? (isFinished ? rint(0, 3) : null);
  const awayScore = opts.awayScore ?? (isFinished ? rint(0, 3) : null);
  const attendance = opts.attendance ?? rint(24000, 78000);
  const highlights: Highlight[] = isFinished
    ? [
        {
          kind: 'highlight',
          title: `${home.shortName} - ${away.shortName} : les buts`,
          url: `https://sports.bzzoiro.com/media/highlights/${id}/`,
          thumbnail: null,
          publishedAt: new Date(date.getTime() + 3 * 3600000).toISOString(),
        },
      ]
    : [];
  return {
    id,
    leagueId,
    homeTeamId,
    awayTeamId,
    date,
    status,
    homeScore,
    awayScore,
    minute: opts.minute ?? null,
    period: opts.period ?? null,
    round,
    roundLabel,
    stage,
    attendance,
    highlights,
    isLocalDerby: home.countryCode === away.countryCode,
  };
}

const eventSeeds: EventSeed[] = [];

// Match vedette : Arsenal - Manchester City (Premier League, terminé il y a 2 jours).
eventSeeds.push(
  buildEvent(1, 1, 18, 12, atUtc(-2, 15, 30), 'finished', {
    round: 12,
    roundLabel: 'Journée 12',
    homeScore: 2,
    awayScore: 2,
    attendance: 60342,
  }),
);

// Deux matchs en direct.
eventSeeds.push(
  buildEvent(2, 3, 57, 44, new Date(now.getTime() - 42 * 60000), 'inprogress', {
    round: 9,
    roundLabel: 'Journée 9',
    minute: 67,
    period: '2nd_half',
    homeScore: 1,
    awayScore: 1,
    attendance: 74120,
  }),
  buildEvent(3, 5, 79, 92, new Date(now.getTime() - 18 * 60000), 'inprogress', {
    round: 7,
    roundLabel: 'Journée 7',
    minute: 31,
    period: '1st_half',
    homeScore: 0,
    awayScore: 1,
    attendance: 75000,
  }),
);

// Calendrier généré : tour de table (round-robin) sur toutes les équipes de chaque ligue.
const roundOffsets = [-8, -6, -4, 1, 3, 5];
const roundHours = [15, 17, 19, 16, 18, 20];
const roundBase = 11; // premiere journée generee (saison en cours)

/** Tour de table : renvoie les paires de chaque journée. */
function roundRobinPairs(teamIds: number[]): Array<[number, number][]> {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push(-1); //bye
  const n = teams.length;
  const rounds: Array<[number, number][]> = [];
  const arr = [...teams];
  for (let r = 0; r < n - 1; r += 1) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i += 1) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== -1 && b !== -1) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop() as number);
  }
  return rounds;
}

let nextId = 4;
for (const league of leagueSeeds) {
  const teams = teamSeeds.filter((t) => t.leagueId === league.id).map((t) => t.id);
  if (teams.length < 2) continue;
  const allRounds = roundRobinPairs(teams);
  roundOffsets.forEach((offset, i) => {
    const pairs = allRounds[i % allRounds.length];
    const status: MatchStatus = offset < 0 ? 'finished' : 'notstarted';
    pairs.forEach(([home, away], j) => {
      const hour = roundHours[i];
      const minute = (j * 5) % 60;
      eventSeeds.push(
        buildEvent(nextId, league.id, home, away, atUtc(offset, hour, minute), status, {
          round: roundBase + i,
          roundLabel: `Journée ${roundBase + i}`,
        }),
      );
      nextId += 1;
    });
  });
}

const eventById = new Map<number, EventSeed>(eventSeeds.map((e) => [e.id, e]));

/** xG par équipe et par match (déterministe). */
const xgByEvent = new Map<number, { home: number; away: number }>();
for (const ev of eventSeeds) {
  if (ev.status !== 'finished') continue;
  xgByEvent.set(ev.id, { home: rfloat(0.6, 2.6), away: rfloat(0.5, 2.4) });
}

/* ------------------------------------------------------------------ */
/* Conversion en objets domaine                                        */
/* ------------------------------------------------------------------ */

function leagueNameOf(leagueId: number): string {
  return leagueById.get(leagueId)?.name ?? '';
}

function seasonOf(leagueId: number): Season {
  const seed = leagueById.get(leagueId);
  return {
    id: seed?.seasonId ?? leagueId * 100 + 1,
    name: seed?.seasonName ?? '2026/2027',
    year: 2026,
    isCurrent: true,
    startDate: '2026-08-01',
    endDate: '2027-05-24',
  };
}

export function toDomainEvent(seed: EventSeed): FootballEvent {
  const home = teamById.get(seed.homeTeamId)!;
  const away = teamById.get(seed.awayTeamId)!;
  const scoreRnd = seededRnd(seed.id);
  const scoreRint = (min: number, max: number): number => rint(min, max, scoreRnd);
  return {
    id: seed.id,
    leagueId: seed.leagueId,
    leagueName: leagueNameOf(seed.leagueId),
    seasonId: leagueById.get(seed.leagueId)?.seasonId ?? null,
    homeTeamId: seed.homeTeamId,
    homeTeam: home.name,
    awayTeamId: seed.awayTeamId,
    awayTeam: away.name,
    date: seed.date,
    status: seed.status,
    period: seed.period,
    minute: seed.minute,
    homeScore: seed.homeScore,
    awayScore: seed.awayScore,
    homeScoreHt: seed.homeScore === null ? null : Math.max(0, seed.homeScore - scoreRint(0, 1)),
    awayScoreHt: seed.awayScore === null ? null : Math.max(0, seed.awayScore - scoreRint(0, 1)),
    penaltyShootout: null,
    extraTime: null,
    roundLabel: seed.roundLabel,
    stage: seed.stage,
    roundNumber: seed.round,
    venueId: home.venueId,
    refereeId: 500 + (seed.id % 40),
    attendance: seed.attendance,
    isLocalDerby: seed.isLocalDerby,
    highlights: seed.highlights,
    isLive: seed.status === 'inprogress' || seed.status === 'live',
  };
}

/* ------------------------------------------------------------------ */
/* Joueurs → objets domaine                                            */
/* ------------------------------------------------------------------ */

export function toDomainPlayer(seed: PlayerSeed): Player {
  const team = teamById.get(seed.teamId);
  return {
    id: seed.id,
    name: seed.name,
    shortName: seed.shortName,
    position: seed.position,
    specificPosition: seed.specificPosition,
    jerseyNumber: seed.number,
    dateOfBirth: seed.dob,
    heightCm: seed.height,
    weightKg: seed.weight,
    nationality: seed.nationality,
    currentTeamId: seed.teamId,
    currentTeamName: team?.name ?? null,
    marketValueEur: seed.value,
    availability: 'available',
    injuryType: '',
    rating: seed.rating,
    photoUrl: `https://sports.bzzoiro.com/img/player/${seed.id}/?sor=true`,
    strengths: playerStrengths[seed.position] ?? [],
    weaknesses: playerWeaknesses[seed.position] ?? [],
  };
}

export function toDomainSquadPlayer(seed: PlayerSeed, availability: string, injuryType: string): SquadPlayer {
  return {
    id: seed.id,
    name: seed.name,
    shortName: seed.shortName,
    position: seed.position,
    jerseyNumber: seed.number,
    nationality: seed.nationality,
    dateOfBirth: seed.dob,
    availability,
    injuryType,
    injuryExpectedReturn: injuryType ? new Date(now.getTime() + 21 * DAY).toISOString().slice(0, 10) : null,
    photoUrl: `https://sports.bzzoiro.com/img/player/${seed.id}/?sor=true`,
  };
}

export function toDomainTeam(seed: TeamSeed): Team {
  return {
    id: seed.id,
    name: seed.name,
    shortName: seed.shortName,
    country: seed.country,
    countryCode: seed.countryCode,
    venueId: seed.venueId,
    logoUrl: `https://sports.bzzoiro.com/img/team/${seed.id}/`,
  };
}

export function toDomainLeague(seed: LeagueSeed): League {
  return {
    id: seed.id,
    name: seed.name,
    country: seed.country,
    isWomen: seed.isWomen,
    isActive: true,
    currentSeason: seasonOf(seed.id),
    logoUrl: `https://sports.bzzoiro.com/img/league/${seed.id}/`,
  };
}

/* ------------------------------------------------------------------ */
/* API mock — mêmes signatures que endpoints.ts                          */
/* ------------------------------------------------------------------ */

export const mock = {
  async getLiveEvents(opts?: { leagueId?: number; teamId?: number }): Promise<LiveEvent[]> {
    const list = eventSeeds
      .filter((e) => e.status === 'inprogress' || e.status === 'live')
      .filter((e) => (opts?.leagueId ? e.leagueId === opts.leagueId : true))
      .filter((e) => (opts?.teamId ? e.homeTeamId === opts.teamId || e.awayTeamId === opts.teamId : true))
      .map((e) => {
        const base = toDomainEvent(e);
        return { ...base, leagueName: leagueNameOf(e.leagueId), lastUpdated: new Date(now.getTime() - 40000).toISOString() };
      });
    return list;
  },

  async getFixtures(opts: { dateFrom: string; dateTo: string; leagueId?: number; limit?: number }): Promise<FootballEvent[]> {
    const from = new Date(opts.dateFrom).getTime();
    const to = new Date(opts.dateTo).getTime();
    const list = eventSeeds
      .filter((e) => e.date.getTime() >= from && e.date.getTime() <= to)
      .filter((e) => (opts.leagueId ? e.leagueId === opts.leagueId : true))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(toDomainEvent);
    return opts.limit ? list.slice(0, opts.limit) : list;
  },

  async getEvent(id: number): Promise<FootballEvent | null> {
    const seed = eventById.get(id);
    return seed ? toDomainEvent(seed) : null;
  },

  async getEventStats(id: number): Promise<EventStats | null> {
    const seed = eventById.get(id);
    if (!seed || seed.status === 'notstarted') return null;
    return memoized(`stats:${id}`, () => {
      const xg = xgByEvent.get(id) ?? { home: rfloat(0.8, 2.1), away: rfloat(0.7, 1.9) };
      return buildStats(seed, xg.home, xg.away);
    });
  },

  async getEventLineups(id: number): Promise<EventLineups | null> {
    const seed = eventById.get(id);
    if (!seed) return null;
    return memoized(`lineups:${id}`, () => buildLineups(seed));
  },

  async getEventIncidents(id: number): Promise<Incident[]> {
    const seed = eventById.get(id);
    if (!seed || seed.status === 'notstarted') return [];
    return memoized(`incidents:${id}`, () => buildIncidents(seed));
  },

  async getEventCommentary(id: number): Promise<CommentaryLine[]> {
    const seed = eventById.get(id);
    if (!seed || seed.status === 'notstarted') return [];
    return memoized(`commentary:${id}`, () => buildCommentary(seed));
  },

  async getEventH2H(id: number): Promise<H2H | null> {
    const seed = eventById.get(id);
    if (!seed) return null;
    return memoized(`h2h:${id}`, () => buildH2H(seed));
  },

  async getEventOdds(id: number): Promise<EventOdds | null> {
    const seed = eventById.get(id);
    if (!seed || seed.status === 'notstarted') return null;
    return memoized(`odds:${id}`, () => buildOdds(seed));
  },

  async getEventPrediction(id: number): Promise<Prediction | null> {
    const seed = eventById.get(id);
    if (!seed) return null;
    return memoized(`prediction:${id}`, () => buildPrediction(seed));
  },

  async getEventAvailability(id: number): Promise<Availability | null> {
    const seed = eventById.get(id);
    if (!seed) return null;
    return {
      eventId: id,
      status: seed.status,
      lineupStatus: seed.status === 'notstarted' ? 'predicted' : 'confirmed',
      available: {
        stats: seed.status !== 'notstarted',
        lineups: true,
        incidents: seed.status !== 'notstarted',
        commentary: seed.status !== 'notstarted',
        odds: seed.status !== 'notstarted',
        prediction: true,
        player_stats: seed.status !== 'notstarted',
        h2h: true,
      },
      statKeys: ['possession', 'shots', 'shots_on_target', 'corners', 'xg', 'fouls', 'passes'],
      oddsMarkets: ['1x2', 'over_under_25', 'btts'],
    };
  },

  async getEventPlayerStats(id: number): Promise<PlayerStat[]> {
    const seed = eventById.get(id);
    if (!seed || seed.status === 'notstarted') return [];
    return memoized(`playerstats:${id}`, () => buildPlayerStats(seed));
  },

  async getLeagues(opts?: { country?: string; isWomen?: boolean }): Promise<League[]> {
    return leagueSeeds
      .filter((l) => (opts?.country ? l.country.toLowerCase() === opts.country.toLowerCase() : true))
      .filter((l) => (opts?.isWomen !== undefined ? l.isWomen === opts.isWomen : true))
      .map(toDomainLeague);
  },

  async getLeague(id: number): Promise<League | null> {
    const seed = leagueById.get(id);
    return seed ? toDomainLeague(seed) : null;
  },

  async getLeagueSeasons(id: number): Promise<Season[]> {
    const seed = leagueById.get(id);
    if (!seed) return [];
    return [
      { id: seed.seasonId, name: seed.seasonName, year: 2026, isCurrent: true, startDate: '2026-08-01', endDate: '2027-05-24' },
      { id: seed.seasonId - 1, name: '2025/2026', year: 2025, isCurrent: false, startDate: '2025-08-01', endDate: '2026-05-25' },
      { id: seed.seasonId - 2, name: '2024/2025', year: 2024, isCurrent: false, startDate: '2024-08-01', endDate: '2025-05-26' },
    ];
  },

  async getStandings(leagueId: number, seasonId?: number): Promise<StandingsResult> {
    const league = leagueById.get(leagueId);
    const teams = teamSeeds.filter((t) => t.leagueId === leagueId);
    const rows: Standing[] = teams.map((team) => {
      let played = 0;
      let won = 0;
      let drawn = 0;
      let lost = 0;
      let gf = 0;
      let ga = 0;
      let xgf = 0;
      let xga = 0;
      let xgGames = 0;
      const results: string[] = [];
      const playedEvents: EventSeed[] = [];
      for (const ev of eventSeeds) {
        if (ev.leagueId !== leagueId || ev.status !== 'finished') continue;
        const isHome = ev.homeTeamId === team.id;
        const isAway = ev.awayTeamId === team.id;
        if (!isHome && !isAway) continue;
        played += 1;
        playedEvents.push(ev);
        const scored = isHome ? (ev.homeScore ?? 0) : (ev.awayScore ?? 0);
        const conceded = isHome ? (ev.awayScore ?? 0) : (ev.homeScore ?? 0);
        gf += scored;
        ga += conceded;
        const x = xgByEvent.get(ev.id);
        if (x) {
          xgf += isHome ? x.home : x.away;
          xga += isHome ? x.away : x.home;
          xgGames += 1;
        }
        if (scored > conceded) {
          won += 1;
          results.push('W');
        } else if (scored === conceded) {
          drawn += 1;
          results.push('D');
        } else {
          lost += 1;
          results.push('L');
        }
      }
      const pts = won * 3 + drawn;
      return {
        position: 0,
        teamId: team.id,
        teamName: team.name,
        played,
        won,
        drawn,
        lost,
        gf,
        ga,
        gd: gf - ga,
        pts,
        xgf: xgGames ? Math.round(xgf * 10) / 10 : null,
        xga: xgGames ? Math.round(xga * 10) / 10 : null,
        xgd: xgGames ? Math.round((xgf - xga) * 10) / 10 : null,
        xgGames,
        form: results.slice(-5).join(''),
        live: playedEvents.some((e) => e.status === 'inprogress'),
        zone: null,
      };
    });
    rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    rows.forEach((row, i) => {
      row.position = i + 1;
      if (rows.length >= 8) {
        row.zone = i < 4 ? 'title' : i < 6 ? 'europe' : i >= rows.length - 2 ? 'relegation' : null;
      }
    });
    return {
      grouped: false,
      groups: { [league?.country ?? 'Groupe']: rows },
      flat: rows,
      season: seasonOf(leagueId),
      leagueId,
    };
  },

  async getTopScorers(leagueId: number, opts?: { stat?: string; seasonId?: number; limit?: number }): Promise<LeaderboardEntry[]> {
    const stat = opts?.stat ?? 'scorers';
    const teamIds = new Set(teamSeeds.filter((t) => t.leagueId === leagueId).map((t) => t.id));
    const entries: LeaderboardEntry[] = [];
    for (const seed of playerSeeds) {
      if (!teamIds.has(seed.teamId)) continue;
      const goals = goalsFor(seed);
      const assists = assistsFor(seed);
      const value = stat === 'assists' ? assists : stat === 'yellowcards' ? (seed.id % 7) : stat === 'redcards' ? seed.id % 2 : stat === 'fouls' ? seed.id % 5 : goals;
      entries.push({
        rank: 0,
        playerId: seed.id,
        playerName: seed.name,
        position: seed.position,
        teamId: seed.teamId,
        teamName: teamById.get(seed.teamId)?.name ?? '',
        value,
        matches: 24,
        photoUrl: `https://sports.bzzoiro.com/img/player/${seed.id}/?sor=true`,
      });
    }
    entries.sort((a, b) => b.value - a.value);
    entries.forEach((e, i) => {
      e.rank = i + 1;
    });
    return opts?.limit ? entries.slice(0, opts.limit) : entries;
  },

  async getBestXI(leagueId: number, seasonId: number, round?: number): Promise<BestXI | null> {
    const teamIds = teamSeeds.filter((t) => t.leagueId === leagueId).map((t) => t.id);
    const pool = playerSeeds.filter((p) => teamIds.includes(p.teamId));
    const formation = '4-3-3';
    const slots = ['G', 'D', 'D', 'D', 'D', 'M', 'M', 'M', 'F', 'F', 'F'];
    const lineup = slots.map((position, i) => {
      const candidates = pool.filter((p) => p.position === position);
      const chosen = candidates[i % Math.max(1, candidates.length)] ?? pool[i % Math.max(1, pool.length)];
      return {
        position,
        player: chosen ? toDomainPlayer(chosen) : null,
        rating: chosen ? chosen.rating : null,
      };
    });
    return { formation, lineup };
  },

  async getTeams(opts?: { leagueId?: number; name?: string; countryCode?: string; limit?: number }): Promise<Team[]> {
    const q = opts?.name?.toLowerCase();
    const list = teamSeeds
      .filter((t) => (opts?.leagueId ? t.leagueId === opts.leagueId : true))
      .filter((t) => (opts?.countryCode ? t.countryCode === opts.countryCode : true))
      .filter((t) => (q ? t.name.toLowerCase().includes(q) : true))
      .map(toDomainTeam);
    return opts?.limit ? list.slice(0, opts.limit) : list;
  },

  async getTeam(id: number): Promise<Team | null> {
    const seed = teamById.get(id);
    return seed ? toDomainTeam(seed) : null;
  },

  async getTeamSquad(id: number): Promise<SquadPlayer[]> {
    const team = teamById.get(id);
    if (!team) return [];
    const squad = squadOf(id);
    return squad.map((p, i) =>
      toDomainSquadPlayer(p, i === 3 ? 'injured' : 'available', i === 3 ? 'muscle' : ''),
    );
  },

  async getTeamForm(id: number, opts?: { last?: number; leagueId?: number }): Promise<TeamForm | null> {
    const team = teamById.get(id);
    if (!team) return null;
    const requested = opts?.last ?? 10;
    const results: string[] = [];
    let gf = 0;
    let ga = 0;
    let matches = 0;
    for (const ev of eventSeeds) {
      if (ev.status !== 'finished') continue;
      if (opts?.leagueId && ev.leagueId !== opts.leagueId) continue;
      const isHome = ev.homeTeamId === id;
      const isAway = ev.awayTeamId === id;
      if (!isHome && !isAway) continue;
      const scored = isHome ? (ev.homeScore ?? 0) : (ev.awayScore ?? 0);
      const conceded = isHome ? (ev.awayScore ?? 0) : (ev.homeScore ?? 0);
      results.push(scored > conceded ? 'W' : scored === conceded ? 'D' : 'L');
      gf += scored;
      ga += conceded;
      matches += 1;
    }
    const last = results.slice(-requested);
    const wins = last.filter((r) => r === 'W').length;
    const draws = last.filter((r) => r === 'D').length;
    const losses = last.filter((r) => r === 'L').length;
    const goalsFor = gf;
    const goalsAgainst = ga;
    const ppm = last.length ? (wins * 3 + draws) / last.length : null;
    const split = (): {
      results: string | null;
      wins: number | null;
      draws: number | null;
      losses: number | null;
      goalsFor: number | null;
      goalsAgainst: number | null;
      pointsPerMatch: number | null;
      stats: Record<string, number | null>;
    } => ({
      results: last.join('') || null,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      pointsPerMatch: ppm === null ? null : Math.round(ppm * 100) / 100,
      stats: { possession: 52.4, shots: 13.2, xg: 1.61, corners: 5.8, fouls: 11.3 },
    });
    return {
      teamId: id,
      teamName: team.name,
      matches,
      requested,
      overall: split(),
      home: split(),
      away: split(),
    };
  },

  async getTeamFixtures(id: number, opts?: { dateFrom?: string; dateTo?: string }): Promise<FootballEvent[]> {
    const from = opts?.dateFrom ? new Date(opts.dateFrom).getTime() : -Infinity;
    const to = opts?.dateTo ? new Date(opts.dateTo).getTime() : Infinity;
    return eventSeeds
      .filter((e) => e.homeTeamId === id || e.awayTeamId === id)
      .filter((e) => e.date.getTime() >= from && e.date.getTime() <= to)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(toDomainEvent);
  },

  async getPlayers(opts?: { name?: string; teamId?: number; position?: string; limit?: number }): Promise<Player[]> {
    const q = opts?.name?.toLowerCase();
    const list = playerSeeds
      .filter((p) => (opts?.teamId ? p.teamId === opts.teamId : true))
      .filter((p) => (opts?.position ? p.position === opts.position : true))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) || p.shortName.toLowerCase().includes(q) : true))
      .map(toDomainPlayer);
    return opts?.limit ? list.slice(0, opts.limit) : list;
  },

  async getPlayer(id: number): Promise<Player | null> {
    const seed = playerById.get(id);
    return seed ? toDomainPlayer(seed) : null;
  },

  async getPlayerStats(id: number, opts?: { seasonId?: number; limit?: number }): Promise<PlayerStat[]> {
    const seed = playerById.get(id);
    if (!seed) return [];
    const stats: PlayerStat[] = [];
    const count = opts?.limit ?? 3;
    for (let i = 0; i < count; i += 1) {
      const ev = eventSeeds.filter(
        (e) => e.status === 'finished' && (e.homeTeamId === seed.teamId || e.awayTeamId === seed.teamId),
      )[i];
      if (!ev) break;
      stats.push({
        playerId: seed.id,
        teamId: seed.teamId,
        minutesPlayed: 90,
        rating: Math.round((seed.rating - 0.4 + rnd() * 0.8) * 10) / 10,
        goals: goalsFor(seed) / 24 > 0.7 ? 1 : 0,
        assists: assistsFor(seed) / 24 > 0.6 ? 1 : 0,
        xg: Math.round(rfloat(0.05, 0.6) * 100) / 100,
        xa: Math.round(rfloat(0.01, 0.35) * 100) / 100,
        shots: rint(0, 5),
        shotsOnTarget: rint(0, 2),
        passes: rint(28, 78),
        accuratePasses: rint(20, 62),
        tackles: rint(0, 5),
        duelsWon: rint(1, 9),
        duelsLost: rint(0, 6),
        yellowCards: rint(0, 1),
        redCards: 0,
        saves: seed.position === 'G' ? rint(0, 4) : 0,
        bigChances: rint(0, 2),
        bigChancesMissed: rint(0, 1),
        progressivePasses: rint(0, 12),
        aerialWon: rint(0, 7),
        aerialLost: rint(0, 5),
      });
    }
    return stats;
  },

  async getPlayerTransfers(id: number): Promise<Transfer[]> {
    const seed = playerById.get(id);
    if (!seed) return [];
    const from = teamSeeds.find((t) => t.leagueId === 2 && t.id !== seed.teamId) ?? teamSeeds[0];
    return [
      {
        id: seed.id * 10,
        date: '2025-07-01',
        playerId: seed.id,
        playerName: seed.name,
        fromTeamId: from.id,
        fromTeamName: from.name,
        toTeamId: seed.teamId,
        toTeamName: teamById.get(seed.teamId)?.name ?? '',
        feeEur: Math.round(seed.value * 0.6),
        feeDescription: `Transfert définitif (${Math.round(seed.value * 0.6 / 1_000_000)} M€)`,
      },
    ];
  },

  async getPredictions(opts?: { dateFrom?: string; dateTo?: string; leagueId?: number; limit?: number }): Promise<Prediction[]> {
    const from = opts?.dateFrom ? new Date(opts.dateFrom).getTime() : -Infinity;
    const to = opts?.dateTo ? new Date(opts.dateTo).getTime() : Infinity;
    const list = eventSeeds
      .filter((e) => e.date.getTime() >= from && e.date.getTime() <= to)
      .filter((e) => (opts?.leagueId ? e.leagueId === opts.leagueId : true))
      .filter((e) => e.status === 'notstarted' || e.status === 'inprogress')
      .map((e) => buildPrediction(e))
      .filter((p): p is Prediction => p !== null);
    return opts?.limit ? list.slice(0, opts.limit) : list;
  },

  async getBestOdds(opts?: { market?: string; dateFrom?: string; dateTo?: string; limit?: number }): Promise<BestOddsRow[]> {
    const market = opts?.market ?? '1x2';
    const from = opts?.dateFrom ? new Date(opts.dateFrom).getTime() : -Infinity;
    const to = opts?.dateTo ? new Date(opts.dateTo).getTime() : Infinity;
    const rows: BestOddsRow[] = [];
    for (const ev of eventSeeds) {
      if (ev.status !== 'notstarted') continue;
      if (ev.date.getTime() < from || ev.date.getTime() > to) continue;
      const odds = buildOdds(ev);
      if (!odds) continue;
      const m = odds.markets.find((x) => x.market === market) ?? odds.markets[0];
      rows.push({
        eventId: ev.id,
        date: ev.date,
        leagueId: ev.leagueId,
        leagueName: leagueNameOf(ev.leagueId),
        homeTeam: teamById.get(ev.homeTeamId)?.name ?? '',
        awayTeam: teamById.get(ev.awayTeamId)?.name ?? '',
        homeTeamId: ev.homeTeamId,
        awayTeamId: ev.awayTeamId,
        market: m.market,
        outcomes: m.outcomes.map((o) => ({
          outcome: o.outcome,
          label: o.label,
          decimal: o.decimal,
          implied: o.implied,
        })),
      });
      if (rows.length >= (opts?.limit ?? 20)) break;
    }
    return rows;
  },

  async getTransfers(opts?: { leagueId?: number; teamId?: number; ordering?: string; limit?: number }): Promise<Transfer[]> {
    const list = buildTransfers().filter((t) => {
      if (opts?.leagueId) {
        const from = teamById.get(t.fromTeamId ?? -1);
        const to = teamById.get(t.toTeamId ?? -1);
        if (from?.leagueId !== opts.leagueId && to?.leagueId !== opts.leagueId) return false;
      }
      if (opts?.teamId && t.fromTeamId !== opts.teamId && t.toTeamId !== opts.teamId) return false;
      return true;
    });
    if (opts?.ordering === '-fee') list.sort((a, b) => (b.feeEur ?? 0) - (a.feeEur ?? 0));
    else if (opts?.ordering === 'fee') list.sort((a, b) => (a.feeEur ?? 0) - (b.feeEur ?? 0));
    else list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return opts?.limit ? list.slice(0, opts.limit) : list;
  },

  async getBroadcasts(opts?: { dateFrom?: string; dateTo?: string; countryCode?: string }): Promise<Broadcast[]> {
    const from = opts?.dateFrom ? new Date(opts.dateFrom).getTime() : -Infinity;
    const to = opts?.dateTo ? new Date(opts.dateTo).getTime() : Infinity;
    const channels: Record<string, string[]> = {
      FR: ['Canal+ Foot', 'beIN Sports 1'],
      ES: ['Movistar Plus+', 'DAZN'],
      GB: ['Sky Sports', 'TNT Sports 1'],
      DE: ['Sky Sport Deutschland', 'DAZN 1'],
      IT: ['Sky Sport Uno', 'DAZN'],
      PT: ['Sport TV 1', 'DAZN'],
      NL: ['Ziggo Sport', 'ESPN'],
      BR: ['Premiere', 'Globoplay'],
    };
    const out: Broadcast[] = [];
    let id = 1;
    for (const ev of eventSeeds) {
      if (ev.status !== 'notstarted') continue;
      if (ev.date.getTime() < from || ev.date.getTime() > to) continue;
      const cc = opts?.countryCode ?? 'FR';
      const list = channels[cc] ?? channels.FR;
      out.push({
        id: id++,
        eventId: ev.id,
        leagueName: leagueNameOf(ev.leagueId),
        homeTeam: teamById.get(ev.homeTeamId)?.name ?? '',
        awayTeam: teamById.get(ev.awayTeamId)?.name ?? '',
        date: ev.date,
        countryCode: cc,
        channelName: list[out.length % list.length],
        channelLink: `https://www.google.com/search?q=${encodeURIComponent(list[out.length % list.length])}`,
        scheduledStart: new Date(ev.date.getTime() - 15 * 60000),
      });
      if (out.length >= 20) break;
    }
    return out;
  },

  async getCoverage(): Promise<Coverage | null> {
    const next = eventSeeds
      .filter((e) => e.status === 'notstarted')
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    return {
      generatedAt: new Date(now.getTime() - 20000).toISOString(),
      sports: [
        {
          sport: 'football',
          name: 'Football',
          status: 'live',
          eventsNext7d: eventSeeds.filter((e) => e.date.getTime() > now.getTime() && e.date.getTime() < now.getTime() + 7 * DAY).length,
          liveNow: eventSeeds.filter((e) => e.status === 'inprogress').length,
          nextEventAt: next ? next.date.toISOString() : null,
        },
        {
          sport: 'tennis',
          name: 'Tennis',
          status: 'active',
          eventsNext7d: 42,
          liveNow: 3,
          nextEventAt: new Date(now.getTime() + 3 * 3600000).toISOString(),
        },
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Constructions dérivées                                                */
/* ------------------------------------------------------------------ */

const explicitGoals: Record<number, number> = {
  2: 16, 3: 13, 5: 11, 6: 12, 13: 14, 17: 9, 9: 10, 34: 11, 20: 8, 30: 7, 35: 8, 54: 7, 21: 9, 23: 10, 41: 8, 55: 6, 12: 7, 25: 5,
};

function goalsFor(seed: PlayerSeed): number {
  return explicitGoals[seed.id] ?? (seed.id * 5 + 3) % 9;
}

function assistsFor(seed: PlayerSeed): number {
  return (seed.id * 3 + 2) % 7;
}

/**
 * Mémoïsation par match : les données dérivées (stats, lineups, incidents…)
 * sont générées une seule fois puis servies à l'identique.
 */
const memo = new Map<string, unknown>();
function memoized<T>(key: string, factory: () => T): T {
  if (memo.has(key)) return memo.get(key) as T;
  const value = factory();
  memo.set(key, value);
  return value;
}

function buildStats(seed: EventSeed, homeXg: number, awayXg: number): EventStats {
  const rng = seededRnd(seed.id);
  const pickIdx = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
  const rint = (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
  const rfloat = (min: number, max: number): number => min + rng() * (max - min);
  const minuteMax = seed.status === 'finished' ? 90 : Math.max(1, seed.minute ?? 45);
  const shotTypes = ['open_play', 'set_piece', 'counter', 'header', 'free_kick', 'penalty'];
  const sits = ['wide', 'blocked', 'on_target', 'off_target', 'post'];
  const bodies = ['right_foot', 'left_foot', 'head'];
  const shots: EventStats['shotmap'] = [];
  const shotCount = 12 + Math.floor(rnd() * 8);
  for (let i = 0; i < shotCount; i += 1) {
    const home = rnd() > 0.48;
    const team = home ? seed.homeTeamId : seed.awayTeamId;
    const squad = namedFirst(squadOf(team));
    const p = squad[Math.floor(rng() * squad.length)];
    const minute = rint(1, minuteMax);
    const xg = Math.round(rfloat(0.02, 0.45) * 1000) / 1000;
    shots.push({
      playerId: p?.id ?? null,
      playerName: p?.name ?? null,
      minute,
      added: minute > 45 && minute <= minuteMax && rnd() > 0.85 ? 1 : null,
      home,
      type: pickIdx(shotTypes),
      sit: pickIdx(sits),
      body: pickIdx(bodies),
      gtype: null,
      xg,
      xgot: Math.round(xg * rfloat(0.7, 1.3) * 1000) / 1000,
      xgEstimated: true,
      x: Math.round(rfloat(3, 97) * 10) / 10,
      y: Math.round(rfloat(3, 97) * 10) / 10,
    });
  }
  const momentum: EventStats['momentum'] = [];
  for (let m = 1; m <= minuteMax; m += 1) {
    momentum.push({ minute: m, value: Math.round((rnd() * 2 - 1) * 100) / 100 });
  }
  const xgPerMinute: EventStats['xgPerMinute'] = [];
  let cumHome = 0;
  let cumAway = 0;
  for (let m = 1; m <= minuteMax; m += 1) {
    const h = Math.round(rfloat(0, 0.18) * 1000) / 1000;
    const a = Math.round(rfloat(0, 0.16) * 1000) / 1000;
    cumHome += h;
    cumAway += a;
    xgPerMinute.push({ minute: m, home: h, away: a, cumHome: Math.round(cumHome * 100) / 100, cumAway: Math.round(cumAway * 100) / 100 });
  }
  const homePoss = Math.round(rfloat(38, 62) * 10) / 10;
  return {
    home: {
      possession: homePoss,
      shots: shots.filter((s) => s.home).length,
      shotsOnTarget: shots.filter((s) => s.home && s.sit === 'on_target').length,
      corners: rint(2, 11),
      fouls: rint(6, 16),
      offsides: rint(0, 5),
      yellowCards: rint(0, 3),
      redCards: rnd() > 0.9 ? 1 : 0,
      passes: rint(280, 620),
      accuratePasses: rint(200, 520),
      tackles: rint(6, 22),
      xg: Math.round(homeXg * 100) / 100,
      xgot: Math.round(homeXg * rfloat(0.85, 1.2) * 100) / 100,
      bigChances: rint(0, 4),
      saves: rint(0, 6),
    },
    away: {
      possession: Math.round((100 - homePoss) * 10) / 10,
      shots: shots.filter((s) => !s.home).length,
      shotsOnTarget: shots.filter((s) => !s.home && s.sit === 'on_target').length,
      corners: rint(1, 9),
      fouls: rint(6, 18),
      offsides: rint(0, 6),
      yellowCards: rint(0, 4),
      redCards: rnd() > 0.94 ? 1 : 0,
      passes: rint(240, 580),
      accuratePasses: rint(170, 470),
      tackles: rint(6, 24),
      xg: Math.round(awayXg * 100) / 100,
      xgot: Math.round(awayXg * rfloat(0.85, 1.2) * 100) / 100,
      bigChances: rint(0, 4),
      saves: rint(0, 7),
    },
    shotmap: shots,
    momentum,
    xgPerMinute,
    xgEstimated: true,
    averagePositions: { home: [], away: [] },
  };
}

function buildLineups(seed: EventSeed): EventLineups {
  const rng = seededRnd(seed.id);
  const pickIdx = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
  const rint = (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
  const rfloat = (min: number, max: number): number => min + rng() * (max - min);
  const confirmed = seed.status !== 'notstarted';
  const formation = '4-3-3';
  const build = (teamId: number) => {
    const squad = squadOf(teamId);
    const starters = squad.slice(0, 11).map((p, i) => ({
      id: p.id,
      name: p.name,
      shortName: p.shortName,
      position: p.position,
      jerseyNumber: p.number,
      isStarter: true,
      isCaptain: i === 0,
      subIn: null,
      subOut: null,
    }));
    const subs = squad.slice(11, 18).map((p, i) => ({
      id: p.id,
      name: p.name,
      shortName: p.shortName,
      position: p.position,
      jerseyNumber: p.number,
      isStarter: false,
      isCaptain: false,
      subIn: confirmed ? 60 + i * 4 : null,
      subOut: null,
    }));
    return { starters, subs };
  };
  const home = build(seed.homeTeamId);
  const away = build(seed.awayTeamId);
  const unavailable = squadOf(seed.homeTeamId)
    .slice(18, 20)
    .map((p) => toDomainSquadPlayer(p, 'injured', 'knee'));
  return {
    status: confirmed ? 'confirmed' : 'predicted',
    home: [...home.starters, ...home.subs],
    away: [...away.starters, ...away.subs],
    homeFormation: formation,
    awayFormation: '4-2-3-1',
    unavailable,
    updatedAt: new Date(seed.date.getTime() - 3600000).toISOString(),
  };
}

function buildIncidents(seed: EventSeed): Incident[] {
  const rng = seededRnd(seed.id);
  const pickIdx = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
  const rint = (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
  const rfloat = (min: number, max: number): number => min + rng() * (max - min);
  const out: Incident[] = [];
  const minuteMax = seed.status === 'finished' ? 90 : Math.max(1, seed.minute ?? 45);
  const scoreFor = (home: boolean): number => {
    const scored = home ? seed.homeScore ?? 0 : seed.awayScore ?? 0;
    let count = 0;
    for (const i of out) {
      if (i.type === 'goal' && i.isHome === home) count += 1;
    }
    return count < scored ? 1 : 0;
  };
  // On privilégie les joueurs nommés du catalogue (ids <= 60) pour les buts.
  const homeSquad = namedFirst(squadOf(seed.homeTeamId));
  const awaySquad = namedFirst(squadOf(seed.awayTeamId));
  for (let minute = 3; minute <= minuteMax; minute += rint(4, 12)) {
    const isHome = rnd() > 0.48;
    const squad = isHome ? homeSquad : awaySquad;
    const scorer = squad[Math.floor(rnd() * squad.length)];
    const assister = squad[Math.floor(rnd() * squad.length)];
    if (scoreFor(isHome) === 1) {
      out.push({
        type: 'goal',
        player: scorer?.name ?? null,
        minute,
        isHome,
        assist: assister?.name ?? null,
        reason: null,
      });
    } else if (rnd() > 0.82) {
      out.push({
        type: 'yellow_card',
        player: scorer?.name ?? null,
        minute,
        isHome,
        assist: null,
        reason: 'Faute tactique',
      });
    } else if (rnd() > 0.95) {
      out.push({
        type: 'substitution',
        player: assister?.name ?? null,
        minute,
        isHome,
        assist: scorer?.name ?? null,
        reason: 'Remplacement',
      });
    }
  }
  return out;
}

function buildCommentary(seed: EventSeed): CommentaryLine[] {
  const rng = seededRnd(seed.id);
  const pickIdx = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
  const rint = (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
  const rfloat = (min: number, max: number): number => min + rng() * (max - min);
  const incidents = buildIncidents(seed);
  const lines: CommentaryLine[] = [];
  let id = 1;
  const homeName = teamById.get(seed.homeTeamId)?.name ?? '';
  const awayName = teamById.get(seed.awayTeamId)?.name ?? '';
  let scoreHome = 0;
  let scoreAway = 0;
  const push = (
    minute: number,
    type: string,
    team: string,
    player: string | null,
    text: string,
    important: boolean,
    relatedPlayer: string | null = null,
  ): void => {
    lines.push({
      id: String(id++),
      minute,
      addedTime: null,
      type,
      team,
      player,
      relatedPlayer,
      text,
      score: `${scoreHome} - ${scoreAway}`,
      important,
    });
  };
  push(1, 'kickoff', homeName, null, 'Coup d’envoi de la rencontre.', true);
  for (const inc of incidents) {
    if (inc.type === 'goal') {
      if (inc.isHome) scoreHome += 1;
      else scoreAway += 1;
      push(
        inc.minute ?? 0,
        'goal',
        inc.isHome ? homeName : awayName,
        inc.player,
        `But de ${inc.player}${inc.assist ? `, assists par ${inc.assist}` : ''}.`,
        true,
        inc.assist,
      );
    } else if (inc.type === 'yellow_card') {
      push(
        inc.minute ?? 0,
        'yellow_card',
        inc.isHome ? homeName : awayName,
        inc.player,
        `Carton jaune pour ${inc.player}.`,
        false,
      );
    } else if (inc.type === 'substitution') {
      push(
        inc.minute ?? 0,
        'substitution',
        inc.isHome ? homeName : awayName,
        inc.player,
        `Changement : ${inc.player} entre en jeu.`,
        false,
        inc.assist,
      );
    }
  }
  if (seed.status === 'finished') {
    push(90, 'fulltime', homeName, null, 'Fin du match.', true);
  } else {
    push(seed.minute ?? 45, 'live', homeName, null, 'Le match est toujours en cours.', false);
  }
  return lines;
}

function buildH2H(seed: EventSeed): H2H {
  const rng = seededRnd(seed.id);
  const pickIdx = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
  const rint = (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
  const rfloat = (min: number, max: number): number => min + rng() * (max - min);
  const recent: H2HMatch[] = [];
  const opponents = eventSeeds
    .filter(
      (e) =>
        e.id !== seed.id &&
        e.status === 'finished' &&
        ((e.homeTeamId === seed.homeTeamId && e.awayTeamId === seed.awayTeamId) ||
          (e.homeTeamId === seed.awayTeamId && e.awayTeamId === seed.homeTeamId)),
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const pool = opponents.length >= 4 ? opponents : eventSeeds.filter((e) => e.id !== seed.id && e.status === 'finished').slice(0, 5);
  for (const ev of pool.slice(0, 5)) {
    const homeName = teamById.get(ev.homeTeamId)?.name ?? '';
    const awayName = teamById.get(ev.awayTeamId)?.name ?? '';
    recent.push({
      eventId: ev.id,
      date: ev.date.toISOString(),
      home: homeName,
      away: awayName,
      score: `${ev.homeScore ?? 0} - ${ev.awayScore ?? 0}`,
      homeTeamId: ev.homeTeamId,
      awayTeamId: ev.awayTeamId,
    });
  }
  const totalMatches = Math.max(recent.length, 8);
  const homeWins = Math.round(totalMatches * 0.45);
  const awayWins = Math.round(totalMatches * 0.3);
  const draws = Math.max(0, totalMatches - homeWins - awayWins);
  const homeGoals = recent.reduce((acc, m) => acc + Number(m.score.split(' - ')[0] ?? 0), 0);
  const awayGoals = recent.reduce((acc, m) => acc + Number(m.score.split(' - ')[1] ?? 0), 0);
  return {
    totalMatches,
    homeWins,
    draws,
    awayWins,
    homeGoals,
    awayGoals,
    avgTotalGoals: recent.length ? Math.round(((homeGoals + awayGoals) / recent.length) * 100) / 100 : null,
    homeWinRate: Math.round((homeWins / totalMatches) * 100) / 100,
    awayWinRate: Math.round((awayWins / totalMatches) * 100) / 100,
    recentMatches: recent,
  };
}

function buildOdds(seed: EventSeed): EventOdds | null {
  const rng = seededRnd(seed.id);
  const pickIdx = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
  const rint = (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
  const rfloat = (min: number, max: number): number => min + rng() * (max - min);
  if (seed.status === 'notstarted') return null;
  const homeProb = Math.round(rfloat(0.26, 0.52) * 100) / 100;
  const drawProb = Math.round(rfloat(0.2, 0.3) * 100) / 100;
  const awayProb = Math.round((1 - homeProb - drawProb) * 100) / 100;
  const dec = (p: number): number => Math.round((1 / p) * 100) / 100;
  const overProb = Math.round(rfloat(0.45, 0.62) * 100) / 100;
  const bttsProb = Math.round(rfloat(0.42, 0.62) * 100) / 100;
  const updated = new Date(now.getTime() - 4 * 60000).toISOString();
  return {
    markets: [
      {
        market: '1x2',
        label: 'Résultat du match',
        line: null,
        outcomes: [
          { outcome: 'HOME', label: 'Équipe à domicile', decimal: dec(homeProb), implied: homeProb, movement: 'down' },
          { outcome: 'DRAW', label: 'Match nul', decimal: dec(drawProb), implied: drawProb, movement: 'up' },
          { outcome: 'AWAY', label: 'Équipe à l’extérieur', decimal: dec(awayProb), implied: awayProb, movement: 'stable' },
        ],
      },
      {
        market: 'over_under_25',
        label: 'Plus ou moins 2,5 buts',
        line: 2.5,
        outcomes: [
          { outcome: 'over', label: 'Plus de 2,5 buts', decimal: dec(overProb), implied: overProb, movement: 'stable' },
          { outcome: 'under', label: 'Moins de 2,5 buts', decimal: dec(1 - overProb), implied: Math.round((1 - overProb) * 100) / 100, movement: 'up' },
        ],
      },
      {
        market: 'btts',
        label: 'Les deux équipes marquent',
        line: null,
        outcomes: [
          { outcome: 'yes', label: 'Oui', decimal: dec(bttsProb), implied: bttsProb, movement: 'down' },
          { outcome: 'no', label: 'Non', decimal: dec(1 - bttsProb), implied: Math.round((1 - bttsProb) * 100) / 100, movement: 'up' },
        ],
      },
    ],
    lastUpdateAt: updated,
    nextUpdateAt: new Date(now.getTime() + 3 * 60000).toISOString(),
    updateIntervalSeconds: 180,
    bookmakersCount: 14,
  };
}

function buildPrediction(seed: EventSeed): Prediction | null {
  const rng = seededRnd(seed.id);
  const pickIdx = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
  const rint = (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
  const rfloat = (min: number, max: number): number => min + rng() * (max - min);
  const homeProb = Math.round(rfloat(0.28, 0.5) * 100) / 100;
  const drawProb = Math.round(rfloat(0.2, 0.3) * 100) / 100;
  const awayProb = Math.round((1 - homeProb - drawProb) * 100) / 100;
  const top = Math.max(homeProb, drawProb, awayProb);
  const topOutcome = top === homeProb ? 'HOME' : top === drawProb ? 'DRAW' : 'AWAY';
  const expHome = Math.round(rfloat(0.9, 2.1) * 100) / 100;
  const expAway = Math.round(rfloat(0.7, 1.8) * 100) / 100;
  return {
    id: seed.id * 100,
    eventId: seed.id,
    homeTeam: teamById.get(seed.homeTeamId)?.name ?? null,
    awayTeam: teamById.get(seed.awayTeamId)?.name ?? null,
    homeTeamId: seed.homeTeamId,
    awayTeamId: seed.awayTeamId,
    leagueName: leagueNameOf(seed.leagueId),
    date: seed.date,
    homeProb,
    drawProb,
    awayProb,
    topOutcome,
    topProbability: top,
    expectedHomeGoals: expHome,
    expectedAwayGoals: expAway,
    over25: Math.round(rfloat(0.42, 0.6) * 100) / 100,
    btts: Math.round(rfloat(0.4, 0.62) * 100) / 100,
    score: `${Math.floor(expHome)} - ${Math.floor(expAway)}`,
    model: 'kickoff-catboost-v3',
    updatedAt: new Date(now.getTime() - 30 * 60000).toISOString(),
  };
}

function buildPlayerStats(seed: EventSeed): PlayerStat[] {
  const rng = seededRnd(seed.id);
  const pickIdx = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
  const rint = (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
  const rfloat = (min: number, max: number): number => min + rng() * (max - min);
  const out: PlayerStat[] = [];
  for (const teamId of [seed.homeTeamId, seed.awayTeamId]) {
    const squad = squadOf(teamId);
    for (let i = 0; i < squad.length; i += 1) {
      const p = squad[i];
      const isStarter = i < 11;
      const minutesPlayed = seed.status === 'finished' ? (isStarter ? 90 : i < 14 ? rint(8, 30) : 0) : isStarter ? 90 : 0;
      out.push({
        playerId: p.id,
        teamId,
        minutesPlayed,
        rating: minutesPlayed === 0 ? null : Math.round(rfloat(5.9, 9.4) * 10) / 10,
        goals: isStarter && rnd() > 0.86 ? 1 : 0,
        assists: isStarter && rnd() > 0.9 ? 1 : 0,
        xg: minutesPlayed === 0 ? 0 : Math.round(rfloat(0, 0.42) * 100) / 100,
        xa: minutesPlayed === 0 ? 0 : Math.round(rfloat(0, 0.28) * 100) / 100,
        shots: minutesPlayed === 0 ? 0 : rint(0, 4),
        shotsOnTarget: minutesPlayed === 0 ? 0 : rint(0, 2),
        passes: minutesPlayed === 0 ? 0 : rint(12, 76),
        accuratePasses: minutesPlayed === 0 ? 0 : rint(8, 62),
        tackles: minutesPlayed === 0 ? 0 : rint(0, 6),
        duelsWon: minutesPlayed === 0 ? 0 : rint(0, 11),
        duelsLost: minutesPlayed === 0 ? 0 : rint(0, 8),
        yellowCards: minutesPlayed === 0 ? 0 : rnd() > 0.85 ? 1 : 0,
        redCards: 0,
        saves: p.position === 'G' ? rint(0, 7) : 0,
        bigChances: minutesPlayed === 0 ? 0 : rint(0, 3),
        bigChancesMissed: minutesPlayed === 0 ? 0 : rint(0, 2),
        progressivePasses: minutesPlayed === 0 ? 0 : rint(0, 14),
        aerialWon: minutesPlayed === 0 ? 0 : rint(0, 9),
        aerialLost: minutesPlayed === 0 ? 0 : rint(0, 6),
      });
    }
  }
  return out;
}

function buildTransfers(): Transfer[] {
  const specs: Array<[number, number, number, string | null]> = [
    [2, 12, 90000000, 'Transfert définitif'],
    [6, 3, 65000000, 'Transfert définitif'],
    [17, 9, 55000000, 'Transfert définitif'],
    [21, 14, 40000000, 'Prêt avec option d’achat'],
    [23, 26, 32000000, 'Transfert définitif'],
    [30, 18, 28000000, 'Transfert définitif'],
    [35, 16, 24000000, 'Transfert définitif'],
    [54, 38, 22000000, 'Transfert définitif'],
    [45, 11, 0, 'Prêt'],
    [49, 37, 18000000, 'Transfert définitif'],
    [57, 29, 15000000, 'Transfert définitif'],
    [58, 20, 12000000, 'Transfert définitif'],
  ];
  return specs.map(([playerId, toTeamId, fee, kind], i) => {
    const player = playerById.get(playerId);
    const to = teamById.get(toTeamId);
    const from = player ? teamById.get(player.teamId) : undefined;
    return {
      id: 500 + i,
      date: new Date(now.getTime() - (120 - i * 9) * DAY).toISOString().slice(0, 10),
      playerId,
      playerName: player?.name ?? null,
      fromTeamId: from?.id ?? null,
      fromTeamName: from?.name ?? 'Club sans contrat',
      toTeamId,
      toTeamName: to?.name ?? '',
      feeEur: fee === 0 ? null : fee,
      feeDescription: fee === 0 ? kind ?? 'Prêt' : `${kind} (${Math.round(fee / 1_000_000)} M€)`,
    };
  });
}

export default mock;
