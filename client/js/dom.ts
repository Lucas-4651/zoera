/**
 * Utilitaires DOM partagés par les modules client.
 */

export function qs<T extends Element>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(selector);
}

export function qsa<T extends Element>(selector: string, root: ParentNode = document): T[] {
  return Array.prototype.slice.call(root.querySelectorAll<T>(selector));
}

/** Crée un élément avec classes et texte (pas d'injection HTML). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** "il y a 2 min", "dans 3 h" — format français compact. */
export function relativeTime(from: number): string {
  const diff = Math.max(0, Date.now() - from);
  const sec = Math.round(diff / 1000);
  if (sec < 10) return "à l'instant";
  if (sec < 60) return `il y a ${sec} s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

/** Échappe une chaîne pour un usage dans du HTML construit manuellement. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
