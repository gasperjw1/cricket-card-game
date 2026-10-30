/**
 * Cricsheet archive access: download, extract, index and stream the men's T20I and ODI zips.
 *
 * Memory model: each archive is extracted once to `.cache/` and matches are read one file at a
 * time. Nothing holds more than one full match in memory; an index keeps only a few hundred
 * bytes per match.
 */

import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { paths, readJson } from "../util/io.js";
import type { RawMatch } from "./types.js";

export interface ArchiveSpec {
  key: string;
  name: string;
  url: string;
  /** Domestic T20 leagues are optional: a missing or renamed zip is skipped, never fatal. */
  optional?: boolean;
}

export const ARCHIVES: Record<"t20" | "odi", ArchiveSpec> = {
  t20: { key: "t20", name: "t20s_male_json", url: "https://cricsheet.org/downloads/t20s_male_json.zip" },
  /** Men's ODIs: the weak prior for 2007/2009 ratings and the ODI captaincy/strength timelines. */
  odi: { key: "odi", name: "odis_male_json", url: "https://cricsheet.org/downloads/odis_male_json.zip" },
};

/**
 * Men's domestic and franchise T20 leagues on Cricsheet (same person ids as the internationals).
 * Used as backup evidence for skills a player rarely shows in T20Is (a bowler's batting, a
 * batter's bowling), decided 2026-10-30.
 */
export const LEAGUE_ARCHIVES: ArchiveSpec[] = [
  ["ipl", "Indian Premier League"], ["bbl", "Big Bash League"], ["psl", "Pakistan Super League"], ["cpl", "Caribbean Premier League"],
  ["ntb", "T20 Blast"], ["sat", "SA20"], ["ilt", "International League T20"], ["mlc", "Major League Cricket"], ["lpl", "Lanka Premier League"],
  ["bpl", "Bangladesh Premier League"], ["ssm", "Super Smash"], ["sma", "Syed Mushtaq Ali Trophy"], ["msl", "Mzansi Super League"], ["apl", "Afghanistan Premier League"],
].map(([code]) => ({ key: code!, name: `${code}_male_json`, url: `https://cricsheet.org/downloads/${code}_male_json.zip`, optional: true }));

export const ARCHIVE = {
  ...ARCHIVES.t20,
  licence: "Open Data Commons Attribution License v1.0 (ODC-By) — https://cricsheet.org/licensing/",
} as const;

const zipPath = (a: ArchiveSpec) => resolve(paths.cache, `${a.name}.zip`);
const extractDir = (a: ArchiveSpec) => resolve(paths.cache, a.name);
const snapshotPath = (a: ArchiveSpec) => resolve(paths.cache, `${a.name}.snapshot.json`);
const indexPath = (a: ArchiveSpec) => resolve(paths.cache, `${a.name}.index.json`);

export interface ArchiveSnapshot {
  url: string;
  downloadedAt: string;
  zipBytes: number;
  fileCount: number;
}

/** Download (unless cached) and extract an archive. Returns the snapshot record. */
export async function fetchArchive(opts: { force?: boolean; archive?: ArchiveSpec } = {}): Promise<ArchiveSnapshot> {
  const a = opts.archive ?? ARCHIVES.t20;
  mkdirSync(paths.cache, { recursive: true });

  if (opts.force || !existsSync(zipPath(a))) {
    process.stdout.write(`Downloading ${a.url} … `);
    const res = await fetch(a.url);
    if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(zipPath(a)));
    process.stdout.write(`${(statSync(zipPath(a)).size / 1e6).toFixed(1)} MB\n`);
  } else {
    console.log(`Using cached zip ${zipPath(a)}`);
  }

  // Re-extract when forced or when the extracted set is incomplete (e.g. an interrupted run).
  const expected = zipEntryCount(a);
  if (opts.force || listMatchFiles(a).length !== expected) {
    console.log(`Extracting ${expected} files to ${extractDir(a)} …`);
    rmSync(extractDir(a), { recursive: true, force: true });
    mkdirSync(extractDir(a), { recursive: true });
    // System unzip keeps us dependency-free; files are written straight to disk.
    execFileSync("unzip", ["-q", "-o", zipPath(a), "-d", extractDir(a)], { stdio: "inherit" });
    if (listMatchFiles(a).length !== expected) throw new Error(`Extraction incomplete: ${listMatchFiles(a).length}/${expected} files`);
  }

  const snapshot: ArchiveSnapshot = {
    url: a.url,
    downloadedAt: new Date(statSync(zipPath(a)).mtimeMs).toISOString(),
    zipBytes: statSync(zipPath(a)).size,
    fileCount: listMatchFiles(a).length,
  };
  writeFileSync(snapshotPath(a), JSON.stringify(snapshot, null, 2));
  return snapshot;
}

/** Number of match JSON entries inside the zip, from `unzip -Z1`. */
function zipEntryCount(a: ArchiveSpec): number {
  const listing = execFileSync("unzip", ["-Z1", zipPath(a)], { encoding: "utf8" });
  return listing.split("\n").filter((f) => f.endsWith(".json")).length;
}

export function archiveIsReady(a: ArchiveSpec = ARCHIVES.t20): boolean {
  return existsSync(extractDir(a)) && existsSync(snapshotPath(a));
}

export function readSnapshot(a: ArchiveSpec = ARCHIVES.t20): ArchiveSnapshot {
  if (!archiveIsReady(a)) throw new Error(`Archive ${a.name} not fetched. Run \`npm run data:fetch\` first.`);
  return readJson<ArchiveSnapshot>(snapshotPath(a));
}

/** Sorted absolute paths of every match JSON in the extracted archive. */
export function listMatchFiles(a: ArchiveSpec = ARCHIVES.t20): string[] {
  if (!existsSync(extractDir(a))) return [];
  return readdirSync(extractDir(a))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => resolve(extractDir(a), f));
}

export function readMatch(file: string): RawMatch {
  return JSON.parse(readFileSync(file, "utf8")) as RawMatch;
}

/** Match-level facts kept in memory for the whole archive (no deliveries). */
export interface MatchIndexEntry {
  id: string;
  file: string;
  date: string;
  season: string;
  eventName: string | null;
  stage: string | null;
  group: string | null;
  teams: [string, string];
  venue: string | null;
  city: string | null;
  /** team → player names (as listed in `info.players`) */
  players: Record<string, string[]>;
  /** name → Cricsheet person id */
  registry: Record<string, string>;
  tossWinner: string;
  tossDecision: "bat" | "field";
  winner: string | null;
  result: string | null;
  method: string | null;
  gender: string;
}

/**
 * Build (or load the cached) index of every match in an archive, sorted by date then id.
 * The index is cached beside the archive and invalidated when the file count changes.
 */
export function loadIndex(a: ArchiveSpec = ARCHIVES.t20): MatchIndexEntry[] {
  const snapshot = readSnapshot(a);
  if (existsSync(indexPath(a))) {
    const cached = readJson<{ fileCount: number; entries: MatchIndexEntry[] }>(indexPath(a));
    if (cached.fileCount === snapshot.fileCount) return cached.entries;
  }
  const entries: MatchIndexEntry[] = [];
  for (const file of listMatchFiles(a)) {
    const { info } = readMatch(file);
    const id = file.replace(/^.*\//, "").replace(/\.json$/, "");
    entries.push({
      id,
      file,
      date: info.dates[0] ?? "",
      season: String(info.season),
      eventName: info.event?.name ?? null,
      stage: info.event?.stage ?? null,
      group: info.event?.group === undefined ? null : String(info.event.group),
      teams: [info.teams[0] ?? "", info.teams[1] ?? ""],
      venue: info.venue ?? null,
      city: info.city ?? null,
      players: info.players,
      registry: info.registry.people,
      tossWinner: info.toss.winner,
      tossDecision: info.toss.decision,
      winner: info.outcome.winner ?? null,
      result: info.outcome.result ?? null,
      method: info.outcome.method ?? null,
      gender: info.gender,
    });
  }
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)));
  writeFileSync(indexPath(a), JSON.stringify({ fileCount: snapshot.fileCount, entries }));
  return entries;
}
