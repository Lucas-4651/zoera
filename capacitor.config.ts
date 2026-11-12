import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Coquille Android de Zoera.
 *
 * L'application est rendue côté serveur (EJS) : l'APK ne contient donc pas les
 * pages, elle charge le site. Deux réglages comptent :
 *
 *   server.url        URL HTTPS du serveur Node déployé. Surchargée en CI par
 *                     la variable ZOERA_APP_URL (dépôt GitHub → Settings →
 *                     Variables → Actions).
 *   server.errorPath  page locale embarquée (mobile/www/index.html) affichée
 *                     quand le serveur est injoignable, au lieu de la page
 *                     d'erreur blanche de WebView.
 */
const appUrl = process.env.ZOERA_APP_URL || "https://zoera.example";

const config: CapacitorConfig = {
  appId: "mg.zoera.app",
  appName: "Zoera",
  webDir: "mobile/www",
  android: {
    allowMixedContent: false,
    backgroundColor: "#0a0d12",
  },
  server: {
    url: appUrl,
    cleartext: false,
    androidScheme: "https",
    errorPath: "index.html",
  },
};

export default config;
