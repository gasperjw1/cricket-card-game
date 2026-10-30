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

export type CoachTag = "Powerplay aggressor" | "Powerplay anchor" | "Wicket preserver" | "Risk taker" | "Death hitter" | "Death conservative" | "Deep batting" | "Top-heavy" | "Six-bowler rotation" | "Frontline trust" | "Bowl first" | "Bat first";

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

export function buildCoaches(style: { months: Record<string, StyleMonth>; teams: Record<string, Record<string, StyleMonth>> }): CoachTables {
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
    coaches.push({ team, coachName, role: r.role ?? "", from: r.fromDate ?? "", to: r.toDate ?? "", worldCups: (r.worldCupsCoached ?? "").split(";").map((x) => x.trim()).filter(Boolean), months, innings, indices, z: { ...indices }, tags: [], intent: { pp: 0, mid: 0, death: 0 } });
  }
  // Standardise each index across coaches (innings-weighted), tag and build the intent profile.
  const keys = Object.keys(emptyIndices) as (keyof CoachRow["indices"])[];
  const total = coaches.reduce((a, c) => a + c.innings, 0) || 1;
  const indexSd = { ...emptyIndices };
  for (const k of keys) {
    const mean = coaches.reduce((a, c) => a + c.innings * c.indices[k], 0) / total;
    const sd = Math.sqrt(coaches.reduce((a, c) => a + c.innings * (c.indices[k] - mean) ** 2, 0) / total) || 1;
    indexSd[k] = +sd.toFixed(4);
    for (const c of coaches) c.z[k] = +((c.indices[k] - mean) / sd).toFixed(3);
  }
  const clip = (x: number) => +Math.max(-1.5, Math.min(1.5, x)).toFixed(3);
  for (const c of coaches) {
    // Thin tenures (a stand-in coach, a short white-ball appointment) are shrunk toward the era.
    const shrink = c.innings / (c.innings + SHRINK_INNINGS);
    for (const k of keys) c.z[k] = +(c.z[k] * shrink).toFixed(3);
    const z = c.z;
    const tags: CoachTag[] = [];
    if (c.innings < TAG_MIN_INNINGS) {
      c.intent = { pp: clip(z.ppIntent), mid: clip(z.wicketsAt15), death: clip(z.deathIntent) };
      continue;
    }
    if (z.ppIntent >= TAG_Z) tags.push("Powerplay aggressor"); else if (z.ppIntent <= -TAG_Z) tags.push("Powerplay anchor");
    if (z.ppPreservation >= TAG_Z) tags.push("Wicket preserver"); else if (z.ppPreservation <= -TAG_Z) tags.push("Risk taker");
    if (z.deathIntent >= TAG_Z) tags.push("Death hitter"); else if (z.deathIntent <= -TAG_Z) tags.push("Death conservative");
    if (z.lowerOrderShare >= TAG_Z) tags.push("Deep batting"); else if (z.lowerOrderShare <= -TAG_Z) tags.push("Top-heavy");
    if (z.bowlersUsed >= TAG_Z) tags.push("Six-bowler rotation"); else if (z.bowlersUsed <= -TAG_Z) tags.push("Frontline trust");
    if (z.bowlFirst >= TAG_Z) tags.push("Bowl first"); else if (z.bowlFirst <= -TAG_Z) tags.push("Bat first");
    c.tags = tags;
    // Middle-overs intent: more wickets down at 15 than the era reads as risk taken through the middle.
    c.intent = { pp: clip(z.ppIntent), mid: clip(z.wicketsAt15), death: clip(z.deathIntent) };
  }
  coaches.sort((a, b) => a.team.localeCompare(b.team) || a.from.localeCompare(b.from));
  return { tagThreshold: TAG_Z, minInnings: MIN_INNINGS, indexSd, coaches, unmatched };
}
