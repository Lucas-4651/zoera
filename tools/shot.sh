#!/usr/bin/env bash
# Capture d'écran d'une page Zoera via Chromium headless.
# Usage: tools/shot.sh <url> <sortie.png> [largeur] [hauteur]
set -euo pipefail

URL="${1:-http://localhost:3000/}"
OUT="${2:-/tmp/opencode/shot.png}"
W="${3:-1440}"
H="${4:-1000}"

mkdir -p "$(dirname "$OUT")"

chromium \
  --headless=new \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --hide-scrollbars \
  --force-device-scale-factor=1 \
  --virtual-time-budget=6000 \
  --window-size="${W},${H}" \
  --screenshot="${OUT}" \
  "${URL}" >/dev/null 2>&1 || true

if [ -s "${OUT}" ]; then
  echo "OK  ${OUT}  ($(stat -c%s "${OUT}") octets)  <- ${URL}"
else
  echo "ÉCHEC capture : ${URL}" >&2
  exit 1
fi
