/**
 * Captaincy ratings (design spec §5, decided 2026-10-27): wins above expectation as captain,
 * shrunk. Tenures come from `data/config/captains.csv` (year granularity, Wikipedia captain lists);
 * expectation is the team's mean pre-match Elo win probability over the tenure years, so a captain
 * is credited only for results beyond what the side's strength predicted. Names are joined to
 * Cricsheet people by surname + first initial within the team; only people in the World Cup pool
 * matter, so unmatched tenures (Vaughan, Strauss, Cook) are reported, not an error.
 *
 * Rows sourced from ESPNcricinfo (80, mostly associate stand-in captains) are excluded until Yash
 * decides on them (spec, parked table); `includeCricinfoRows` flips that.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readCsv } from "../util/csv.js";
import { paths } from "../util/io.js";

export interface CaptainRow {
  personId: string;
  name: string;
  captainName: string;
  team: string;
  firstYear: number;
  lastYear: number;
  matches: number;
  won: number;
  lost: number;
  /** Mean Elo win expectation of the team over the tenure years, times matches. */
  expectedWins: number;
  winsAboveExpectation: number;
  /** Shrunk per-match edge: WAE ÷ (matches + prior), in win-probability units. */
  rating: number;
  /** Standardised across matched captains (mean 0, SD 1), clipped ±2. */
  z: number;
  source: "wikipedia" | "cricinfo";
}

export interface CaptaincyTables {
  prior: number;
  captains: CaptainRow[];
  unmatched: { team: string; captainName: string; reason: "no-person" | "ambiguous" | "excluded-source" }[];
}

const PRIOR_MATCHES = 20;

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function buildCaptaincy(
  people: { id: string; name: string; teams: string[] }[],
  history: Record<string, { history: { date: string; expected: number }[] }>,
  opts: { includeCricinfoRows?: boolean } = {},
): CaptaincyTables {
  const file = resolve(paths.config, "captains.csv");
  const empty: CaptaincyTables = { prior: PRIOR_MATCHES, captains: [], unmatched: [] };
  if (!existsSync(file)) return empty;
  const rows = readCsv(readFileSync(file, "utf8"));
  const captains: CaptainRow[] = [];
  const unmatched: CaptaincyTables["unmatched"] = [];
  for (const r of rows) {
    const team = r.team ?? "", captainName = r.captainName ?? "";
    const source: CaptainRow["source"] = /espncricinfo/i.test(r.sourceUrl ?? "") ? "cricinfo" : "wikipedia";
    if (source === "cricinfo" && !opts.includeCricinfoRows) { unmatched.push({ team, captainName, reason: "excluded-source" }); continue; }
    const parts = norm(captainName).split(/[\s-]+/).filter(Boolean);
    const surname = parts[parts.length - 1] ?? "", initial = parts[0]?.[0] ?? "";
    const hits = people.filter((p) => p.teams.includes(team) && norm(p.name).split(/\s+/).slice(-1)[0] === surname && norm(p.name)[0] === initial);
    if (hits.length !== 1) { unmatched.push({ team, captainName, reason: hits.length ? "ambiguous" : "no-person" }); continue; }
    const person = hits[0]!;
    const firstYear = Number(r.firstYear), lastYear = Number(r.lastYear) || firstYear;
    const matches = Number(r.matches) || 0, won = Number(r.won) || 0, lost = Number(r.lost) || 0;
    const tenure = (history[team]?.history ?? []).filter((m) => { const y = Number(m.date.slice(0, 4)); return y >= firstYear && y <= lastYear; });
    const meanExpected = tenure.length ? tenure.reduce((a, m) => a + m.expected, 0) / tenure.length : 0.5;
    const expectedWins = +(meanExpected * matches).toFixed(2);
    const wae = +(won - expectedWins).toFixed(2);
    captains.push({ personId: person.id, name: person.name, captainName, team, firstYear, lastYear, matches, won, lost, expectedWins, winsAboveExpectation: wae, rating: +(wae / (matches + PRIOR_MATCHES)).toFixed(4), z: 0, source });
  }
  const ratings = captains.map((c) => c.rating);
  const mean = ratings.reduce((a, b) => a + b, 0) / Math.max(1, ratings.length);
  const sd = Math.sqrt(ratings.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, ratings.length)) || 1;
  for (const c of captains) c.z = +Math.max(-2, Math.min(2, (c.rating - mean) / sd)).toFixed(3);
  captains.sort((a, b) => b.z - a.z);
  return { prior: PRIOR_MATCHES, captains, unmatched };
}
