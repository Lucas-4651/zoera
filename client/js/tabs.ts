/**
 * Onglets (statistiques, compositions, chronologie, commentaire,
 * confrontation, cotes, prédiction, positions) — sans dépendance.
 */

import { qsa } from "./dom.js";

function selectTab(tabs: HTMLElement[], target: string): void {
  tabs.forEach(function (tab) {
    const isTarget = tab.getAttribute("data-tab-target") === target;
    tab.setAttribute("aria-selected", isTarget ? "true" : "false");
    tab.setAttribute("tabindex", isTarget ? "0" : "-1");
    const panelId = tab.getAttribute("aria-controls");
    if (panelId) {
      const panel = document.getElementById(panelId);
      if (panel) {
        if (isTarget) panel.removeAttribute("hidden");
        else panel.setAttribute("hidden", "");
      }
    }
  });
}

export function initTabs(): void {
  qsa<HTMLElement>("[data-tabs]").forEach(function (container) {
    const tabs = qsa<HTMLElement>("[data-tab-target]", container);
    if (tabs.length === 0) return;

    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () {
        const target = tab.getAttribute("data-tab-target");
        if (target) selectTab(tabs, target);
      });

      // Navigation clavier (flèches gauche/droite) — accessibilité.
      tab.addEventListener("keydown", function (event) {
        const key = event.key;
        if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") return;
        event.preventDefault();
        let next = index;
        if (key === "ArrowRight") next = (index + 1) % tabs.length;
        if (key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        if (key === "Home") next = 0;
        if (key === "End") next = tabs.length - 1;
        const target = tabs[next].getAttribute("data-tab-target");
        if (target) selectTab(tabs, target);
        tabs[next].focus();
      });
    });

    // État initial : premier onglet actif si rien n'est sélectionné.
    const selected = tabs.filter(function (tab) {
      return tab.getAttribute("aria-selected") === "true";
    });
    const initial = selected.length > 0 ? selected[0] : tabs[0];
    const initialTarget = initial.getAttribute("data-tab-target");
    if (initialTarget) selectTab(tabs, initialTarget);
  });
}
