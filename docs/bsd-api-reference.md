### GET /api/v2/bookmakers/
**Summary:** List bookmakers (v2)
**Notes:** All active bookmakers as {slug, name}. No detail endpoint, no pagination, no filters — there are ~15 of them. The `consensus` entry is a synthetic average across the rest, not a real bookmaker.
**Response fields:**
  - `slug`: string
  - `name`: string

### GET /api/v2/broadcasts/
**Summary:** List broadcasts (v2)
**Notes:** Paginated event-to-channel broadcast mappings, ordered by kick-off ascending. `channel_id` is the **internal PK** of TVChannel (not the upstream channel_id used in v1). When neither date_from nor date_to is set, returns the default window now-3h to now+7d — pass date_from to reach past fixtures. Cached 1 hour.
**Params:**
  - `channel_id` | integer | Internal TVChannel PK.
  - `country_code` | string | ISO 3166-1 alpha-2.
  - `date_from` | string | Kick-off >=. Setting either bound disables the default now-3h..now+7d window.
  - `date_to` | string | Kick-off <=. Setting either bound disables the default now-3h..now+7d window.
  - `event_id` | integer
  - `league_id` | integer
  - `limit` | integer
  - `offset` | integer
  - `season_id` | integer
  - `team_id` | integer | Broadcasts of events where the team played home or away.
**Response fields:**
  - `id`: integer
  - `event_id`: integer
  - `home_team_id`: integer
  - `home_team`: string
  - `away_team_id`: integer
  - `away_team`: string
  - `league_id`: integer
  - `league_name`: string
  - `event_date`: string
  - `country_code`: string
  - `channel_id`: integer
  - `channel_name`: string
  - `channel_link`: string
  - `scheduled_start_time`: string

### GET /api/v2/broadcasts/{id}/
**Summary:** Broadcast detail (v2)
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `event_id`: integer
  - `home_team_id`: integer
  - `home_team`: string
  - `away_team_id`: integer
  - `away_team`: string
  - `league_id`: integer
  - `league_name`: string
  - `event_date`: string
  - `country_code`: string
  - `channel_id`: integer
  - `channel_name`: string
  - `channel_link`: string
  - `scheduled_start_time`: string

### GET /api/v2/coverage/
**Summary:** What every sport holds right now (v2)
**Notes:** One row per sport: whether it has fixtures ahead, how many, how many of them are priced, and when the next and last events are. Written so an empty match list can be told apart from a closed season — hockey and basketball are out of season for months at a time, and the fixture endpoints cannot say so on their own.  Open to any authenticated account, whatever it subscribes to.
**Params:**
  - `sport` | string | Restrict to one sport key (football, tennis, basketball, hockey, darts, csgo, horseracing).
**Response fields:**
  - `generated_at`: string
  - `sports`: array<object>

### GET /api/v2/events/
**Summary:** List events (v2)
**Notes:** Lightweight events list. Same shape as detail. Filter by league, season, team, status, or date range. Spatial data (lineups, shotmap, momentum, average_positions) is never included in the list — fetch it from the sub-resources `/events/{id}/lineups/` and `/events/{id}/stats/`.
**Params:**
  - `date_from` | string | ISO 8601 UTC, e.g. 2026-04-30T00:00:00Z. Date-only (YYYY-MM-DD) is also accepted.
  - `date_to` | string | ISO 8601 UTC, e.g. 2026-04-30T23:59:59Z. Date-only (YYYY-MM-DD) is also accepted.
  - `league_id` | integer | Filter by league ID.
  - `limit` | integer | Page size (default 50, max 200).
  - `offset` | integer
  - `round` | integer | Matchday within `stage` (1-8 for a Champions League league phase). Requires `stage`: round numbers repeat across stages, so on its own it would mix a matchday with a knockout tie.
  - `season_id` | integer | Filter by season ID. Returns every match in that season.
  - `stage` | string | Filter by competition stage. Use the `stage` slug returned by this endpoint, or read the full list for a season from `/api/v2/leagues/{id}/seasons/` (field `stages`). Main stages are `group-stage`, `league-phase` and `re
  - `status` | string | Filter by match status.
  - `team_id` | integer | Matches where the team played home or away (exact match).
  - `team_name` | string | Partial, case-insensitive match on home or away team name.
**Response fields:**
  - `id`: integer
  - `league_id`: integer
  - `season_id`: integer
  - `home_team_id`: integer
  - `home_team`: string
  - `away_team_id`: integer
  - `away_team`: string
  - `home_coach_id`: integer
  - `away_coach_id`: integer
  - `referee_id`: integer
  - `venue_id`: integer
  - `event_date`: string
  - `status`: string
  - `replaced_by`: integer
  - `round_number`: integer
  - `round_name`: string
  - `group_name`: string
  - `period`: string
  - `current_minute`: integer
  - `home_score`: integer
  - `away_score`: integer
  - `home_score_ht`: integer
  - `away_score_ht`: integer
  - `penalty_shootout`: ?
  - `extra_time_score`: ?
  - `is_local_derby`: boolean
  - `stage`: string
  - `stage_name`: string
  - `round_label`: string
  - `is_neutral_ground`: boolean
  - `travel_distance_km`: integer
  - `weather`: ?
  - `pitch_condition`: integer
  - `attendance`: integer
  - `live_websocket`: boolean
  - `websocket_plus`: boolean
  - `highlights`: array<_HighlightSchema>
  - `head_to_head`: ?

### GET /api/v2/events/live/
**Summary:** Live events (v2)
**Notes:** Lightweight list of events in their live window (event_date − 5 min to ~10 min after final whistle). Designed for high-frequency polling by livetracker dashboards. Cached in Redis with TTL 30 s. For full event detail use /api/v2/events/{id}/.
**Params:**
  - `league_id` | integer
  - `limit` | integer | Return at most this many events. `count` stays the total number live, not the number returned.
  - `offset` | integer
  - `season_id` | integer
  - `team_id` | integer | Matches where the team played home or away.
**Response fields:**
  - `count`: integer
  - `events`: array<EventLiveListItemV2Schema>

### GET /api/v2/events/{id}/
**Summary:** Event detail (v2)
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `league_id`: integer
  - `season_id`: integer
  - `home_team_id`: integer
  - `home_team`: string
  - `away_team_id`: integer
  - `away_team`: string
  - `home_coach_id`: integer
  - `away_coach_id`: integer
  - `referee_id`: integer
  - `venue_id`: integer
  - `event_date`: string
  - `status`: string
  - `replaced_by`: integer
  - `round_number`: integer
  - `round_name`: string
  - `group_name`: string
  - `period`: string
  - `current_minute`: integer
  - `home_score`: integer
  - `away_score`: integer
  - `home_score_ht`: integer
  - `away_score_ht`: integer
  - `penalty_shootout`: ?
  - `extra_time_score`: ?
  - `is_local_derby`: boolean
  - `stage`: string
  - `stage_name`: string
  - `round_label`: string
  - `is_neutral_ground`: boolean
  - `travel_distance_km`: integer
  - `weather`: ?
  - `pitch_condition`: integer
  - `attendance`: integer
  - `live_websocket`: boolean
  - `websocket_plus`: boolean
  - `highlights`: array<_HighlightSchema>
  - `head_to_head`: ?

### GET /api/v2/events/{id}/availability/
**Summary:** What this match actually carries (v2)
**Notes:** Which sub-resources of a match have data, in one call, so you do not have to probe each endpoint and read an empty body to find out.  Everything here is computed from the rows it describes at the moment you ask. It is deliberately not a stored flag: a stored flag can drift out of step with the data, and a flag that says "yes" when the answer is "no" is worse than the empty call it saves, because you stop checking.  `stat_keys` answers the corners-and-cards question exactly; `odds_markets` answers it for prices, using the same codes `/odds/?market=` accepts.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `event_id`: integer
  - `status`: string
  - `lineup_status`: string
  - `available`: object<string,?>
  - `stat_keys`: array<string>
  - `odds_markets`: array<string>

### GET /api/v2/events/{id}/broadcasts/
**Summary:** Broadcasts for an event (v2)
**Notes:** Paginated broadcasts mappings for a single event across countries and channels. Filter to a specific country with `country_code`. Cached 1 hour.
**Params:**
  - `country_code` | string | ISO 3166-1 alpha-2 (e.g. PT, ES). 400 if malformed.
  - `id` | integer | REQUIRED
  - `limit` | integer
  - `offset` | integer
**Response fields:**
  - `id`: integer
  - `event_id`: integer
  - `home_team_id`: integer
  - `home_team`: string
  - `away_team_id`: integer
  - `away_team`: string
  - `league_id`: integer
  - `league_name`: string
  - `event_date`: string
  - `country_code`: string
  - `channel_id`: integer
  - `channel_name`: string
  - `channel_link`: string
  - `scheduled_start_time`: string

### GET /api/v2/events/{id}/commentary/
**Summary:** Event commentary (v2) — the match as text, line by line
**Notes:** A written, minute-by-minute account of the match: goals, cards, substitutions, VAR, every attempt with its xG, corners, offsides, added time and the periods. Each line carries the minute, the side, the player (internal ids), the score at that moment and an English sentence ready to display.  Lines are in match order. While a match is live, poll with `?since=<last id>` to get only what is new; an id we no longer recognise returns the whole list, so de-duplicate on `id`. Live matches refresh every 15 seconds.  Fouls are not narrated: we do not publish who committed a foul unless it was booked, a
**Params:**
  - `id` | integer | REQUIRED
  - `order` | string | `asc` (default) oldest first; `desc` newest first.
  - `since` | string | Return only the lines after the line with this `id`.
**Response fields:**
  - `event_id`: integer
  - `status`: string
  - `has_play_by_play`: boolean
  - `commentary`: array<FootballCommentaryLineV2>

### GET /api/v2/events/{id}/h2h/
**Summary:** Head-to-head record (v2)
**Notes:** Aggregated head-to-head stats for the two teams in this event, oriented so that "home" always means this event's home team. With no history indexed it still answers 200, with the counts zeroed, the rates null and recent_matches empty.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `total_matches`: integer
  - `home_wins`: integer
  - `draws`: integer
  - `away_wins`: integer
  - `home_goals`: integer
  - `away_goals`: integer
  - `avg_total_goals`: number
  - `home_win_rate`: number
  - `away_win_rate`: number
  - `recent_matches`: array<_H2HRecentMatchSchema>

### GET /api/v2/events/{id}/incidents/
**Summary:** Event incidents (v2) — goals and scorers, cards, substitutions
**Notes:** **This is where the goalscorers are.** Every incident of the match, in order.  A goal reads `{"type": "goal", "player": "M. Oyarzabal", "minute": 22, "is_home": false, "assist": "D. Olmo"}` — `player` is the scorer, `minute` the minute, and `is_home` the side (false = the event's away team). `assist` is present when there was one. Filter on `type == "goal"` for a scorers list; the same response also carries cards and substitutions.  A penalty missed in play is `{"type": "penalty_missed", ..., "reason": "saved"}` with `reason` one of `saved`, `post` (woodwork) or `miss` (off target).  Goals may
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `event_id`: integer
  - `incidents`: array<object>

### GET /api/v2/events/{id}/lineups/
**Summary:** Event lineups (v2)
**Notes:** Unified lineups endpoint covering three states via the `lineup_status` discriminator:  - `confirmed` — official XI published by the club. Available ~1 hour before kickoff and persists after the match. `confidence` and `ai_score` are always `null` in this state. - `predicted` — AI-generated lineup with `confidence` and per-player `ai_score` (both 0–1, four decimals). Only served for matches that have not started. The `beta: true` flag is set only in this state. - `unavailable` — no lineup data yet; `lineups`, `unavailable_players` and `updated_at` are all null. The response is still 200, not 40
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `event_id`: integer
  - `lineup_status`: string
  - `beta`: boolean
  - `lineups`: ?
  - `unavailable_players`: ?
  - `updated_at`: string

### GET /api/v2/events/{id}/metadata/
**Summary:** Event metadata (v2)
**Notes:** Kit colours, pre-match trivia and the written match preview.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `event_id`: integer
  - `jerseys`: object<string,?>
  - `funfacts`: array<_FunFactSchema>
  - `ai_preview`: ?

### GET /api/v2/events/{id}/odds/
**Summary:** Event odds (v2)
**Notes:** Consensus decimal odds across the bookmakers we collect. Markets: 1X2, Over/Under {1.5,2.5,3.5}, BTTS. Also carries when the prices were last refreshed and when they are next scheduled to, so you can poll at the rate they actually move.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `event_id`: integer
  - `odds`: ?
  - `last_update_at`: string
  - `last_change_at`: string
  - `next_update_at`: string
  - `update_interval_seconds`: integer
  - `update_reason`: string

### GET /api/v2/events/{id}/odds/comparison/
**Summary:** Side-by-side bookmaker comparison for an event (v2)
**Notes:** All bookmakers side-by-side for a single event. Outcome keys are codes (HOME/DRAW/AWAY/over/under/...), not team names — stable parsing even when teams are renamed. Bookmaker keys are slugs. Cached 3 min. Event with no odds returns {markets: {}}; missing event returns 404.  **Requires Football Unlimited.** Every field in this response is per-bookmaker, so without the entitlement there is nothing to degrade to and the endpoint answers 403 (`bookmakers_not_entitled`) rather than a thinner grid that looks like live data. For the free consensus price use /api/v2/odds/.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `event_id`: integer
  - `event_date`: string
  - `league_id`: integer
  - `league_name`: string
  - `home_team_id`: integer
  - `home_team`: string
  - `away_team_id`: integer
  - `away_team`: string
  - `bookmakers_count`: integer
  - `total_odds`: integer
  - `markets`: object<string,?>
  - `main_lines`: object<string,?>

### GET /api/v2/events/{id}/player-stats/
**Summary:** Per-player stats for an event (v2)
**Notes:** Per-player statistics for the whole matchday squad of this match (typically 30-40 records): starters, substitutes who came on, and unused substitutes, who come back with `minutes_played: 0`, every counter at 0 and `rating: null`. A counter the source did not send is 0, not null. Tagged under v2 / Players because the records belong to the players domain.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `event_id`: integer
  - `count`: integer
  - `player_stats`: array<PlayerStatV2Schema>

### GET /api/v2/events/{id}/polymarket/
**Summary:** Polymarket prices for an event (v2)
**Notes:** Polymarket prediction-market prices for one event. Prices are implied probabilities (0–1); decimal odds = 1/price. Distinct shape from traditional odds. Cached 1 min.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `event_id`: integer
  - `event_date`: string
  - `home_team`: string
  - `away_team`: string
  - `polymarket_event_id`: string
  - `markets`: ?
  - `liquidity`: ?
  - `pricing`: ?
  - `goalscorers`: ?
  - `exact_scores`: ?
  - `updated_at`: string

### GET /api/v2/events/{id}/prediction/
**Summary:** Prediction for an event (v2)
**Notes:** Returns the CatBoost ML prediction associated with this event. The response shape matches /api/v2/predictions/{id}/. Tagged under v2 / Events because the resource hangs off the events namespace, consistent with /events/{id}/stats/ etc.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `created_at`: string
  - `updated_at`: string
  - `event`: ?
  - `markets`: ?
  - `recommendations`: ?
  - `model`: ?

### GET /api/v2/events/{id}/social/
**Summary:** Social items for an event (v2)
**Notes:** Paginated tweets and video highlights linked to this event. No temporal filters — the event already bounds the window. Cached 15 min.
**Params:**
  - `id` | integer | REQUIRED
  - `limit` | integer
  - `offset` | integer
  - `type` | string
**Response fields:**
  - `id`: integer
  - `type`: string
  - `url`: string
  - `text`: string
  - `title`: string
  - `thumbnail`: string
  - `media`: array<SocialMediaItemSchema>
  - `account`: ?
  - `published_at`: string
  - `linked`: ?

### GET /api/v2/events/{id}/stats/
**Summary:** Event stats (v2)
**Notes:** Per-team merged stats (live + provider-only counters), shotmap, momentum, average positions, per-minute xG.  **xG provenance.** Not every xG here is a measured one: where the shot feed ships no price we estimate it ourselves, and whole competitions are estimated end to end. Four flags say which is which, all answering the same question — `true` = our estimate, `false` = the measured value, `null` = there is no xG to qualify (a shoot-out attempt, or a shot with no usable geometry):  - `xg_estimated` at the root — true when *any* xG in this response is ours. Read this one to decide whether the m
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `event_id`: integer
  - `stats`: ?
  - `xg_estimated`: boolean
  - `shotmap`: array<_ShotV2Schema>
  - `momentum`: array<_MomentumPointSchema>
  - `average_positions`: object<string,?>
  - `xg_per_minute`: array<_XgPerMinuteSchema>

### GET /api/v2/fixtures/changes/
**Summary:** Fixture change feed (v2)
**Notes:** Only what changed about scheduled matches: a kickoff that moved, a match postponed or abandoned, a venue switch, a broadcaster added. Poll this instead of re-fetching fixture lists and diffing them yourself.  A fixture carries its current kickoff and status and nothing else, so a move is only visible if it was written down when it happened. That recording started on the day this endpoint shipped — nothing before it can be recovered.  **Normal progress is not a change.** A match going `notstarted` → `inprogress` → `finished` never appears here. Only transitions in or out of a disrupted state do
**Params:**
  - `change` | string | Comma-separated subset of `kickoff,status,venue,broadcast_added`.
  - `league_id` | integer | Only changes to matches in this competition.
  - `limit` | integer | 1–500, default 100.
  - `since` | string | ISO-8601 instant. Default 24 hours ago, maximum 7 days back.
**Response fields:**
  - `since`: string
  - `until`: string
  - `count`: integer
  - `truncated`: boolean
  - `changes`: array<FixtureChangeV2Schema>

### GET /api/v2/leagues/
**Summary:** List leagues (v2)
**Notes:** Paginated leagues list. Returns only active leagues by default; pass `include_inactive=true` to include inactive ones too. Filter by country and women/men. Unknown query parameters are rejected with 400 rather than ignored, so a mistyped filter fails loudly instead of returning the unfiltered list.
**Params:**
  - `country` | string | ISO country name (case-insensitive exact match).
  - `include_inactive` | boolean | Set to true to include inactive leagues in the response. Default behavior (omit or false) returns only active leagues.
  - `is_women` | boolean | Filter by women / men competitions.
  - `limit` | integer | Default 50, max 200.
  - `offset` | integer
**Response fields:**
  - `id`: integer
  - `name`: string
  - `country`: string
  - `is_women`: boolean
  - `is_active`: boolean
  - `current_season`: ?

### GET /api/v2/leagues/{id}/
**Summary:** League detail (v2)
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `name`: string
  - `country`: string
  - `is_women`: boolean
  - `is_active`: boolean
  - `current_season`: ?

### GET /api/v2/leagues/{id}/bestxi/{season_id}/
**Summary:** Season Best XI (v2)
**Notes:** Best-performing player per position (1-4-3-3) across the whole season, ranked by average match rating. Requires at least 450 minutes played to qualify (roughly 5 full matches), so early-season results won't be skewed by a single big performance.
**Params:**
  - `id` | integer | REQUIRED
  - `season_id` | integer | REQUIRED
**Response fields:**
  - `league_id`: integer
  - `season`: ?
  - `round_number`: integer
  - `formation`: string
  - `lineup`: object<string,?>

### GET /api/v2/leagues/{id}/bestxi/{season_id}/{round_number}/
**Summary:** Round Best XI (v2)
**Notes:** Best-performing player per position (1-4-3-3) within one specific round of a season, ranked by match rating. Requires at least 45 minutes played to qualify.
**Params:**
  - `id` | integer | REQUIRED
  - `round_number` | integer | REQUIRED
  - `season_id` | integer | REQUIRED
**Response fields:**
  - `league_id`: integer
  - `season`: ?
  - `round_number`: integer
  - `formation`: string
  - `lineup`: object<string,?>

### GET /api/v2/leagues/{id}/season/
**Summary:** Current league season (v2)
**Notes:** The season currently flagged as active for this league, under a `season` key. That key is null if none is marked current (e.g. between cycles).
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `league_id`: integer
  - `season`: ?

### GET /api/v2/leagues/{id}/seasons/
**Summary:** League seasons (v2)
**Notes:** The seasons of this league we can actually answer for, newest first.  A finished season is listed once it carries data: the table also holds rows for every season upstream has ever run, and listing those would hand out ids whose standings, fixtures and stats all come back empty. A season still in progress is always listed.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `league_id`: integer
  - `count`: integer
  - `seasons`: array<_SeasonSchema>

### GET /api/v2/leagues/{id}/seasons/{season_id}/venues/
**Summary:** League/season venues (v2)
**Notes:** Venues assigned to a specific league + season. Replaces the legacy `/api/worldcup/venues/` endpoint for FIFA World Cup 2026 — and works the same way for any league/season pair.
**Params:**
  - `host_country_code` | string | Restrict to venues in this host country (ISO 3166-1 alpha-2).
  - `hosts_final` | boolean
  - `hosts_opening` | boolean
  - `hosts_third_place` | boolean
  - `id` | integer | REQUIRED
  - `limit` | integer | Page size (default 50, max 200).
  - `offset` | integer
  - `round` | string | Restrict to venues hosting this knockout round.
  - `season_id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `league_id`: integer
  - `season_id`: integer
  - `host_country_code`: string
  - `hosts_opening`: boolean
  - `hosts_final`: boolean
  - `hosts_third_place`: boolean
  - `rounds`: array<string>
  - `match_count`: integer
  - `fifa_role`: string
  - `venue`: ?

### GET /api/v2/leagues/{id}/standings/
**Summary:** League standings (v2)
**Notes:** Standings for one season (defaults to current). Cup competitions return a `groups` map; league competitions return a flat `standings` array.
**Params:**
  - `id` | integer | REQUIRED
  - `season_id` | integer | Season ID. Defaults to the league's current season.
**Response fields:**
  - `league_id`: integer
  - `season`: ?
  - `grouped`: boolean
  - `standings`: array<StandingsRowV2Schema>
  - `groups`: object<string,?>
  - `zones`: ?

### GET /api/v2/leagues/{id}/top/{stat}/
**Summary:** League stat leaderboard (v2)
**Notes:** Top players in one season for a given stat: `scorers` (goals), `assists`, `yellowcards`, `redcards`, or `fouls`. Defaults to the league's current season. Pass `team_id` to rank one squad instead of the whole league.
**Params:**
  - `id` | integer | REQUIRED
  - `limit` | integer | Number of players to return (default 20, max 50).
  - `season_id` | integer | Season ID. Defaults to the league's current season.
  - `stat` | string | REQUIRED
  - `stat` | string | REQUIRED | Which leaderboard to return.
  - `team_id` | integer | Rank only this team's players. Ranking is then within the squad, so a player outside the league top 50 still appears.
**Response fields:**
  - `league_id`: integer
  - `team_id`: integer
  - `season`: ?
  - `stat`: string
  - `label`: string
  - `leaders`: array<LeaderboardEntrySchema>

### GET /api/v2/leagues/{id}/venues/
**Summary:** League venues (v2)
**Notes:** Venues assigned to this league across one or more seasons. Each row is one venue-to-season assignment, with the venue embedded.
**Params:**
  - `id` | integer | REQUIRED
  - `limit` | integer | Page size (default 50, max 200).
  - `offset` | integer
  - `season_id` | integer | Restrict to assignments in this season.
**Response fields:**
  - `id`: integer
  - `league_id`: integer
  - `season_id`: integer
  - `host_country_code`: string
  - `hosts_opening`: boolean
  - `hosts_final`: boolean
  - `hosts_third_place`: boolean
  - `rounds`: array<string>
  - `match_count`: integer
  - `fifa_role`: string
  - `venue`: ?

### GET /api/v2/managers/
**Summary:** List managers (v2)
**Notes:** Paginated managers list with computed match aggregates. Filter by current club, league experience, nationality (ISO-2), tactical profile, primary team style, minimum matches, or name.
**Params:**
  - `league_id` | integer | Managers who have coached at least one match in this league.
  - `limit` | integer | Page size (default 50, max 200).
  - `min_matches` | integer | Minimum matches managed (default: 0).
  - `name` | string | Partial, case-insensitive match on name or short_name.
  - `nationality_code` | string | ISO 3166-1 alpha-2 country code. Unknown codes return an empty list.
  - `offset` | integer
  - `tactical_profile` | string | Tactical profile of the manager.
  - `team_id` | integer | Manager with an active tenure at that club.
  - `team_style` | string | Primary playing style category derived from manager-style scoring.
**Response fields:**
  - `id`: integer
  - `name`: string
  - `short_name`: string
  - `country`: string
  - `tactical_profile`: string
  - `preferred_formation`: string
  - `current_team_id`: integer
  - `matches_total`: integer
  - `wins`: integer
  - `draws`: integer
  - `losses`: integer
  - `win_pct`: number
  - `avg_goals_scored`: number
  - `avg_goals_conceded`: number
  - `avg_possession`: number
  - `clean_sheet_pct`: number
  - `btts_pct`: number
  - `over_25_pct`: number
  - `stats_updated_at`: string

### GET /api/v2/managers/{id}/
**Summary:** Manager detail (v2)
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `name`: string
  - `short_name`: string
  - `country`: string
  - `tactical_profile`: string
  - `preferred_formation`: string
  - `current_team_id`: integer
  - `matches_total`: integer
  - `wins`: integer
  - `draws`: integer
  - `losses`: integer
  - `win_pct`: number
  - `avg_goals_scored`: number
  - `avg_goals_conceded`: number
  - `avg_possession`: number
  - `clean_sheet_pct`: number
  - `btts_pct`: number
  - `over_25_pct`: number
  - `stats_updated_at`: string

### GET /api/v2/managers/{id}/career/
**Summary:** Manager career (v2)
**Notes:** Club-by-club tenure history: dates, record, points per match, goals and a home/away split for each spell. Every tenure with a start date also carries `appointment_effect` — how the club performed in the matches immediately before the appointment against the same number immediately after, which is the only way to read a points-per-match figure as good or bad rather than just high or low.
**Params:**
  - `id` | integer | REQUIRED
  - `window` | integer | Matches either side of the appointment for `appointment_effect` (default 10, max 38). Pass 0 to skip the calculation.
**Response fields:**
  - `manager_id`: integer
  - `count`: integer
  - `tenures`: array<ManagerTenureV2Schema>

### GET /api/v2/managers/{id}/matches/
**Summary:** Manager matches (v2)
**Notes:** Matches managed by this manager, newest first. Returns the full history by default — narrow it with `date_from`/`date_to`, `league_id`, `team_id` or `status`. Same row shape as `/api/v2/events/`.
**Params:**
  - `date_from` | string | ISO 8601 UTC.
  - `date_to` | string | ISO 8601 UTC.
  - `id` | integer | REQUIRED
  - `league_id` | integer
  - `limit` | integer | Page size (default 50, max 200).
  - `offset` | integer
  - `status` | string | Filter by match status.
  - `team_id` | integer | Restrict to matches where this manager was on the bench for this team (useful for managers with multiple tenures).
**Response fields:**
  - `id`: integer
  - `league_id`: integer
  - `season_id`: integer
  - `home_team_id`: integer
  - `home_team`: string
  - `away_team_id`: integer
  - `away_team`: string
  - `home_coach_id`: integer
  - `away_coach_id`: integer
  - `referee_id`: integer
  - `venue_id`: integer
  - `event_date`: string
  - `status`: string
  - `replaced_by`: integer
  - `round_number`: integer
  - `round_name`: string
  - `group_name`: string
  - `period`: string
  - `current_minute`: integer
  - `home_score`: integer
  - `away_score`: integer
  - `home_score_ht`: integer
  - `away_score_ht`: integer
  - `penalty_shootout`: ?
  - `extra_time_score`: ?
  - `is_local_derby`: boolean
  - `stage`: string
  - `stage_name`: string
  - `round_label`: string
  - `is_neutral_ground`: boolean
  - `travel_distance_km`: integer
  - `weather`: ?
  - `pitch_condition`: integer
  - `attendance`: integer
  - `live_websocket`: boolean
  - `websocket_plus`: boolean
  - `highlights`: array<_HighlightSchema>
  - `head_to_head`: ?

### GET /api/v2/managers/{id}/social/
**Summary:** Social items for a manager (v2)
**Notes:** Paginated tweets and video highlights linked to this manager. Cached 15 min.
**Params:**
  - `id` | integer | REQUIRED
  - `limit` | integer
  - `offset` | integer
  - `published_after` | string
  - `published_before` | string
  - `type` | string
**Response fields:**
  - `id`: integer
  - `type`: string
  - `url`: string
  - `text`: string
  - `title`: string
  - `thumbnail`: string
  - `media`: array<SocialMediaItemSchema>
  - `account`: ?
  - `published_at`: string
  - `linked`: ?

### GET /api/v2/odds/
**Summary:** List odds (v2)
**Notes:** Paginated list of latest odds across bookmakers. Each item is one (event, bookmaker, market, outcome) tuple at its most recent observation. Standard v2 wrapper (count + next + previous + results). Cached 3 min.  When no event_id/league_id/season_id/team_id or updated_after filter is given, results default to the last 48h of observations (the meaningful "latest odds" window). Pass an explicit updated_after to widen it.  Market+outcome compatibility (incoherent combos return 400): - 1x2            → HOME, DRAW, AWAY - btts           → yes, no - over_under_05/15/25/35 → over, under - double_chanc
**Params:**
  - `bookmaker_slug` | string | Slug only (e.g. "pinnacle"). Display names rejected with 400.
  - `cursor` | string | Keyset pagination. Opaque value taken from the `next` link; resumes exactly where the previous page ended, at constant cost. Use this to consume the feed incrementally (pair it with `updated_after`). Ignores `offset`; `p
  - `event_id` | integer
  - `is_max_quote` | boolean
  - `league_id` | integer
  - `limit` | integer
  - `market` | string
  - `max_decimal_odds` | number
  - `min_decimal_odds` | number
  - `movement` | string
  - `offset` | integer | Max 10000. To walk the whole feed use `cursor` instead — offset pages recount from the start every time.
  - `outcome` | string
  - `season_id` | integer
  - `team_id` | integer
  - `updated_after` | string | ISO-8601 UTC. Only odds with observed_at >= this.
**Response fields:**
  - `id`: integer
  - `event_id`: integer
  - `market`: string
  - `outcome`: string
  - `line`: number
  - `push`: string
  - `outcome_name`: string
  - `bookmaker_slug`: string
  - `bookmaker_name`: string
  - `decimal_odds`: number
  - `previous_decimal_odds`: number
  - `opening_decimal_odds`: number
  - `opening_at`: string
  - `implied_probability`: number
  - `movement`: string
  - `is_max_quote`: boolean
  - `is_live`: boolean
  - `updated_at`: string

### GET /api/v2/odds/best/
**Summary:** Best upcoming odds (v2)
**Notes:** Per upcoming event, the highest decimal odds for each outcome of the requested market across all bookmakers. Defaults: market=1x2, date_from=now, date_to=now+7 days. Cached 5 min.
**Params:**
  - `date_from` | string
  - `date_to` | string
  - `league_id` | integer
  - `limit` | integer
  - `market` | string
  - `offset` | integer
  - `season_id` | integer
  - `team_id` | integer
**Response fields:**
  - `event_id`: integer
  - `event_date`: string
  - `league_id`: integer
  - `league_name`: string
  - `home_team_id`: integer
  - `home_team`: string
  - `away_team_id`: integer
  - `away_team`: string
  - `market`: string
  - `best_odds`: array<_BestOutcomeV2Schema>

### GET /api/v2/odds/{id}/
**Summary:** Odds detail (v2)
**Notes:** Returns one odds row by its id. NOT the event-context envelope that v1 had as a fallback — invalid ids are 404s.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `event_id`: integer
  - `market`: string
  - `outcome`: string
  - `line`: number
  - `push`: string
  - `outcome_name`: string
  - `bookmaker_slug`: string
  - `bookmaker_name`: string
  - `decimal_odds`: number
  - `previous_decimal_odds`: number
  - `opening_decimal_odds`: number
  - `opening_at`: string
  - `implied_probability`: number
  - `movement`: string
  - `is_max_quote`: boolean
  - `is_live`: boolean
  - `updated_at`: string

### GET /api/v2/players/
**Summary:** List players (v2)
**Notes:** Paginated players list. Filter by current club, national team, nationality (ISO-2), position, or name. Heavy per-player data (stats, transfers, career) is exposed via dedicated sub-resources.
**Params:**
  - `limit` | integer | Page size (default 50, max 200).
  - `name` | string | Partial, case- and accent-insensitive match on name or short_name. `gyokeres` matches `Gyökeres`, `sesko` matches `Šeško`, `estevao` matches `Estêvão`.
  - `national_team_id` | integer | Filter by national-team ID.
  - `nationality_code` | string | ISO 3166-1 alpha-2 nationality code (e.g. PT, BR). Unknown codes return an empty list.
  - `offset` | integer
  - `position` | string | Generic (G/D/M/F) or specific position code.
  - `team_id` | integer | Filter by current club ID.
**Response fields:**
  - `id`: integer
  - `name`: string
  - `short_name`: string
  - `position`: string
  - `specific_position`: string
  - `jersey_number`: integer
  - `date_of_birth`: string
  - `height_cm`: integer
  - `weight_kg`: integer
  - `preferred_foot`: string
  - `nationality`: string
  - `current_team_id`: integer
  - `national_team_id`: integer
  - `current_team`: ?
  - `national_team`: ?
  - `market_value_eur`: integer
  - `contract_until`: string
  - `availability`: string
  - `injury_type`: string
  - `injury_expected_return`: string
  - `attributes`: ?
  - `strengths`: array<string>
  - `weaknesses`: array<string>
  - `rating`: integer
  - `potential`: string
  - `injury_risk`: string
  - `wage_eur_annual`: integer

### GET /api/v2/players/{id}/
**Summary:** Player detail (v2)
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `name`: string
  - `short_name`: string
  - `position`: string
  - `specific_position`: string
  - `jersey_number`: integer
  - `date_of_birth`: string
  - `height_cm`: integer
  - `weight_kg`: integer
  - `preferred_foot`: string
  - `nationality`: string
  - `current_team_id`: integer
  - `national_team_id`: integer
  - `current_team`: ?
  - `national_team`: ?
  - `market_value_eur`: integer
  - `contract_until`: string
  - `availability`: string
  - `injury_type`: string
  - `injury_expected_return`: string
  - `attributes`: ?
  - `strengths`: array<string>
  - `weaknesses`: array<string>
  - `rating`: integer
  - `potential`: string
  - `injury_risk`: string
  - `wage_eur_annual`: integer

### GET /api/v2/players/{id}/career/
**Summary:** Player career summary (v2)
**Notes:** Career totals aggregated by season and competition: appearances, minutes, goals, assists and mean match rating.  Built from the per-match statistics we hold, so a season we have no player-level data for simply does not appear, and `matches` can sit below the official tally for older or lower-division seasons.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `player_id`: integer
  - `seasons`: array<CareerSeasonV2Schema>

### GET /api/v2/players/{id}/national-team/
**Summary:** Player national-team data (v2)
**Notes:** The player's national team plus appearances and goals for it.  Counted from the per-match statistics we hold, not from an official cap register, so `caps` is a floor rather than the federation's number.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `player_id`: integer
  - `national_team_id`: integer
  - `caps`: integer
  - `goals`: integer
  - `last_appearance`: string

### GET /api/v2/players/{id}/social/
**Summary:** Social items for a player (v2)
**Notes:** Paginated tweets and video highlights mentioning this player. Linking is **heuristic** (best-effort NLP/regex over the text); false positives are possible. Cached 15 min.
**Params:**
  - `id` | integer | REQUIRED
  - `limit` | integer
  - `offset` | integer
  - `published_after` | string
  - `published_before` | string
  - `type` | string
**Response fields:**
  - `id`: integer
  - `type`: string
  - `url`: string
  - `text`: string
  - `title`: string
  - `thumbnail`: string
  - `media`: array<SocialMediaItemSchema>
  - `account`: ?
  - `published_at`: string
  - `linked`: ?

### GET /api/v2/players/{id}/stats/
**Summary:** Player per-match stats (v2)
**Notes:** Per-match player statistics for one player. Filter by season, team, league or date range. To get stats for one specific event use `/api/v2/events/{id}/player-stats/` (the canonical path); passing `event_id` here is rejected with 400.
**Params:**
  - `date_from` | string | ISO 8601 UTC.
  - `date_to` | string | ISO 8601 UTC.
  - `id` | integer | REQUIRED
  - `league_id` | integer
  - `limit` | integer | Page size (default 50, max 200).
  - `offset` | integer
  - `season_id` | integer
  - `team_id` | integer | Stats logged with this team (handles transfers).
**Response fields:**
  - `id`: integer
  - `player_id`: integer
  - `event_id`: integer
  - `team_id`: integer
  - `minutes_played`: integer
  - `rating`: number
  - `touches`: integer
  - `goals`: integer
  - `goal_assist`: integer
  - `expected_goals`: number
  - `expected_assists`: number
  - `total_shots`: integer
  - `shots_on_target`: integer
  - `key_pass`: integer
  - `total_pass`: integer
  - `accurate_pass`: integer
  - `total_long_balls`: integer
  - `accurate_long_balls`: integer
  - `total_cross`: integer
  - `accurate_cross`: integer
  - `total_contest`: integer
  - `won_contest`: integer
  - `duel_won`: integer
  - `duel_lost`: integer
  - `aerial_won`: integer
  - `aerial_lost`: integer
  - `total_tackle`: integer
  - `won_tackle`: integer
  - `total_clearance`: integer
  - `interception`: integer
  - `ball_recovery`: integer
  - `blocked_scoring_attempt`: integer
  - `dispossessed`: integer
  - `possession_lost`: integer
  - `was_fouled`: integer
  - `fouls`: integer
  - `yellow_card`: integer
  - `red_card`: integer
  - `saves`: integer
  - `goals_conceded`: integer
  - `punches`: integer
  - `high_claims`: integer
  - `good_high_claim`: integer
  - `accurate_keeper_sweeper`: integer
  - `total_keeper_sweeper`: integer
  - `goals_prevented`: number
  - `keeper_save_value`: number
  - `goalkeeper_value_normalized`: number
  - `big_chance_created`: integer
  - `big_chance_missed`: integer
  - `expected_goals_on_target`: number
  - `hit_woodwork`: integer
  - `last_man_tackle`: integer
  - `outfielder_block`: integer
  - `saved_shots_from_inside_the_box`: integer
  - `clearance_off_line`: integer
  - `challenge_lost`: integer
  - `total_offside`: integer
  - `error_lead_to_a_goal`: integer
  - `error_lead_to_a_shot`: integer
  - `defensive_value_normalized`: number
  - `pass_value_normalized`: number
  - `shot_value_normalized`: number
  - `dribble_value_normalized`: number
  - `ball_carries_count`: integer
  - `progressive_ball_carries_count`: integer
  - `total_ball_carries_distance`: number
  - `total_progressive_ball_carries_distance`: number
  - `best_ball_carry_progression`: number
  - `total_progression`: integer
  - `unsuccessful_touch`: integer
  - `accurate_opposition_half_passes`: integer
  - `total_opposition_half_passes`: integer
  - `accurate_own_half_passes`: integer
  - `total_own_half_passes`: integer

### GET /api/v2/players/{id}/transfers/
**Summary:** Player transfers (v2)
**Notes:** Transfer history for the player, newest first.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `player_id`: integer
  - `count`: integer
  - `transfers`: array<TransferV2Schema>

### GET /api/v2/predictions/
**Summary:** List predictions (v2)
**Notes:** Paginated list of engine forecasts. Response items group fields by market (match_result, expected_goals, over_under, btts, score, draw_no_bet, corners). Probabilities are calibrated, market-anchored where a consensus price exists. When date_from or date_to is set, status is ignored — the explicit window wins. Cached 120 s.
**Params:**
  - `date_from` | string | ISO-8601 UTC. Date-only YYYY-MM-DD also accepted.
  - `date_to` | string
  - `league_id` | integer
  - `limit` | integer
  - `min_confidence` | number | Lower bound (0–1) on the probability of the most likely 1X2 outcome.
  - `offset` | integer
  - `recommended` | boolean | Kept for contract compatibility. The engine issues no bet recommendations, so true matches nothing and false matches all.
  - `season_id` | integer
  - `status` | string | upcoming (default) | past | all. Ignored when date_from/date_to is set.
  - `team_id` | integer | Forecasts where the team plays home or away.
**Response fields:**
  - `id`: integer
  - `created_at`: string
  - `updated_at`: string
  - `event`: ?
  - `markets`: ?
  - `recommendations`: ?
  - `model`: ?

### GET /api/v2/predictions/{id}/
**Summary:** Prediction detail (v2)
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `created_at`: string
  - `updated_at`: string
  - `event`: ?
  - `markets`: ?
  - `recommendations`: ?
  - `model`: ?

### GET /api/v2/referees/
**Summary:** List referees (v2)
**Notes:** Paginated referees list with computed match aggregates. Filter by league, name, country (ISO-2) or minimum matches. Ordered by matches officiated, descending.
**Params:**
  - `country_code` | string | ISO 3166-1 alpha-2 country code. Unknown codes return an empty list.
  - `league_id` | integer | Referees who have officiated at least one match in this league.
  - `limit` | integer | Page size (default 50, max 200).
  - `min_matches` | integer | Minimum matches officiated (default: 0).
  - `name` | string | Partial, case-insensitive match on referee name.
  - `offset` | integer
**Response fields:**
  - `id`: integer
  - `name`: string
  - `country`: string
  - `nationality_a3`: string
  - `birthdate`: string
  - `matches`: integer
  - `total_yellow_cards`: integer
  - `total_red_cards`: integer
  - `avg_yellow_per_match`: number
  - `avg_red_per_match`: number
  - `avg_goals_per_match`: number
  - `avg_fouls_per_match`: number
  - `career_games`: integer
  - `career_yellow_cards`: integer
  - `career_red_cards`: integer

### GET /api/v2/referees/{id}/
**Summary:** Referee detail (v2)
**Notes:** New in v2 (no equivalent in v1). Same shape as the list item, with aggregate stats over all played matches.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `name`: string
  - `country`: string
  - `nationality_a3`: string
  - `birthdate`: string
  - `matches`: integer
  - `total_yellow_cards`: integer
  - `total_red_cards`: integer
  - `avg_yellow_per_match`: number
  - `avg_red_per_match`: number
  - `avg_goals_per_match`: number
  - `avg_fouls_per_match`: number
  - `career_games`: integer
  - `career_yellow_cards`: integer
  - `career_red_cards`: integer

### GET /api/v2/referees/{id}/matches/
**Summary:** Referee matches (v2)
**Notes:** Matches officiated by this referee, newest first. Returns the full history by default — narrow it with `date_from`/`date_to`, `league_id`, `season_id` or `status`. Same row shape as `/api/v2/events/`.
**Params:**
  - `date_from` | string | ISO 8601 UTC.
  - `date_to` | string | ISO 8601 UTC.
  - `id` | integer | REQUIRED
  - `league_id` | integer
  - `limit` | integer | Page size (default 50, max 200).
  - `offset` | integer
  - `season_id` | integer
  - `status` | string | Filter by match status.
**Response fields:**
  - `id`: integer
  - `league_id`: integer
  - `season_id`: integer
  - `home_team_id`: integer
  - `home_team`: string
  - `away_team_id`: integer
  - `away_team`: string
  - `home_coach_id`: integer
  - `away_coach_id`: integer
  - `referee_id`: integer
  - `venue_id`: integer
  - `event_date`: string
  - `status`: string
  - `replaced_by`: integer
  - `round_number`: integer
  - `round_name`: string
  - `group_name`: string
  - `period`: string
  - `current_minute`: integer
  - `home_score`: integer
  - `away_score`: integer
  - `home_score_ht`: integer
  - `away_score_ht`: integer
  - `penalty_shootout`: ?
  - `extra_time_score`: ?
  - `is_local_derby`: boolean
  - `stage`: string
  - `stage_name`: string
  - `round_label`: string
  - `is_neutral_ground`: boolean
  - `travel_distance_km`: integer
  - `weather`: ?
  - `pitch_condition`: integer
  - `attendance`: integer
  - `live_websocket`: boolean
  - `websocket_plus`: boolean
  - `highlights`: array<_HighlightSchema>
  - `head_to_head`: ?

### GET /api/v2/social/
**Summary:** List social items (v2)
**Notes:** Paginated feed of tweets and video highlights linked to BSD entities. News items (v1 type=`news`) are intentionally excluded from v2. Order: published_at DESC. Cached 15 min.
**Params:**
  - `account_verified` | boolean
  - `event_id` | integer
  - `league_id` | integer | Items linked to events of this league.
  - `limit` | integer
  - `manager_id` | integer
  - `offset` | integer
  - `player_id` | integer | Filter by mentioned player. Linking is **heuristic** (best-effort NLP/regex over the text); false positives are possible.
  - `published_after` | string
  - `published_before` | string
  - `season_id` | integer | Items linked to events of this season.
  - `team_id` | integer
  - `type` | string
**Response fields:**
  - `id`: integer
  - `type`: string
  - `url`: string
  - `text`: string
  - `title`: string
  - `thumbnail`: string
  - `media`: array<SocialMediaItemSchema>
  - `account`: ?
  - `published_at`: string
  - `linked`: ?

### GET /api/v2/social/{id}/
**Summary:** Social item detail (v2)
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `type`: string
  - `url`: string
  - `text`: string
  - `title`: string
  - `thumbnail`: string
  - `media`: array<SocialMediaItemSchema>
  - `account`: ?
  - `published_at`: string
  - `linked`: ?

### GET /api/v2/teams/
**Summary:** List teams (v2)
**Notes:** Paginated teams list. Filter by country (ISO-2), league, season, name, or competition status. Spatial / squad data is not in this list — fetch it from `/teams/{id}/squad/` or `/teams/{id}/fixtures/`.
**Params:**
  - `country_code` | string | ISO 3166-1 alpha-2 country code (e.g. PT, ES, BR). Unknown codes return an empty list.
  - `in_competition` | boolean | Set true for teams with upcoming matches in the league. Requires `league_id`; otherwise responds 400.
  - `is_women` | boolean | Filter by women / men competitions (requires `league_id` or `season_id` to apply).
  - `league_id` | integer | Teams that have at least one event in this league.
  - `limit` | integer | Page size (default 50, max 200).
  - `name` | string | Partial, case-insensitive match on team name.
  - `offset` | integer
  - `season_id` | integer | Teams that participated in this season.
**Response fields:**
  - `id`: integer
  - `name`: string
  - `short_name`: string
  - `country`: string
  - `country_code`: string
  - `venue_id`: integer

### GET /api/v2/teams/{id}/
**Summary:** Team detail (v2)
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `name`: string
  - `short_name`: string
  - `country`: string
  - `country_code`: string
  - `venue_id`: integer

### GET /api/v2/teams/{id}/fixtures/
**Summary:** Team fixtures (v2)
**Notes:** Matches for this team. Defaults to a window of `now - 3h` to `now + 7d` when no date filters are provided. Final response shape will be aligned with `/api/v2/events/` in the schema pass.
**Params:**
  - `date_from` | string | ISO 8601 UTC, e.g. 2026-04-30T00:00:00Z.
  - `date_to` | string | ISO 8601 UTC, e.g. 2026-04-30T23:59:59Z.
  - `id` | integer | REQUIRED
  - `league_id` | integer | Restrict to fixtures in this league.
  - `limit` | integer | Page size (default 50, max 200).
  - `offset` | integer
  - `status` | string | Filter by match status.
**Response fields:**
  - `id`: integer
  - `league_id`: integer
  - `season_id`: integer
  - `home_team_id`: integer
  - `home_team`: string
  - `away_team_id`: integer
  - `away_team`: string
  - `home_coach_id`: integer
  - `away_coach_id`: integer
  - `referee_id`: integer
  - `venue_id`: integer
  - `event_date`: string
  - `status`: string
  - `replaced_by`: integer
  - `round_number`: integer
  - `round_name`: string
  - `group_name`: string
  - `period`: string
  - `current_minute`: integer
  - `home_score`: integer
  - `away_score`: integer
  - `home_score_ht`: integer
  - `away_score_ht`: integer
  - `penalty_shootout`: ?
  - `extra_time_score`: ?
  - `is_local_derby`: boolean
  - `stage`: string
  - `stage_name`: string
  - `round_label`: string
  - `is_neutral_ground`: boolean
  - `travel_distance_km`: integer
  - `weather`: ?
  - `pitch_condition`: integer
  - `attendance`: integer
  - `live_websocket`: boolean
  - `websocket_plus`: boolean
  - `highlights`: array<_HighlightSchema>
  - `head_to_head`: ?

### GET /api/v2/teams/{id}/form/
**Summary:** Rolling form over the last N matches (v2)
**Notes:** Everything a team did over its last N finished matches, already averaged: results, goals, points per match and the mean of every statistic the matches reported — split by venue and by whether the opponent was placed above or below in the table.  This exists to replace the loop. Computing it yourself is a fixtures call plus a stats call per match; this is one call over rows we already have in memory.  **Read the denominators.** Every statistic carries its own `matches`, because a team can have possession in ten matches and dribbles in four, and averaging the dribbles over ten would be inventing
**Params:**
  - `id` | integer | REQUIRED
  - `last` | integer | Window size, 1–40. Default 10.
  - `league_id` | integer | Restrict the window to one competition. Without it, every competition counts — which is usually not what you want for league form.
  - `venue` | string | Restrict the window itself. The response always carries the home/away splits of whatever window you asked for.
**Response fields:**
  - `team_id`: integer
  - `team_name`: string
  - `requested`: integer
  - `matches`: integer
  - `league_id`: integer
  - `from_date`: string
  - `to_date`: string
  - `overall`: _FormSplitV2Schema
  - `home`: _FormSplitV2Schema
  - `away`: _FormSplitV2Schema
  - `vs_stronger`: ?
  - `vs_weaker`: ?

### GET /api/v2/teams/{id}/social/
**Summary:** Social items for a team (v2)
**Notes:** Paginated tweets and video highlights linked to this team. Cached 15 min.
**Params:**
  - `account_verified` | boolean
  - `id` | integer | REQUIRED
  - `limit` | integer
  - `offset` | integer
  - `published_after` | string
  - `published_before` | string
  - `type` | string
**Response fields:**
  - `id`: integer
  - `type`: string
  - `url`: string
  - `text`: string
  - `title`: string
  - `thumbnail`: string
  - `media`: array<SocialMediaItemSchema>
  - `account`: ?
  - `published_at`: string
  - `linked`: ?

### GET /api/v2/teams/{id}/squad/
**Summary:** Team squad (v2)
**Notes:** Active players currently linked to this team via `current_team`, ordered by position then shirt number. Each player carries their current availability (`availability`, `injury_type`, `injury_expected_return`), so team news does not need a second call.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `team_id`: integer
  - `count`: integer
  - `players`: array<SquadPlayerV2Schema>

### GET /api/v2/transfers/
**Summary:** Transfers feed (v2)
**Notes:** Cross-player transfer feed. Newest first by default; pass `ordering=-fee` for the biggest deals. Filter by league, team (incoming or outgoing), player, date range and minimum fee. Fees are in EUR. Unknown query parameters are rejected with 400 rather than ignored, so a mistyped filter fails loudly instead of returning the unfiltered feed.
**Params:**
  - `date_from` | string | Earliest transfer_date (YYYY-MM-DD).
  - `date_to` | string | Latest transfer_date (YYYY-MM-DD).
  - `from_team_id` | integer | Only transfers OUT OF this team.
  - `has_fee` | boolean | Only transfers with a known paid fee (>0).
  - `league_id` | integer | Transfers where either club has played in this league (BSD league id, the one from /api/v2/leagues/). Same either-side semantics as team_id.
  - `limit` | integer | Page size (default 25, max 100).
  - `min_fee` | integer | Minimum fee in EUR (implies a paid transfer).
  - `offset` | integer | Pagination offset.
  - `ordering` | string | One of: -transfer_date (default), transfer_date, -fee, fee.
  - `player_id` | integer | Only this player.
  - `team_id` | integer | Transfers involving this team (incoming OR outgoing).
  - `to_team_id` | integer | Only transfers INTO this team.
**Response fields:**
  - `id`: integer
  - `transfer_date`: string
  - `player`: ?
  - `from_team_id`: integer
  - `from_team_name`: string
  - `to_team_id`: integer
  - `to_team_name`: string
  - `fee_eur`: integer
  - `fee_description`: string
  - `transfer_type`: integer

### GET /api/v2/transfers/ledger/
**Summary:** Transfer ledger (v2)
**Notes:** Club-level transfer accounting for a window: gross spend, gross income, net spend, squad turnover, loan dependency and the average age of players in and out.  Money only counts where a fee was published. A move with no figure is counted under `undisclosed` rather than as zero — summing the blanks as zeroes reports a tenth of what the big leagues actually spend. `free` is the separate case where the fee is known to be nothing.  Loan returns are not arrivals. A player coming back from a loan is the same player returning to where he already belonged, and counting him as a signing inflates the arr
**Params:**
  - `date_from` | string
  - `date_to` | string | Never reaches past today even if you ask it to.
  - `league_id` | integer | Every club in the league, capped at 40.
  - `team_id` | integer | One club. Mutually exclusive with league_id.
**Response fields:**
  - `count`: integer
  - `net_spend_eur`: integer
  - `clubs`: array<ClubLedgerV2Schema>

### GET /api/v2/transfers/routes/
**Summary:** Transfer routes (v2)
**Notes:** The club pairs that repeat: who sells to whom, how often, how much changed hands and which players walked it.  Only moves where both ends are clubs we hold are counted. A route with a bare name on one side cannot be followed or linked, and the same club spelled three ways would show up as three destinations.
**Params:**
  - `date_from` | string
  - `date_to` | string
  - `league_id` | integer
  - `limit` | integer | Routes to return (default 50, max 200).
  - `min_moves` | integer | Minimum moves for a pair to count as a route (default 2).
  - `team_id` | integer
**Response fields:**
  - `count`: integer
  - `min_moves`: integer
  - `routes`: array<TransferRouteV2Schema>

### GET /api/v2/tv-channels/
**Summary:** List TV channels (v2)
**Notes:** Paginated list of licensed TV channels. Cached 1 hour.
**Params:**
  - `country_code` | string | ISO 3166-1 alpha-2 (e.g. PT, ES). 400 if malformed.
  - `limit` | integer
  - `name` | string | Case-insensitive partial match on channel name.
  - `offset` | integer
**Response fields:**
  - `id`: integer
  - `name`: string
  - `country_code`: string
  - `link`: string

### GET /api/v2/tv-channels/{id}/
**Summary:** TV channel detail (v2)
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `name`: string
  - `country_code`: string
  - `link`: string

### GET /api/v2/tv-channels/{id}/broadcasts/
**Summary:** Broadcasts emitted by a TV channel (v2)
**Notes:** Paginated list of broadcasts emitted by this channel. When neither date_from nor date_to is set, returns the default window now-3h to now+7d. Cached 1 hour.
**Params:**
  - `date_from` | string
  - `date_to` | string
  - `id` | integer | REQUIRED
  - `league_id` | integer
  - `limit` | integer
  - `offset` | integer
  - `season_id` | integer
**Response fields:**
  - `id`: integer
  - `event_id`: integer
  - `home_team_id`: integer
  - `home_team`: string
  - `away_team_id`: integer
  - `away_team`: string
  - `league_id`: integer
  - `league_name`: string
  - `event_date`: string
  - `country_code`: string
  - `channel_id`: integer
  - `channel_name`: string
  - `channel_link`: string
  - `scheduled_start_time`: string

### GET /api/v2/venues/
**Summary:** List venues (v2)
**Notes:** Paginated venues list. Filter by country (ISO-2), city, name, capacity, or home team.
**Params:**
  - `city` | string | Partial, case-insensitive match on city.
  - `country_code` | string | ISO 3166-1 alpha-2 country code. Unknown codes return an empty list.
  - `limit` | integer | Page size (default 50, max 200).
  - `min_capacity` | integer | Minimum seating capacity.
  - `name` | string | Partial, case-insensitive match on venue name.
  - `offset` | integer
  - `team_id` | integer | Venues that are the home stadium of this team.
**Response fields:**
  - `id`: integer
  - `name`: string
  - `city`: string
  - `country`: string
  - `country_code`: string
  - `capacity`: integer
  - `latitude`: number
  - `longitude`: number
  - `pitch_length_m`: integer
  - `pitch_width_m`: integer
  - `built_year`: integer
  - `home_team_id`: integer

### GET /api/v2/venues/{id}/
**Summary:** Venue detail (v2)
**Notes:** Single venue with embedded `competition_assignments` (list of tournament roles). Each venue typically has fewer than five assignments so they ship inline.
**Params:**
  - `id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `name`: string
  - `city`: string
  - `country`: string
  - `country_code`: string
  - `capacity`: integer
  - `latitude`: number
  - `longitude`: number
  - `pitch_length_m`: integer
  - `pitch_width_m`: integer
  - `built_year`: integer
  - `home_team_id`: integer

### GET /api/v2/venues/{id}/competitions/
**Summary:** Venue competitions (v2)
**Notes:** Every league and season this venue is used in, newest season first.
**Params:**
  - `id` | integer | REQUIRED
  - `limit` | integer | Page size (default 50, max 200).
  - `offset` | integer
**Response fields:**
  - `id`: integer
  - `league_id`: integer
  - `season_id`: integer
  - `host_country_code`: string
  - `hosts_opening`: boolean
  - `hosts_final`: boolean
  - `hosts_third_place`: boolean
  - `rounds`: array<string>
  - `match_count`: integer
  - `fifa_role`: string

### GET /api/v2/worldcup/squads/
**Summary:** World Cup 2026 squad call-ups (v2)
**Notes:** Per-player squad call-ups for the 2026 FIFA World Cup. Each row is a single announced player on a national team (26 final / up to 55 preliminary). `player_id` is null when the player is not yet in our Player table; the remaining fields (name, club, caps, goals, age) are still populated from the source. Filter with `has_player=true` to restrict to rows that resolve to an existing player.
**Params:**
  - `group` | string | Group stage letter (A–L).
  - `has_player` | boolean | Restrict to rows linked to a Player record (true) or only raw announcements without a linked Player (false).
  - `limit` | integer | Page size (default 50, max 200).
  - `offset` | integer
  - `status` | string | official = final 26-man list; preliminary = pre-list (up to 55); projected = unannounced rumour; dropped = removed from a list.
  - `team` | integer | Internal team id.
**Response fields:**
  - `id`: integer
  - `team_id`: integer
  - `name`: string
  - `jersey_number`: integer
  - `position`: string
  - `status`: string
  - `call_up_date`: string
  - `club`: string
  - `club_country`: string
  - `caps`: integer
  - `goals`: integer
  - `date_of_birth`: string
  - `age`: integer
  - `player_id`: integer

### GET /api/v2/worldcup/squads/{team_id}/
**Summary:** World Cup 2026 squad for one team (v2)
**Notes:** Full squad for a single national team at the 2026 FIFA World Cup. Returns every announced call-up sorted by position then jersey number. See `/api/v2/worldcup/squads/` for the paginated all-teams view.
**Params:**
  - `team_id` | integer | REQUIRED
**Response fields:**
  - `id`: integer
  - `team_id`: integer
  - `name`: string
  - `jersey_number`: integer
  - `position`: string
  - `status`: string
  - `call_up_date`: string
  - `club`: string
  - `club_country`: string
  - `caps`: integer
  - `goals`: integer
  - `date_of_birth`: string
  - `age`: integer
  - `player_id`: integer
