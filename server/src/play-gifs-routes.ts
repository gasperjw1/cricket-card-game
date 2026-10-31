import { Router, type Request, type Response } from "express";
import { authenticatePlayer } from "./play-auth.js";

// GIF search proxy for /play table reactions. Keeps the Tenor key server-side,
// forces a family-safe content filter, and caches recent queries so a table
// repeatedly searching the same thing doesn't burn the free quota.
//
// Response shape is provider-agnostic on purpose — swapping Tenor for Giphy
// later only touches this file.

const router = Router();

const TENOR_BASE = "https://tenor.googleapis.com/v2";
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 200;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 20;
const MAX_QUERY_LEN = 60;

type Gif = { id: string; url: string; previewUrl: string; width: number; height: number };

const cache = new Map<string, { at: number; gifs: Gif[] }>();

function normalizeTenor(results: unknown): Gif[] {
  if (!Array.isArray(results)) return [];
  const out: Gif[] = [];
  for (const r of results) {
    const formats = (r as { media_formats?: Record<string, { url?: string; dims?: number[] }> })?.media_formats ?? {};
    const tiny = formats.tinygif;
    const nano = formats.nanogif ?? tiny;
    const id = (r as { id?: unknown })?.id;
    if (!tiny?.url || typeof id !== "string") continue;
    out.push({
      id,
      url: tiny.url,                 // shown in the on-table toast (~220px)
      previewUrl: nano?.url ?? tiny.url, // picker thumbnails (~90px, far less data on phones)
      width: tiny.dims?.[0] ?? 0,
      height: tiny.dims?.[1] ?? 0,
    });
  }
  return out;
}

// GET /play/api/gifs/search?q=<text>&limit=<n> — empty q returns Tenor's
// featured/trending set so the picker isn't blank before the user types.
router.get("/search", async (req: Request, res: Response) => {
  const me = await authenticatePlayer(req, res);
  if (!me) return;

  const key = process.env.TENOR_API_KEY;
  if (!key) {
    // Lets the client hide the GIF button cleanly instead of showing an error.
    res.status(503).json({ error: "gifs_unavailable" });
    return;
  }

  const q = String(req.query.q ?? "").trim().slice(0, MAX_QUERY_LEN);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT));
  const cacheKey = `${q}|${limit}`;

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    res.json({ gifs: hit.gifs });
    return;
  }

  const params = new URLSearchParams({
    key,
    limit: String(limit),
    contentfilter: "high",
    media_filter: "nanogif,tinygif",
    client_key: "gamenight",
  });
  if (q) params.set("q", q);
  const endpoint = `${TENOR_BASE}/${q ? "search" : "featured"}?${params.toString()}`;

  try {
    const upstream = await fetch(endpoint);
    if (!upstream.ok) {
      res.status(502).json({ error: "gif_search_failed" });
      return;
    }
    const data = (await upstream.json()) as { results?: unknown };
    const gifs = normalizeTenor(data.results);

    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(cacheKey, { at: Date.now(), gifs });

    res.json({ gifs });
  } catch {
    res.status(502).json({ error: "gif_search_failed" });
  }
});

export default router;
