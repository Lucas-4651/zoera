import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config';
import { apiRouter } from './routes/api';
import { notFoundHandler, pagesRouter } from './routes/pages';
import { purgeExpired } from './lib/bsd/cache';
import { fmt, nl2br, eq, json } from './lib/format';

/**
 * Bootstrap Express (Zoera).
 */

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(config.projectRoot, 'server', 'views'));
app.disable('x-powered-by');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Fichiers statiques (CSS/JS compilés).
app.use(express.static(path.join(config.projectRoot, 'public'), { maxAge: '1h' }));

// API JSON.
app.use('/api', apiRouter);

// Pages HTML.
app.use('/', pagesRouter);

// 404.
app.use(notFoundHandler);

// Gestionnaire d'erreurs : jamais de page blanche.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[server] ${req.method} ${req.path} — ${err instanceof Error ? err.stack : String(err)}`);
  if (res.headersSent) return;
  const status = typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status: unknown }).status) : 500;
  res.status(Number.isFinite(status) && status >= 400 && status < 600 ? status : 500);
  const vm = {
    title: 'Erreur',
    description: 'Une erreur est survenue.',
    status: res.statusCode,
    message: err instanceof Error ? err.message : 'Erreur interne.',
    currentPath: req.path,
    nav: [],
    demo: config.isDemo,
    quota: { remaining: null, limit: config.quotaLimit, resetIn: null },
    fmt,
    nl2br,
    eq,
    json,
  };
  res.render(
    'error',
    vm,
    (renderErr, body) => {
      if (renderErr) {
        console.error(`[server] template manquant : error.ejs — ${renderErr.message}`);
        res.type('text/plain').send('Erreur interne du serveur.');
        return;
      }
      res.render('layout', { ...vm, body }, (layoutErr, html) => {
        if (layoutErr) {
          console.error(`[server] template manquant : layout.ejs — ${layoutErr.message}`);
          res.send(body);
          return;
        }
        res.send(html);
      });
    },
  );
});

// Purge périodique du cache expiré (au moins une fois par heure).
const purgeTimer = setInterval(() => {
  const removed = purgeExpired(true);
  if (removed > 0) console.log(`[cache] ${removed} entrée(s) expirée(s) purgée(s).`);
}, 60 * 60 * 1000);
purgeTimer.unref();

const server = app.listen(config.port, () => {
  console.log(`[server] Zoera démarré sur http://localhost:${config.port}`);
  console.log(`[server] Base API : ${config.baseUrl}`);
  console.log(`[server] Mode : ${config.isDemo ? 'DÉMO (données simulées)' : 'API BSD réelle'}`);
});

function shutdown(): void {
  server.close(() => {
    console.log('[server] Arrêt.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
