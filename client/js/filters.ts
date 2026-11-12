/**
 * Filtres : calendrier (date + compétition), direct (par compétition),
 * page des ligues (hommes/femmes, pays), prédictions et mercato.
 * L'état est reflété dans l'URL (navigation partageable).
 */

import { qsa } from "./dom.js";

function currentParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function syncUrl(key: string, value: string): void {
  const params = currentParams();
  if (value) params.set(key, value);
  else params.delete(key);
  const query = params.toString();
  const url = window.location.pathname + (query ? `?${query}` : "") + window.location.hash;
  window.history.replaceState(null, "", url);
}

/* ------------------------------------------------------------------ */
/* Calendrier : filtre par compétition                                  */
/* ------------------------------------------------------------------ */
function initFixturesFilter(): void {
  const select = document.querySelector<HTMLSelectElement>("[data-league-filter]");
  if (!select) return;

  const apply = function (leagueId: string): void {
    qsa<HTMLElement>("[data-competition]").forEach(function (section) {
      const id = section.getAttribute("data-competition");
      section.hidden = !!leagueId && id !== leagueId;
    });
    syncUrl("league", leagueId);
  };

  // État initial : paramètre d'URL éventuel.
  const initial = currentParams().get("league") || "";
  if (initial) select.value = initial;
  apply(select.value);

  select.addEventListener("change", function () {
    apply(select.value);
  });
}

/* ------------------------------------------------------------------ */
/* Direct : puces de filtre par compétition                             */
/* ------------------------------------------------------------------ */
function initLiveFilter(): void {
  const buttons = qsa<HTMLElement>("[data-live-league-filter]");
  if (buttons.length === 0) return;

  const apply = function (leagueId: string): void {
    buttons.forEach(function (button) {
      const active = (button.getAttribute("data-live-league-filter") || "") === leagueId;
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.classList.toggle("border-acid-500/50", active);
      button.classList.toggle("bg-acid-500/12", active);
      button.classList.toggle("text-acid-300", active);
      button.classList.toggle("border-line", !active);
      button.classList.toggle("bg-ink-850", !active);
      button.classList.toggle("text-mist-300", !active);
    });

    qsa<HTMLElement>("[data-live-group]").forEach(function (group) {
      const id = group.getAttribute("data-live-group");
      group.hidden = !!leagueId && id !== leagueId;
    });
  };

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      apply(button.getAttribute("data-live-league-filter") || "");
    });
  });

  apply("");
}

/* ------------------------------------------------------------------ */
/* Ligues : hommes / femmes + pays                                      */
/* ------------------------------------------------------------------ */
function initLeaguesFilters(): void {
  const genderButtons = qsa<HTMLElement>("[data-league-gender]");
  const countrySelect = document.querySelector<HTMLSelectElement>("[data-league-country]");
  if (genderButtons.length === 0 && !countrySelect) return;

  let gender = "";
  const country = function (): string {
    return countrySelect ? countrySelect.value : "";
  };

  const apply = function (): void {
    genderButtons.forEach(function (button) {
      const active = (button.getAttribute("data-league-gender") || "") === gender;
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.classList.toggle("border-acid-500/50", active);
      button.classList.toggle("bg-acid-500/12", active);
      button.classList.toggle("text-acid-300", active);
      button.classList.toggle("border-line", !active);
      button.classList.toggle("bg-ink-800", !active);
      button.classList.toggle("text-mist-300", !active);
    });

    const wanted = country();
    qsa<HTMLElement>("[data-league-gender-item]").forEach(function (item) {
      const g = item.getAttribute("data-league-gender-item");
      const c = item.getAttribute("data-league-country-item");
      const visible = (gender === "" || g === gender) && (wanted === "" || c === wanted);
      item.hidden = !visible;
    });

    // On masque une section de pays devenue vide.
    qsa<HTMLElement>("[data-country]").forEach(function (section) {
      const items = qsa<HTMLElement>("[data-league-gender-item]", section);
      const anyVisible = items.some(function (item) {
        return !item.hidden;
      });
      section.hidden = !anyVisible;
    });
  };

  genderButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      gender = button.getAttribute("data-league-gender") || "";
      apply();
      syncUrl("genre", gender);
    });
  });

  if (countrySelect) {
    countrySelect.addEventListener("change", function () {
      apply();
      syncUrl("pays", countrySelect.value);
    });
  }

  const initialGenre = currentParams().get("genre");
  if (initialGenre) gender = initialGenre;
  const initialPays = currentParams().get("pays");
  if (initialPays && countrySelect) countrySelect.value = initialPays;
  apply();
}

/* ------------------------------------------------------------------ */
/* Prédictions : filtre par compétition (par nom)                        */
/* ------------------------------------------------------------------ */
function initPredictionsFilter(): void {
  const select = document.querySelector<HTMLSelectElement>("[data-prediction-league]");
  if (!select) return;

  const apply = function (): void {
    const option = select.options[select.selectedIndex];
    /* On filtre sur le NOM de la ligue (attribut data-league-name), mais
       l'option « toutes les compétitions » a une valeur vide : sans cette
       garde, son libellé (« Toutes les compétitions ») était comparé aux
       noms de ligues et masquait toutes les cartes. */
    const wanted = option && option.value ? (option.textContent || "").trim() : "";
    const items = qsa<HTMLElement>("[data-prediction-item]");
    items.forEach(function (item) {
      const name = (item.getAttribute("data-league-name") || "").trim();
      item.hidden = !!wanted && name !== wanted;
    });

    /* Si le filtre courant ne laisse aucune carte visible, on affiche un
       état vide et on masque la liste ; sinon l'inverse. */
    const list = document.querySelector<HTMLElement>("[data-prediction-list]");
    const empty = document.querySelector<HTMLElement>("[data-prediction-empty]");
    if (list && empty) {
      const visible = items.filter(function (item) {
        return !item.hidden;
      }).length;
      empty.hidden = visible > 0;
      list.hidden = visible === 0;
    }
  };

  select.addEventListener("change", apply);
  apply();
}

/* ------------------------------------------------------------------ */
/* Mercato : filtre par compétition (navigation côté serveur)            */
/* ------------------------------------------------------------------ */
function initTransfersFilter(): void {
  const select = document.querySelector<HTMLSelectElement>("[data-transfer-league]");
  if (!select) return;

  const initial = currentParams().get("league_id");
  if (initial) select.value = initial;

  select.addEventListener("change", function () {
    const url = select.value
      ? `/transfers?league_id=${encodeURIComponent(select.value)}`
      : "/transfers";
    window.location.href = url;
  });
}

export function initFilters(): void {
  initFixturesFilter();
  initLiveFilter();
  initLeaguesFilters();
  initPredictionsFilter();
  initTransfersFilter();
}
