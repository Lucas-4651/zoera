/**
 * Recherche : debounce 250 ms, GET /api/search?q=…, rendu des résultats
 * groupés (compétitions, équipes, joueurs) sans rechargement.
 */

import { el, qs, qsa } from "./dom.js";
import type { ApiLeague, ApiPlayer, ApiSearchResponse, ApiTeam } from "./types.js";

const DEBOUNCE_MS = 250;

function initials(name: string): string {
  const parts = name
    .split(/\s+/)
    .filter(function (part) {
      return part.length > 0;
    })
    .slice(0, 2);
  return parts
    .map(function (part) {
      return part.charAt(0).toUpperCase();
    })
    .join("");
}

function section(title: string): HTMLElement {
  const wrap = el("section");
  const heading = el("h2", "ko-eyebrow mb-3 text-[11px] text-mist-400");
  heading.textContent = title;
  wrap.appendChild(heading);
  return wrap;
}

function leagueCard(lg: ApiLeague): HTMLElement {
  const item = el("li");
  const link = el("a", "ko-focus flex items-center gap-3 border border-line bg-ink-900 p-3 transition-colors duration-200 hover:border-line-strong hover:bg-ink-850");
  link.href = `/leagues/${lg.id}`;

  const badge = el("span", "grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[9px] border border-line bg-ink-750 font-display text-[13px] font-bold text-mist-300");
  badge.textContent = initials(lg.name);
  if (lg.logoUrl) {
    const img = document.createElement("img");
    img.src = lg.logoUrl;
    img.alt = "";
    img.loading = "lazy";
    img.className = "h-full w-full object-contain";
    img.addEventListener("error", function () {
      img.remove();
    });
    badge.appendChild(img);
  }

  const texts = el("span", "min-w-0");
  const name = el("span", "block truncate text-[13px] font-semibold text-mist-50");
  name.textContent = lg.name;
  const meta = el("span", "block truncate text-[11px] text-mist-500");
  meta.textContent = lg.country || "";
  texts.appendChild(name);
  texts.appendChild(meta);

  link.appendChild(badge);
  link.appendChild(texts);
  item.appendChild(link);
  return item;
}

function teamCard(tm: ApiTeam): HTMLElement {
  const item = el("li");
  const link = el("a", "ko-focus flex items-center gap-3 border border-line bg-ink-900 p-3 transition-colors duration-200 hover:border-line-strong hover:bg-ink-850");
  link.href = `/teams/${tm.id}`;

  const badge = el("span", "relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[9px] border border-line bg-ink-750 font-display text-[13px] font-bold text-mist-300");
  badge.textContent = initials(tm.name);
  const img = document.createElement("img");
  img.src = `https://sports.bzzoiro.com/img/team/${tm.id}/`;
  img.alt = "";
  img.loading = "lazy";
  img.className = "absolute inset-0 h-full w-full object-contain";
  img.addEventListener("error", function () {
    img.remove();
  });
  badge.appendChild(img);

  const texts = el("span", "min-w-0");
  const name = el("span", "block truncate text-[13px] font-semibold text-mist-50");
  name.textContent = tm.name;
  const meta = el("span", "block truncate text-[11px] text-mist-500");
  meta.textContent = tm.country || "";
  texts.appendChild(name);
  texts.appendChild(meta);

  link.appendChild(badge);
  link.appendChild(texts);
  item.appendChild(link);
  return item;
}

function playerRow(pl: ApiPlayer): HTMLElement {
  const item = el("li", "flex items-center gap-3 border-b border-line/80 px-3 py-2.5 last:border-b-0");
  const badge = el("span", "relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[8px] border border-line bg-ink-750 font-display text-[12px] font-bold text-mist-300");
  badge.textContent = initials(pl.name);
  const img = document.createElement("img");
  img.src = `https://sports.bzzoiro.com/img/player/${pl.id}/?sor=true`;
  img.alt = "";
  img.loading = "lazy";
  img.className = "absolute inset-0 h-full w-full object-cover";
  img.addEventListener("error", function () {
    img.remove();
  });
  badge.appendChild(img);

  const link = el("a", "ko-focus min-w-0 flex-1");
  link.href = `/players/${pl.id}`;
  const name = el("span", "block truncate text-[13px] font-medium text-mist-100");
  name.textContent = pl.name;
  const meta = el("span", "block truncate text-[11px] text-mist-500");
  meta.textContent = pl.currentTeamName || pl.nationality || pl.position || "";
  link.appendChild(name);
  link.appendChild(meta);

  item.appendChild(badge);
  item.appendChild(link);
  return item;
}

function render(container: HTMLElement, data: ApiSearchResponse): void {
  container.textContent = "";

  const leagues = data.leagues || [];
  const teams = data.teams || [];
  const players = data.players || [];

  if (leagues.length === 0 && teams.length === 0 && players.length === 0) {
    const empty = el("div", "flex flex-col items-center gap-3 border border-dashed border-line-strong bg-ink-850/60 px-6 py-10 text-center");
    const title = el("p", "font-display text-[15px] font-bold tracking-wide text-mist-100");
    title.textContent = "Aucun résultat";
    const message = el("p", "max-w-sm text-[13px] leading-relaxed text-mist-400");
    message.textContent = "Aucune équipe, aucun joueur et aucune compétition ne correspond à cette recherche.";
    empty.appendChild(title);
    empty.appendChild(message);
    container.appendChild(empty);
    return;
  }

  const grid = "grid gap-2 sm:grid-cols-2 lg:grid-cols-3";

  if (leagues.length) {
    const sec = section(`Compétitions (${leagues.length})`);
    const list = el("ul", grid);
    leagues.forEach(function (lg) {
      list.appendChild(leagueCard(lg));
    });
    sec.appendChild(list);
    container.appendChild(sec);
  }

  if (teams.length) {
    const sec = section(`Équipes (${teams.length})`);
    const list = el("ul", grid);
    teams.forEach(function (tm) {
      list.appendChild(teamCard(tm));
    });
    sec.appendChild(list);
    container.appendChild(sec);
  }

  if (players.length) {
    const sec = section(`Joueurs (${players.length})`);
    const list = el("ul", "border border-line bg-ink-900");
    players.forEach(function (pl) {
      list.appendChild(playerRow(pl));
    });
    sec.appendChild(list);
    container.appendChild(sec);
  }
}

export function initSearch(): void {
  const container = qs<HTMLElement>("[data-search-results]");
  const inputs = qsa<HTMLInputElement>("[data-search-input]");
  if (!container || inputs.length === 0) return;

  let timer: number | null = null;
  let sequence = 0;

  const run = function (value: string): void {
    const term = value.trim();
    if (term.length < 2) return;
    sequence += 1;
    const current = sequence;

    fetch(`/api/search?q=${encodeURIComponent(term)}`, {
      headers: { Accept: "application/json" },
      credentials: "same-origin"
    })
      .then(function (response) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<ApiSearchResponse>;
      })
      .then(function (data) {
        if (current !== sequence) return; // une réponse plus récente est arrivée
        render(container, data);
      })
      .catch(function () {
        /* on conserve l'affichage serveur */
      });
  };

  inputs.forEach(function (input) {
    input.addEventListener("input", function () {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        run(input.value);
      }, DEBOUNCE_MS);
    });
  });
}
