# ───────────────────────────────────────────────────────────────────────────
# Swipe Sixer — production Docker image
#
# Multi-stage build:
#   Stage 1 (builder): install all deps, generate cards.json from markdown,
#     compile shared/server TypeScript, build the Vite client.
#   Stage 2 (runtime): slim image with only production deps + built artifacts.
#
# Final image runs the Node server, which both handles WebSockets AND serves
# the built React client as static files (see server/src/index.ts).
#
# Local dev does NOT use this Dockerfile — `npm run dev` runs Vite + tsx-watch
# directly. This file is only built/used during `fly deploy`.
# ───────────────────────────────────────────────────────────────────────────

# ───── Stage 1: build everything ─────
FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace package files first to maximize Docker layer cache —
# `npm ci` only re-runs when these change, not on every source edit.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY cottage/package.json ./cottage/
COPY play/package.json ./play/
COPY wcdraft/package.json ./wcdraft/
COPY draft/package.json ./draft/

# Install all deps (including dev) — needed for tsc, vite, tsx, prisma.
RUN npm ci

# Copy source files
COPY tsconfig.base.json ./
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/
COPY cottage/ ./cottage/
COPY play/ ./play/
# World Cup Draft: the client imports the engine as TypeScript source from wcdraft/src and its
# build syncs the committed wcdraft/data/out tables into public/data.
COPY wcdraft/ ./wcdraft/
COPY draft/ ./draft/
COPY docs/ ./docs/

# Generate Prisma client before building.
RUN npx prisma generate --schema=server/prisma/schema.prisma

# Regenerate cards.json from the markdown source of truth.
RUN npm run parse-cards

# Build every workspace with a build script (shared, server, client, cottage, play, draft;
# wcdraft has none, its data tables are committed).
RUN npm run build --workspaces --if-present

# ───── Stage 2: slim runtime image ─────
FROM node:20-slim AS runtime

# Prisma's query engine binary requires OpenSSL at runtime.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Production env triggers same-origin static serving in server/src/index.ts.
# PORT 8080 is Fly's default and matches fly.toml's [http_service].
ENV NODE_ENV=production
ENV PORT=8080

# Copy workspace package files for production install.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY cottage/package.json ./cottage/
COPY play/package.json ./play/
COPY wcdraft/package.json ./wcdraft/
COPY draft/package.json ./draft/

# Install server production deps (includes prisma + @prisma/client).
RUN npm ci --omit=dev --workspace=server --include-workspace-root

# Copy Prisma schema so the release command can run db push.
COPY server/prisma ./server/prisma

# Copy the generated Prisma client binary from the builder stage.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy built artifacts from the builder stage.
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/cottage/dist ./cottage/dist
COPY --from=builder /app/play/dist ./play/dist
COPY --from=builder /app/draft/dist ./draft/dist

# Document the port (Fly reads fly.toml, not this — it's purely informational)
EXPOSE 8080

# Boot the Node server. It serves Socket.IO at /socket.io and the React app
# at /. See server/src/index.ts for the static + WS wiring.
CMD ["node", "server/dist/index.js"]
