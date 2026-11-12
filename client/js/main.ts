/**
 * Point d'entrée client : initialise les modules d'interactivité.
 * Aucune dépendance, modules ES natifs (voir CONTRACT.md §10).
 */

import { initFavorites } from "./favorites.js";
import { initFilters } from "./filters.js";
import { initLive } from "./live.js";
import { initPwa } from "./pwa.js";
import { initSearch } from "./search.js";
import { initTabs } from "./tabs.js";
import { initUi } from "./ui.js";

function boot(): void {
  initUi();
  initTabs();
  initFilters();
  initSearch();
  initFavorites();
  initLive();
  initPwa();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
