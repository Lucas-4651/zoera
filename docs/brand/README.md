# Zoera — système de marque (logo)

Trois directions de logo pour **Zoera** (« joueur » en malgache). Chaque direction existe en trois usages :
symbole seul, symbole en pastille acide, lockup horizontal symbole + `ZOERA`.

> **Zoera** signifie « joueur » en malgache. L'app est faite pour les communautés malagasy qui suivent le football.

## Fichiers

| Fichier | Contenu |
| --- | --- |
| `concepts.html` | Page de comparaison autonome : chaque direction avec son symbole à 16 / 24 / 32 / 64 / 128 px, la pastille acide, le lockup bicolore, le lockup monochrome, le test d'onglet clair / sombre et la rationale (en français). |
| `zoera-01.svg` | Direction 01 « Le Z frappé » — lockup horizontal (symbole + `ZOERA`). |
| `zoera-01-mark.svg` | Direction 01 — symbole seul, `viewBox="0 0 24 24"`. |
| `zoera-02.svg` | Direction 02 « Le terrain en perspective » — lockup horizontal. |
| `zoera-02-mark.svg` | Direction 02 — symbole seul, `viewBox="0 0 24 24"`. |
| `zoera-03.svg` | Direction 03 « Le Z tissé » — lockup horizontal. |
| `zoera-03-mark.svg` | Direction 03 — symbole seul, `viewBox="0 0 24 24"`. |

## Ouvrir la page de comparaison

La page est **autonome** (CSS inline, aucune ressource externe, aucun JavaScript) : il suffit de l'ouvrir
directement dans un navigateur.

```bash
# 1. le plus simple
xdg-open docs/brand/concepts.html      # Linux
open docs/brand/concepts.html          # macOS
start docs/brand/concepts.html         # Windows

# 2. ou via un petit serveur local (utile pour tester <img src="...svg">)
cd docs/brand && python3 -m http.server 8000
# puis http://localhost:8000/concepts.html
```

Les fichiers SVG doivent rester **dans le même dossier** que `concepts.html` : la page les référence
relativement.

## Règles techniques

* **SVG pur, fait main.** Aucun raster, aucune image externe, aucun filtre, aucun `<style>` interne.
  Uniquement `fill` / `stroke` / `fill-rule` et des transformations.
* **Grille 24.** Tous les symboles sont dessinés sur un `viewBox="0 0 24 24"`. Le trait le plus fin
  fait 2,4 unités (≈ 1,6 px à 16 px) : rien ne tombe sous le seuil de lisibilité.
* **Monochrome.** Les fichiers `*-mark.svg` utilisent `fill="currentColor"`. Leur racine porte
  `color="#cdf542"` pour que le fichier soit déjà correct lorsqu'il est référencé en `<img>`.
  En `<svg>` inline, il suffit de surcharger `color` :

  ```html
  <!-- acide sur fond sombre -->
  <svg color="#cdf542"><use href="/docs/brand/zoera-01-mark.svg#mark"/></svg>

  <!-- encre sur fond clair (onglet de navigateur) -->
  <svg color="#06080b"><use href="/docs/brand/zoera-01-mark.svg#mark"/></svg>
  ```

* **Bicolore.** Les lockups `zoera-0X.svg` sont en dur : symbole et `ERA` en `#cdf542`, `ZO` en
  `#f5f8fb`. Les groupes portent les classes `zoera-zo` et `zoera-era` : une feuille de style peut
  les surcharger (`svg .zoera-era{fill:#f5f8fb}`) pour obtenir un lockup monochrome sans toucher au SVG.
* **Logotype sans police.** `ZOERA` est dessiné en tracés (lettrage condensé custom, hauteur de
  capitale 14 unités, jambage ≈ 2,6). Aucun `<text>`, donc aucun rendu cassé sur une machine sans
  Archivo Expanded / Anton / Oswald.
* **Pastille acide.** `bg-acid-400` + symbole `ink-950`, coins arrondis `rx≈5.5` sur la grille 24.
  C'est la forme à utiliser en favicon : un pavé acide plein reste lisible sur onglet clair **et**
  sur onglet sombre.

## Palette

| Rôle | Token | Valeur |
| --- | --- | --- |
| Fond | `ink-950` → `ink-800` | `#06080b` → `#121821` |
| Accent | `acid-400` | `#cdf542` |
| Accent secondaire (rare) | `blood-500` | `#e5484d` |
| Texte | `mist-50` | `#f5f8fb` |

## Rappel de style

Sportif, sombre, dense, sobre : l'écran se lit comme un tableau de scores. Pas de mascotte, pas de
dégradé violet, pas de glassmorphism, pas d'effet « startup IA ». C'est cette sobriété qui doit rester
lisible dans les trois directions.
