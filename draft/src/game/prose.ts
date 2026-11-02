/**
 * The gazette's sentences (asked 2026-11-01): a small grammar over the fragment bank. A frame is a
 * template with `{slot}` tokens filled from the facts and `[list]` tokens filled from a fragment
 * list; `{n:word}` writes a number with its noun ("1 run", "12 runs"). The picker draws from each
 * list in a seeded shuffled order and does not repeat an entry until the list is used up, so a run
 * reads with variety and the same seed prints the same paper. Every number in a sentence comes
 * from a slot; the bank itself carries no digits (a test keeps it so).
 *
 * Register: the understated British sports page. Short sentences, the score early, one judgement a
 * paragraph, no exclamation marks, and nothing the scorecard does not show.
 */

import type { FixtureResult } from "../../../wcdraft/src/engine/tournament.ts";
import { BANK, type BankLists } from "./bank.ts";
import type { Fact } from "./facts.ts";

export type Slots = Record<string, string | number>;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** A small deterministic generator (mulberry32) seeded from a string. */
function rng(seed: string): () => number {
  let a = hash(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws from lists without repeating an entry until the list is exhausted; order fixed by the seed. */
export class Picker {
  private readonly next: () => number;
  private readonly orders = new Map<string, { order: number[]; at: number }>();

  constructor(seed: string) {
    this.next = rng(seed);
  }

  pick<T>(key: string, items: readonly T[]): T {
    if (items.length === 0) throw new Error(`empty list ${key}`);
    if (items.length === 1) return items[0]!;
    let state = this.orders.get(key);
    if (!state || state.at >= state.order.length) {
      const order = this.shuffle(items.length);
      // Never follow the last entry of one cycle with the same entry at the top of the next.
      if (state && order[0] === state.order[state.order.length - 1]) order.push(order.shift()!);
      state = { order, at: 0 };
      this.orders.set(key, state);
    }
    return items[state.order[state.at++]!]!;
  }

  private shuffle(n: number): number[] {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }
}

/** "1 run", "12 runs"; irregular plurals the bank uses are listed here. */
export function count(n: number, word: string): string {
  if (word === "nth") {
    const mod100 = n % 100, mod10 = n % 10;
    return `${n}${mod100 >= 11 && mod100 <= 13 ? "th" : mod10 === 1 ? "st" : mod10 === 2 ? "nd" : mod10 === 3 ? "rd" : "th"}`;
  }
  const plural = n === 1 ? word : word === "run" ? "runs" : word === "ball" ? "balls" : word === "wicket" ? "wickets" : word === "over" ? "overs" : word === "day" ? "days" : word === "match" ? "matches" : word === "six" ? "sixes" : word === "four" ? "fours" : `${word}s`;
  return `${n} ${plural}`;
}

/** "India's", "West Indies'": the possessive of a name. */
export const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

/** Fill `[list]` tokens from the bank (recursively) and `{slot}`, `{n:word}`, `{name:pos}` tokens; no tidying. */
export function expand(template: string, slots: Slots, picker: Picker, lists: BankLists = BANK.lists): string {
  let text = template.replace(/\[([a-zA-Z_]+)\]/g, (_, key: string) => {
    const list = lists[key];
    if (!list) throw new Error(`no fragment list ${key}`);
    return expand(picker.pick(key, list), slots, picker, lists);
  });
  text = text.replace(/\{([a-zA-Z_0-9]+)(?::([a-z]+))?\}/g, (_, key: string, word?: string) => {
    const v = slots[key];
    if (v === undefined) throw new Error(`no slot ${key}`);
    if (word === "pos") return possessive(String(v));
    return word ? count(Number(v), word) : String(v);
  });
  return text;
}

/** A finished sentence: expanded, then tidied once, so fragments inside it keep their case. */
export function render(template: string, slots: Slots, picker: Picker, lists: BankLists = BANK.lists): string {
  return tidy(expand(template, slots, picker, lists));
}

/** Capitalise the first letter, collapse doubled spaces, and fix "a" before a vowel sound. */
export function tidy(text: string): string {
  const t = text.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
  return t.replace(/\ba ([aeiouAEIOU])/g, "an $1").replace(/^./, (c) => c.toUpperCase());
}

/** The slots a fact offers: its numbers, its names, and the player and team it is about. */
export function factSlots(fact: Fact, extra: Slots = {}): Slots {
  return { ...fact.n, ...fact.s, team: fact.team ?? "", player: fact.player?.name ?? "", surname: surname(fact.player?.name ?? ""), ...extra };
}

export const surname = (name: string) => name.trim().split(" ").slice(-1)[0] ?? name;

/** A sentence for a fact, or null when the bank has no frames for it. */
export function factSentence(fact: Fact, picker: Picker, extra: Slots = {}): string | null {
  const frames = BANK.facts[fact.key];
  if (!frames?.length) return null;
  return render(picker.pick(`fact:${fact.key}`, frames), factSlots(fact, extra), picker);
}

/** The stop-press line for a tier-one fact: terse, no sub-clauses. */
export function stopPress(fact: Fact, picker: Picker, extra: Slots = {}): string | null {
  const frames = BANK.stopPress[fact.key] ?? BANK.facts[fact.key];
  if (!frames?.length) return null;
  return render(picker.pick(`stop:${fact.key}`, frames), factSlots(fact, extra), picker);
}

/** One line for a result, as late news prints it. */
export function resultLine(f: FixtureResult, picker: Picker): string {
  const [a, b] = f.teams;
  if (!f.winner) return render(picker.pick("result:noResult", BANK.results.noResult), { a, b }, picker);
  const loser = f.winner === a ? b : a;
  const slots: Slots = { winner: f.winner, loser };
  if (f.tieBreak) {
    const key = f.tieBreak.method === "super-over" ? "superOver" : f.tieBreak.method === "bowl-out" ? "bowlOut" : "coinToss";
    return render(picker.pick(`result:${key}`, BANK.results[key]), slots, picker);
  }
  const m = f.margin;
  if (!m) return render(picker.pick("result:plain", BANK.results.plain), slots, picker);
  if ("dls" in m) return render(picker.pick("result:dls", BANK.results.dls), { ...slots, runs: m.runs }, picker);
  if ("wickets" in m) {
    if (m.ballsLeft === 0) return render(picker.pick("result:lastBall", BANK.results.lastBall), { ...slots, wickets: m.wickets }, picker);
    return render(picker.pick("result:wickets", BANK.results.wickets), { ...slots, wickets: m.wickets, ballsLeft: m.ballsLeft }, picker);
  }
  return render(picker.pick("result:runs", BANK.results.runs), { ...slots, runs: m.runs }, picker);
}

/** Every integer in a sentence, for the honesty test: each must come from the match. */
export function numbersIn(text: string): number[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}
