/**
 * Captaincy ratings (design spec §5, decided 2026-10-27): wins above expectation as captain,
 * shrunk. Tenures come from `data/config/captains.csv` (year granularity, Wikipedia captain lists);
 * expectation is the team's mean pre-match Elo win probability over the tenure years, so a captain
 * is credited only for results beyond what the side's strength predicted. Names are joined to
 * Cricsheet people within the team by display name, then surname + first initial (Cricsheet's
 * initials don't always start with the name a player goes by: DPMD Jayawardene is Mahela); only
 * people in the World Cup pool matter, so unmatched tenures (Vaughan, Strauss, Cook) are reported,
 * not an error.
 *
 * Rows sourced from ESPNcricinfo (80, mostly associate stand-in captains) stay out of the ratings
 * until Yash decides on them (spec, parked table); `includeCricinfoRows` flips that. They still say
 * who led a side, so they do go in `leaders`, which only names the captain on a scorecard.
 * Tenures are whole years and overlap (Rohit's covers 2021, when Kohli led at the World Cup), so
 * `data/config/world-cup-captains.csv`, read off Wikipedia's squad pages, says who led at each.
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

/** A tenure as captain, rated or not: who led the side, not how well. */
export interface CaptainTenure {
  personId: string;
  team: string;
  firstYear: number;
  lastYear: number;
  matches: number;
  /** From `world-cup-captains.csv`: he led the side at the World Cup of that year, whatever the tenures say. */
  worldCup?: boolean;
}

export interface CaptaincyTables {
  prior: number;
  captains: CaptainRow[];
  leaders: CaptainTenure[];
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
  const empty: CaptaincyTables = { prior: PRIOR_MATCHES, captains: [], leaders: [], unmatched: [] };
  if (!existsSync(file)) return empty;
  const rows = readCsv(readFileSync(file, "utf8"));
  const namesFile = resolve(paths.labels, "display-names.csv");
  const display = new Map(existsSync(namesFile) ? readCsv(readFileSync(namesFile, "utf8")).map((r) => [r.personId ?? "", norm(r.displayName ?? "")]) : []);
  const captains: CaptainRow[] = [];
  const leaders: CaptainTenure[] = [];
  const unmatched: CaptaincyTables["unmatched"] = [];
  const findPerson = (team: string, captainName: string) => {
    const parts = norm(captainName).split(/[\s-]+/).filter(Boolean);
    const surname = parts[parts.length - 1] ?? "", initial = parts[0]?.[0] ?? "";
    const squad = people.filter((p) => p.teams.includes(team));
    const words = (p: { id: string }) => (display.get(p.id) ?? "").split(/[\s-]+/).filter(Boolean);
    const shown = squad.filter((p) => display.get(p.id) === norm(captainName));
    const outer = squad.filter((p) => words(p)[0] === parts[0] && words(p).slice(-1)[0] === surname);
    const named = shown.length ? shown : outer.length ? outer : squad.filter((p) => norm(p.name).split(/\s+/).slice(-1)[0] === surname && norm(p.name)[0] === initial);
    // A hand-made squad's copy of a player (MG Erasmus, Namibia 2012) isn't a second person.
    const real = named.filter((p) => !p.id.startsWith("hand:"));
    return real.length ? real : named;
  };
  for (const r of rows) {
    const team = r.team ?? "", captainName = r.captainName ?? "";
    const source: CaptainRow["source"] = /espncricinfo/i.test(r.sourceUrl ?? "") ? "cricinfo" : "wikipedia";
    const hits = findPerson(team, captainName);
    const person = hits.length === 1 ? hits[0]! : null;
    const firstYear = Number(r.firstYear), lastYear = Number(r.lastYear) || firstYear;
    const matches = Number(r.matches) || 0, won = Number(r.won) || 0, lost = Number(r.lost) || 0;
    if (person) leaders.push({ personId: person.id, team, firstYear, lastYear, matches });
    if (source === "cricinfo" && !opts.includeCricinfoRows) { unmatched.push({ team, captainName, reason: "excluded-source" }); continue; }
    if (!person) { unmatched.push({ team, captainName, reason: hits.length ? "ambiguous" : "no-person" }); continue; }
    const tenure = (history[team]?.history ?? []).filter((m) => { const y = Number(m.date.slice(0, 4)); return y >= firstYear && y <= lastYear; });
    const meanExpected = tenure.length ? tenure.reduce((a, m) => a + m.expected, 0) / tenure.length : 0.5;
    const expectedWins = +(meanExpected * matches).toFixed(2);
    const wae = +(won - expectedWins).toFixed(2);
    captains.push({ personId: person.id, name: person.name, captainName, team, firstYear, lastYear, matches, won, lost, expectedWins, winsAboveExpectation: wae, rating: +(wae / (matches + PRIOR_MATCHES)).toFixed(4), z: 0, source });
  }
  const namedFile = resolve(paths.config, "world-cup-captains.csv");
  for (const r of existsSync(namedFile) ? readCsv(readFileSync(namedFile, "utf8")) : []) {
    const team = r.team ?? "", captainName = r.captainName ?? "", year = Number(r.edition);
    const hits = findPerson(team, captainName);
    if (hits.length === 1) leaders.push({ personId: hits[0]!.id, team, firstYear: year, lastYear: year, matches: 0, worldCup: true });
    else unmatched.push({ team, captainName, reason: hits.length ? "ambiguous" : "no-person" });
  }
  const ratings = captains.map((c) => c.rating);
  const mean = ratings.reduce((a, b) => a + b, 0) / Math.max(1, ratings.length);
  const sd = Math.sqrt(ratings.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, ratings.length)) || 1;
  for (const c of captains) c.z = +Math.max(-2, Math.min(2, (c.rating - mean) / sd)).toFixed(3);
  captains.sort((a, b) => b.z - a.z);
  return { prior: PRIOR_MATCHES, captains, leaders, unmatched };
}
