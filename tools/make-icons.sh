#!/usr/bin/env bash
# Génère les icônes PWA/Android de Zoera à partir du monogramme « Z frappé ».
# Usage : tools/make-icons.sh
# Dépendance : chromium (headless). Aucune bibliothèque graphique.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/icons"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$OUT"

# Rendu d'un SVG dans un PNG de taille exacte, fond transparent.
render() { # <html> <taille> <sortie>
  local html="$1" size="$2" out="$3"
  chromium --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --default-background-color=00000000 --force-device-scale-factor=1 \
    --window-size="${size},${size}" --screenshot="$out" "file://${html}" >/dev/null 2>&1
}

# Icône standard : pavé acide arrondi + symbole sombre (coins transparents).
cat > "$TMP/rounded.html" <<'HTML'
<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#cdf542"/>
  <g fill="#06080b" transform="translate(3.2 3.2) scale(2.4)">
    <path d="M2.5 4.2H17.2V7.6L7.2 17H21V20.4H5L2.6 17.6L13.6 7.6H2.5Z"/>
    <circle cx="20.4" cy="3.6" r="2.7"/>
  </g>
</svg></body></html>
HTML

# Icône « maskable » : fond plein (pas de coins arrondis) et symbole dans la
# zone de sécurité (80 %), pour que les masques Android ne rognent pas le Z.
cat > "$TMP/maskable.html" <<'HTML'
<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#cdf542"/>
  <g fill="#06080b" transform="translate(8 8) scale(2)">
    <path d="M2.5 4.2H17.2V7.6L7.2 17H21V20.4H5L2.6 17.6L13.6 7.6H2.5Z"/>
    <circle cx="20.4" cy="3.6" r="2.7"/>
  </g>
</svg></body></html>
HTML

render "$TMP/rounded.html"  192 "$OUT/icon-192.png"
render "$TMP/rounded.html"  512 "$OUT/icon-512.png"
render "$TMP/maskable.html" 512 "$OUT/maskable-512.png"
render "$TMP/maskable.html" 180 "$OUT/apple-touch-icon.png"
# 1024 : source pour le Play Store / les générateurs d'icônes Android.
render "$TMP/maskable.html" 1024 "$OUT/icon-1024.png"

for f in "$OUT"/*.png; do
  printf 'OK  %s (%s octets)\n' "${f#"$ROOT"/}" "$(stat -c%s "$f")"
done
