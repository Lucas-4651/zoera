/**
 * Favoris : équipes et matchs, persistés en localStorage.
 * L'état est réappliqué au rendu (boutons déjà présents dans le HTML).
 */

const STORAGE_KEY = "zoera.favorites.v1";

interface Favorites {
  teams: number[];
  matches: number[];
}

function emptyState(): Favorites {
  return { teams: [], matches: [] };
}

function read(): Favorites {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<Favorites>;
    return {
      teams: Array.isArray(parsed.teams) ? parsed.teams : [],
      matches: Array.isArray(parsed.matches) ? parsed.matches : []
    };
  } catch {
    return emptyState();
  }
}

function write(state: Favorites): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* stockage indisponible (mode privé) : on ignore */
  }
}

/** "match:42" ou "team:7" → type + identifiant. */
function parseKey(key: string): { kind: "match" | "team"; id: number } | null {
  const parts = key.split(":");
  if (parts.length !== 2) return null;
  const id = Number(parts[1]);
  if (!Number.isFinite(id)) return null;
  if (parts[0] === "match") return { kind: "match", id };
  if (parts[0] === "team") return { kind: "team", id };
  return null;
}

function isFavorite(kind: "match" | "team", id: number): boolean {
  const state = read();
  return (kind === "match" ? state.matches : state.teams).indexOf(id) !== -1;
}

function toggle(kind: "match" | "team", id: number): boolean {
  const state = read();
  const list = kind === "match" ? state.matches : state.teams;
  const pos = list.indexOf(id);
  if (pos === -1) list.push(id);
  else list.splice(pos, 1);
  write(state);
  return pos === -1;
}

function paint(button: HTMLElement, active: boolean): void {
  button.setAttribute("aria-pressed", active ? "true" : "false");
  const key = button.getAttribute("data-fav") || "";
  const kind = key.indexOf("match:") === 0 ? "ce match" : "cette équipe";
  button.setAttribute(
    "aria-label",
    active ? `Retirer ${kind} des favoris` : `Ajouter ${kind} aux favoris`
  );
  button.classList.toggle("text-acid-300", active);
  button.classList.toggle("text-mist-500", !active);
  button.classList.toggle("text-mist-400", !active);
}

export function initFavorites(): void {
  const buttons = Array.prototype.slice.call(
    document.querySelectorAll<HTMLElement>("[data-fav]")
  ) as HTMLElement[];

  buttons.forEach(function (button) {
    const key = button.getAttribute("data-fav") || "";
    const parsed = parseKey(key);
    if (parsed) paint(button, isFavorite(parsed.kind, parsed.id));

    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      const target = parseKey(key);
      if (!target) return;
      const active = toggle(target.kind, target.id);
      paint(button, active);
      button.classList.add("ko-flash");
      window.setTimeout(function () {
        button.classList.remove("ko-flash");
      }, 900);
    });
  });
}
