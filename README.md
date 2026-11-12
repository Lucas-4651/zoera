# Zoera — app football temps réel

Application football complète (scores en direct, calendrier, classements, statistiques xG,
compositions, H2H, cotes, prédictions, mercato, recherche) construite sur l'API gratuite
**Bzzoiro Sports Data (BSD)** — `https://sports.bzzoiro.com`.

Stack : **Node.js 22 · Express 4 · TypeScript · Tailwind CSS v4 · EJS** (rendu serveur).
Aucun bundler, aucune base de données, aucun framework SPA.

**Zoera** signifie « joueur » en malgache : l'app est faite pour les communautés
malagasy qui suivent le football.

---

## Démarrage rapide

```bash
npm install
cp .env.example .env      # optionnel : sans clé, l'app démarre en MODE DÉMO
npm run dev               # http://localhost:3000
```

- **Mode démo** (aucune clé) : l'app est entièrement navigable avec un jeu de données
  simulées cohérent (10 compétitions, 40 clubs, matchs en direct, classements, xG, cotes…).
  Badge « MODE DÉMO » en haut de page.
- **Mode réel** : renseignez `BSD_API_KEY` dans `.env` puis redémarrez.

### Obtenir une clé API (gratuit, 2 minutes)

1. Inscription : <https://sports.bzzoiro.com/register/> (puis validez l'e-mail reçu).
2. Dashboard : <https://sports.bzzoiro.com/dashboard/> → copiez l'API key.
3. `.env` :

```dotenv
BSD_API_KEY=Votre_cle_ici
```

Quota du palier gratuit : **7 500 requêtes / jour** (reset minuit UTC), rafales limitées à
25 req/s sur les endpoints chauds. L'app suit ce quota en temps réel (indicateur en header,
`GET /api/quota`) et le repère dans le cache pour ne jamais le dépasser.

---

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur Express en rechargement (`tsx watch`) |
| `npm run dev:css` | Tailwind en watch (à lancer dans un 2ᵉ terminal pendant le dev) |
| `npm run build` | CSS Tailwind + compilation serveur + compilation client |
| `npm start` | Serveur de production (`dist/server/index.js`) |
| `npm run typecheck` | `tsc --noEmit` serveur + client |
| `tools/make-icons.sh` | Icônes PWA (`public/icons/*`) via Chromium headless |
| `tools/make-android-assets.sh` | Icônes launcher + splash screens Android |

> En développement, lance `npm run dev` **et** `npm run dev:css` en parallèle : le premier
> sert l'app, le second recompile `public/css/app.css` à chaque modification de template.

---

## Mobile

L'app est **mobile-first** et installable : PWA (manifeste + service worker) et
APK Android construite sur GitHub Actions — le build local est impossible sur
Termux/ARM.

- **PWA** : ouvrir le site en HTTPS dans Chrome Android → « Installer
  l'application ». Plein écran, icône sur l'écran d'accueil, page hors-ligne.
- **APK** : `.github/workflows/android.yml` compile une coquille Capacitor qui
  charge le site. Il faut d'abord héberger le serveur en HTTPS et définir la
  variable de dépôt `ZOERA_APP_URL`.

Procédure complète (hébergement, signature, installation, régénération des
icônes) : [`docs/MOBILE.md`](docs/MOBILE.md).

---

## Fonctionnalités

| Page | Contenu | Endpoints BSD |
|---|---|---|
| `/` | Accueil : rail des matchs en direct, matchs du jour et de demain, compétitions, top buteurs, prédictions, derniers résultats | `/events/live/`, `/events/`, `/leagues/`, `/leagues/{id}/top/scorers/`, `/predictions/` |
| `/live` | Tous les matchs en direct, groupés par compétition, rafraîchis toutes les 15 s | `/events/live/` |
| `/fixtures` | Calendrier par date (précédent / jour / suivant), filtre par ligue | `/events/?date_from&date_to` |
| `/match/:id` | **Match center** : score, stats (xG, possession, tirs…), momentum, shotmap, compositions, chronologie, commentaire live, H2H, cotes, prédiction, positions au classement | `/events/{id}/` + 10 sous-ressources |
| `/leagues` | Compétitions, groupées par pays, filtre hommes/femmes | `/leagues/` |
| `/palmares` | **Palmarès** : meilleur club, meilleur joueur, meilleure compétition + classements (clubs, joueurs, compétitions) avec indices calculés | `/leagues/`, `/leagues/{id}/standings/`, `/leagues/{id}/bestxi/{season}/`, `/leagues/{id}/top/scorers/` |
| `/leagues/:id` | Classement (zones, forme, xG), top buteurs, meilleur XI, calendrier de la saison | `/leagues/{id}/standings/`, `/top/{stat}/`, `/bestxi/`, `/seasons/` |
| `/teams/:id` | Effectif avec blessures, forme (5 derniers), calendrier, transferts | `/teams/{id}/`, `/squad/`, `/form/`, `/fixtures/` |
| `/players/:id` | Fiche joueur, statistiques par match, historique des transferts | `/players/{id}/`, `/stats/`, `/transfers/` |
| `/predictions` | Prédictions du modèle (CatBoost) : 1X2, score attendu, confiance | `/predictions/` |
| `/odds` | meilleures cotes disponibles (consensus gratuit) | `/odds/best/` |
| `/transfers` | Mercato : derniers transferts et montants | `/transfers/` |
| `/recherche` | Recherche unifiée équipes / joueurs / ligues | `/teams/?name=`, `/players/?name=` |

### API JSON locale

`/api/health` · `/api/quota` · `/api/live` · `/api/palmares` · `/api/events` · `/api/match/:id` ·
`/api/standings/:leagueId` · `/api/search?q=`

### Le palmarès : des indices, pas des impressions

La page `/palmares` compare **10 compétitions majeures** (repérées par leur nom) et en
déduit trois classements, uniquement à partir des données réelles de l'API :

| Indice | Formule | Ce qu'il récompense |
|---|---|---|
| **Club** | `60 × (points/match ÷ 3) + 20 × (écart xG/match) + 20 × (écart buts/match)`, pondéré par `min(1, matchs joués ÷ 8)` | la régularité et la qualité de jeu, pas les seuls points |
| **Compétition** | `12 × buts moyens + 30 × écart xG moyen + 20 × (points/match ÷ 3)` | l'intensité offensive et l'équilibre du championnat |
| **Joueur** | `10 × note moyenne dans le meilleur XI de la saison` | la performance individuelle, les buts venant du classement des buts |

La pondération « fiabilité » empêche un club classé sur 4 journées de devancer un club
suivi sur 12. Un club présent dans deux compétitions (ex. Benfica en Europa League et en
Liga Portugal) n'apparaît qu'une fois, avec son meilleur indice.
Coût : 3 appels par compétition, mis en cache **3 heures** par compétition (le
palmarès complet est recalculé toutes les 30 minutes à partir de ce cache).

---

## Architecture

```
server/
  index.ts            bootstrap Express (views, statique, API, pages, 404, erreurs)
  config.ts           env, mode démo, racine du projet, quota
  lib/
    format.ts         helpers d'affichage FR (dates, statuts, montants, pourcentages)
    utils.ts          utilitaires (cn, slug, escape…)
    bsd/
      client.ts       appel API + erreurs typées + quota (RateLimit) + URLs d'images
      cache.ts        cache TTL mémoire + disque, purge, single-flight
      endpoints.ts    fonctions typées par ressource (API publique)
      mock.ts         jeu de données démo cohérent
      types.ts        types du domaine
  routes/
    api.ts            routes JSON
    pages.ts          contrôleurs de pages + view models
  views/              templates EJS (layout, 15 pages, 9 partials)
client/
  styles/app.css      tokens Tailwind v4 (@theme) + composants
  js/*.ts             interactions (polling live, onglets, filtres, recherche, favoris)
public/               css + js compilés
mobile/
  www/index.html      page locale embarquée dans l'APK (serveur injoignable)
android/              projet natif Capacitor (généré, versionné)
capacitor.config.ts   coquille Android : appId, server.url, errorPath
.github/workflows/
  android.yml         build APK sur ubuntu-latest (impossible sur ARM/Termux)
docs/
  CONTRACT.md         contrat d'intégration (signatures, view models, cache, DA)
  DESIGN.md           système de design (jetons, composants, motifs)
  MOBILE.md           PWA, APK, signature, build GitHub Actions
  bsd-api-reference.md  référence des 221 endpoints BSD
  brand/              directions de logo + page de comparaison
tools/
  extract_spec.py     génère bsd-api-reference.md depuis le schéma OpenAPI
  check-views.ts      rend chaque template EJS avec des données factices (contrôle)
  make-icons.sh       génère les icônes PWA (Chromium headless)
  make-android-assets.sh  génère icônes launcher + splash Android
  qa.sh               build + serveur + curl de toutes les routes + captures
  shot.sh             capture d'écran Chromium headless
```

### Stratégie « gratuit maximal »

1. **Cache TTL à deux niveaux** (mémoire + disque dans `CACHE_DIR`, survit aux redémarrages) :
   live 15 s, calendrier 5 min, stats 2 min, classements 15 min, effectifs/ligues 1 h.
2. **Single-flight** : deux requêtes identiques simultanées = un seul appel API.
3. **Polling depuis le navigateur toutes les 15 s maximum**, pause quand l'onglet est caché,
   backoff ×2 (jusqu'à 60 s) sur erreur réseau, et cache serveur `s-maxage=15`.
4. **Un seul appel `/events/live/`** alimente l'accueil, le direct et le compteur du header.
5. **Image API BSD** (gratuite, sans authentification) pour les logos et les photos :
   `https://sports.bzzoiro.com/img/team/{id}/` — fallback initiales si l'image manque (204).
6. **Endpoints payants masqués proprement** : la comparaison bookmaker (403) et les sports
   hors football (402) sont traités, pas contournés.
7. **Quota observable** : `GET /api/quota` + indicateur dans le header.

### Points d'attention côté API (vérifiés en conditions réelles)

- **URL** : la base contient déjà `/api/v2` — les endpoints sont résolus *relativement*
  à cette base, sinon la requête part à la racine et reçoit du HTML au lieu du JSON.
- **v2 refuse tout paramètre de filtre inconnu** (400) — les listes blanches sont
  centralisées dans `endpoints.ts`.
- `/events/live/` renvoie `{ count, events }` (et non `results`).
- `/events/{id}/player-stats/` renvoie `{ event_id, count, player_stats }` :
  la liste est sous `player_stats`, pas sous `results`.
- Les compteurs d'équipe s'appellent `ball_possession`, `total_shots`,
  `corner_kicks` ; le momentum `{ m, v }` ; les tirs `min` + `pos { x, y }`.
- Les probabilités de prédiction arrivent en **pourcentage** (44,1) : le mapper les
  ramène en 0–1, comme le contrat l'exige.
- Les timestamps sont en UTC : la conversion vers Europe/Paris se fait côté serveur.
- `status` peut valoir `notstarted`, `inprogress`, `delayed`, `penalties`, `finished`,
  `postponed`, `cancelled`, `unresolved` — les libellés FR sont dans `lib/format.ts`.
- **Ce qui est payant, et ce que l'app fait à la place** :
  - `/odds/best/` (meilleur prix par bookmaker) → **403** sans Football Unlimited.
    L'app bascule sur `/odds/` (consensus gratuit, qui indique en plus le nombre de
    bookmakers derrière le prix).
  - `/events/{id}/odds/comparison/` → **403**, la comparaison bookmaker est masquée.
  - WebSockets live (addon 7 $/mois) → polling 15 s à la place, pause onglet caché.

### Budget de requêtes

Une page de match centre déclenche une dizaine d'appels parallèles ; l'API plafonne
les rafales à 25 req/s. Le client BSD sérialise donc les appels (6 en concurrence
max) et le cache TTL évite de refaire les mêmes requêtes. Sur une session de
navigation normale, l'app consomme quelques dizaines de requêtes pour une
douzaine de pages : le quota de 7 500/jour est très confortable.

---

## Configuration

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port HTTP |
| `BSD_API_KEY` | *(vide)* | Clé API ; vide ⇒ mode démo |
| `BSD_BASE_URL` | `https://sports.bzzoiro.com/api/v2` | Base de l'API |
| `CACHE_DIR` | `./.cache` | Cache disque des réponses |

## Dépannage

- **« MODE DÉMO » affiché** : `BSD_API_KEY` absent ou non lu → vérifiez que le fichier est
  bien `.env` (le serveur le charge au démarrage) et redémarrez.
- **401 de l'API** : clé invalide ou non validée → contrôlez le dashboard BSD.
- **429 `taster_exhausted`** : quota du jour épuisé, le cache disque réduit déjà la pression ;
  le reset a lieu à minuit UTC.
- **Page HTML sans style** : lancez `npm run build:css` (ou `npm run dev:css` en dev).
- **Ports occupés** : `PORT=3100 npm run dev`.

## Licence

Code fourni tel quel, à titre de démonstration. Les données proviennent de Bzzoiro Sports Data
et restent soumises à leur conditions d'utilisation.
