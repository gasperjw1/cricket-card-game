/**
 * Player biography supplement: the `player_meta` snapshot bundled with Rob Hyndman's
 * `cricketdata` R package (GPL-3). It holds ESPNcricinfo profile facts (batting style, bowling
 * style, date of birth, playing role) for every player who appears on both Cricsheet and
 * Cricinfo as at 24 March 2025, keyed by Cricsheet person id, so it joins to our people with
 * no name matching. The Cricsheet people register (ODC-By) is fetched alongside it for the
 * cricinfo-id fallback.
 *
 * We never scrape Cricinfo ourselves; this is a one-off data file pinned to a commit.
 */

import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { paths } from "../util/io.js";
import { readRdaDataFrame } from "./rda.js";

export const SUPPLEMENTS = {
  playerMeta: {
    file: resolve(paths.cache, "player_meta.rda"),
    // Pinned to the commit current on 2026-10-28; bump deliberately.
    url: "https://raw.githubusercontent.com/robjhyndman/cricketdata/c87fb8cfcd4b1a39f5f5d53e0f549014debff082/data/player_meta.rda",
    licence: "cricketdata R package, GPL-3 (Hyndman et al.); content: ESPNcricinfo profile facts as at 24 March 2025",
  },
  people: {
    file: resolve(paths.cache, "people.csv"),
    url: "https://cricsheet.org/register/people.csv",
    licence: "Cricsheet people register, ODC-By 1.0",
  },
} as const;

export interface PlayerMeta {
  cricinfoId: string;
  cricsheetId: string | null;
  fullName: string | null;
  country: string | null;
  dob: string | null;
  battingStyle: string | null;
  bowlingStyle: string | null;
  playingRole: string | null;
}

export async function fetchSupplements(opts: { force?: boolean } = {}): Promise<void> {
  mkdirSync(paths.cache, { recursive: true });
  for (const s of Object.values(SUPPLEMENTS)) {
    if (!opts.force && existsSync(s.file)) continue;
    process.stdout.write(`Downloading ${s.url} … `);
    const res = await fetch(s.url);
    if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status} for ${s.url}`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(s.file));
    process.stdout.write("done\n");
  }
}

export function supplementsReady(): boolean {
  return Object.values(SUPPLEMENTS).every((s) => existsSync(s.file));
}

/** Parse the snapshot; returns lookups by Cricsheet id and by Cricinfo id. */
export function loadPlayerMeta(): { byCricsheetId: Map<string, PlayerMeta>; byCricinfoId: Map<string, PlayerMeta>; rows: number } {
  const { frame } = readRdaDataFrame(SUPPLEMENTS.playerMeta.file);
  const byCricsheetId = new Map<string, PlayerMeta>();
  const byCricinfoId = new Map<string, PlayerMeta>();
  const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v).trim() || null);
  for (const r of frame.rows) {
    const m: PlayerMeta = {
      cricinfoId: str(r["cricinfo_id"]) ?? "",
      cricsheetId: str(r["cricsheet_id"]),
      fullName: str(r["full_name"]),
      country: str(r["country"]),
      dob: str(r["dob"]),
      battingStyle: str(r["batting_style"]),
      bowlingStyle: str(r["bowling_style"]),
      playingRole: str(r["playing_role"]),
    };
    if (m.cricsheetId && !byCricsheetId.has(m.cricsheetId)) byCricsheetId.set(m.cricsheetId, m);
    if (m.cricinfoId && !byCricinfoId.has(m.cricinfoId)) byCricinfoId.set(m.cricinfoId, m);
  }
  return { byCricsheetId, byCricinfoId, rows: frame.rows.length };
}

/** Cricsheet person id → Cricinfo key(s) from the people register. */
export function loadPeopleRegister(): Map<string, string[]> {
  const text = readFileSync(SUPPLEMENTS.people.file, "utf8");
  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const cols = (header ?? "").split(",");
  const idCol = cols.indexOf("identifier");
  const keyCols = cols.map((c, i) => (c.startsWith("key_cricinfo") ? i : -1)).filter((i) => i >= 0);
  const out = new Map<string, string[]>();
  for (const line of lines) {
    const cells = line.split(",");
    const id = cells[idCol];
    if (!id) continue;
    const keys = keyCols.map((i) => cells[i] ?? "").filter(Boolean);
    if (keys.length) out.set(id, keys);
  }
  return out;
}

/** "Right hand Bat" / "Left-hand bat" → R / L. */
export function normaliseBattingStyle(raw: string | null): "R" | "L" | "" {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("left")) return "L";
  if (s.includes("right")) return "R";
  return "";
}

/**
 * Cricinfo bowling-style text → our codes. Cricinfo spelling varies by profile era
 * ("Right arm Fast medium", "Right-arm fast-medium"), so match on normalised tokens.
 * Combined styles ("Right arm Offbreak, Legbreak Googly") take the first style listed.
 */
export function normaliseBowlingStyle(raw: string | null): string {
  if (!raw) return "";
  const first = raw.split(",")[0] ?? raw;
  const s = first.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  const left = s.includes("left");
  if (s.includes("wrist") || s.includes("chinaman")) return left ? "SLW" : "LB";
  if (s.includes("orthodox")) return "SLA";
  if (/\blegbreak\b|\bleg break\b|\bgoogly\b|\bleg spin\b|\blegspin\b/.test(s)) return "LB";
  if (/\boffbreak\b|\boff break\b|\boff spin\b|\boffspin\b/.test(s)) return "OB";
  if (left && /\bslow\b/.test(s)) return "SLA";
  const fastMedium = /fast medium|medium fast/.test(s);
  const fast = /\bfast\b/.test(s);
  const medium = /\bmedium\b|\bslow medium\b|\bslow\b/.test(s);
  if (fastMedium) return left ? "LFM" : "RFM";
  if (fast) return left ? "LF" : "RF";
  if (medium) return left ? "LM" : "RM";
  return "";
}

export function isKeeperRole(playingRole: string | null): boolean {
  return /wicket\s*keeper/i.test(playingRole ?? "");
}
