/**
 * The corpus harness for the gazette's facts (2026-11-01): plays CPU-only tournaments across the
 * editions with real elevens, runs every detector on every fixture, and prints how often each fact
 * fires, how many matches earn a stop press, where the edition marks sit against the simulated
 * totals, and a sample sentence per fact for reading. Tiers in `facts.ts` are set from this.
 *
 *   node --import tsx draft/scripts/facts-corpus.mts [seedsPerEdition=10] [editions=all]
 */

import { engineReady, loadEdition } from "../../wcdraft/src/engine/load.ts";
import { simulateTournament } from "../../wcdraft/src/engine/tournament.ts";
import type { FixtureResult } from "../../wcdraft/src/engine/tournament.ts";
import { factsFor, foldRecords, marksFor, recordsBefore, fixtureKey, type Fact } from "../src/game/facts.ts";
import { Picker, factSentence, stopPress } from "../src/game/prose.ts";
import { inPlayOrder } from "../src/game/stats.ts";

const seeds = Number(process.argv[2] ?? 10);
const only = process.argv[3]?.split(",");
const EDITIONS = ["2007", "2009", "2010", "2012", "2014", "2016", "2021", "2022", "2024", "2026"].filter((e) => !only || only.includes(e));

if (!engineReady()) { console.error("engine data not built; run data:build and ratings:build in wcdraft"); process.exit(1); }

const byKey = new Map<string, { matches: number; sample: Fact | null; tiers: Set<number> }>();
let matches = 0, withStop = 0, withReport = 0, tier1Count = 0;
const totalsByEdition = new Map<string, number[]>();
const chasesByEdition = new Map<string, number[]>();

for (const id of EDITIONS) {
  let data;
  try { data = loadEdition(id); } catch (e) { console.error(`skip ${id}: ${(e as Error).message}`); continue; }
  const rpo = data.edition.environment.runsPerOver;
  const marks = marksFor(rpo);
  const knockouts = new Set(data.progression.stages.filter((s: { groups?: unknown }) => !s.groups).map((s: { id: string }) => s.id));
  for (let s = 1; s <= seeds; s += 1) {
    const result = simulateTournament(data, data.progression, { seed: `corpus-${id}-${s}`, keepScorecards: true, keepBallLogs: true });
    const all: FixtureResult[] = result.stages.flatMap((st) => inPlayOrder(st.fixtures));
    const records = foldRecords(all);
    const before = recordsBefore(all);
    for (const f of all) {
      const key = fixtureKey(f);
      const facts = factsFor(f, { editionId: id, records: records.get(key)!, knockout: knockouts.has(f.stageId.replace(/-reserve$/, "")), before: before.get(key)!, marks });
      matches += 1;
      const keys = new Set(facts.map((x) => x.key));
      for (const k of keys) {
        const row = byKey.get(k) ?? { matches: 0, sample: null, tiers: new Set() };
        row.matches += 1;
        const fact = facts.find((x) => x.key === k)!;
        if (!row.sample || (s + matches) % 7 === 0) row.sample = fact;
        row.tiers.add(fact.tier);
        byKey.set(k, row);
      }
      const t1 = facts.filter((x) => x.tier === 1).length;
      tier1Count += t1;
      if (t1 > 0) withStop += 1;
      if (facts.some((x) => x.tier <= 2)) withReport += 1;
      const [i1, i2] = f.innings ?? [];
      if (i1 && i1.legalBalls >= 100 && !f.rain) totalsByEdition.set(id, [...(totalsByEdition.get(id) ?? []), i1.runs]);
      if (i2 && f.winner === i2.team && !f.rain) chasesByEdition.set(id, [...(chasesByEdition.get(id) ?? []), i2.runs]);
    }
  }
  const tot = (totalsByEdition.get(id) ?? []).sort((a, b) => a - b), ch = (chasesByEdition.get(id) ?? []).sort((a, b) => a - b);
  const q = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))] ?? 0;
  console.log(`${id}: rpo ${rpo.toFixed(2)} | marks highTotal ${marks.highTotal} (sim p90 ${q(tot, 0.9)}, p95 ${q(tot, 0.95)}, n ${tot.length}) | highChase ${marks.highChase} (sim p90 ${q(ch, 0.9)}, p95 ${q(ch, 0.95)}, n ${ch.length})`);
}

console.log(`\n${matches} matches. Stop press (tier 1) in ${(100 * withStop / matches).toFixed(1)}% of matches (${(tier1Count / matches).toFixed(2)} tier-1 facts a match); a report fact (tier ≤ 2) in ${(100 * withReport / matches).toFixed(1)}%.\n`);
console.log("fact".padEnd(26), "tier", "share of matches", "  sample");
const picker = new Picker("corpus");
for (const [k, row] of [...byKey].sort((a, b) => b[1].matches - a[1].matches)) {
  const share = `${(100 * row.matches / matches).toFixed(1)}%`;
  const sample = row.sample ? (factSentence(row.sample, picker) ?? stopPress(row.sample, picker) ?? "(no frame)") : "";
  console.log(k.padEnd(26), [...row.tiers].join("/").padEnd(4), share.padStart(8), "        ", sample);
}
