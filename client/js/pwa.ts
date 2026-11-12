/**
 * PWA : enregistrement du service worker et invitation à installer.
 * Aucune dépendance. Le service worker ne s'active qu'en HTTPS ou sur
 * localhost — ailleurs, l'échec est silencieux (l'app reste utilisable).
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: InstallPromptEvent | null = null;

export function initPwa(): void {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {
      /* pas de HTTPS, ou SW désactivé : sans effet sur le reste de l'app */
    });
  });

  /* Chrome/Android : on garde l'événement pour proposer l'installation
     depuis le bouton du menu mobile. */
  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    document.querySelectorAll<HTMLElement>("[data-pwa-install]").forEach(function (el) {
      el.hidden = false;
    });
  });

  document.addEventListener("click", function (event) {
    const target = event.target as HTMLElement | null;
    const trigger = target ? target.closest<HTMLElement>("[data-pwa-install]") : null;
    if (!trigger || !deferredPrompt) return;
    event.preventDefault();
    const prompt = deferredPrompt;
    prompt.prompt();
    prompt.userChoice.finally(function () {
      deferredPrompt = null;
      document.querySelectorAll<HTMLElement>("[data-pwa-install]").forEach(function (el) {
        el.hidden = true;
      });
    });
  });
}
