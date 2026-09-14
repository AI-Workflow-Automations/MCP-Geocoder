# syntax=docker/dockerfile:1
#
# Zwei Stufen: pnpm löst die Abhängigkeiten auf (Node-Image), Bun führt aus.
# Bun braucht keinen Build-Schritt - TypeScript läuft direkt.

# --- Abhängigkeiten mit pnpm -----------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.4.1 --activate
COPY package.json pnpm-lock.yaml .npmrc ./
# hoisted (siehe .npmrc): flaches node_modules, das sich sauber ins Bun-Image kopieren lässt
RUN pnpm install --frozen-lockfile --prod

# --- Laufzeit mit Bun --------------------------------------------------------
FROM oven/bun:1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HTTP_PORT=8080

# curl nur für den Healthcheck
RUN apk add --no-cache curl

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY web ./web

USER bun
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:8080/health || exit 1

CMD ["bun", "run", "src/serve.ts"]
