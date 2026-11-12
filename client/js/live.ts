/**
 * Polling « en direct » : GET /api/live toutes les 15 s.
 * - mise à jour du DOM sans rechargement ;
 * - pause quand l'onglet est caché (visibilitychange) ;
 * - backoff ×2 jusqu'à 60 s en cas d'erreur réseau ;
 * - indicateur « dernière mise à jour ».
 */

import { qsa, relativeTime } from "./dom.js";
import type { ApiLiveResponse, LiveEvent } from "./types.js";

const POLL_MIN_MS = 15000;
const POLL_MAX_MS = 60000;

let timer: number | null = null;
let currentDelay = POLL_MIN_MS;
let lastUpdate = 0;
let inFlight = false;

function setTimer(delay: number): void {
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(function () {
    void poll();
  }, delay);
}

/** Met à jour tous les blocs d'un match présents dans le DOM. */
function applyEvent(ev: LiveEvent): void {
  const containers = qsa<HTMLElement>(`[data-live-match][data-event-id="${ev.id}"]`);
  containers.forEach(function (container) {
    container.setAttribute("data-status", ev.status);
    if (ev.minute !== null && ev.minute !== undefined) {
      container.setAttribute("data-minute", String(ev.minute));
    }
    if (ev.homeScore !== null && ev.homeScore !== undefined) {
      container.setAttribute("data-home-score", String(ev.homeScore));
    }
    if (ev.awayScore !== null && ev.awayScore !== undefined) {
      container.setAttribute("data-away-score", String(ev.awayScore));
    }

    const score = container.querySelector("[data-live-score]");
    if (score) {
      const home = ev.homeScore === null || ev.homeScore === undefined ? 0 : ev.homeScore;
      const away = ev.awayScore === null || ev.awayScore === undefined ? 0 : ev.awayScore;
      score.textContent = `${home} – ${away}`;
    }

    const minute = container.querySelector("[data-live-minute]");
    if (minute) {
      minute.textContent = ev.minute === null || ev.minute === undefined ? "" : `${ev.minute}'`;
    }
  });
}

function updateCounter(count: number): void {
  qsa<HTMLElement>("[data-live-count]").forEach(function (node) {
    node.textContent = String(count);
  });
}

function paintUpdatedLabel(): void {
  qsa<HTMLElement>("[data-live-updated]").forEach(function (node) {
    if (!lastUpdate) {
      node.textContent = "Dernière mise à jour : —";
      return;
    }
    node.textContent = `Dernière mise à jour : ${relativeTime(lastUpdate)}`;
  });
}

async function poll(): Promise<void> {
  if (inFlight) {
    setTimer(currentDelay);
    return;
  }
  inFlight = true;
  try {
    const response = await fetch("/api/live", {
      headers: { Accept: "application/json" },
      credentials: "same-origin"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as ApiLiveResponse;
    const events = Array.isArray(payload.live) ? payload.live : [];
    events.forEach(applyEvent);
    updateCounter(events.length);
    lastUpdate = Date.now();
    paintUpdatedLabel();
    currentDelay = POLL_MIN_MS;
  } catch {
    // Erreur réseau : on espace les tentatives (backoff ×2, plafonné à 60 s).
    currentDelay = Math.min(currentDelay * 2, POLL_MAX_MS);
  } finally {
    inFlight = false;
    setTimer(currentDelay);
  }
}

export function initLive(): void {
  // Aucun bloc live sur la page : inutile de sonder l'API.
  const hasLiveBlocks = qsa("[data-live-match]").length > 0;
  const hasIndicator = qsa("[data-live-updated]").length > 0;
  if (!hasLiveBlocks && !hasIndicator) return;

  paintUpdatedLabel();
  void poll();

  // Rafraîchissement du libellé « il y a X s » même sans nouveau poll.
  window.setInterval(paintUpdatedLabel, 5000);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    } else if (timer === null) {
      void poll();
    }
  });
}
