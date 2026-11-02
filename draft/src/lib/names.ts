/**
 * Display names (asked 2026-10-31). The engine keeps Cricsheet's short names; the client shows the
 * names fans use, from data/names.json. `fullName` is for anywhere a person is named on their own,
 * `surnameOf` for the scorebook shorthand ("c Kohli b Bumrah") and a story's second mention.
 */

import { splitShortName } from "../../../wcdraft/src/util/names.ts";

let names: Record<string, string> = {};

export function setNames(map: Record<string, string>): void {
  names = map;
}

export function fullName(id: string, short: string): string {
  return names[id] ?? short;
}

export function surnameOf(short: string): string {
  return splitShortName(short).surname;
}

const TEAM_LABELS: Record<string, string> = { "United States of America": "USA", "United Arab Emirates": "UAE", "Papua New Guinea": "PNG" };

/** A side's name as the paper prints it: the long associate names abbreviated (asked 2026-11-02), everyone else as is. */
export function teamLabel(team: string): string {
  return TEAM_LABELS[team] ?? team;
}

/** The same abbreviation applied inside a finished sentence. */
export function labelTeams(text: string): string {
  let out = text;
  for (const [long, short] of Object.entries(TEAM_LABELS)) out = out.split(long).join(short);
  return out;
}

/** The name a story or a scorebook uses on its own: "Kohli", and "Hasaranga" where Cricsheet has "PWH de Silva". */
export function familiar(id: string, short: string): string {
  const display = fullName(id, short);
  const surname = surnameOf(short);
  return display.includes(surname) ? surname : (display.split(" ").pop() ?? surname);
}
