/**
 * Coach philosophy (design spec §5.10, decided 2026-10-27): tags derived from whole-tenure team
 * style, era-relative. Tenures come from `data/config/coaches.csv` (year or date granularity,
 * Wikipedia coach lists with the World Cups each coached); style comes from `team-style.json`
 * (per team per month: powerplay run rate and wickets per over, death run rate, lower-order run
 * share, wickets at 15, bowlers used, bowl-first share) against the global month values, so a
 * 2009 coach is judged against 2009 cricket.
 *
 * Indices are tenure means of the team-minus-era deviation (innings-weighted), standardised across
 * coaches; tags fire at |z| ≥ TAG_Z. The engine reads `intent` (powerplay / middle / death) and the
 * draft client reads `tags`.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Phase } from "../cricsheet/match.js";
import { readCsv } from "../util/csv.js";
import type { CoachResidual } from "./pressure.js";
import type { CoachPlay } from "../engine/types.js";
import { paths } from "../util/io.js";

export interface StyleMonth {
  matches: number;
  innings: number;
  ppRpo: number;
  ppWicketsPerOver: number;
  deathRpo: number;
  lowerOrderRunShare: number;
  wicketsAt15: number;
  firstInningsAvg: number;
  bowlersUsed: number;
  bowlFirstPct: number | null;
}

/**
 * Every tag is something the engine plays (2026-11-03, Yash: show nothing the engine ignores):
 * powerplay and death tags through `intent`, the toss tags through `play.bowlFirst`, the bowling
 * tags through `play.rotation`, the batting-depth tags through `play.lowerOrder`. "Wicket
 * preserver" and "Risk taker" were dropped: with the players removed, a side's powerplay wicket
 * rate under a coach does not repeat from one half of his tenure to the other (split-half r −0.07,
 * `scripts/research/coach-residuals.mts`), so there was nothing of the coach's to play.
 */
export type CoachTag = "Powerplay aggressor" | "Powerplay anchor" | "Death hitter" | "Death conservative" | "Deep batting" | "Top-heavy" | "Six-bowler rotation" | "Frontline trust" | "Bowl first" | "Bat first";

export type { CoachPlay };

export interface CoachRow {
  team: string;
  coachName: string;
  role: string;
  from: string;
  to: string;
  worldCups: string[];
  /** Team-months and innings inside the tenure that had style data. */
  months: number;
  innings: number;
  /** Era-relative indices (team ÷ era − 1, or difference for shares), tenure means. */
  indices: { ppIntent: number; ppPreservation: number; deathIntent: number; lowerOrderShare: number; wicketsAt15: number; bowlersUsed: number; bowlFirst: number };
  z: CoachRow["indices"];
  tags: CoachTag[];
  /** Engine intent profile per phase, in SD units clipped to ±1.5 (0 = era average). */
  intent: Record<Phase, number>;
  play: CoachPlay;
}

export interface CoachTables {
  tagThreshold: number;
  minInnings: number;
  /** Innings-weighted SD across coaches of each era-relative index (what one unit of `z` means in real terms). */
  indexSd: CoachRow["indices"];
  coaches: CoachRow[];
  unmatched: { team: string; coachName: string; reason: "no-style-data" }[];
}

const TAG_Z = 0.6;
/**
 * Lower-order effect: observed over expected runs for No. 6 down with the players removed, shrunk
 * twice, by how well it repeats (split-half r 0.27 over 67 tenures, so a whole tenure's reliability
 * is 2r/(1+r) ≈ 0.43) and by its size (a prior of 300 expected runs).
 */
const LOWER_RELIABILITY = 0.43;
const LOWER_PRIOR_RUNS = 300;
/** Coaches with fewer innings than this get no profile; between this and TAG_MIN_INNINGS the intent is shrunk and no tags fire. */
const MIN_INNINGS = 8;
const TAG_MIN_INNINGS = 20;
const SHRINK_INNINGS = 20;

function monthRange(from: string, to: string): string[] {
  const start = from.length >= 7 ? from.slice(0, 7) : `${from.slice(0, 4)}-01`;
  const endRaw = to.trim() ? to : "2026-12";
  const end = endRaw.length >= 7 ? endRaw.slice(0, 7) : `${endRaw.slice(0, 4)}-12`;
  const out: string[] = [];
  let [y, m] = start.split("-").map(Number) as [number, number];
  const [ey, em] = end.split("-").map(Number) as [number, number];
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export function buildCoaches(
  style: { months: Record<string, StyleMonth>; teams: Record<string, Record<string, StyleMonth>> },
  residualsFor?: (tenureOf: (team: string, month: string) => string | null) => Map<string, CoachResidual[]>,
): CoachTables {
  const file = resolve(paths.config, "coaches.csv");
  const emptyIndices = { ppIntent: 0, ppPreservation: 0, deathIntent: 0, lowerOrderShare: 0, wicketsAt15: 0, bowlersUsed: 0, bowlFirst: 0 };
  const empty: CoachTables = { tagThreshold: TAG_Z, minInnings: MIN_INNINGS, indexSd: { ...emptyIndices }, coaches: [], unmatched: [] };
  if (!existsSync(file)) return empty;

  const rows = readCsv(readFileSync(file, "utf8"));
  const coaches: CoachRow[] = [];
  const unmatched: CoachTables["unmatched"] = [];
  for (const r of rows) {
    const team = r.team ?? "", coachName = r.coachName ?? "";
    const teamMonths = style.teams[team] ?? {};
    const acc = { ppIntent: 0, ppPreservation: 0, deathIntent: 0, lowerOrderShare: 0, wicketsAt15: 0, bowlersUsed: 0, bowlFirst: 0 };
    let innings = 0, months = 0;
    for (const month of monthRange(r.fromDate ?? "", r.toDate ?? "")) {
      const s = teamMonths[month], era = style.months[month];
      if (!s || !era || s.innings <= 0 || era.ppRpo <= 0) continue;
      const w = s.innings;
      months += 1; innings += w;
      acc.ppIntent += w * (s.ppRpo / era.ppRpo - 1);
      acc.ppPreservation += w * -(era.ppWicketsPerOver > 0 ? s.ppWicketsPerOver / era.ppWicketsPerOver - 1 : 0);
      acc.deathIntent += w * (s.deathRpo > 0 && era.deathRpo > 0 ? s.deathRpo / era.deathRpo - 1 : 0);
      acc.lowerOrderShare += w * (s.lowerOrderRunShare - era.lowerOrderRunShare);
      acc.wicketsAt15 += w * (era.wicketsAt15 > 0 ? s.wicketsAt15 / era.wicketsAt15 - 1 : 0);
      acc.bowlersUsed += w * (s.bowlersUsed - era.bowlersUsed);
      acc.bowlFirst += w * (((s.bowlFirstPct ?? era.bowlFirstPct ?? 0) - (era.bowlFirstPct ?? 0)) / 100);
    }
    if (innings < MIN_INNINGS) { unmatched.push({ team, coachName, reason: "no-style-data" }); continue; }
    const indices = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, +(v / innings).toFixed(4)])) as CoachRow["indices"];
    coaches.push({ team, coachName, role: r.role ?? "", from: r.fromDate ?? "", to: r.toDate ?? "", worldCups: (r.worldCupsCoached ?? "").split(";").map((x) => x.trim()).filter(Boolean), months, innings, indices, z: { ...indices }, tags: [], intent: { pp: 0, mid: 0, death: 0 }, play: { bowlFirst: 0, rotation: 0, lowerOrder: 0 } });
  }
  // The lower-order residual per tenure (players removed), keyed as the coaches are; a head coach
  // wins a month he shares with an interim.
  const key = (c: { team: string; coachName: string; from: string }) => `${c.team}|${c.coachName}|${c.from}`;
  const ranges = [...coaches].sort((a, b) => Number(a.role === "interim") - Number(b.role === "interim")).map((c) => ({ c, range: [monthRange(c.from, c.to)[0]!, monthRange(c.from, c.to).at(-1)!] as const }));
  const residuals = residualsFor?.((team, month) => {
    const hit = ranges.find((x) => x.c.team === team && x.range[0] <= month && month <= x.range[1]);
    return hit ? key(hit.c) : null;
  });
  const lowerOf = (c: CoachRow) => {
    const halves = residuals?.get(key(c));
    if (!halves) return 0;
    const obs = halves.reduce((a, h) => a + h.lower.runs[0], 0), exp = halves.reduce((a, h) => a + h.lower.runs[1], 0);
    return LOWER_RELIABILITY * (obs - exp) / (exp + LOWER_PRIOR_RUNS);
  };
  // Standardise each index across coaches (innings-weighted), tag and build the intent profile.
  const keys = Object.keys(emptyIndices) as (keyof CoachRow["indices"])[];
  const total = coaches.reduce((a, c) => a + c.innings, 0) || 1;
  const indexSd = { ...emptyIndices };
  const indexMean = { ...emptyIndices };
  for (const k of keys) {
    const mean = coaches.reduce((a, c) => a + c.innings * c.indices[k], 0) / total;
    indexMean[k] = mean;
    const sd = Math.sqrt(coaches.reduce((a, c) => a + c.innings * (c.indices[k] - mean) ** 2, 0) / total) || 1;
    indexSd[k] = +sd.toFixed(4);
    for (const c of coaches) c.z[k] = +((c.indices[k] - mean) / sd).toFixed(3);
  }
  const clip = (x: number) => +Math.max(-1.5, Math.min(1.5, x)).toFixed(3);
  // The lower-order effect standardised across coaches, for its tags.
  const lower = new Map(coaches.map((c) => [c, lowerOf(c)]));
  const lowerMean = coaches.reduce((a, c) => a + c.innings * lower.get(c)!, 0) / total;
  const lowerSd = Math.sqrt(coaches.reduce((a, c) => a + c.innings * (lower.get(c)! - lowerMean) ** 2, 0) / total) || 1;
  for (const c of coaches) {
    // Thin tenures (a stand-in coach, a short white-ball appointment) are shrunk toward the era.
    const shrink = c.innings / (c.innings + SHRINK_INNINGS);
    for (const k of keys) c.z[k] = +(c.z[k] * shrink).toFixed(3);
    const z = c.z;
    // Against the average coach, as the tags are: the era yardstick includes associate and league
    // sides, which use more bowlers than national sides, so raw indices put nearly every coach below
    // it and would have moved the whole field off the usage the allocation was calibrated to.
    c.play = {
      bowlFirst: +((c.indices.bowlFirst - indexMean.bowlFirst) * shrink).toFixed(4),
      rotation: +((c.indices.bowlersUsed - indexMean.bowlersUsed) * shrink).toFixed(3),
      lowerOrder: +(lower.get(c)! - lowerMean).toFixed(4),
    };
    const lowerZ = (lower.get(c)! - lowerMean) / lowerSd;
    const tags: CoachTag[] = [];
    if (c.innings < TAG_MIN_INNINGS) {
      c.intent = { pp: clip(z.ppIntent), mid: clip(z.wicketsAt15), death: clip(z.deathIntent) };
      continue;
    }
    if (z.ppIntent >= TAG_Z) tags.push("Powerplay aggressor"); else if (z.ppIntent <= -TAG_Z) tags.push("Powerplay anchor");
    if (z.deathIntent >= TAG_Z) tags.push("Death hitter"); else if (z.deathIntent <= -TAG_Z) tags.push("Death conservative");
    // From the lower order's own scoring with the players removed, not its share of the runs (that
    // share is mostly who bats there: r 0.18 with the coach's residual).
    if (residuals && lowerZ >= TAG_Z) tags.push("Deep batting"); else if (residuals && lowerZ <= -TAG_Z) tags.push("Top-heavy");
    if (z.bowlersUsed >= TAG_Z) tags.push("Six-bowler rotation"); else if (z.bowlersUsed <= -TAG_Z) tags.push("Frontline trust");
    if (z.bowlFirst >= TAG_Z) tags.push("Bowl first"); else if (z.bowlFirst <= -TAG_Z) tags.push("Bat first");
    c.tags = tags;
    // Middle-overs intent: more wickets down at 15 than the era reads as risk taken through the middle.
    c.intent = { pp: clip(z.ppIntent), mid: clip(z.wicketsAt15), death: clip(z.deathIntent) };
  }
  coaches.sort((a, b) => a.team.localeCompare(b.team) || a.from.localeCompare(b.from));
  return { tagThreshold: TAG_Z, minInnings: MIN_INNINGS, indexSd, coaches, unmatched };
}
