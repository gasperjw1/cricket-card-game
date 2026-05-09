# Deployment — Swipe Sixer on Fly.io

This doc explains everything about how Swipe Sixer is deployed publicly:
the architecture, every file involved, how to deploy and update it, common
operations, and **how to tear it all down cleanly** when we eventually
migrate to Facebook Messenger Instant Games.

This is a "for myself, six months from now" doc — verbose on purpose.

---

## 1. Why Fly.io?

We picked Fly.io because the game needs:

1. **A WebSocket server** — players talk to each other through Socket.IO,
   which needs a long-lived TCP connection. Static-only hosts (GitHub
   Pages, Netlify free tier) can't do this.
2. **Always-on hosting** — "click my link" sharing breaks if the server
   has 30-second cold starts. Fly's free tier keeps at least one VM warm.
3. **Single-host simplicity** — one Fly app serves both the static React
   client AND the WebSocket server, on the same origin. No CORS headaches,
   no separate static host to manage.

Alternatives considered: Vercel + separate WS host (more moving parts),
Render free tier (cold starts), Railway (no real free tier post-2023).

**Important context:** Fly is a *temporary* home. The long-term target
is Facebook Messenger Instant Games, which uses Meta's own multiplayer
infrastructure. See section 8 below for the teardown plan.

---

## 2. The architecture in one picture

```
                  ┌─────────────────────────────────────┐
  Player browser  │                                     │
  ──────────────► │   https://swipe-sixer.fly.dev       │
                  │                                     │
                  │   ┌─────────────────────────────┐   │
                  │   │ Node 20 + Express + Socket.IO│  │
                  │   │                              │  │
                  │   │ GET /          → React index │  │
                  │   │ GET /assets/.. → JS/CSS      │  │
                  │   │ GET /health    → JSON status │  │
                  │   │ WS  /socket.io → game state  │  │
                  │   └─────────────────────────────┘   │
                  │                                     │
                  │   1× shared-cpu-1x VM, 256MB RAM    │
                  │   (Fly free tier — primary: iad)    │
                  └─────────────────────────────────────┘
```

One process, one port, one URL. The Express server has a static-file
middleware that serves `client/dist/` for any unrecognised GET, and
Socket.IO listens on the same `httpServer` for WebSocket upgrades.

---

## 3. Files involved (and what each one does)

| File | Purpose |
|------|---------|
| [`Dockerfile`](../Dockerfile) | Multi-stage build — installs deps, regenerates cards.json, compiles all 3 workspaces, then ships a slim runtime image with only built artifacts + production node_modules. |
| [`.dockerignore`](../.dockerignore) | Tells Docker NOT to ship `node_modules`, `dist`, `.git`, secrets, etc. into the build context. Smaller context = faster `fly deploy`. |
| [`fly.toml`](../fly.toml) | Fly.io app config — region, port, healthcheck, VM size. Read by `fly deploy`. |
| [`server/src/index.ts`](../server/src/index.ts) | When `NODE_ENV=production`, mounts `client/dist/` as static files and adds an SPA fallback so `/` boots the React app. WebSocket setup is unchanged from dev. |
| [`client/src/socket.ts`](../client/src/socket.ts) | When the client is built in production mode (and no `VITE_SERVER_URL` env var is set), Socket.IO connects to the page's own origin instead of `localhost:3001`. |

**No new dependencies were added** — Express and Socket.IO already shipped
with the dev server.

---

## 4. First-time deploy (one-time setup, ~10–15 min)

You only do this once.

### 4a. Install the Fly CLI

```bash
brew install flyctl       # macOS / Homebrew
# or:
curl -L https://fly.io/install.sh | sh
```

### 4b. Sign up + log in

```bash
fly auth signup           # opens browser; credit card required for verification
                          # but the free tier never charges unless you scale up
# (returning users:)
fly auth login
```

### 4c. Create the app

From the repo root (where `fly.toml` lives):

```bash
fly launch --no-deploy --copy-config
```

Flags explained:
- `--no-deploy` — don't build/deploy yet, just register the app name.
- `--copy-config` — use our pre-written `fly.toml` instead of asking you
  questions interactively.

Fly will probably ask:
- **App name** — must be globally unique. If `swipe-sixer` is taken, pick
  something like `swipe-sixer-yash` and update `app = "..."` in `fly.toml`.
- **Region** — accept the default (`iad`) or pick one closer to your players.
  Full list: https://fly.io/docs/reference/regions/

### 4d. Deploy

```bash
fly deploy
```

This:
1. Tarballs your repo (respecting `.dockerignore`)
2. Uploads it to Fly's remote builder
3. Runs the multi-stage Dockerfile build there
4. Pushes the image to Fly's registry
5. Boots a VM running the image
6. Hits `/health` to confirm it's live
7. Routes `https://<app-name>.fly.dev` to it

First deploy takes ~5 minutes (everything is cold). Subsequent deploys
are 1–2 minutes thanks to layer caching.

### 4e. Confirm it works

```bash
fly open                  # opens https://<app-name>.fly.dev in your browser
fly status                # shows VMs, regions, recent deploys
fly logs                  # tails server logs in real time
```

---

## 5. Updating after code changes

Just run:

```bash
fly deploy
```

That's it. Fly does an in-place rolling update — old VM keeps serving
requests until the new one passes its `/health` check, then traffic
swaps over with zero downtime.

**Tip:** if you want to deploy faster, install Docker Desktop locally
and Fly will auto-detect it, building images on your machine instead of
remotely. Saves the upload time. Not required.

---

## 6. Local dev is unchanged

```bash
npm run dev     # spins up Vite (5173) + tsx-watch server (3001), as before
```

The Dockerfile and fly.toml don't run during dev. Server code branches
on `NODE_ENV === "production"` — when running `npm run dev`, that's
`undefined`, so static-file serving is skipped (Vite handles the client).

You don't need Docker installed to develop. Ever.

---

## 7. Common operations

```bash
# Watch logs in real time
fly logs

# SSH into the running container (debugging)
fly ssh console

# Restart all VMs
fly apps restart

# Set / unset secrets (env vars not committed to git)
fly secrets set SOME_KEY=value
fly secrets unset SOME_KEY
fly secrets list

# Scale up (paid — leaves free tier)
fly scale vm shared-cpu-2x --memory 512    # bigger VM
fly scale count 2                          # more VMs

# Roll back to a previous release
fly releases                               # list versions
fly deploy --image registry.fly.io/<app>:deployment-<id>
```

---

## 8. Tearing it down for the Messenger migration

When we're ready to ship as a Facebook Messenger Instant Game, the Fly
deployment becomes obsolete. Here's the clean teardown:

### 8a. What to keep (still useful for Messenger build)

These are platform-agnostic and stay:

- `shared/` — engine, types, card data. Used wherever the game runs.
- `client/` — React app. Will be wrapped by Meta's Instant Games SDK
  rather than served by our server, but the bundle output is the same.
- `docs/` — all documentation.
- The `parse-cards` pipeline. Markdown → JSON stays the source of truth.

### 8b. What to throw away (Fly-specific)

These can all be deleted in one commit when you migrate:

- `Dockerfile`
- `.dockerignore`
- `fly.toml`
- `server/` (the entire workspace) — Messenger's `FBInstant.context`
  API replaces our Socket.IO multiplayer layer. The matchmaking, lobby,
  innings, and coin-toss logic that currently lives in `server/src/`
  needs to be reimplemented against `FBInstant.updateAsync()` and
  `FBInstant.subscribeBotAsync()` instead of WebSocket events.
- The static-serving block in `server/src/index.ts` — moot, since Meta
  hosts the bundle.
- The `socket.io` and `socket.io-client` dependencies in `server/package.json`
  and `client/package.json` — Messenger uses message-passing, not sockets.

### 8c. The Fly side of teardown

```bash
# Spin down VMs immediately (stops billing if you ever scaled past free)
fly scale count 0

# Or — destroy the app entirely
fly apps destroy swipe-sixer
```

Once destroyed, the `https://swipe-sixer.fly.dev` URL releases. If
you want to preserve old links pointing at it (e.g. shared with friends),
do `fly scale count 0` instead — keeps the app registered but stops
running it. Costs nothing on free tier.

### 8d. Architectural changes for Messenger (rough sketch)

For when you actually start the migration:

1. Add Meta's Instant Games SDK: `<script src="https://connect.facebook.net/en_US/fbinstant.7.0.js">`
2. Replace `client/src/socket.ts` with an `FBInstant` adapter that
   exposes the same `MatchClient` interface (state.ts wouldn't change).
3. Replace `server/src/match-registry.ts` and the WebSocket event handlers
   with logic that runs in the *client* (Messenger doesn't have a server
   — both players run the same code and sync via context messages).
4. The engine (`shared/src/engine/resolve-ball.ts`) and card data don't
   change at all.

This is a real refactor — probably 1–2 weeks of work. Not something to
start until Messenger Instant Games is actually validated as the
distribution channel.

---

## 9. Cost notes

Fly's free tier as of 2026:
- 3× `shared-cpu-1x` VMs (256MB RAM each)
- 3GB outbound transfer / month
- Free shared IPv4 + IPv6
- No charge for the app sitting idle (if `auto_stop_machines = true`)

Our setup uses 1 VM kept warm 24/7 (`min_machines_running = 1`).
That's well inside free tier for any realistic playtester audience
(say, <50 concurrent matches).

If the game goes viral — a problem we'd love to have — bump VM size
or count via `fly scale`. Each `shared-cpu-2x` is ~$5/month.

---

## 10. Quick-reference cheat sheet

| Task | Command |
|------|---------|
| Deploy a code change | `fly deploy` |
| Open the live app | `fly open` |
| Watch logs | `fly logs` |
| SSH in | `fly ssh console` |
| Roll back | `fly releases` then `fly deploy --image …` |
| Stop VMs (keep app) | `fly scale count 0` |
| Destroy app entirely | `fly apps destroy swipe-sixer` |
| Local dev (unaffected) | `npm run dev` |
