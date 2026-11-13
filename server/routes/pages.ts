import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import { config } from '../config';
import { getQuota } from '../lib/bsd/client';
import { fmt, nl2br, eq, json } from '../lib/format';
import { PREDICTION_THRESHOLD, buildCalls, callShortLabel } from '../lib/predictions';
import {
  getBestOdds,
  getBestXI,
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
  getLeague,
  getLeagueSeasons,
  getLeagues,
  getLiveEvents,
  getPlayer,
  getPlayerStats,
  getPlayerTransfers,
  getPredictions,
  getStandings,
  getTeam,
  getTeamFixtures,
  getTeamForm,
  getTeamSquad,
  getTopScorers,
  getTransfers,
  search,
} from '../lib/bsd/endpoints';
import type { FootballEvent, League, Quota } from '../lib/bsd/types';

/** Contrôleurs de pages + view models (contrat §7 / §7.1). */

export const pagesRouter: Router = express.Router();

/** Navigation identique pour toutes les pages (contrat §6.1). */
export const nav: { href: string; label: string; icon: string }[] = [
  { href: '/', label: 'Accueil', icon: 'home' },
  { href: '/live', label: 'Direct', icon: 'radio' },
  { href: '/fixtures', label: 'Calendrier', icon: 'calendar' },
  { href: '/leagues', label: 'Ligues', icon: 'trophy' },
  { href: '/palmares', label: 'Palmarès', icon: 'star' },
  { href: '/predictions', label: 'Prédictions', icon: 'sparkles' },
  { href: '/odds', label: 'Cotes', icon: 'chart' },
  { href: '/transfers', label: 'Mercato', icon: 'swap' },
  { href: '/recherche', label: 'Recherche', icon: 'search' },
];

const DAY = 86400000;

/** « YYYY-MM-DD » dans le fuseau Europe/Paris. */
function parisDateKey(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Paris',
  }).formatToParts(d);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const base = Date.UTC(y, m - 1, d);
  return parisDateKey(new Date(base + days * DAY));
}

function dayBounds(key: string): { from: string; to: string } {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const base = Date.UTC(y, m - 1, d);
  return {
    from: new Date(base).toISOString(),
    to: new Date(base + DAY - 1000).toISOString(),
  };
}

/**
 * Pattern de rendu imposé (§7.1) : la page est rendue sans <html>,
 * puis injectée dans le layout.
 */
function renderPage(
  res: Response,
  page: string,
  vm: Record<string, unknown>,
  extra: { title?: string; description?: string } = {},
): void {
  res.render(
    page,
    {
      ...vm,
      title: extra.title ?? '',
      description: extra.description ?? '',
      fmt,
      nl2br,
      eq,
      json,
    },
    (err, html) => {
      if (err) {
        console.error(`[pages] template manquant ou invalide : ${page}.ejs — ${err.message}`);
        res.status(500);
        res.render(
          'error',
          {
            title: '',
            description: '',
            status: 500,
            message: `Le template « ${page}.ejs » est introuvable ou invalide.`,
            fmt,
            nl2br,
            eq,
            json,
            currentPath: res.req.path,
            nav,
            demo: config.isDemo,
            quota: getQuota(),
          },
          (err2, html2) => {
            if (err2) {
              console.error(`[pages] template manquant : error.ejs — ${err2.message}`);
              res.type('text/plain').send('Template indisponible.');
              return;
            }
            res.send(html2);
          },
        );
        return;
      }
      res.render(
        'layout',
        {
          ...vm,
          title: extra.title ?? '',
          description: extra.description ?? '',
          body: html,
          currentPath: res.req.path,
          nav,
          demo: config.isDemo,
          quota: getQuota(),
          fmt,
          nl2br,
          eq,
          json,
        },
        (err2, layoutHtml) => {
          if (err2) {
            console.error(`[pages] template manquant ou invalide : layout.ejs — ${err2.message}`);
            res.status(500).type('text/plain').send('Template indisponible.');
            return;
          }
          // Express n'envoie rien quand un callback est fourni : c'est à nous de le faire.
          res.send(layoutHtml);
        },
      );
    },
  );
}

/** Page d'erreur générique (404 / 500) — rendue dans le layout complet. */
function renderError(res: Response, status: number, message: string): void {
  const vm = {
    title: status === 404 ? 'Introuvable' : 'Erreur',
    description: message,
    status,
    message,
    currentPath: res.req.path,
    nav,
    demo: config.isDemo,
    quota: getQuota(),
    fmt,
    nl2br,
    eq,
    json,
  };
  res.status(status).render(
    'error',
    vm,
    (err, body) => {
      if (err) {
        console.error(`[pages] template manquant : error.ejs — ${err.message}`);
        res.type('text/plain').send(message);
        return;
      }
      res.render('layout', { ...vm, body }, (err2, html) => {
        if (err2) {
          console.error(`[pages] template manquant : layout.ejs — ${err2.message}`);
          res.send(body);
          return;
        }
        res.send(html);
      });
    },
  );
}

function matchesOnDay(events: FootballEvent[], key: string): FootballEvent[] {
  return events.filter((e) => parisDateKey(e.date) === key);
}

/* ------------------------------------------------------------------ */
/* Accueil                                                              */
/* ------------------------------------------------------------------ */

pagesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const today = parisDateKey(new Date());
    const tomorrow = shiftDay(today, 1);
    const { from, to } = dayBounds(today);
    const [live, todayEvents, tomorrowEvents, leagues, topScorers, predictions, lastResults, highlights] =
      await Promise.all([
        getLiveEvents().catch(() => []),
        getFixtures({ dateFrom: from, dateTo: to }).catch(() => []),
        (async () => {
          const b = dayBounds(tomorrow);
          return getFixtures({ dateFrom: b.from, dateTo: b.to }).catch(() => []);
        })(),
        getLeagues().catch(() => [] as League[]),
        getTopScorers(1, { limit: 10 }).catch(() => []),
        getPredictions({ limit: 8 }).catch(() => []),
        (async () => {
          const from7 = new Date(Date.now() - 7 * DAY).toISOString();
          const to7 = new Date(Date.now() - 12 * 3600000).toISOString();
          const evts = await getFixtures({ dateFrom: from7, dateTo: to7 }).catch(() => []);
          return evts.filter((e) => e.status === 'finished').slice(-10).reverse();
        })(),
        // Palmarès : sert de bandeau sur l'accueil (données mises en cache 3 h par compétition).
        getHighlights({ limit: 10 }).catch(() => null),
      ]);

    renderPage(
      res,
      'home',
      {
        live,
        today: matchesOnDay(todayEvents, today),
        tomorrow: matchesOnDay(tomorrowEvents, tomorrow),
        leagues,
        topScorers,
        predictions,
        lastResults,
        highlights,
        // Bloc « Palmarès » pour le bandeau de l'accueil (template home.ejs).
        featured: highlights ? highlights.featured : null,
        palmares: highlights,
      },
      { title: 'Football en direct', description: 'Scores en direct, calendrier, classements et prédictions.' },
    );
  } catch (err) {
    nextError(res, err, 'Impossible de charger la page d’accueil.');
  }
});

/* ------------------------------------------------------------------ */
/* Direct                                                               */
/* ------------------------------------------------------------------ */

pagesRouter.get('/live', async (_req: Request, res: Response) => {
  try {
    const [live, leagues] = await Promise.all([
      getLiveEvents().catch(() => []),
      getLeagues().catch(() => [] as League[]),
    ]);
    renderPage(res, 'live', { live, leagues, updatedAt: new Date() }, {
      title: 'Direct',
      description: 'Tous les matchs en direct, minute par minute.',
    });
  } catch (err) {
    nextError(res, err, 'Impossible de charger les matchs en direct.');
  }
});

/* ------------------------------------------------------------------ */
/* Calendrier                                                           */
/* ------------------------------------------------------------------ */

async function renderFixtures(req: Request, res: Response, dateKey: string): Promise<void> {
  const { from, to } = dayBounds(dateKey);
  const [events, leagues] = await Promise.all([
    getFixtures({ dateFrom: from, dateTo: to }).catch(() => []),
    getLeagues().catch(() => [] as League[]),
  ]);
  renderPage(
    res,
    'fixtures',
    {
      date: dateKey,
      dateFrom: from,
      dateTo: to,
      events,
      leagues,
      prevDate: shiftDay(dateKey, -1),
      nextDate: shiftDay(dateKey, 1),
    },
    { title: `Calendrier ${dateKey}`, description: 'Programme des matchs du jour.' },
  );
}

pagesRouter.get('/fixtures', async (req: Request, res: Response) => {
  try {
    await renderFixtures(req, res, parisDateKey(new Date()));
  } catch (err) {
    nextError(res, err, 'Impossible de charger le calendrier.');
  }
});

pagesRouter.get('/fixtures/:date', async (req: Request, res: Response) => {
  const raw = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    renderError(res, 404, 'Date invalide.');
    return;
  }
  try {
    await renderFixtures(req, res, raw);
  } catch (err) {
    nextError(res, err, 'Impossible de charger le calendrier.');
  }
});

/* ------------------------------------------------------------------ */
/* Match                                                                */
/* ------------------------------------------------------------------ */

pagesRouter.get('/match/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    renderError(res, 404, 'Match introuvable.');
    return;
  }
  try {
    const event = await getEvent(id);
    if (!event) {
      renderError(res, 404, 'Ce match est introuvable.');
      return;
    }
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
    // L'endpoint match ne renvoie pas le nom de la compétition : on le résout (1 appel, cache 1 h).
    const league = event.leagueName ? null : await getLeague(event.leagueId).catch(() => null);
    const matchEvent = league ? { ...event, leagueName: league.name } : event;

    renderPage(
      res,
      'match',
      {
        event: matchEvent,
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
      },
      {
        title: `${event.homeTeam} - ${event.awayTeam}`,
        description: `Statistiques, compositions et commentaires du match ${event.homeTeam} - ${event.awayTeam}.`,
      },
    );
  } catch (err) {
    nextError(res, err, 'Impossible de charger ce match.');
  }
});

/* ------------------------------------------------------------------ */
/* Ligues                                                               */
/* ------------------------------------------------------------------ */

pagesRouter.get('/leagues', async (_req: Request, res: Response) => {
  try {
    const leagues = await getLeagues().catch(() => [] as League[]);
    const countries = [...new Set(leagues.map((l) => l.country).filter((c) => c.length > 0))].sort((a, b) =>
      a.localeCompare(b, 'fr'),
    );
    renderPage(
      res,
      'leagues',
      {
        leagues,
        countries,
        womenCount: leagues.filter((l) => l.isWomen).length,
        menCount: leagues.filter((l) => !l.isWomen).length,
      },
      { title: 'Ligues', description: 'Toutes les compétitions couvertes par Zoera.' },
    );
  } catch (err) {
    nextError(res, err, 'Impossible de charger les ligues.');
  }
});

pagesRouter.get('/leagues/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    renderError(res, 404, 'Ligue introuvable.');
    return;
  }
  try {
    const league = await getLeague(id);
    if (!league) {
      renderError(res, 404, 'Cette ligue est introuvable.');
      return;
    }
    const [seasons, standings, topScorers, bestXI, events] = await Promise.all([
      getLeagueSeasons(id).catch(() => []),
      getStandings(id).catch(() => null),
      getTopScorers(id, { limit: 10 }).catch(() => []),
      league.currentSeason ? getBestXI(id, league.currentSeason.id).catch(() => null) : Promise.resolve(null),
      (async () => {
        const from = new Date(Date.now() - 30 * DAY).toISOString();
        const to = new Date(Date.now() + 30 * DAY).toISOString();
        const all = await getFixtures({ dateFrom: from, dateTo: to, leagueId: id }).catch(() => []);
        return all.filter((e) => e.leagueId === id);
      })(),
    ]);
    renderPage(
      res,
      'league',
      {
        league,
        season: league.currentSeason,
        seasons,
        standings,
        topScorers,
        bestXI,
        events,
        venues: [],
      },
      { title: `${league.name}`, description: `Classement, statistiques et calendrier de ${league.name}.` },
    );
  } catch (err) {
    nextError(res, err, 'Impossible de charger cette ligue.');
  }
});

/* ------------------------------------------------------------------ */
/* Palmarès                                                             */
/* ------------------------------------------------------------------ */

pagesRouter.get('/palmares', async (_req: Request, res: Response) => {
  try {
    const highlights = await getHighlights();
    renderPage(
      res,
      'palmares',
      {
        featured: highlights.featured,
        competitions: highlights.competitions,
        clubs: highlights.clubs,
        players: highlights.players,
        leaguesAnalysed: highlights.leaguesAnalysed,
        generatedAt: highlights.generatedAt,
      },
      {
        title: 'Palmarès',
        description: 'Meilleurs clubs, meilleur joueur et meilleure compétition, calculés sur les données de la saison.',
      },
    );
  } catch (err) {
    nextError(res, err, 'Impossible de calculer le palmarès.');
  }
});

/* ------------------------------------------------------------------ */
/* Équipe                                                               */
/* ------------------------------------------------------------------ */

pagesRouter.get('/teams/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    renderError(res, 404, 'Équipe introuvable.');
    return;
  }
  try {
    const team = await getTeam(id);
    if (!team) {
      renderError(res, 404, 'Cette équipe est introuvable.');
      return;
    }
    const [squad, form, events, transfers] = await Promise.all([
      getTeamSquad(id).catch(() => []),
      getTeamForm(id).catch(() => null),
      getTeamFixtures(id).catch(() => []),
      getTransfers({ teamId: id }).catch(() => []),
    ]);
    renderPage(
      res,
      'team',
      { team, squad, form, events, transfers },
      { title: `${team.name}`, description: `Effectif, forme et résultats de ${team.name}.` },
    );
  } catch (err) {
    nextError(res, err, 'Impossible de charger cette équipe.');
  }
});

/* ------------------------------------------------------------------ */
/* Joueur                                                               */
/* ------------------------------------------------------------------ */

pagesRouter.get('/players/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    renderError(res, 404, 'Joueur introuvable.');
    return;
  }
  try {
    const player = await getPlayer(id);
    if (!player) {
      renderError(res, 404, 'Ce joueur est introuvable.');
      return;
    }
    const [stats, transfers, events] = await Promise.all([
      getPlayerStats(id).catch(() => []),
      getPlayerTransfers(id).catch(() => []),
      player.currentTeamId
        ? getTeamFixtures(player.currentTeamId).catch(() => [])
        : Promise.resolve([]),
    ]);
    renderPage(
      res,
      'player',
      { player, stats, transfers, events },
      { title: `${player.name}`, description: `Profil et statistiques de ${player.name}.` },
    );
  } catch (err) {
    nextError(res, err, 'Impossible de charger ce joueur.');
  }
});

/* ------------------------------------------------------------------ */
/* Prédictions / cotes / transferts / recherche                          */
/* ------------------------------------------------------------------ */

pagesRouter.get('/predictions', async (_req: Request, res: Response) => {
  try {
    /* Assez large pour couvrir les 5 jours publiés par le modèle, puis on ne
       garde que les matchs qui portent au moins un appel ≥ seuil. */
    const predictions = await getPredictions({ limit: 200 }).catch(() => []);
    const now = new Date();
    const today = parisDateKey(now);
    const tomorrow = parisDateKey(new Date(now.getTime() + DAY));
    const weekEnd = parisDateKey(new Date(now.getTime() + 6 * DAY));

    const rows = predictions
      .map((p) => ({
        ...p,
        dateKey: p.date ? parisDateKey(p.date) : '',
        calls: buildCalls(p),
      }))
      .filter((p) => p.calls.length > 0)
      .sort((a, b) => (a.date && b.date ? a.date.getTime() - b.date.getTime() : 0));

    /* Compétitions réellement présentes, pour le filtre. */
    const leagueMap = new Map<number, string>();
    for (const row of rows) {
      if (row.leagueId !== null && row.leagueName && !leagueMap.has(row.leagueId)) {
        leagueMap.set(row.leagueId, row.leagueName);
      }
    }
    const predLeagues = Array.from(leagueMap, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'fr'),
    );

    const counts = {
      today: rows.filter((r) => r.dateKey === today).length,
      tomorrow: rows.filter((r) => r.dateKey === tomorrow).length,
      week: rows.filter((r) => r.dateKey >= today && r.dateKey <= weekEnd).length,
      all: rows.length,
    };
    const modelName = rows.find((r) => r.model)?.model ?? '';

    renderPage(
      res,
      'predictions',
      {
        rows,
        predLeagues,
        counts,
        scanned: predictions.length,
        threshold: PREDICTION_THRESHOLD,
        modelName,
        callShortLabel,
        dates: { today, tomorrow, weekEnd },
      },
      {
        title: 'Prédictions',
        description: 'Les appels du modèle : un pari par match, publié seulement à partir de 80 % de confiance.',
      },
    );
  } catch (err) {
    nextError(res, err, 'Impossible de charger les prédictions.');
  }
});

pagesRouter.get('/odds', async (req: Request, res: Response) => {
  try {
    const market = typeof req.query.market === 'string' ? req.query.market : '1x2';
    const odds = await getBestOdds({ market }).catch(() => []);
    renderPage(
      res,
      'odds',
      { odds, markets: ['1x2', 'over_under_25', 'over_under_15', 'btts'], market },
      { title: 'Cotes', description: 'Meilleures cotes disponibles sur les matchs à venir.' },
    );
  } catch (err) {
    nextError(res, err, 'Impossible de charger les cotes.');
  }
});

pagesRouter.get('/transfers', async (_req: Request, res: Response) => {
  try {
    const [transfers, leagues] = await Promise.all([
      getTransfers({ limit: 40 }).catch(() => []),
      getLeagues().catch(() => [] as League[]),
    ]);
    renderPage(res, 'transfers', { transfers, leagues }, {
      title: 'Mercato',
      description: 'Les derniers transferts et montants du mercato.',
    });
  } catch (err) {
    nextError(res, err, 'Impossible de charger les transferts.');
  }
});

pagesRouter.get('/recherche', async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  try {
    const [teams, players, leagues] = query
      ? await Promise.all([
          search(query).then((r) => r.teams),
          search(query).then((r) => r.players),
          search(query).then((r) => r.leagues),
        ])
      : [[], [], [] as League[]];
    renderPage(res, 'search', { query, teams, players, leagues }, {
      title: `Recherche`,
      description: 'Rechercher un club, un joueur ou une compétition.',
    });
  } catch (err) {
    nextError(res, err, 'Recherche indisponible.');
  }
});

/* ------------------------------------------------------------------ */
/* Utilitaire                                                           */
/* ------------------------------------------------------------------ */

function nextError(res: Response, err: unknown, message: string): void {
  console.error(`[pages] ${res.req.path} — ${err instanceof Error ? err.message : String(err)}`);
  renderError(res, 500, message);
}

/** 404 global. */
export function notFoundHandler(_req: Request, res: Response, _next: NextFunction): void {
  renderError(res, 404, 'Cette page est introuvable.');
}

export default pagesRouter;
