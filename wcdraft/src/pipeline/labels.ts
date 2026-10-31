/**
 * Hand-labelling sheet: one row per World Cup player for handedness, bowling type, keeper
 * editions and date of birth.
 *
 * Fill order (first non-empty wins):
 *   1. hand-entered values (rows whose `source` is "hand" or that carry notes) — never overwritten
 *   2. the cricketdata player_meta snapshot, joined by Cricsheet id (source "cricinfo-snapshot")
 *   3. reviewed lookups in data/labels/hand-entries*.csv, matched by name + team (source "hand-entry")
 *   4. hand-made stand-in squads in data/config/hand-squads.json (source "hand-squad")
 *   5. keepers inferred from stumpings (source "inferred")
 * The card-game roster is deliberately not used here: name matching produced false positives and
 * the snapshot covers 891 of 903 players. Card↔person mapping will be its own reviewed file.
 *
 * Vocabulary
 *   handedness      R | L                     (batting hand)
 *   bowlingType     RF | RFM | RM | LF | LFM | LM | OB | LB | SLA | SLW | none
 *                   (right/left arm fast, fast-medium, medium; off-break; leg-break;
 *                    slow left-arm orthodox; slow left-arm wrist)
 *   keeper          Y = keeper-eligible in EVERY edition (rule: anyone who has ever kept is a keeper,
 *                   decided 2026-10-28). Derived as any of the three evidence columns below; override by hand.
 *   keeperEditions  evidence: editions with a stumping in the tournament or form window, e.g. "2014;2016"
 *   keeperCareer    evidence: Cricinfo lists the playing role as wicketkeeper
 *   keeperAnyT20I   evidence: stumpings credited anywhere in the men's T20I archive, any date
 *   dob             ISO date
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../config.js";
import { isKeeperRole, loadPeopleRegister, loadPlayerMeta, normaliseBattingStyle, normaliseBowlingStyle, supplementsReady, type PlayerMeta } from "../cricinfo/player-meta.js";
import { paths, writeText } from "../util/io.js";
import type { BuildResult } from "./build.js";

export const LABEL_COLUMNS = [
  "personId", "name", "teams", "editions", "handedness", "bowlingType", "keeper", "keeperEditions", "keeperCareer", "keeperAnyT20I", "dob", "cricinfoId", "source", "notes",
] as const;
type LabelRow = Record<(typeof LABEL_COLUMNS)[number], string>;

const LABELS_PATH = resolve(paths.labels, "players.csv");
const META_SUBSET_PATH = resolve(paths.labels, "sources", "player-meta.csv");

export interface LabelsReport {
  rows: number;
  preservedHand: number;
  fromSnapshot: number;
  unmatched: number;
  unmappedBowlingStyles: Record<string, number>;
  filled: { handedness: number; bowlingType: number; keeper: number; keeperEditions: number; keeperCareer: number; keeperAnyT20I: number; dob: number };
}

interface Lookup {
  handedness: string;
  bowlingType: string;
  keeper: string;
  dob: string;
  notes: string;
  source: string;
}

/** Reviewed lookups (hand-entries*.csv, keyed by name|team) and hand-squad players (keyed by synthetic id). */
function loadLookups(): { byNameTeam: Map<string, Lookup>; byId: Map<string, Lookup> } {
  const byNameTeam = new Map<string, Lookup>();
  const byId = new Map<string, Lookup>();
  if (existsSync(paths.labels)) {
    for (const file of readdirSync(paths.labels).filter((f) => /^hand-entries.*\.csv$/.test(f))) {
      const [header, ...lines] = readFileSync(resolve(paths.labels, file), "utf8").split(/\r?\n/).filter(Boolean);
      const cols = parseCsvLine(header ?? "");
      for (const line of lines) {
        const cells = parseCsvLine(line);
        const row = Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
        if (!row["name"]) continue;
        byNameTeam.set(`${row["name"]}|${row["team"]}`, {
          handedness: row["handedness"] ?? "", bowlingType: row["bowlingType"] ?? "", keeper: row["keeper"] ?? "", dob: row["dob"] ?? "",
          notes: [row["notes"], row["sourceUrl"]].filter(Boolean).join(" | "), source: `hand-entry:${file}`,
        });
      }
    }
  }
  for (const squad of loadConfig().handSquads) {
    for (const p of squad.players) {
      const id = `hand:${squad.editionId}:${(p.shortName ?? p.name).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
      byId.set(id, { handedness: p.handedness ?? "", bowlingType: p.bowlingType ?? "", keeper: p.keeper ?? "", dob: p.dob ?? "", notes: [p.notes, p.sourceUrl].filter(Boolean).join(" | "), source: "hand-squad" });
    }
  }
  return { byNameTeam, byId };
}

export function writeLabels(result: BuildResult): LabelsReport {
  const existing = readExisting();
  const lookups = loadLookups();
  const meta = supplementsReady() ? joinSnapshot(result) : new Map<string, PlayerMeta>();
  const keepers = new Map<string, Set<string>>();
  // keeperEditions = stumpings in that edition's tournament or form window only; the all-time
  // signal goes in its own column so "has kept ever" never masquerades as "kept in this edition".
  for (const s of result.squads) for (const k of s.inferredKeepers) if (k.stumpings > 0) (keepers.get(k.id) ?? keepers.set(k.id, new Set()).get(k.id)!).add(s.editionId);

  const report: LabelsReport = {
    rows: 0, preservedHand: 0, fromSnapshot: 0, unmatched: 0, unmappedBowlingStyles: {},
    filled: { handedness: 0, bowlingType: 0, keeper: 0, keeperEditions: 0, keeperCareer: 0, keeperAnyT20I: 0, dob: 0 },
  };

  const rows: LabelRow[] = result.people.map((p) => {
    const prevRaw = existing.get(p.id);
    const prev = prevRaw && prevRaw.source === "hand" ? prevRaw : undefined;
    const m = meta.get(p.id);
    const lookup = lookups.byId.get(p.id) ?? p.teams.map((t) => lookups.byNameTeam.get(`${p.name}|${t}`)).find(Boolean);
    const inferredKeeper = [...(keepers.get(p.id) ?? [])].sort().join(";");

    let bowlingType = "";
    if (m) {
      bowlingType = normaliseBowlingStyle(m.bowlingStyle);
      if (m.bowlingStyle && !bowlingType) report.unmappedBowlingStyles[m.bowlingStyle] = (report.unmappedBowlingStyles[m.bowlingStyle] ?? 0) + 1;
    }

    if (prev) report.preservedHand += 1;
    else if (m) report.fromSnapshot += 1;
    else if (!lookup) report.unmatched += 1;

    const keeperEditions = prev?.keeperEditions || inferredKeeper;
    const keeperCareer = prev?.keeperCareer || (m && isKeeperRole(m.playingRole) ? "Y" : "") || lookup?.keeper || "";
    const keeperAnyT20I = p.stumpingsAllT20I > 0 ? String(p.stumpingsAllT20I) : "";
    const row: LabelRow = {
      personId: p.id,
      name: p.name,
      teams: p.teams.join(";"),
      editions: Object.keys(p.editions).sort().join(";"),
      handedness: prev?.handedness || (m ? normaliseBattingStyle(m.battingStyle) : "") || lookup?.handedness || "",
      bowlingType: prev?.bowlingType || bowlingType || lookup?.bowlingType || "",
      keeper: prev?.keeper || (keeperEditions || keeperCareer || keeperAnyT20I ? "Y" : ""),
      keeperEditions,
      keeperCareer,
      keeperAnyT20I,
      dob: prev?.dob || m?.dob || lookup?.dob || "",
      cricinfoId: prev?.cricinfoId || m?.cricinfoId || "",
      source: prev?.source || (m ? "cricinfo-snapshot" : lookup ? lookup.source : inferredKeeper ? "inferred" : ""),
      notes: prev?.notes || (m ? "" : lookup?.notes ?? ""),
    };
    for (const k of Object.keys(report.filled) as (keyof LabelsReport["filled"])[]) if (row[k]) report.filled[k] += 1;
    return row;
  });

  report.rows = rows.length;
  writeText(LABELS_PATH, toCsv(LABEL_COLUMNS, rows));

  // Keep the raw snapshot values for our players beside the sheet, so any normalisation can be audited.
  const subsetCols = ["personId", "name", "cricinfoId", "fullName", "country", "dob", "battingStyle", "bowlingStyle", "playingRole"] as const;
  const subset = result.people
    .filter((p) => meta.has(p.id))
    .map((p) => {
      const m = meta.get(p.id)!;
      return { personId: p.id, name: p.name, cricinfoId: m.cricinfoId, fullName: m.fullName ?? "", country: m.country ?? "", dob: m.dob ?? "", battingStyle: m.battingStyle ?? "", bowlingStyle: m.bowlingStyle ?? "", playingRole: m.playingRole ?? "" };
    });
  writeText(META_SUBSET_PATH, toCsv(subsetCols, subset));
  return report;
}

/** Snapshot rows for our people: direct Cricsheet-id join, then Cricinfo-id fallback via the people register. */
function joinSnapshot(result: BuildResult): Map<string, PlayerMeta> {
  const { byCricsheetId, byCricinfoId } = loadPlayerMeta();
  const register = loadPeopleRegister();
  const out = new Map<string, PlayerMeta>();
  for (const p of result.people) {
    const direct = byCricsheetId.get(p.id);
    if (direct) {
      out.set(p.id, direct);
      continue;
    }
    for (const key of register.get(p.id) ?? []) {
      const viaKey = byCricinfoId.get(key);
      if (viaKey) {
        out.set(p.id, viaKey);
        break;
      }
    }
  }
  return out;
}

export function readLabels(): Map<string, LabelRow> {
  return readExisting();
}

function readExisting(): Map<string, LabelRow> {
  const out = new Map<string, LabelRow>();
  if (!existsSync(LABELS_PATH)) return out;
  const [header, ...lines] = readFileSync(LABELS_PATH, "utf8").split(/\r?\n/).filter(Boolean);
  const cols = parseCsvLine(header ?? "");
  for (const line of lines) {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(LABEL_COLUMNS.map((c) => [c, ""])) as LabelRow;
    cols.forEach((c, i) => {
      if ((LABEL_COLUMNS as readonly string[]).includes(c)) row[c as keyof LabelRow] = cells[i] ?? "";
    });
    if (row.personId) out.set(row.personId, row);
  }
  return out;
}

export function toCsv<C extends readonly string[]>(columns: C, rows: Record<C[number], string>[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c as C[number]] ?? "")).join(","))].join("\n") + "\n";
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
