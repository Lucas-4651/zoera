#!/usr/bin/env bash
# QA Zoera : démarre le serveur, teste toutes les routes, capture les écrans.
# Usage: tools/qa.sh [port]
set -uo pipefail

PORT="${1:-3100}"
BASE="http://127.0.0.1:${PORT}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHOTS="${SHOTS:-/tmp/opencode/shots}"
LOG="/tmp/opencode/qa-server.log"

cd "$ROOT"
mkdir -p "$SHOTS"

echo "=== 1. Build CSS + serveur + client ==="
npm run build:css >/tmp/opencode/qa-build.log 2>&1 && echo "build:css OK" || { echo "build:css ÉCHEC"; tail -20 /tmp/opencode/qa-build.log; }
npm run build:server >>/tmp/opencode/qa-build.log 2>&1 && echo "build:server OK" || { echo "build:server ÉCHEC"; tail -20 /tmp/opencode/qa-build.log; }
npm run build:client >>/tmp/opencode/qa-build.log 2>&1 && echo "build:client OK" || { echo "build:client ÉCHEC"; tail -20 /tmp/opencode/qa-build.log; }

echo "=== 2. Démarrage du serveur (port ${PORT}) ==="
PORT="$PORT" node dist/server/index.js >"$LOG" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

for i in $(seq 1 40); do
  if curl -fsS "${BASE}/api/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done

if ! curl -fsS "${BASE}/api/health" >/dev/null 2>&1; then
  echo "SERVEUR INJOIGNABLE — log :"; tail -40 "$LOG"; exit 1
fi
echo "health: $(curl -fsS "${BASE}/api/health")"

echo "=== 3. Routes API ==="
for r in "/api/health" "/api/quota" "/api/live" "/api/events?date_from=$(date -u +%F)&date_to=$(date -u -d '+3 days' +%F)" "/api/match/1" "/api/standings/1" "/api/search?q=arsenal"; do
  code=$(curl -s -o /tmp/opencode/qa-resp.json -w '%{http_code}' "${BASE}${r}")
  size=$(stat -c%s /tmp/opencode/qa-resp.json)
  printf "  %-3s %-6s %s\n" "$code" "${size}o" "$r"
  if [ "$code" != "200" ]; then head -c 300 /tmp/opencode/qa-resp.json; echo; fi
done

echo "=== 4. Pages HTML ==="
for p in "/" "/live" "/fixtures" "/match/1" "/leagues" "/leagues/1" "/palmares" "/teams/1" "/players/1" "/predictions" "/odds" "/transfers" "/recherche?q=arsenal" "/nexistepas" ; do
  code=$(curl -s -o /tmp/opencode/qa-page.html -w '%{http_code}' "${BASE}${p}")
  size=$(stat -c%s /tmp/opencode/qa-page.html)
  err=$(grep -c "Error\|Cannot read\|<pre>" /tmp/opencode/qa-page.html 2>/dev/null || echo 0)
  printf "  %-3s %-7s err=%-3s %s\n" "$code" "${size}o" "$err" "$p"
  if [ "$code" != "200" ] && [ "$code" != "404" ]; then head -c 400 /tmp/opencode/qa-page.html; echo; fi
done

echo "=== 5. Captures d'écran (MOBILE-FIRST : l'app est pensée pour le mobile) ==="
# L'app est mobile-first : les captures de référence sont prises en 390 px
# (iPhone 14). Le desktop est un contrôle secondaire, jamais la référence.
shot() { # url nom largeur hauteur
  ./tools/shot.sh "${BASE}$1" "${SHOTS}/$2.png" "$3" "$4" || true
}
M_W=390
M_H=844
shot "/" home $M_W $M_H
shot "/live" live $M_W $M_H
shot "/fixtures" fixtures $M_W $M_H
shot "/match/1" match $M_W $M_H
shot "/leagues" leagues $M_W $M_H
shot "/leagues/1" league $M_W $M_H
shot "/palmares" palmares $M_W $M_H
shot "/teams/1" team $M_W $M_H
shot "/players/1" player $M_W $M_H
shot "/predictions" predictions $M_W $M_H
shot "/odds" odds $M_W $M_H
shot "/transfers" transfers $M_W $M_H
shot "/recherche?q=arsenal" search $M_W $M_H

echo "--- contrôle desktop (secondaire) ---"
shot "/" home-desktop 1440 1100
shot "/match/1" match-desktop 1440 1400

echo "=== 6. Fin serveur ==="
kill $SERVER_PID 2>/dev/null
echo "Captures : ${SHOTS}"
echo "Log serveur : ${LOG}"
