# Zoera — Système de design

Direction artistique : **sportive, sombre, dense**. L'écran doit se lire comme un
tableau de scores, pas comme une page marketing. Le score est l'élément le plus
fort ; tout le reste est au service de la comparaison rapide.

---

## 1. Principes

1. **Le score d'abord.** Chiffres très grands, condensés, tabulaires. Le nom des
   équipes ne doit jamais peser plus lourd que le score.
2. **Densité assumée.** Un écran doit montrer le plus d'information possible sans
  Scopes ni « cartes blanches ». Sur desktop on tabule, sur mobile on empile.
3. **Un seul accent.** Le vert acide sert d'ancrage : bouton actif, direct, score,
   gain. Le rouge ne sert qu'aux cartons et aux pertes.
4. **Aucune décoration gratuite.** Pas de dégradé violet, pas de glassmorphism,
   pas d'ombre diffuse. Les séparateurs 1 px et les aplats font le travail.
5. **Lisible en une seconde.** Un utilisateur qui jette un œil doit capter le
   score, l'heure et l'état du match.

---

## 2. Jetons

Les jetons vivent dans le bloc `@theme` de `client/styles/app.css` (Tailwind v4).
Ce sont les **seules** couleurs autorisées dans les templates.

### Fonds et surfaces

| Token | Valeur | Usage |
|---|---|---|
| `ink-950` | `#06080b` | Fond le plus profond (pied de page, zones creuses) |
| `ink-900` | `#0a0d12` | Fond de page, surface de base |
| `ink-850` | `#0d121a` | Surface légèrement élevée (lignes alternées) |
| `ink-800` | `#121821` | Surfaces interactives (boutons, champs) |
| `ink-750` | `#161d27` | Pastilles, avatars, placeholders |
| `ink-700` | `#1b2430` | Fond de barre de progression |
| `ink-600` | `#232e3c` | Pastilles neutres, marqueurs |

### Séparateurs

| Token | Valeur | Usage |
|---|---|---|
| `line` | `#1d2632` | Bordures de tableaux, filets de 1 px |
| `line-strong` | `#2b3846` | Bordures au survol, placeholders |

### Texte

| Token | Valeur | Usage |
|---|---|---|
| `mist-50` | `#f5f8fb` | Titres, scores |
| `mist-100` | `#e6ecf3` | Texte courant |
| `mist-200` | `#b7c1cf` | Texte secondaire fort |
| `mist-300` | `#8e9aab` | Libellés de colonnes |
| `mist-400` | `#6c7889` | Textes tertiaires, horodatages |
| `mist-500` | `#55606f` | Textes quints, notes de bas de page |

### Accents

| Token | Valeur | Usage |
|---|---|---|
| `acid-300` | `#d4ff55` | Accent sur fond sombre (liens, valeurs actives) |
| `acid-400` | `#cdf542` | Accent principal (point LIVE, boutons, score) |
| `acid-500` | `#b0dd24` | Fond de bouton primaire |
| `blood-400` | `#f2555f` | Cartons rouges, pertes, différentiel négatif |
| `blood-500` | `#d92d3a` | Alertes |
| `amber-400` | `#e0a336` | Retards, cartons jaunes, « à venir » |

### Typographie

- **Display** (`font-display`) : titres, scores, chiffres de tableau.
  Pile condensée : `Archivo Expanded → Anton → Oswald → Arial Narrow → Impact`.
  Aucune police web n'est téléchargée : le rendu est immédiat et hors-ligne.
- **UI** (`font-sans`) : `ui-sans-serif → system-ui → Segoe UI → Roboto → Helvetica`.
- **Chiffres** : `.ko-tabular` active `font-variant-numeric: tabular-nums` —
  indispensable pour que les scores et colonnes de stats restent alignés.

### Rayons et animation

| Token | Valeur | Usage |
|---|---|---|
| `radius-panel` | `16px` | Grands blocs (cartes de rails) |
| `radius-cell` | `10px` | Boutons, champs, pastilles |
| `radius-pill` | `999px` | Badges, points, pastilles d'état |

Animations : `live-pulse` (point LIVE, 1,8 s), `rise` (entrée de contenu),
`flash` (mise à jour d'un score au polling). Transitions 150–250 ms.
`prefers-reduced-motion` neutralise tout.

---

## 3. Composants maison (`client/styles/app.css`)

| Classe | Rôle |
|---|---|
| `.ko-grain` | Grain fin en fond (SVG inline, opacité 3,5 %) — donne une matière au noir plat |
| `.ko-live-dot` | Point « LIVE » pulsant |
| `.ko-rail` | Rail horizontal défilant (accueil) avec snap |
| `.ko-eyebrow` | Sur-titre de section : capitales condensées, interlettrage large |
| `.ko-bar` | Barre de progression (possession, probabilités) |
| `.ko-table` | Tableau dense : lignes de 1 px, survol sombre, chiffres tabulaires |
| `.ko-focus` | Anneau de focus visible (accessibilité) |
| `.ko-skip` | Lien d'évitement |
| `.ko-rise` / `.ko-flash` | Entrée en scène / flash de mise à jour |

---

## 4. Motifs d'interface

### En-tête de match
Compétition (lien) · journée · score XXL centré sur l'axe · noms d'équipes avec
logo de 44 px · statut (`TERMINÉ`, `EN DIRECT`, minute) · HT · date.

### Ligne de match (tableau)
`[badge statut] [heure] [équipe 1] [score] [équipe 2] [competition] [★ favori]`
Sur mobile, la ligne passe en carte empilée : équipes au-dessus, score en dessous.

### Tableau de classement
Rang · logo · nom · J G N P · +/− · PTS · xG · forme (5 pastilles W/D/L colorées).
Les zones (titre / Europe / relégation) sont signalées par un filet coloré à gauche.

Sous `md`, une équipe devient une carte : `rang · écusson · nom` en première
ligne, les sept statistiques en grille de libellés (J G N P +/− PTS xG) en
deuxième, la forme en troisième. Le filet de zone est conservé sur le bord
gauche de la carte, et le mode groupé garde son sous-titre de groupe.

---

## 4.1 Mobile first

L'application est **mobile first** : la référence de rendu est **390 × 844**
(iPhone 14), et le desktop (≥ 768 px, `md:`) est la seconde version, jamais
l'inverse. Toute capture de contrôle se fait en 390 px
(`tools/qa.sh` le fait par défaut).

### Règle du basculement

Une donnée qui ne tient pas lisiblement sur 390 px ne doit jamais être confiée
à un scroll horizontal, et son nom ne doit jamais être tronqué au point de
devenir ambigu (« Quérétar… » ne dit plus de quel match il s'agit).

Deux formes sont autorisées :

- **Le tableau dense reste tel quel à partir de `md`.** C'est la forme la plus
  compacte pour des chiffres comparés colonne par colonne.
- **Sous `md`, la même donnée devient une carte empilée** : une information
  par ligne, les chiffres tabulaires conservés, et les repères (zone de
  classement, compétition, bookmaker) remontés en clair.

Le desktop n'est jamais « la version empilée de la mobile » : la bascule se
fait avec `md:contents` ou `hidden md:block` / `md:hidden`, jamais en
dupliquant les données côté serveur.

### Ligne de match sur mobile

Les deux écussons encadrent le score, les noms passent en ligne secondaire
sous chaque écusson, en 11 px, sur deux lignes maximum :

```
[badge statut]              [logo compétition]
     [écusson]   4 – 0   [écusson]
   New Zealand        India
```

Le nom reste en toutes lettres : le logo seul n'est pas lisible (deux clubs
au même écusson, 18 px illisibles) et perd l'information.


### Onglets du match center
`Statistiques · Compositions · Chronologie · Commentaire · Confrontation ·
Cotes · Prédiction · Positions` — soulignés à l'acide, contenu dans un panneau
unique (pas de rechargement).

### Vitrine « Palmarès »
Trois cartes de podium (MEILLEUR CLUB / MEILLEUR JOUEUR / MEILLEURE COMPÉTITION) :
rang « 01 / 02 / 03 » en chiffres condensés en filigrane, logo, nom, ligue,
puce d'explication, indice en gros à droite. La première carte est la seule à
avoir un liseré acide : c'est le « meilleur », pas un titre générique.
En dessous, trois classements tabulaires (clubs, joueurs, compétitions) où
l'indice est montré avec une barre horizontale — le classement se lit sans
avoir à lire les chiffres. La méthode de calcul est affichée dans un encadré
en bas de page : un palmarès sans formule n'est qu'une opinion.

### Statistiques
Tableau comparatif à deux colonnes (domicile à gauche, extérieur à droite) ;
momentum en courbe SVG ; carte des tirs sur terrain dessiné (le camp adverse est
retourné pour que les deux équipes se superposent).

---

## 5. Logos et images

### Marque Zoera

- **Zoera** signifie « joueur » en malgache : l'app s'adresse aux communautés
  malagasy. Le nom se dit en français, la marque ne se traduit pas.
- **Monogramme « Z frappé »** : un `Z` dessiné à la main (barre haute courte,
  diagonale épaisse, terminals coupés à 45°) avec un **ballon posé sur la ligne
  haute** — le point de départ de la frappe dont la diagonale est la trajectoire.
  Il vit dans l'en-tête, le pied de page et le favicon ; source :
  `docs/brand/zoera-01-mark.svg`.
- **Favicon** : la **pastille acide** (pavé `acid-400` + symbole `ink-950`), seule
  version lisible sur onglet clair comme sur onglet sombre — un symbole acide sur
  fond sombre disparaît sur un onglet clair.
- **Logotype** : `ZO` en `mist-50` + `ERA` en `acid-400`, en `font-display` bold
  avec un tracking serré. Le découpage est fixe : il ne se recompose pas pour
  tenir sur une ligne étroite. Le lockup vectoriel complet (symbole + mot dessiné
  à la main) est disponible dans `docs/brand/zoera-01.svg` pour les supports
  hors écran (og:image, splash, impression).
- **Icônes applicatives** : PWA (`tools/make-icons.sh` → `public/icons/`) et
  Android (`tools/make-android-assets.sh` → `mipmap-*`, splash screens). Les
  deux dérivent du même monogramme ; dans le calque adaptatif Android, le
  ballon reste à 32 dp du centre, sous les 33 dp du rayon garanti par les
  masques de launcher. Voir `docs/MOBILE.md`.

- Source unique : **Image API BSD**, gratuite et sans authentification —
  `https://sports.bzzoiro.com/img/team/{id}/` (idem `player`, `league`, `venue`).
- Une image absente renvoie **204** : le repli est un dégradé coloré calculé à
  partir du nom (teinte stable par club) et les initiales — jamais une image cassée.
- Aucune image externe générique, aucun CDN d'images : le site est autonome.
- Un seul partial pour tout : `partials/img.ejs` (exposé aussi via
  `partials/logo.ejs`) — `kind` = `team` | `league` | `player`, `size` =
  `xs` (18) → `2xl` (96), `round` pour les pastilles de joueurs, `fit` =
  `contain` (logos) ou `cover` (photos). Le conteneur a une taille fixe :
  aucune secousse de mise en page quand l'image arrive.
- Règle éditoriale : **le logo remplace le texte seul quand il identifie
  l'entité** (club, compétition, joueur). Le nom reste en texte à côté —
  un logo n'est pas accessible, et « Inter » vs « Inter Milan » ne se
  distinguent pas à l'image. Les chiffres, eux, ne sont jamais remplacés
  (indice, note, points) : ce sont des données, pas des ornements.
- Le drapeau emoji (`fmt.flag`, code ISO 3166-1 alpha-2) accompagne le nom
  du pays quand le code est disponible : décoratif (`aria-hidden`), le nom
  du pays reste en clair.

## 5.1 Titres centrés

- Le **titre de page** (`partials/page-head.ejs`) est centré : surtitre, `h1`,
  sous-titre, dans une colonne `max-w-2xl` centrée. Les actions passent
  dessous, centrées.
- Les **titres de section** (`partials/section-head.ejs`) sont *optiquement*
  centrés : grille `1fr / auto / 1fr`, le titre occupe la colonne centrale,
  la meta (`Tout le direct →`, compteur) la colonne de droite. Le titre reste
  donc au centre exact du conteneur, même quand la meta est présente.
- Exceptions assumées : les **onglets** du match center (contrôles, pas des
  titres) et les **en-têtes de fiche** (club, joueur) gardent leur logo à
  gauche du nom — un portrait et un emblème ne se centrent pas, ils
  s'ancrent.
- Les libellés de **regroupement** (pays dans `/leagues`, groupe dans un
  classement) restent à gauche : ce sont des repères de lecture dans une
  liste longue, pas des titres de page.


## 6. Accessibilité

- Contraste AA sur le texte courant et les scores.
- Cibles tactiles ≥ 44 px (barre basse mobile 56 px de haut).
- Focus visible (anneau acide) sur tous les éléments focusables.
- Icônes SVG `aria-hidden` + libellés `aria-label` sur les boutons-icônes.
- `lang="fr"`, tables avec `<th scope="col">`, navigation `aria-current="page"`.
