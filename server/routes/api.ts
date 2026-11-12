import express, { type Request, type Response, type Router } from 'express';
import { config } from '../config';
import { getQuota } from '../lib/bsd/client';
import {
  getBestOdds,
  getEvent,
  getEventAvailability,
  getEventCommentary,
  getEventH2H,
  getEventIncidents,
  getEventLineups,
  getEventOdds,
  getEventPlayerStats,
  getEventPrediction,
  getEventStats,
  getFixtures,
  getHighlights,
  getLeagues,
  getLeague,
  getLiveEvents,
  getPredictions,
  getStandings,
  getTeam,
  getTeamForm,
  getTeamSquad,
  getTeams,
  getTopScorers,
  getTransfers,
  search,
} from '../lib/bsd/endpoints';
import type { Quota } from '../lib/bsd/types';

/** Routes API JSON (contrat §8). */

export const apiRouter: Router = express.Router();

function quota(): Quota {
  return getQuota();
}

/** Enveloppe d'erreur normalisée §3. */
function sendError(res: Response, status: number, detail: string): void {
  res.status(status).json({ error: true, status, detail });
}

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    demo: config.isDemo,
    hasKey: config.hasKey,
    baseUrl: config.baseUrl,
    version: config.version,
    uptime: Math.round(process.uptime()),
  });
});

apiRouter.get('/quota', (_req: Request, res: Response) => {
  const q = quota();
  res.json({
    remaining: q.remaining,
    limit: q.limit,
    resetIn: q.resetIn,
    demo: config.isDemo,
  });
});

apiRouter.get('/live', async (_req: Request, res: Response) => {
  try {
    const live = await getLiveEvents();
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.json({
      live,
      quota: quota(),
      demo: config.isDemo,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    sendError(res, 503, err instanceof Error ? err.message : 'Impossible de récupérer les matchs en direct.');
  }
});

apiRouter.get('/palmares', async (req: Request, res: Response) => {
  try {
    const limitRaw = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitRaw !== undefined && Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
    const highlights = await getHighlights({ limit });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    res.json(highlights);
  } catch (err) {
    sendError(res, 503, err instanceof Error ? err.message : 'Impossible de calculer le palmarès.');
  }
});

apiRouter.get('/events', async (req: Request, res: Response) => {
  try {
    const dateFrom = typeof req.query.date_from === 'string' ? req.query.date_from : undefined;
    const dateTo = typeof req.query.date_to === 'string' ? req.query.date_to : undefined;
    const leagueId = req.query.league_id ? Number(req.query.league_id) : undefined;
    const now = new Date();
    const from = dateFrom ?? new Date(now.getTime() - 7 * 86400000).toISOString();
    const to = dateTo ?? new Date(now.getTime() + 7 * 86400000).toISOString();
    const events = await getFixtures({ dateFrom: from, dateTo: to, leagueId });
    res.json({ events, quota: quota() });
  } catch (err) {
    sendError(res, 503, err instanceof Error ? err.message : 'Impossible de récupérer le calendrier.');
  }
});

apiRouter.get('/match/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    sendError(res, 400, 'Identifiant de match invalide.');
    return;
  }
  try {
    const event = await getEvent(id);
    if (!event) {
      sendError(res, 404, 'Match introuvable.');
      return;
    }
    // Ressources annexes : une erreur ne doit pas faire échouer la page.
    const [stats, lineups, incidents, commentary, h2h, odds, prediction, availability, playerStats, standings] =
      await Promise.all([
        getEventStats(id).catch(() => null),
        getEventLineups(id).catch(() => null),
        getEventIncidents(id).catch(() => []),
        getEventCommentary(id).catch(() => []),
        getEventH2H(id).catch(() => null),
        getEventOdds(id).catch(() => null),
        getEventPrediction(id).catch(() => null),
        getEventAvailability(id).catch(() => null),
        getEventPlayerStats(id).catch(() => []),
        getStandings(event.leagueId).catch(() => null),
      ]);
    const homeStanding = standings?.flat.find((s) => s.teamId === event.homeTeamId) ?? null;
    const awayStanding = standings?.flat.find((s) => s.teamId === event.awayTeamId) ?? null;
    const league = event.leagueName ? null : await getLeague(event.leagueId).catch(() => null);
    res.json({
      event: league ? { ...event, leagueName: league.name } : event,
      stats,
      lineups,
      incidents,
      commentary,
      h2h,
      odds,
      prediction,
      availability,
      playerStats,
      standings,
      homeStanding,
      awayStanding,
      venue: null,
      referee: null,
    });
  } catch (err) {
    sendError(res, 503, err instanceof Error ? err.message : 'Impossible de récupérer le match.');
  }
});

apiRouter.get('/standings/:leagueId', async (req: Request, res: Response) => {
  const leagueId = Number(req.params.leagueId);
  if (!Number.isFinite(leagueId)) {
    sendError(res, 400, 'Identifiant de ligue invalide.');
    return;
  }
  try {
    const seasonId = req.query.season_id ? Number(req.query.season_id) : undefined;
    const standings = await getStandings(leagueId, seasonId);
    res.json(standings);
  } catch (err) {
    sendError(res, 503, err instanceof Error ? err.message : 'Impossible de récupérer le classement.');
  }
});

apiRouter.get('/search', async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.json({ teams: [], players: [], leagues: [] });
    return;
  }
  try {
    const result = await search(q);
    res.json(result);
  } catch (err) {
    sendError(res, 503, err instanceof Error ? err.message : 'Recherche indisponible.');
  }
});

apiRouter.get('/teams', async (req: Request, res: Response) => {
  try {
    const teams = await getTeams({
      leagueId: req.query.league_id ? Number(req.query.league_id) : undefined,
      name: typeof req.query.name === 'string' ? req.query.name : undefined,
      countryCode: typeof req.query.country_code === 'string' ? req.query.country_code : undefined,
    });
    res.json({ teams });
  } catch (err) {
    sendError(res, 503, err instanceof Error ? err.message : 'Impossible de récupérer les équipes.');
  }
});

apiRouter.get('/team/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    const team = await getTeam(id);
    if (!team) {
      sendError(res, 404, 'Équipe introuvable.');
      return;
    }
    const [squad, form] = await Promise.all([
      getTeamSquad(id).catch(() => []),
      getTeamForm(id).catch(() => null),
    ]);
    res.json({ team, squad, form });
  } catch (err) {
    sendError(res, 503, err instanceof Error ? err.message : 'Impossible de récupérer l’équipe.');
  }
});

apiRouter.get('/leagues', async (_req: Request, res: Response) => {
  try {
    const leagues = await getLeagues();
    res.json({ leagues });
  } catch (err) {
    sendError(res, 503, err instanceof Error ? err.message : 'Impossible de récupérer les ligues.');
  }
});

apiRouter.get('/predictions', async (req: Request, res: Response) => {
  try {
    const predictions = await getPredictions({
      dateFrom: typeof req.query.date_from === 'string' ? req.query.date_from : undefined,
      dateTo: typeof req.query.date_to === 'string' ? req.query.date_to : undefined,
      leagueId: req.query.league_id ? Number(req.query.league_id) : undefined,
    });
    res.json({ predictions });
  } catch (err) {
    sendError(res, 503, err instanceof Error ? err.message : 'Impossible de récupérer les prédictions.');
  }
});

apiRouter.get('/odds', async (req: Request, res: Response) => {
  try {
    const odds = await getBestOdds({
      market: typeof req.query.market === 'string' ? req.query.market : undefined,
      dateFrom: typeof req.query.date_from === 'string' ? req.query.date_from : undefined,
      dateTo: typeof req.query.date_to === 'string' ? req.query.date_to : undefined,
    });
    res.json({ odds });
  } catch (err) {
    sendError(res, 503, err instanceof Error ? err.message : 'Impossible de récupérer les cotes.');
  }
});

apiRouter.get('/transfers', async (req: Request, res: Response) => {
  try {
    const transfers = await getTransfers({
      leagueId: req.query.league_id ? Number(req.query.league_id) : undefined,
      teamId: req.query.team_id ? Number(req.query.team_id) : undefined,
      ordering: typeof req.query.ordering === 'string' ? req.query.ordering : undefined,
    });
    res.json({ transfers });
  } catch (err) {
    sendError(res, 503, err instanceof Error ? err.message : 'Impossible de récupérer les transferts.');
  }
});

export default apiRouter;
