#!/usr/bin/env bash
# Génère les ressources Android de Zoera (icônes launcher + splash screens)
# à partir du monogramme « Z frappé ». Remplace les ressources Capacitor.
#
# Usage : tools/make-android-assets.sh
# Dépendances : chromium (headless) + Python 3 avec Pillow (redimensionnement).
# Méthode : chaque visuel est rendu une seule fois à sa taille maximale puis
# réduit en LANCZOS — plus rapide et plus propre que 26 lancements de Chromium.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RES="$ROOT/android/app/src/main/res"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ ! -d "$RES" ]; then
  echo "ERREUR : $RES introuvable — lancer « npx cap add android » d'abord." >&2
  exit 1
fi

# --- Géométrie du symbole -------------------------------------------------
# Bornes du tracé dans son viewBox 24 : x 2.5 → 23.1, y 0.9 → 20.4.
# Centre optique : (12.8 ; 10.65). Les transformations ci-dessous centrent
# le symbole dans chaque canevas plutôt que de le coller aux marges du
# viewBox d'origine (le ballon dépasse à droite).
MARK='<path d="M2.5 4.2H17.2V7.6L7.2 17H21V20.4H5L2.6 17.6L13.6 7.6H2.5Z"/><circle cx="20.4" cy="3.6" r="2.7"/>'

html_svg() { # <sortie> <viewBox> <largeur> <hauteur> <contenu svg>
  local out="$1" vb="$2" w="$3" h="$4" body="$5"
  cat > "$out" <<HTML
<!doctype html><html><head><style>
html,body{margin:0;padding:0;background:transparent;overflow:hidden}
svg{display:block}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="$w" height="$h" viewBox="$vb">$body</svg>
</body></html>
HTML
}

# Rendu d'une page HTML dans un PNG de taille exacte.
render() { # <html> <largeur> <hauteur> <sortie> [transparent]
  local html="$1" w="$2" h="$3" out="$4" alpha="${5:-opaque}"
  local bg="ff0a0d12"
  [ "$alpha" = "transparent" ] && bg="00000000"
  mkdir -p "$(dirname "$out")"
  chromium --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --default-background-color="$bg" --force-device-scale-factor=1 \
    --window-size="${w},${h}" --screenshot="$out" "file://${html}" >/dev/null 2>&1
}

# Réduction d'un PNG (préserve l'alpha).
resize() { # <source> <largeur> <hauteur> <sortie>
  python3 - "$1" "$2" "$3" "$4" <<'PY'
import sys
from PIL import Image
src, w, h, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
Image.open(src).convert("RGBA").resize((w, h), Image.LANCZOS).save(out)
PY
}

# --- 1. Icône carrée (legacy) ---------------------------------------------
# Canevas 64, contenu à 50 unités de large (78 %), coins arrondis 14.
html_svg "$TMP/square.html" "0 0 64 64" "100%" "100%" \
  '<rect width="64" height="64" rx="14" fill="#cdf542"/><g fill="#06080b" transform="translate(0.93 6.15) scale(2.4272)">'"$MARK"'</g>'

# --- 2. Icône ronde -------------------------------------------------------
# Même logique, disque plein et contenu un peu plus resserré (70 %).
html_svg "$TMP/round.html" "0 0 64 64" "100%" "100%" \
  '<circle cx="32" cy="32" r="32" fill="#cdf542"/><g fill="#06080b" transform="translate(4.04 8.74) scale(2.1845)">'"$MARK"'</g>'

# --- 3. Calque adaptatif (foreground) -------------------------------------
# Canevas 108, zone de sécurité = cercle de 66 dp centré. Le point le plus
# exposé est le ballon (centre 20.4/3.6, rayon 2.7) : à l'échelle 2.45 il
# tombe à 32.0 dp du centre, donc sous les 33 dp du rayon garanti — même un
# masque circulaire ne peut pas le rogner. Le contenu occupe 70 % des 72 dp
# visibles, ce qui est l'optique habituelle d'une icône adaptative.
html_svg "$TMP/foreground.html" "0 0 108 108" "100%" "100%" \
  '<g fill="#06080b" transform="translate(22.64 27.91) scale(2.45)">'"$MARK"'</g>'

# --- 4. Splash screens ----------------------------------------------------
# Fond #0a0d12 + monogramme acide centré, à 30 % du plus petit côté.
splash_html() { # <sortie> <largeur> <hauteur>
  local out="$1" w="$2" h="$3"
  local s
  s="$(awk -v a="$w" -v b="$h" 'BEGIN{m=(a<b?a:b); printf "%d", m*0.30}')"
  cat > "$out" <<HTML
<!doctype html><html><head><style>
html,body{margin:0;padding:0;width:${w}px;height:${h}px;background:#0a0d12;overflow:hidden}
body{display:flex;align-items:center;justify-content:center}
svg{display:block}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="$s" height="$s" viewBox="0 0 24 24" fill="#cdf542">$MARK</svg>
</body></html>
HTML
}

# --- Rendu des maîtres (une seule passe Chromium par visuel) --------------
render "$TMP/square.html"     192 192 "$TMP/square.png"     transparent
render "$TMP/round.html"      192 192 "$TMP/round.png"      transparent
render "$TMP/foreground.html" 432 432 "$TMP/foreground.png" transparent
splash_html "$TMP/splash-port.html" 1280 1920
render "$TMP/splash-port.html" 1280 1920 "$TMP/splash-port.png"
splash_html "$TMP/splash-land.html" 1920 1280
render "$TMP/splash-land.html" 1920 1280 "$TMP/splash-land.png"

# --- Déclinaisons par densité --------------------------------------------
# mdpi ×1, hdpi ×1.5, xhdpi ×2, xxhdpi ×3, xxxhdpi ×4.
# Launcher 48 dp, foreground adaptatif 108 dp.
for pair in "mdpi 48 108" "hdpi 72 162" "xhdpi 96 216" "xxhdpi 144 324" "xxxhdpi 192 432"; do
  set -- $pair
  d="$1" icon="$2" fg="$3"
  resize "$TMP/square.png"     "$icon" "$icon" "$RES/mipmap-$d/ic_launcher.png"
  resize "$TMP/round.png"      "$icon" "$icon" "$RES/mipmap-$d/ic_launcher_round.png"
  resize "$TMP/foreground.png" "$fg"   "$fg"   "$RES/mipmap-$d/ic_launcher_foreground.png"
done

# Splash : tailles dp officielles (portrait / paysage) + drawable de repli.
for pair in \
  "port-mdpi 320 480" "port-hdpi 480 800" "port-xhdpi 720 1280" "port-xxhdpi 960 1600" "port-xxxhdpi 1280 1920"; do
  set -- $pair
  resize "$TMP/splash-port.png" "$2" "$3" "$RES/drawable-$1/splash.png"
done
for pair in \
  "land-mdpi 480 320" "land-hdpi 800 480" "land-xhdpi 1280 720" "land-xxhdpi 1600 960" "land-xxxhdpi 1920 1280"; do
  set -- $pair
  resize "$TMP/splash-land.png" "$2" "$3" "$RES/drawable-$1/splash.png"
done
resize "$TMP/splash-land.png" 480 320 "$RES/drawable/splash.png"

# --- Couleurs -------------------------------------------------------------
# Le fond du calque adaptatif doit être l'acide de la marque, pas le blanc
# du gabarit Capacitor.
cat > "$RES/values/ic_launcher_background.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#cdf542</color>
</resources>
XML

# styles.xml référence @color/colorPrimary, colorPrimaryDark et colorAccent :
# le gabarit Capacitor 8 ne fournit plus colors.xml, ce qui casse AAPT.
cat > "$RES/values/colors.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#cdf542</color>
    <color name="colorPrimaryDark">#06080b</color>
    <color name="colorAccent">#cdf542</color>
</resources>
XML

# Android 12+ affiche un splash système (icône + fond) avant la WebView.
# Sans windowSplashScreenBackground, ce fond est blanc : on force l'encre
# de la marque. Idempotent — on ne réinsère pas si l'attribut est présent.
python3 - "$RES/values/styles.xml" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "windowSplashScreenBackground" not in s:
    old = '<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">'
    new = old + '\n        <item name="windowSplashScreenBackground">@color/colorPrimaryDark</item>'
    if old in s:
        open(p, "w", encoding="utf-8").write(s.replace(old, new, 1))
PY

# --- Nettoyage des restes du gabarit --------------------------------------
# Vecteurs Capacitor (logo par défaut) devenus inutiles : le calque
# adaptatif pointe désormais sur les PNG de mipmap-*.
rm -f "$RES/drawable-v24/ic_launcher_foreground.xml"
rm -f "$RES/drawable/ic_launcher_background.xml"
rmdir "$RES/drawable-v24" 2>/dev/null || true

# --- Récapitulatif --------------------------------------------------------
echo "Ressources Android générées :"
find "$RES" -name "*.png" | grep -E "mipmap|splash" | sort | while read -r f; do
  printf '  %-58s %s octets\n' "${f#"$ROOT"/}" "$(stat -c%s "$f")"
done
