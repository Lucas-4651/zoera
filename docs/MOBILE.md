# Zoera sur mobile — PWA, APK et build CI

L'app est **rendue côté serveur** (EJS). L'APK n'embarque donc pas les pages :
c'est une **coquille Capacitor** qui charge le site Zoera depuis son URL HTTPS,
avec une page locale de secours quand le serveur est injoignable.

```
┌──────────────┐   HTTPS    ┌──────────────────────┐
│  APK (WebView)│ ─────────► │ serveur Node (Express)│
│  mobile/www   │            │  rendu EJS + /api/*   │
└──────────────┘            └──────────────────────┘
        │ erreur réseau
        ▼
 mobile/www/index.html  (« Serveur injoignable »)
```

Trois briques, indépendantes :

| Brique | Fichiers | Rôle |
| --- | --- | --- |
| **PWA** | `public/manifest.webmanifest`, `public/sw.js`, `public/offline.html`, `public/icons/`, `client/js/pwa.ts` | Installation depuis Chrome, plein écran, page hors-ligne. Fonctionne sans APK. |
| **Coquille Android** | `capacitor.config.ts`, `android/`, `mobile/www/index.html` | L'APK elle-même. |
| **Build CI** | `.github/workflows/android.yml` | Compile l'APK sur `ubuntu-latest` — indispensable sur Termux/ARM. |

---

## 1. Prérequis : le serveur en HTTPS

Android refuse le HTTP en clair (`cleartext: false`). Il faut donc un domaine
avec un certificat valide avant de produire une APK utile.

Le dépôt contient déjà l'image de production (`Dockerfile`) et les
configurations **Fly.io** (`fly.toml`) et **Render** (`render.yaml`) :
procédure pas à pas dans [`DEPLOY.md`](DEPLOY.md). En résumé :

```bash
fly launch --no-deploy --copy-config --name zoera
fly secrets set BSD_API_KEY=Votre_cle_ici
fly deploy                     # → https://zoera.fly.dev
```

Options détaillées : VPS + Caddy, Fly.io, Render, Cloudflare Tunnel — voir
[`DEPLOY.md`](DEPLOY.md).

Une fois le site joignable en `https://…`, vérifier que la PWA est bien servie :

```bash
curl -sI https://ton-domaine.tld/manifest.webmanifest | head -3   # 200 + application/manifest+json
curl -sI https://ton-domaine.tld/sw.js              | head -3     # 200 + application/javascript
```

> Le service worker ne s'active **qu'en HTTPS** (ou sur `localhost`). Sur un
> domaine en HTTP, l'app fonctionne mais n'est pas installable.

---

## 2. Configurer le dépôt

L'URL du serveur n'est **pas** écrite dans le code : elle est injectée au build
depuis une variable GitHub, et figée dans `android/app/src/main/assets/capacitor.config.json`
par `npx cap sync`.

Dépôt → **Settings → Secrets and variables → Actions → Variables** :

| Nom | Exemple | Obligatoire |
| --- | --- | --- |
| `ZOERA_APP_URL` | `https://zoera.mg` | oui |

Sans cette variable, le workflow s'arrête avec une erreur explicite plutôt que
de livrer un APK qui n'affiche que la page d'erreur.

### Construire en local (facultatif, hors ARM)

Sur une machine x86_64 avec le SDK Android :

```bash
ZOERA_APP_URL=https://zoera.mg npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Sur Termux/ARM, ce chemin n'existe pas : passer par la CI.

---

## 3. Lancer le build

### APK de test (debug)

1. Dépôt → onglet **Actions** → **Android APK** → **Run workflow**.
2. Champ `app_url` vide = utilise la variable `ZOERA_APP_URL`.
3. ~5–10 min plus tard : onglet du run → **Artifacts** → `zoera-debug`.
4. Le zip contient `app-debug.apk`.

L'APK debug est signée avec la clé de debug du runner : elle s'installe, mais
**ne peut pas être mise à jour** par une APK signée avec une autre clé. Pour une
distribution durable, passer à la release signée.

### APK de release signée

Pousser un tag :

```bash
git tag v1.0.0
git push origin v1.0.0
```

Le workflow compile en release, signe, vérifie la signature et crée une
**Release GitHub** avec `zoera-v1.0.0.apk` en pièce jointe — c'est le lien à
partager (WhatsApp, site, etc.).

La version est dérivée du tag : `versionName = 1.0.0`, `versionCode = numéro du
run` (croissant, jamais réutilisé).

---

## 4. Signer (une seule fois)

Générer un keystore — **à conserver pour toujours**, sinon plus aucune mise à
jour ne sera acceptée par Android :

```bash
keytool -genkeypair -v \
  -keystore zoera-release.jks \
  -alias zoera \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass 'MOT_DE_PASSE' -keypass 'MOT_DE_PASSE' \
  -dname "CN=Zoera, O=Zoera, C=MG"
```

Sous Termux : `pkg install openjdk-17` fournit `keytool`.

Puis **Settings → Secrets and variables → Actions → Secrets** :

| Secret | Contenu |
| --- | --- |
| `ZOERA_KEYSTORE_BASE64` | sortie de `base64 -w0 zoera-release.jks` |
| `ZOERA_KEYSTORE_PASSWORD` | mot de passe du keystore |
| `ZOERA_KEY_ALIAS` | `zoera` |
| `ZOERA_KEY_PASSWORD` | mot de passe de la clé |

```bash
base64 -w0 zoera-release.jks     # coller le résultat dans le secret
```

Le keystore lui-même ne doit **jamais** être commité (`.gitignore` couvre
`*.jks` / `*.keystore`). En cas de perte, il faut publier une nouvelle
application sous un autre `applicationId` — Android ne permet pas de changer de
clé de signature.

---

## 5. Installer l'APK sur Android

1. Télécharger le `.apk` sur le téléphone (lien de la Release, ou transfert).
2. Ouvrir le fichier → Android demande d'autoriser l'installation depuis cette
   source (« Installer des applications inconnues »).
3. Autoriser, puis **Installer**. Play Protect peut afficher un avertissement
   pour une app hors Play Store : « Installer quand même ».

Mise à jour : installer la nouvelle APK par-dessus l'ancienne (même
`applicationId` + même clé). Les données de WebView (favoris en
`localStorage`) sont conservées.

---

## 6. Ce que fait la coquille, exactement

`capacitor.config.ts` :

| Réglage | Valeur | Effet |
| --- | --- | --- |
| `appId` | `mg.zoera.app` | Identité de l'app (ne plus changer après diffusion). |
| `webDir` | `mobile/www` | Seul contenu embarqué : la page d'erreur. |
| `server.url` | `ZOERA_APP_URL` | Le site chargé au lancement. |
| `server.errorPath` | `index.html` | Page locale affichée si le chargement échoue. |
| `server.cleartext` | `false` | HTTP refusé (sécurité + règle Play). |
| `android.backgroundColor` | `#0a0d12` | Pas de flash blanc avant le rendu. |

Conséquence à garder en tête : **l'APK ne contient pas l'app**. Corriger un bug
côté serveur met à jour tous les téléphones au prochain lancement ; en revanche
un changement de `server.url`, d'icône ou de nom exige une nouvelle APK.

Le service worker reste actif dans la WebView : après un premier chargement, la
dernière page vue s'affiche même sans réseau (les scores, eux, exigent la
connexion).

---

## 7. Ressources graphiques (icônes, splash)

Tout dérive du monogramme « Z frappé » (`docs/brand/zoera-01-mark.svg`).

```bash
tools/make-icons.sh           # PWA : public/icons/*
tools/make-android-assets.sh  # Android : mipmap-* + drawable-*splash
```

`make-android-assets.sh` régénère les 15 PNG de launcher (48 → 192 px, carré,
rond et calque adaptatif) et les 11 splash screens, puis :

- force `ic_launcher_background` à `#cdf542` (fond du calque adaptatif) ;
- écrit `values/colors.xml` — le gabarit Capacitor 8 référence
  `@color/colorPrimary` sans le fournir, ce qui casse AAPT ;
- ajoute `windowSplashScreenBackground` au thème de lancement (Android 12+
  affiche sinon un splash blanc) ;
- supprime les vecteurs Capacitor devenus inutiles.

Contrainte respectée : dans le calque adaptatif, le point le plus exposé du
symbole (le ballon) tombe à 32 dp du centre, sous les 33 dp du rayon garanti —
aucun masque de launcher ne peut le rogner.

Dépendances : `chromium` (rendu) et Python 3 + Pillow (réduction LANCZOS).
Après régénération, relancer `npx cap sync android` n'est pas nécessaire : les
ressources sont dans `android/app/src/main/res`, pas dans `webDir`.

---

## 8. Limites connues

- **Pas de hors-ligne fonctionnel** pour les données : les scores viennent de
  l'API, la coquille ne fait qu'éviter l'écran blanc.
- **Pas de notifications push** : il faudrait un plugin Capacitor + FCM, donc
  un `google-services.json` et un projet Firebase.
- **Play Store** : une WebView pure peut être refusée (« minimum
  functionality »). Pour le store, passer par une TWA (Bubblewrap) adossée à
  Chrome. La distribution par lien direct, elle, ne pose aucun problème.
- **`versionCode`** : dérivé du numéro de run. Ne jamais republier un tag avec
  un numéro inférieur.
- Le workflow ne construit **pas** le site (`npm run build`) : inutile pour une
  coquille. Si `mobile/www` venait à contenir autre chose que la page d'erreur,
  ajouter l'étape.

---

## 9. Dépannage

| Symptôme | Cause probable |
| --- | --- |
| `Aucune URL fournie` | Variable `ZOERA_APP_URL` absente. |
| `ZOERA_APP_URL doit commencer par https://` | URL en `http://` — Android la refuserait. |
| APK installée → « Serveur injoignable » | URL erronée, certificat invalide, ou serveur éteint. Tester l'URL dans Chrome Android. |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | APK signée avec une autre clé que la version installée → désinstaller, réinstaller. |
| Écran blanc au lancement | `server.url` pointe vers un domaine qui répond mais sans HTML. |
| Le build échoue sur `colorPrimary` | `tools/make-android-assets.sh` n'a pas été lancé (il écrit `colors.xml`). |
| L'icône reste celle de Capacitor | Lancer `tools/make-android-assets.sh` puis rebuilder ; `cap sync` ne touche pas à `res/`. |
