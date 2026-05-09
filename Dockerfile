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

# Install all deps (including dev) — needed for tsc, vite, tsx.
RUN npm ci

# Copy source files
COPY tsconfig.base.json ./
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/
COPY docs/ ./docs/

# Regenerate cards.json from the markdown source of truth, so the deploy
# always reflects whatever's in docs/card-roster.md (committed JSON is just
# a convenience artifact for local dev).
RUN npm run parse-cards

# Build all 3 workspaces:
#   - shared/  → dist/ (TypeScript + cards.json copied via resolveJsonModule)
#   - server/  → dist/ (TypeScript)
#   - client/  → dist/ (Vite production bundle)
RUN npm run build --workspaces

# ───── Stage 2: slim runtime image ─────
FROM node:20-slim AS runtime

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

# Install only the server's production deps. Shared is symlinked as a
# workspace dep automatically. Client deps are dev-time only (Vite, React
# are bundled into client/dist by the builder stage).
RUN npm ci --omit=dev --workspace=server --include-workspace-root

# Copy built artifacts from the builder stage. We don't ship src/, docs/,
# or client node_modules — keeps the runtime image small.
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Document the port (Fly reads fly.toml, not this — it's purely informational)
EXPOSE 8080

# Boot the Node server. It serves Socket.IO at /socket.io and the React app
# at /. See server/src/index.ts for the static + WS wiring.
CMD ["node", "server/dist/index.js"]
