/**
 * Interface : menu mobile, copie du lien, retour en haut de page.
 */

import { qsa } from "./dom.js";

function initMobileMenu(): void {
  const toggles = qsa<HTMLButtonElement>("[data-mobile-menu-toggle]");
  const panels = qsa<HTMLElement>("[data-mobile-menu]");
  if (toggles.length === 0 || panels.length === 0) return;

  const setOpen = function (open: boolean): void {
    panels.forEach(function (panel) {
      if (open) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    });
    toggles.forEach(function (toggle) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    });
  };

  toggles.forEach(function (toggle) {
    toggle.addEventListener("click", function () {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      setOpen(!expanded);
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setOpen(false);
  });

  // On referme le menu après un choix (navigation).
  panels.forEach(function (panel) {
    panel.addEventListener("click", function (event) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("a")) setOpen(false);
    });
  });
}

function initCopyLink(): void {
  qsa<HTMLButtonElement>("[data-copy-link]").forEach(function (button) {
    button.addEventListener("click", function () {
      const url = window.location.href;
      const done = function (): void {
        const label = button.getAttribute("aria-label") || "Copier le lien";
        button.setAttribute("aria-label", "Lien copié");
        button.classList.add("text-acid-300");
        window.setTimeout(function () {
          button.setAttribute("aria-label", label);
          button.classList.remove("text-acid-300");
        }, 1800);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () {
          fallbackCopy(url);
        });
      } else {
        fallbackCopy(url);
      }
    });
  });
}

function fallbackCopy(url: string): void {
  const area = document.createElement("textarea");
  area.value = url;
  area.setAttribute("readonly", "");
  area.style.position = "absolute";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
  } catch {
    /* copie impossible : sans conséquence */
  }
  document.body.removeChild(area);
}

/** Le menu mobile s'ouvre sur la page d'accueil aussi (pas de header sticky plein). */
function initStickyHeaderShadow(): void {
  const header = document.querySelector<HTMLElement>("header");
  if (!header) return;
  const update = function (): void {
    header.classList.toggle("shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]", window.scrollY > 8);
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
}

export function initUi(): void {
  initMobileMenu();
  initCopyLink();
  initStickyHeaderShadow();
}
