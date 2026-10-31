/**
 * Names the game shows (asked 2026-10-31). Cricsheet stores "RG Sharma" and the biography snapshot
 * stores the legal "Rohit Gurunath Sharma"; neither is what a fan calls him. The default is the
 * first given name plus Cricsheet's surname, which gives "Rohit Sharma", and
 * `data/labels/display-name-overrides.csv` holds the people that rule gets wrong: those known by
 * initials (MS Dhoni), a shortened name (Chris Gayle) or a middle name (Lasith Malinga).
 *
 * `npm run data:names` writes `data/labels/display-names.csv`, committed because the image has no
 * snapshot. The engine keeps Cricsheet's names; only the client shows these.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { paths, writeText } from "../util/io.js";
import { deriveDisplayName } from "../util/names.js";
import { parseCsvLine, readLabels, toCsv } from "./labels.js";

const COLUMNS = ["personId", "name", "displayName", "source"] as const;

function readCsvRows(file: string): Record<string, string>[] {
  if (!existsSync(file)) return [];
  const [header, ...lines] = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  const cols = parseCsvLine(header ?? "");
  return lines.map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
  });
}

export function writeDisplayNames(): { rows: number; overridden: number; derived: number; kept: number } {
  const legal = new Map(readCsvRows(resolve(paths.labels, "sources", "player-meta.csv")).map((r) => [r["personId"] ?? "", r["fullName"] ?? ""]));
  // Overrides are keyed by Cricsheet's name so the sheet can be read and edited by eye.
  const overrides = new Map(readCsvRows(resolve(paths.labels, "display-name-overrides.csv")).map((r) => [r["name"] ?? "", r["displayName"] ?? ""]));
  const people = [...readLabels().values()];
  const known = new Set(people.map((p) => p.name));
  for (const name of overrides.keys()) if (!known.has(name)) throw new Error(`display-name-overrides.csv: no player named ${name}`);
  const counts = { rows: 0, overridden: 0, derived: 0, kept: 0 };
  const rows = people.sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
    const override = overrides.get(p.name);
    const derived = deriveDisplayName(p.name, legal.get(p.personId) ?? "");
    const source = override ? "override" : derived !== p.name ? "derived" : "cricsheet";
    counts.rows += 1;
    counts[source === "override" ? "overridden" : source === "derived" ? "derived" : "kept"] += 1;
    return { personId: p.personId, name: p.name, displayName: override || derived, source };
  });
  writeText(resolve(paths.labels, "display-names.csv"), toCsv(COLUMNS, rows));
  return counts;
}
