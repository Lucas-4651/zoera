# Image de production de Zoera.
# Build : Tailwind + TypeScript (serveur + client) dans une étape jetable,
# runtime : Node 22 slim avec les seules dépendances d'exécution (ejs, express).
#
#   docker build -t zoera .
#   docker run -p 3000:3000 -e BSD_API_KEY=... zoera

# --- Étape 1 : compilation ------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Les dépendances d'abord : la couche est réutilisée tant que le lock ne change pas.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Étape 2 : exécution --------------------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    CACHE_DIR=/app/.cache

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/server/views ./server/views

# Le cache disque doit être inscriptible par l'utilisateur non privilégié.
RUN mkdir -p /app/.cache && chown -R node:node /app/.cache

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server/index.js"]
