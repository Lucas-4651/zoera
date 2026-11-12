# CONTRAT TECHNIQUE — App football « Zoera » (Node.js + Express + Tailwind CSS)

Source de données : **Bzzoiro Sports Data (BSD)** — API football v2, gratuite.
Référence API complète (extraite du schéma OpenAPI) : `docs/bsd-api-reference.md`.
Les deux documents sont normatifs : le code doit respecter ces signatures.

---

## 1. Stack (imposé)

| Élément | Choix |
|---|---|
| Runtime | Node.js 22 |
| Serveur | **Express 4** (TypeScript, CommonJS) |
| Front | **Templates EJS** servis par Express + **Tailwind CSS v4** compilé par le CLI Tailwind (`@tailwindcss/cli`) |
| Client | TypeScript compilé en modules ES natifs dans `public/js/` — **pas de bundler, pas de framework SPA** |
| Icônes | SVG inline maison (pas de dépendance icône) ou caractères Unicode sparingly — *aucune dépendance npm supplémentaire* |
| Cache | TTL cache maison, mémoire + disque (`CACHE_DIR`), avec *single-flight* |
| Data | Serveur uniquement : la clé API n'est **jamais** exposée au navigateur |

Dépendances npm (liste fermée) :
`runtime` : express, ejs — `dev` : typescript, @types/{node,express,ejs}, tsx, tailwindcss, @tailwindcss/cli.

Arborescence cible :

```
server/
  index.ts                 # bootstrap express
  config.ts                # env, port, chemins
  lib/
    format.ts              # helpers d'affichage FR
    utils.ts               # cn(), escaping, slug, divers
    bsd/
      client.ts            # fetch BSD + erreurs + quota + images
      cache.ts             # cache TTL disque+mémoire, single-flight
      types.ts             # types domaine
      endpoints.ts         # fonctions typées par ressource
      mock.ts              # jeu de données démo cohérent
  routes/
    api.ts                 # /api/*
    pages.ts               # contrôleurs de pages + view models
  views/                   # EJS (propriété du designer)
    layout.ejs, partials/*, *.ejs
client/
  styles/app.css           # source Tailwind (@source explicites)
  js/*.ts                  # interactions (polling live, onglets, filtres, recherche, favoris)
public/
  css/app.css              # généré
  js/*.js                  # généré
```

---

## 2. Configuration (`.env`)

```
PORT=3000
BSD_API_KEY=               # vide => MODE DÉMO
BSD_BASE_URL=https://sports.bzzoiro.com/api/v2
CACHE_DIR=./.cache
```

- Chargement : `node --env-file=.env` (Node 22 natif) ou `dotenv` non autorisé → utiliser `process.loadEnvFile?.('.env')` dans `server/config.ts` avec try/catch. Aucun crash si le fichier est absent.
- **Mode démo** : si `BSD_API_KEY` est absent → `config.isDemo === true`, toutes les fonctions de `endpoints.ts` renvoient les données de `mock.ts`, et l'interface affiche un badge « MODE DÉMO ».

---

## 3. API BSD : appel, erreurs, quota, cache

En-tête : `Authorization: Token <BSD_API_KEY>`.

| Code | Comportement |
|---|---|
| 400 | Paramètre non supporté → **bug applicatif**, ne jamais l'envoyer. Les fonctions de `endpoints.ts` whitelistent les paramètres. |
| 401 | Clé absente/invalide → message + lien `/register/` ; ne pas planter. |
| 402 | Add-on payant (ex. `/events/{id}/odds/comparison/`) → section masquée. |
| 403 | `bookmakers_not_entitled` → masquer la comparaison bookmakers. |
| 404 | Ressource absente → `null` (la page rend un état « introuvable »). |
| 429 `rate_limited` | burst IP → rejouer **une fois** après `Retry-After` (1 s). |
| 429 `taster_exhausted` | quota 7 500/j épuisé → **ne pas réessayer** avant le reset ; remonter une erreur claire. |
| 503 | Modèle/prédiction HS → bloc indisponible, page intacte. |

Enveloppe d'erreur : `{ "error": true, "status": 404, "detail": "..." }`.

**Quota gratuit : 7 500 req/jour** (reset minuit UTC), burst 25 req/s sur `/events/`, `/events/live/`, `/leagues/`, `/teams/`, `/predictions/`.
Les réponses portent `RateLimit-Policy: "football";q=7500;w=86400` et `RateLimit: "football";r=<restant>;t=<s>`.
→ Le serveur doit **tracker le quota** et l'exposer (`/api/quota`), et **ne jamais dépasser** le quota : tout passe par le cache TTL.

**Politique de cache TTL (secondes)** — implémentée dans `endpoints.ts` :

| Ressource | TTL | | Ressource | TTL |
|---|---|---|---|---|
| `/events/live/` | 15 | | `/events/{id}/standings` | 900 |
| `/events/` (calendrier) | 300 | | `/leagues/{id}/top/{stat}/` | 900 |
| `/events/{id}/` | 60 | | `/leagues/{id}/bestxi/{season}/` | 3600 |
| `/events/{id}/stats/` | 120 | | `/teams/{id}/squad/` | 3600 |
| `/events/{id}/lineups/` | 300 | | `/teams/{id}/form/` | 1800 |
| `/events/{id}/incidents/` | 60 | | `/teams/`, `/players/` | 3600 |
| `/events/{id}/commentary/` | 30 (live) / 1800 (fini) | | `/leagues/` | 3600 |
| `/events/{id}/h2h/` | 3600 | | `/predictions/` | 300 |
| `/events/{id}/odds/` | 180 | | `/odds/best/` | 300 |
| `/events/{id}/prediction/` | 300 | | `/transfers/` | 1800 |
| `/events/{id}/availability/` | 300 | | `/tv-channels/`, `/broadcasts/` | 3600 |
| `/events/{id}/player-stats/` | 300 | | `/coverage/` | 3600 |

Règles :
- Clé de cache = `METHOD path?sortedQuery` ; le TTL dépend de l'URL.
- Single-flight : deux requêtes simultanées identiques = 1 appel réseau.
- Le cache disque (`CACHE_DIR`) survit aux redémarrages ; fichier = JSON `{ storedAt, ttl, data }`.
- Purge automatique des entrées expirées (au moins une fois par heure).
- Polling live navigateur : intervalle **15 s** minimum, pause quand l'onglet est caché (`visibilitychange`), backoff ×2 sur erreur réseau jusqu'à 60 s.

**Images** (Image API BSD, gratuite, sans auth) :
`https://sports.bzzoiro.com/img/team/{id}/`, `/img/league/{id}/`, `/img/player/{id}/?sor=true`, `/img/venue/{id}/`, `/img/manager/{id}/`.
Image absente → **204** (pas 404) → fallback visuel obligatoire (initiales sur pastille colorée).

### 3.1 Comportements constatés sur l'API réelle (à respecter dans les mappers)

| Constat | Conséquence |
|---|---|
| La base URL contient déjà `/api/v2` | Les endpoints doivent être résolus **relativement** à la base, sinon la requête part à la racine et reçoit du HTML. |
| `/events/{id}/player-stats/` → `{ event_id, count, player_stats }` | La liste est sous `player_stats`, pas sous `results`. |
| Compteurs d'équipe : `ball_possession`, `total_shots`, `corner_kicks` | Le mapper accepte les deux conventions (`possession`/`ball_possession`…). |
| Momentum `{ m, v }`, tirs `{ min, pos { x, y } }`, xG/min `{ m, xg_home }` | Les mappers acceptent les noms courts **et** longs. |
| Probabilités de prédiction en pourcentage (44,1) | Le mapper ramène en 0–1 (invariant du domaine). |
| `/odds/best/` → **403** `bookmakers_not_entitled` | Repli sur `/odds/` (consensus gratuit, qui donne aussi le nombre de bookmakers). |
| `/events/{id}/odds/comparison/` → **403** | Comparaison bookmaker masquée ; le consensus `/events/{id}/odds/` reste affiché. |
| `lineup_status` ∈ confirmed/predicted/unavailable, `lineups.home.players` + `.substitutes`, `unavailable_players` = `{ home, away }` | Compositions titulaires **et** remplaçants ; absents par camp. |
| `lineup` du Best XI = objet `{ G: [...], D: [...], M: [...], F: [...] }` | Chaque position peut avoir plusieurs joueurs. |
| `form.overall` = `{ won, drawn, lost, form, points_per_match, stats }` et `stats[k] = { average, total, matches }` | Le mapper prend `average`. |
| Limite de rafale : 25 req/s par IP | Le client sérialise les appels (6 en concurrence max). |

---

## 4. Enveloppes de réponse (pièges)

| Endpoint | Enveloppe |
|---|---|
| `/events/`, `/leagues/`, `/teams/`, `/players/`, `/odds/`, `/predictions/`, `/transfers/` | `{ count, next, previous, results: [...] }` (limit/offset, défaut 50, max 200) |
| `/events/live/` | `{ count, events: [...] }` ⚠️ **pas** `results` |
| `/events/{id}/stats/` | `{ event_id, stats, xg_estimated, shotmap, momentum, average_positions, xg_per_minute }` |
| `/events/{id}/lineups/` | `{ event_id, lineup_status: confirmed\|predicted\|unavailable, beta, lineups, unavailable_players, updated_at }` |
| `/events/{id}/incidents/` | `{ event_id, incidents: [{ type, player, minute, is_home, assist, reason }] }` |
| `/events/{id}/commentary/` | `{ event_id, status, has_play_by_play, commentary: [{ id, minute, added_time, type, team, player, related_player, text, score, important }] }` |
| `/events/{id}/h2h/` | `{ total_matches, home_wins, draws, away_wins, home_goals, away_goals, avg_total_goals, home_win_rate, away_win_rate, recent_matches }` |
| `/events/{id}/odds/` | `{ event_id, odds, last_update_at, last_change_at, next_update_at, update_interval_seconds, update_reason }` |
| `/events/{id}/prediction/` | `{ id, created_at, updated_at, event, markets, recommendations, model }` |
| `/events/{id}/availability/` | `{ event_id, status, lineup_status, available, stat_keys, odds_markets }` |
| `/events/{id}/player-stats/` | `{ event_id, count, player_stats: [PlayerStatV2Schema] }` |
| `/leagues/{id}/standings/` | `{ league_id, season, grouped, standings: [...] }` **ou** `groups: { A: [...] }` |
| `/leagues/{id}/top/{stat}/` | `{ league_id, team_id, season, stat, label, leaders: [...] }` |
| `/leagues/{id}/seasons/` | `{ league_id, count, seasons: [...] }` |
| `/teams/{id}/squad/` | `{ team_id, count, players: [SquadPlayerV2] }` |
| `/teams/{id}/form/` | `{ team_id, team_name, requested, matches, overall, home, away, vs_stronger, vs_weaker }` |
| `/predictions/` | `{ count, next, previous, results: [...] }` |

Paramètres acceptés (liste blanche stricte — un paramètre inconnu = 400) :
`/events/` : `date_from, date_to, league_id, season_id, stage, round, status, team_id, team_name, limit, offset` ·
`/events/live/` : `league_id, season_id, team_id, limit, offset` ·
`/leagues/` : `country, is_women, include_inactive, limit, offset` ·
`/teams/` : `country_code, league_id, season_id, name, in_competition, is_women, limit, offset` ·
`/players/` : `name, team_id, national_team_id, nationality_code, position, limit, offset` ·
`/leagues/{id}/standings/` : `season_id` ·
`/leagues/{id}/top/{stat}/` : `stat` (scorers|assists|yellowcards|redcards|fouls), `season_id, team_id, limit` ·
`/events/{id}/commentary/` : `order` (asc|desc), `since` ·
`/events/{id}/broadcasts/` : `country_code, limit, offset` ·
`/odds/best/` : `market, date_from, date_to, league_id, season_id, team_id, limit, offset` ·
`/transfers/` : `league_id, team_id, player_id, from_team_id, to_team_id, date_from, date_to, has_fee, min_fee, ordering, limit, offset`.

---

## 5. Statuts → libellés FR

Statuts réels v2 : `notstarted`, `delayed`, `inprogress`, `penalties`, `finished`, `postponed`, `cancelled`, `unresolved` (+ `live`, `upcoming` tolérés).
L'API utilise **aussi les périodes comme statuts** pendant un match : `1st_half`, `2nd_half`, `halftime`, `extra_time` (avec `period` = `1T`/`2T`/`FT`).
`period` : `1st_half`, `halftime`, `2nd_half`, `extra_time`, `FT`.

| Statut | Label FR |
|---|---|
| notstarted / upcoming | À venir |
| inprogress / live | En direct |
| delayed | Retard |
| halftime | Mi-temps |
| penalties | Sép. des penalties |
| 1st_half | 1re période |
| 2nd_half | 2e période |
| extra_time | Prolongations |
| finished | Terminé |
| postponed | Reporté |
| cancelled | Annulé |
| unresolved | Non joué |

`isLive(status)` ⇒ `status ∈ {inprogress, live, delayed, penalties, halftime}`.

---

## 6. Interface publique de `server/lib/bsd/endpoints.ts` (normative)

Toutes les fonctions sont `async`, renvoient des objets **domaine normalisés** (jamais la réponse brute de l'API), et sont mises en cache selon §3.

```ts
// --- événements
getLiveEvents(opts?: { leagueId?: number; teamId?: number }): Promise<LiveEvent[]>
getFixtures(opts: { dateFrom: string; dateTo: string; leagueId?: number; limit?: number }): Promise<FootballEvent[]>
getEvent(id: number): Promise<FootballEvent | null>
getEventStats(id: number): Promise<EventStats | null>
getEventLineups(id: number): Promise<EventLineups | null>
getEventIncidents(id: number): Promise<Incident[]>
getEventCommentary(id: number): Promise<CommentaryLine[]>
getEventH2H(id: number): Promise<H2H | null>
getEventOdds(id: number): Promise<EventOdds | null>
getEventPrediction(id: number): Promise<Prediction | null>
getEventAvailability(id: number): Promise<Availability | null>
getEventPlayerStats(id: number): Promise<PlayerStat[]>
// --- compétitions
getLeagues(opts?: { country?: string; isWomen?: boolean }): Promise<League[]>
getLeague(id: number): Promise<League | null>
getLeagueSeasons(id: number): Promise<Season[]>
getStandings(leagueId: number, seasonId?: number): Promise<StandingsResult>
getTopScorers(leagueId: number, opts?: { stat?: string; seasonId?: number; limit?: number }): Promise<LeaderboardEntry[]>
getBestXI(leagueId: number, seasonId: number, round?: number): Promise<BestXI | null>
// --- clubs
getTeams(opts?: { leagueId?: number; name?: string; countryCode?: string; limit?: number }): Promise<Team[]>
getTeam(id: number): Promise<Team | null>
getTeamSquad(id: number): Promise<SquadPlayer[]>
getTeamForm(id: number, opts?: { last?: number; leagueId?: number }): Promise<TeamForm | null>
getTeamFixtures(id: number, opts?: { dateFrom?: string; dateTo?: string }): Promise<FootballEvent[]>
// --- joueurs
getPlayers(opts?: { name?: string; teamId?: number; position?: string; limit?: number }): Promise<Player[]>
getPlayer(id: number): Promise<Player | null>
getPlayerStats(id: number, opts?: { seasonId?: number; limit?: number }): Promise<PlayerStat[]>
getPlayerTransfers(id: number): Promise<Transfer[]>
// --- marché & divers
getPredictions(opts?: { dateFrom?: string; dateTo?: string; leagueId?: number; limit?: number }): Promise<Prediction[]>
getBestOdds(opts?: { market?: string; dateFrom?: string; dateTo?: string; limit?: number }): Promise<BestOddsRow[]>
getTransfers(opts?: { leagueId?: number; teamId?: number; ordering?: string; limit?: number }): Promise<Transfer[]>
getBroadcasts(opts?: { dateFrom?: string; dateTo?: string; countryCode?: string }): Promise<Broadcast[]>
getCoverage(): Promise<Coverage | null>
```

**Formes des objets domaine** (fichier `server/lib/bsd/types.ts`) :

```ts
type MatchStatus = 'notstarted'|'inprogress'|'delayed'|'penalties'|'finished'
  |'postponed'|'cancelled'|'unresolved'|'upcoming'|'live'|'halftime'|'unknown';

interface FootballEvent { id:number; leagueId:number; leagueName?:string; seasonId:number|null;
  homeTeamId:number; homeTeam:string; awayTeamId:number; awayTeam:string;
  date:Date; status:MatchStatus; period?:string|null; minute:number|null;
  homeScore:number|null; awayScore:number|null; homeScoreHt:number|null; awayScoreHt:number|null;
  penaltyShootout:{home:number;away:number}|null; extraTime:{home:number;away:number}|null;
  roundLabel?:string|null; stage?:string|null; roundNumber?:number|null; venueId?:number|null;
  refereeId?:number|null; attendance?:number|null; isLocalDerby?:boolean; highlights:Highlight[]; isLive:boolean }

interface LiveEvent extends FootballEvent { leagueName:string; lastUpdated:string|null }

interface League { id:number; name:string; country:string; isWomen:boolean; isActive:boolean;
  currentSeason:Season|null; logoUrl:string|null }
interface Season { id:number; name:string; year:number|null; isCurrent:boolean;
  startDate:string|null; endDate:string|null }
interface Team { id:number; name:string; shortName:string; country:string; countryCode:string;
  venueId:number|null; logoUrl:string|null }
interface Standing { position:number; teamId:number|null; teamName:string; played:number; won:number;
  drawn:number; lost:number; gf:number; ga:number; gd:number; pts:number;
  xgf:number|null; xga:number|null; xgd:number|null; xgGames:number|null; form:string;
  live:boolean; zone:string|null }
interface StandingsResult { grouped:boolean; groups:Record<string,Standing[]>; flat:Standing[];
  season:Season|null; leagueId:number }
interface LeaderboardEntry { rank:number; playerId:number; playerName:string; position:string;
  teamId:number; teamName:string; value:number; matches:number }
interface Player { id:number; name:string; shortName:string|null; position:string;
  specificPosition:string|null; jerseyNumber:number|null; dateOfBirth:string|null;
  heightCm:number|null; weightKg:number|null; nationality:string|null;
  currentTeamId:number|null; currentTeamName:string|null; marketValueEur:number|null;
  availability:string|null; injuryType:string|null; rating:number|null;
  photoUrl:string|null; strengths:string[]; weaknesses:string[] }
interface SquadPlayer { id:number; name:string; shortName:string; position:string;
  jerseyNumber:number|null; nationality:string; dateOfBirth:string|null;
  availability:string; injuryType:string; injuryExpectedReturn:string|null; photoUrl:string|null }
interface PlayerStat { playerId:number; teamId:number; minutesPlayed:number; rating:number|null;
  goals:number; assists:number; xg:number|null; xa:number|null; shots:number; shotsOnTarget:number;
  passes:number; accuratePasses:number; tackles:number; duelsWon:number; duelsLost:number;
  yellowCards:number; redCards:number; saves:number; bigChances:number; bigChancesMissed:number;
  progressivePasses:number|null; aerialWon:number|null; aerialLost:number|null }
interface EventStats { home:TeamStats; away:TeamStats; shotmap:Shot[]; momentum:MomentumPoint[];
  xgPerMinute:XgMinute[]; xgEstimated:boolean; averagePositions:unknown }
interface TeamStats { possession:number|null; shots:number|null; shotsOnTarget:number|null;
  corners:number|null; fouls:number|null; offsides:number|null; yellowCards:number|null;
  redCards:number|null; passes:number|null; accuratePasses:number|null; tackles:number|null;
  xg:number|null; xgot:number|null; bigChances:number|null; saves:number|null }
interface Shot { playerId:number|null; playerName?:string|null; minute:number; added:number|null;
  home:boolean; type:string; sit:string; body:string; gtype:string|null; xg:number|null;
  xgot:number|null; xgEstimated:boolean|null; x:number|null; y:number|null }
interface MomentumPoint { minute:number; value:number }
interface XgMinute { minute:number; home:number; away:number; cumHome:number; cumAway:number }
interface EventLineups { status:'confirmed'|'predicted'|'unavailable'; home:LineupPlayer[];
  away:LineupPlayer[]; homeFormation:string|null; awayFormation:string|null;
  unavailable:SquadPlayer[]; updatedAt:string|null }
interface LineupPlayer { id:number; name:string; shortName:string; position:string;
  jerseyNumber:number|null; isStarter:boolean; isCaptain:boolean; subIn:number|null; subOut:number|null }
interface Incident { type:string; player:string|null; minute:number|null; isHome:boolean;
  assist:string|null; reason:string|null }
interface CommentaryLine { id:string; minute:number; addedTime:number|null; type:string; team:string;
  player:string|null; relatedPlayer:string|null; text:string; score:string|null; important:boolean }
interface H2H { totalMatches:number; homeWins:number; draws:number; awayWins:number;
  homeGoals:number; awayGoals:number; avgTotalGoals:number|null; homeWinRate:number|null;
  awayWinRate:number|null; recentMatches:H2HMatch[] }
interface H2HMatch { eventId:number|null; date:string; home:string; away:string; score:string;
  homeTeamId:number|null; awayTeamId:number|null }
interface EventOdds { markets:OddsMarket[]; lastUpdateAt:string|null; nextUpdateAt:string|null;
  updateIntervalSeconds:number|null; bookmakersCount:number }
interface OddsMarket { market:string; label:string; line:number|null; outcomes:OddsOutcome[] }
interface OddsOutcome { outcome:string; label:string; decimal:number|null; implied:number|null;
  movement:string|null }
interface Prediction { id:number; eventId:number|null; homeTeam:string|null; awayTeam:string|null;
  leagueName:string|null; date:Date|null; homeProb:number|null; drawProb:number|null;
  awayProb:number|null; topOutcome:string|null; topProbability:number|null;
  expectedHomeGoals:number|null; expectedAwayGoals:number|null; over25:number|null;
  btts:number|null; score:string|null; model:string|null; updatedAt:string|null }
interface Availability { eventId:number; status:string; lineupStatus:string;
  available:Record<string,boolean>; statKeys:string[]; oddsMarkets:string[] }
interface BestOddsRow { eventId:number; date:Date; leagueId:number; leagueName:string;
  homeTeam:string; awayTeam:string; market:string; outcomes:{ outcome:string; label:string;
  decimal:number|null; implied:number|null }[] }
interface Transfer { id:number; date:string|null; playerId:number|null; playerName:string|null;
  fromTeamId:number|null; fromTeamName:string; toTeamId:number|null; toTeamName:string;
  feeEur:number|null; feeDescription:string }
interface Broadcast { id:number; eventId:number; leagueName:string|null; homeTeam:string;
  awayTeam:string; date:Date; countryCode:string; channelName:string; channelLink:string;
  scheduledStart:Date|null }
interface Coverage { generatedAt:string; sports:{ sport:string; name:string; status:string;
  eventsNext7d:number; liveNow:number; nextEventAt:string|null }[] }
interface Highlight { kind:string; title:string; url:string; thumbnail:string|null; publishedAt:string }
interface TeamForm { teamId:number; teamName:string; matches:number; requested:number;
  overall:FormSplit|null; home:FormSplit|null; away:FormSplit|null }
interface FormSplit { results:string|null; wins:number|null; draws:number|null; losses:number|null;
  goalsFor:number|null; goalsAgainst:number|null; pointsPerMatch:number|null; stats:Record<string,number|null> }
interface BestXI { formation:string|null; lineup:{ position:string; player:Player|null; rating:number|null }[] }
```

---

## 6.1 `server/lib/format.ts` — API exacte (exposée aux templates via le local `fmt`)

```ts
fmt.date(d: Date|string|null, opts?: { withTime?: boolean }): string   // "10 nov. 2026" / "10 nov. 2026 · 20:00"
fmt.time(d: Date|string|null): string                                   // "20:00" (Europe/Paris)
fmt.dayLabel(d: Date|string|null): string                               // "aujourd'hui" | "demain" | "hier" | "lun. 10 nov."
fmt.relative(d: Date|string|null): string                               // "il y a 3 min" | "dans 2 h"
fmt.status(status: string): { label: string; tone: 'live'|'done'|'upcoming'|'alert'|'muted'; live: boolean }
fmt.period(period: string|null): string                                 // "1re période", "Mi-temps", "2e période", "Prolongations"
fmt.number(n: number|null|undefined, opts?: { decimals?: number }): string   // "1 234" (espace insécable fine, format fr-FR)
fmt.eur(n: number|null|undefined): string                               // "12,5 M€" | "800 k€" | "Gratuit" si null
fmt.percent(n: number|null|undefined, opts?: { decimals?: number }): string  // "58,4 %" (n en 0-1)
fmt.initials(name: string|null): string                                 // "MC" pour "Manchester City"
fmt.flag(code: string|null|undefined): string                            // "🇵🇹" pour "PT" (ISO 3166-1 alpha-2), "" si invalide
fmt.age(dob: string|null): string                                       // "26 ans"
fmt.ago(d: Date|string|null): string                                    // "il y a 5 min"
```

Le local `fmt` est injecté par le contrôleur dans **chaque** `res.render` (page et layout).
Helpers supplémentaires exposés : `nl2br` (retours à la ligne), `eq` (comparaison), `json` (debug).

Navigation (le contrôleur construit `nav`, identique pour toutes les pages) :

```ts
[{ href:'/', label:'Accueil', icon:'home' },
 { href:'/live', label:'Direct', icon:'radio' },
 { href:'/fixtures', label:'Calendrier', icon:'calendar' },
 { href:'/leagues', label:'Ligues', icon:'trophy' },
 { href:'/predictions', label:'Prédictions', icon:'sparkles' },
 { href:'/odds', label:'Cotes', icon:'chart' },
 { href:'/transfers', label:'Mercato', icon:'swap' },
 { href:'/recherche', label:'Recherche', icon:'search' }]
```

Le partial `partials/header.ejs` mappe `icon` vers des **SVG inline** (auteur du designer) — aucune dépendance icône.

---

## 7. View models par page (contrat de rendu — le contrôleur les fournit, le template les consomme)

Chaque page reçoit un objet `vm` unique. Champs communs à **toutes** les pages :
`demo: boolean` (mode démo), `quota: { remaining:number|null; limit:number|null; resetIn:number|null }`,
`currentPath: string`, `nav: { href:string; label:string; icon:string }[]`.

| Route | Clé du template | View model |
|---|---|---|
| `/` | `home` | `{ live:LiveEvent[]; today:FootballEvent[]; tomorrow:FootballEvent[]; leagues:League[]; topScorers:LeaderboardEntry[]; predictions:Prediction[]; lastResults:FootballEvent[] }` |
| `/live` | `live` | `{ live:LiveEvent[]; leagues:League[]; updatedAt:Date }` |
| `/fixtures` | `fixtures` | `{ date:string; dateFrom:string; dateTo:string; events:FootballEvent[]; leagues:League[]; prevDate:string; nextDate:string }` |
| `/fixtures/:date` | `fixtures` | idem |
| `/match/:id` | `match` | `{ event:FootballEvent; stats:EventStats|null; lineups:EventLineups|null; incidents:Incident[]; commentary:CommentaryLine[]; h2h:H2H|null; odds:EventOdds|null; prediction:Prediction|null; availability:Availability|null; playerStats:PlayerStat[]; standings:StandingsResult|null; homeStanding:Standing|null; awayStanding:Standing|null; venue:unknown; referee:unknown }` |
| `/leagues` | `leagues` | `{ leagues:League[]; countries:string[]; womenCount:number; menCount:number }` |
| `/leagues/:id` | `league` | `{ league:League; season:Season|null; seasons:Season[]; standings:StandingsResult; topScorers:LeaderboardEntry[]; bestXI:BestXI|null; events:FootballEvent[]; venues:unknown[] }` |
| `/teams/:id` | `team` | `{ team:Team; squad:SquadPlayer[]; form:TeamForm|null; events:FootballEvent[]; transfers:Transfer[] }` |
| `/players/:id` | `player` | `{ player:Player; stats:PlayerStat[]; transfers:Transfer[]; events:FootballEvent[] }` |
| `/predictions` | `predictions` | `{ predictions:Prediction[]; leagues:League[] }` |
| `/odds` | `odds` | `{ odds:BestOddsRow[]; markets:string[]; market:string }` |
| `/transfers` | `transfers` | `{ transfers:Transfer[]; leagues:League[] }` |
| `/recherche` | `search` | `{ query:string; teams:Team[]; players:Player[]; leagues:League[] }` |
| `/palmares` | `palmares` | `{ featured:PalmarèsFeatured; competitions:CompetitionRank[]; clubs:ClubRank[]; players:PlayerRank[]; leaguesAnalysed:number; generatedAt:Date }` |

### 7.2 Palmarès — formes imposées (contrat de la feature « mettre en avant »)

Le palmarès est **dérivé** de l'API : aucune donnée inventée. Pour chaque compétition
sélectionnée (10 compétitions majeures, sélectionnées par nom), on lit le classement,
le meilleur XI et les buteurs, puis on compare les clubs, les joueurs et les
compétitions sur des indices **explicites et affichés dans l'interface**.

```ts
interface ClubRank {
  rank:number; teamId:number; teamName:string; leagueId:number; leagueName:string;
  logoUrl:string|null; played:number; pts:number; ptsPerGame:number; gd:number;
  xgd:number|null; xgdPerGame:number|null; form:string; score:number;
  /** Détail lisible de l'indice (ex. "26 pts · +1,4 xG/match"). */
  detail:string;
}
interface PlayerRank {
  rank:number; playerId:number; playerName:string; teamId:number; teamName:string;
  leagueId:number; leagueName:string; position:string; rating:number|null;
  goals:number; assists:number; matches:number; photoUrl:string|null; score:number;
  detail:string;
}
interface CompetitionRank {
  rank:number; leagueId:number; leagueName:string; country:string; logoUrl:string|null;
  teams:number; matches:number; avgGoals:number|null; avgXgDiff:number|null;
  avgPoints:number|null; leader:string|null; leaderPoints:number|null;
  score:number; detail:string;
}
interface PalmarèsFeatured {
  club:ClubRank|null; player:PlayerRank|null; competition:CompetitionRank|null;
}
```

**Indices (calculs stricts, à documenter dans l'interface) :**

- Club : `score = (60 × (ptsPerGame / 3) + 20 × (xgdPerGame ?? 0) + 20 × (gd / played)) × fiabilité`
  avec `ptsPerGame = pts / played`, `xgdPerGame = (xgd ?? 0) / played`
  et `fiabilité = min(1, played / 8)` : un club classé sur 4 journées ne peut pas
  devancer un club suivi sur 12 journées.
- Compétition : `score = 12 × avgGoals + 30 × |avgXgDiff| + 20 × (avgPointsPerGame / 3)`
  (les trois grandeurs se déduisent du **classement seul**, sans appel supplémentaire :
  `matches = Σplayed / 2`, `avgGoals = Σgf / matches`,
  `avgXgDiff = |Σxgf − Σxga| / Σplayed`, `avgPointsPerGame = Σpts / matches`)
- Joueur : `score = 10 × note moyenne (meilleur XI)`, les meilleurs buteurs alimentent
  la colonne « buts » du classement joueurs.

**Règles de sélection :** 10 compétitions majeures repérées par leur nom
(`Champions League`, `Premier League`, `La Liga`, `Serie A`, `Bundesliga`,
`Ligue 1`, `Liga Portugal`, `Eredivisie`, `Brasileirão`, `Europa League`) ;
repli sur les premières compétitions actives si un nom ne correspond pas.
Chaque compétition = 3 appels (`standings`, `bestxi`, `top/scorers`), résultats
mis en cache 30 min pour que la page ne consomme pas le quota à chaque visite.

Erreurs : toute route doit rendre un état propre (`404` → page « introuvable », erreur API → bandeau d'avertissement + page partielle), jamais une page blanche ni une stack trace.

### 7.1 Rendu des templates (contrat de collaboration backend ↔ frontend)

**Inventaire exact** (noms de fichiers obligatoires) :

```
server/views/layout.ejs          # layout unique : <%- body %> + <head> + header + footer
server/views/home.ejs
server/views/live.ejs
server/views/fixtures.ejs
server/views/match.ejs
server/views/leagues.ejs
server/views/league.ejs
server/views/team.ejs
server/views/player.ejs
server/views/predictions.ejs
server/views/odds.ejs
server/views/transfers.ejs
server/views/search.ejs
server/views/palmares.ejs
server/views/error.ejs           # page d'erreur générique
server/views/partials/head.ejs
server/views/partials/header.ejs
server/views/partials/footer.ejs
server/views/partials/match-row.ejs
server/views/partials/img.ejs
server/views/partials/section-head.ejs
server/views/partials/status-badge.ejs
server/views/partials/standing-table.ejs
server/views/partials/empty-state.ejs
server/views/partials/page-head.ejs
```

**Pattern de rendu imposé** (côté contrôleur, `server/routes/pages.ts`) :

```ts
res.render("live", vm, (err, html) => {
  if (err) return next(err);
  res.render("layout", { ...vm, body: html, currentPath: req.path, nav, demo, quota });
});
```

Chaque page est donc un template **sans** `<html>` : elle ne contient que son contenu (le layout fournit `<html>`, `<head>`, header, footer).
Les partials sont inclus via `<%- include("partials/xxx", { ... }) %>` (chemins relatifs au dossier du template appelant : depuis `views/`, `include("partials/head")` ; depuis `views/partials/`, `include("match-row")`).

Le layout reçoit **toujours** : `body`, `title`, `description`, `currentPath`, `nav`, `demo`, `quota`, et le view model de la page (spreadé).
Les partials reçoivent les données dont ils ont besoin en arguments (ex. `include("match-row", { event })`).

**Contraintes de rendu** :
- Échappement : `<%= %>` pour le texte, `<%- %>` uniquement pour du HTML de confiance (ex. `body`, `include`).
- Dates : le contrôleur convertit en `Date`; le template affiche via les helpers de `server/lib/format.ts` (exposés comme locals `fmt` : `fmt.date`, `fmt.time`, `fmt.relative`, `fmt.status`, `fmt.number`, `fmt.eur`).
- Le contrôleur expose aussi `currentPath` pour l'état actif de la navigation.

---

## 8. Routes API (JSON) servies par Express

| Route | Réponse |
|---|---|
| `GET /api/live` | `{ live:LiveEvent[]; quota:Quota; demo:boolean; updatedAt:string }` — `Cache-Control: s-maxage=15, stale-while-revalidate=30` |
| `GET /api/quota` | `{ remaining:number|null; limit:number|null; resetIn:number|null; demo:boolean }` |
| `GET /api/health` | `{ ok:boolean; demo:boolean; hasKey:boolean; baseUrl:string; version:string; uptime:number }` |
| `GET /api/events?date_from&date_to&league_id` | `{ events:FootballEvent[]; quota:Quota }` |
| `GET /api/match/:id` | le view model `match` complet |
| `GET /api/standings/:leagueId` | `StandingsResult` |
| `GET /api/search?q=` | `{ teams:Team[]; players:Player[]; leagues:League[] }` |

Toutes doivent répondre en JSON, gérer les erreurs (status HTTP cohérent + `{ error, detail }`) et ne jamais faire fuiter la clé API.

---

## 9. Direction artistique (à finaliser par le designer)

- **Identité** : « Zoera » (joueur, en malgache) — ton sportif, direct, sombre. Pas de dégradé violet générique, pas de glassmorphism.
- Palette : fond très sombre (`#0A0D12` → `#121821`), **un** accent électrique (vert citron/vert terrain) + rouge carton. Surfaces = subtly elevated, pas de cards flottantes partout : séparateurs 1 px et zones ombrées.
- Typographie : titres condensés et bold pour le score et les titres de section ; UI neutre. Chiffres tabulaires pour les scores et les stats.
- Mobile-first (80 % des consultations sont sur mobile) : tableau dense sur desktop, cartes empilées sur mobile. Barre de navigation basse sur mobile.
- Hiérarchie d'un match : **le score est l'élément le plus fort**, puis le statut/live, puis les équipes, puis l'heure et la compétition.
- Micro-interactions : pulse du point « LIVE », minute animée, transitions 150–250 ms, `prefers-reduced-motion` respecté.
- Accessibilité : contraste AA, cibles ≥ 44 px, focus visible, `aria-label` sur les icônes, langue `fr`.
- Visuels : logos via l'Image API BSD avec fallback ; **aucune image externe générique**, aucun CDN d'images ; motifs = CSS/SVG.
- EJS : échappement par défaut (`<%= %>`), un seul layout (`layout.ejs`) + partials ; composants récurrents = partials (`match-row.ejs`, `img.ejs`, `logo.ejs`, `section-head.ejs`, `status-badge.ejs`, `standing-table.ejs`, `empty-state.ejs`).

---

## 10. Règles d'implémentation

- Server-side only : le HTML est rendu par Express. Le JS client ne fait que l'interactivité (polling, onglets, filtres, favoris en `localStorage`).
- TypeScript `strict`, aucun `any` non justifié (`unknown` + narrowing).
- Le client JS est compilé en **modules ES** et servi en statique ; pas de bundler, pas de `import` de packages npm côté client.
- Tailwind v4 : `@import "tailwindcss";` + `@theme` pour les tokens + `@source "../../server"; @source "../../client";` pour la détection des classes (les templates EJS ne sont pas détectés automatiquement → les directives `@source` sont **obligatoires**).
- Pas de dépendance npm supplémentaire sans accord.
- `npm run build` doit finir avec le code 0 ; `npm start` doit servir l'app sur `PORT`.
- Tout le texte utilisateur est en français.
