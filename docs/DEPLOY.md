# Déployer Zoera en HTTPS

L'APK et la PWA ont besoin d'une URL **HTTPS**. Ce document couvre les deux
cibles gratuites retenues : **Fly.io** (recommandé) et **Render**.

Le dépôt contient déjà tout ce qu'il faut : `Dockerfile`, `.dockerignore`,
`fly.toml`, `render.yaml`.

---

## Ce que fait l'image

`Dockerfile` en deux étapes :

1. **build** — `npm ci` complet, puis `npm run build` (Tailwind + TypeScript
   serveur et client). Tout ce qui est compilé (`public/css`, `public/js`,
   `dist/`) est produit ici.
2. **runtime** — Node 22 slim, `npm ci --omit=dev` (uniquement `ejs` et
   `express`), puis copie de `dist/`, `public/`, `server/views/`.

Variables lues par l'app (`server/config.ts`) :

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `PORT` | Port d'écoute | `3000` |
| `BSD_API_KEY` | Clé API BSD. **Absente = mode démo** | — |
| `CACHE_DIR` | Cache disque des réponses API | `/app/.cache` |
| `BSD_BASE_URL` | Base de l'API | `https://sports.bzzoiro.com/api/v2` |

Le cache disque économise le quota (7 500 req/jour). Sur un hébergeur sans
volume, il est perdu à chaque redémarrage : l'app refait des appels, rien de
plus.

---

## Option A — Fly.io (recommandé)

Région `jnb` (Johannesburg) : la plus proche de Madagascar. TLS et domaine
`*.fly.dev` fournis.

### 1. Installer `flyctl`

```bash
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"
fly auth signup     # ou : fly auth login
```

Des binaires Linux arm64 existent : cela fonctionne depuis Termux.

### 2. Créer l'application

```bash
cd /root/Zoera
fly launch --no-deploy --copy-config --name zoera
```

`--copy-config` conserve le `fly.toml` du dépôt (région, health check,
auto-stop). Si le nom `zoera` est pris, choisir `zoera-mg` et corriger la
première ligne de `fly.toml`.

### 3. Renseigner la clé API

```bash
fly secrets set BSD_API_KEY=Votre_cle_ici
```

Sans ce secret, le site démarre en **MODE DÉMO** (données simulées) — pratique
pour tester l'APK, inutile en production.

### 4. Déployer

```bash
fly deploy
fly open            # ouvre https://zoera.fly.dev
```

Premier déploiement : 3–6 min (build de l'image sur les serveurs Fly).

### 5. Vérifier

```bash
curl -s https://zoera.fly.dev/api/health
curl -sI https://zoera.fly.dev/manifest.webmanifest | head -3
curl -sI https://zoera.fly.dev/sw.js | head -3
```

### Cache persistant (facultatif)

```bash
fly volumes create zoera_cache --region jnb --size 1
```

Puis décommenter le bloc `[[mounts]]` de `fly.toml` et pointer `CACHE_DIR` sur
`/data`. Le volume appartient à `root` alors que l'image tourne en `node` :
ajouter au `Dockerfile` un entrypoint qui fait `chown -R node:node /data`
avant `CMD`, sinon les écritures de cache échouent silencieusement.

### Coût

Machine `shared-cpu-1x` / 512 Mo : ~2 $/mois si elle tourne en continu. Avec
`auto_stop_machines = "stop"`, une app peu visitée tombe sous le seuil gratuit.
Le redémarrage à froid prend 1–3 s.

---

## Option B — Render

1. Pousser le dépôt sur GitHub.
2. Render → **New → Blueprint** → sélectionner le dépôt. `render.yaml` est
   détecté automatiquement.
3. Renseigner `BSD_API_KEY` dans le dashboard (le champ est marqué `sync: false`).
4. Deploy → URL `https://zoera-xxxx.onrender.com`.

**Limite du plan gratuit** : la machine s'endort après 15 minutes sans trafic
et met ~50 s à se réveiller. Pour une app de scores en direct, c'est le point
faible ; Fly.io est nettement meilleur sur ce critère.

---

## Après le déploiement

1. Relever l'URL HTTPS finale.
2. Dépôt GitHub → **Settings → Secrets and variables → Actions → Variables** →
   `ZOERA_APP_URL` = cette URL (sans slash final).
3. Lancer le workflow **Android APK** (voir `docs/MOBILE.md`).
4. Ouvrir l'URL sur le téléphone : Chrome doit proposer « Installer
   l'application » (PWA). L'APK n'est utile que pour la distribution hors
   navigateur.

### Si le certificat ou le domaine change

`server.url` est figée dans l'APK à chaque build : mettre à jour la variable
`ZOERA_APP_URL` **et reconstruire**. Les APK déjà installées continueront de
pointer vers l'ancienne URL.

---

## Alternative — Cloudflare Tunnel

Si le serveur doit rester chez soi :

```bash
cloudflared tunnel --url http://127.0.0.1:3000
```

Cloudflare fournit une URL `https://…trycloudflare.com` (éphémère) ou un
domaine à toi via un tunnel nommé. Le serveur Node reste lancé en local
(`npm start`), il n'y a pas de conteneur à déployer.
