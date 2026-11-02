/**
 * Writes the run's newspaper once (2026-11-01): facts and records for every fixture in play order,
 * then for each of the side's matches the stop press, the fact sentences for the report and the
 * late news since the previous issue. Written in one pass with one picker, so the no-repeat memory
 * holds across the run whatever order the reader turns the pages, and the same seed prints the
 * same paper.
 */

import type { FixtureResult } from "../../../wcdraft/src/engine/tournament.ts";
import { bestFact, factsFor, fixtureKey, foldRecords, marksFor, recordsBefore, type Fact, type RecordsAt } from "./facts.ts";
import { Picker, factSentence, resultLine, stopPress } from "./prose.ts";

export interface LateNewsLine {
  fixtureKey: string;
  date: string | null;
  line: string;
}

export interface IssueCopy {
  fixtureKey: string;
  /** The tournament's match day this match fell on, counting distinct dates in play order. */
  matchDay: number;
  facts: Fact[];
  /** The single stop-press line, from the best tier-one fact, or null. */
  stopPress: string | null;
  /** Fact sentences for the report, at most three, the stop-press fact first. */
  sentences: string[];
  /** Results since the previous issue, in play order, with their best fact where there is one. */
  lateNews: LateNewsLine[];
}

export interface Paper {
  editionId: string;
  /** Match day by date. */
  matchDays: Map<string, number>;
  /** Facts for every fixture, by fixture key. */
  facts: Map<string, Fact[]>;
  records: Map<string, RecordsAt>;
  /** The side's issues, by fixture key. */
  issues: Map<string, IssueCopy>;
}

/** Facts already carried by the result line, so late news does not say them twice. */
const IN_RESULT_LINE = new Set(["nailBiter", "rout", "dls", "superOver", "bowlOut", "coinToss", "noResult", "lastBall", "knockout"]);

/** Match days: each distinct date in play order is a day; undated fixtures take the previous day. */
export function matchDaysOf(all: FixtureResult[]): Map<string, number> {
  const days = new Map<string, number>();
  let day = 0;
  for (const f of all) {
    const key = f.date ?? `#${day}`;
    if (!days.has(key)) days.set(key, (day += 1));
  }
  return days;
}

export function writePaper(all: FixtureResult[], mine: FixtureResult[], me: string, seed: string, editionId: string, runsPerOver: number, knockoutStages: Set<string>): Paper {
  const picker = new Picker(`${seed}:paper`);
  const records = foldRecords(all);
  const before = recordsBefore(all);
  const marks = marksFor(runsPerOver);
  const matchDays = matchDaysOf(all);
  const facts = new Map<string, Fact[]>();
  for (const f of all) {
    const key = fixtureKey(f);
    facts.set(key, factsFor(f, { editionId, records: records.get(key)!, knockout: knockoutStages.has(f.stageId.replace(/-reserve$/, "")), before: before.get(key)!, marks }));
  }
  const issues = new Map<string, IssueCopy>();
  let previous = -1;
  for (const m of mine) {
    const at = all.indexOf(m);
    const key = fixtureKey(m);
    const own = facts.get(key) ?? [];
    const ranked = [...own].sort((a, b) => a.tier - b.tier);
    const top = ranked.find((x) => x.tier === 1) ?? null;
    const stop = top ? stopPress(top, picker) : null;
    const sentences: string[] = [];
    for (const fact of ranked) {
      if (sentences.length >= 3 || fact.tier > 2) break;
      const s = factSentence(fact, picker);
      if (s) sentences.push(s);
    }
    const between = all.slice(previous + 1, at).filter((f) => !f.teams.includes(me));
    const lateNews = between.slice(-8).map((f) => {
      const fk = fixtureKey(f);
      const best = bestFact((facts.get(fk) ?? []).filter((x) => !IN_RESULT_LINE.has(x.key) && x.tier <= 2));
      const extra = best ? factSentence(best, picker) : null;
      return { fixtureKey: fk, date: f.date, line: `${resultLine(f, picker)}${extra ? ` ${extra}` : ""}` };
    });
    issues.set(key, { fixtureKey: key, matchDay: matchDays.get(m.date ?? "") ?? 0, facts: own, stopPress: stop, sentences, lateNews });
    previous = at;
  }
  return { editionId, matchDays, facts, records, issues };
}
