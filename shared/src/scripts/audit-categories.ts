/**
 * Audits the inferred shot/dismissal categories across the full roster
 * so we can spot patterns that need explicit hand-tagging.
 *
 * Run: npm --prefix shared run audit-categories
 *
 * Output prints:
 *   - Counts per ShotCategory (descending)
 *   - Counts per DismissalCategory (descending)
 *   - Sample shot phrases per category (so you can sanity-check the
 *     inference)
 *   - Flags if any category fell back to the catch-all `mistime` or
 *     `caught-deep` more than expected (>5%)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardRoster, DismissalCategory, ShotCategory } from "../types/cards.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_PATH = resolve(__dirname, "../data/cards.json");

interface ShotEntry {
  category: ShotCategory;
  shot: string;
  card: string;
}
interface DismissalEntry {
  category: DismissalCategory;
  mode: string;
  card: string;
}

function main(): void {
  const roster: CardRoster = JSON.parse(readFileSync(DATA_PATH, "utf8"));

  const shots: ShotEntry[] = [];
  const dismissals: DismissalEntry[] = [];

  for (const c of roster.batsmen) {
    for (const list of [c.strengths, c.neutrals, c.weaknesses]) {
      for (const o of list) {
        if (o.outcome.type === "runs") {
          shots.push({
            category: o.outcome.shotCategory,
            shot: o.outcome.shot,
            card: c.name,
          });
        } else if (o.outcome.type === "wicket") {
          dismissals.push({
            category: o.outcome.dismissalCategory,
            mode: o.outcome.mode,
            card: c.name,
          });
        }
      }
    }
  }

  printSection(
    "SHOT CATEGORIES",
    shots.length,
    groupBy(shots, (s) => s.category),
    (entries) => uniqueSorted(entries.map((e) => e.shot)).slice(0, 5),
    "mistime",
  );

  printSection(
    "DISMISSAL CATEGORIES",
    dismissals.length,
    groupBy(dismissals, (d) => d.category),
    (entries) => uniqueSorted(entries.map((e) => e.mode)).slice(0, 5),
    "caught-deep",
  );
}

function groupBy<T, K extends string>(items: T[], keyFn: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const k = keyFn(item);
    if (!out[k]) out[k] = [];
    out[k].push(item);
  }
  return out;
}

function uniqueSorted(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort();
}

function printSection<T>(
  title: string,
  total: number,
  groups: Record<string, T[]>,
  sampleFn: (entries: T[]) => string[],
  fallbackKey: string,
): void {
  console.log(`\n══ ${title} (${total} total) ══`);
  const sorted = Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);
  for (const [cat, entries] of sorted) {
    const pct = ((entries.length / total) * 100).toFixed(1);
    const samples = sampleFn(entries).join(" | ");
    const flag = cat === fallbackKey && entries.length / total > 0.05 ? " ⚠️  OVER-RELIANCE" : "";
    console.log(`  ${cat.padEnd(20)} ${String(entries.length).padStart(4)} (${pct.padStart(4)}%)  ${samples}${flag}`);
  }
}

main();
