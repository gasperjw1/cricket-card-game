/**
 * The newspaper's copy (asked 2026-10-31): a headline, standfirst and short report for each of the
 * side's matches, written from the scorecard alone, so nothing is claimed that did not happen. The
 * template for a match is chosen from the run's seed, so a seed reprints the same paper.
 */

import type { FixtureResult } from "../../../wcdraft/src/engine/tournament.ts";
import type { BatterLine, BowlerLine, InningsResult } from "../../../wcdraft/src/engine/types.ts";
import { familiar, fullName } from "../lib/names.ts";

export interface Story {
  kicker: string;
  headline: string;
  standfirst: string;
  paragraphs: string[];
}

export interface StoryContext {
  me: string;
  seed: string;
  stageLabel: string;
  city: string | null;
  /** True on the side's last match of the run. */
  last: boolean;
  /** True on the tournament's final. */
  final: boolean;
  /** True when this stage is a knockout. */
  knockout: boolean;
  /** The side's record after this match. */
  record: { won: number; lost: number };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const pick = <T,>(options: T[], key: string): T => options[hash(key) % options.length]!;

export function topBatter(inn: InningsResult): BatterLine | null {
  return [...inn.batting].sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0] ?? null;
}

export function topBowler(inn: InningsResult): BowlerLine | null {
  return [...inn.bowling].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0] ?? null;
}

const batLine = (b: BatterLine) => `${b.runs}${b.out ? "" : "*"} off ${b.balls}`;
const bowlLine = (w: BowlerLine) => `${w.wickets} for ${w.runs}`;
const score = (inn: InningsResult) => (inn.wickets >= 10 ? `${inn.runs} all out` : `${inn.runs} for ${inn.wickets}`);
const ball = (balls: number) => `${balls} ball${balls === 1 ? "" : "s"}`;

type Shape = "rained" | "tied" | "tight" | "thrash" | "routine";

function shapeOf(f: FixtureResult): Shape {
  if (!f.winner) return "rained";
  if (f.tieBreak) return "tied";
  const m = f.margin;
  if (!m) return "routine";
  if ("wickets" in m) return m.ballsLeft <= 6 || m.wickets <= 2 ? "tight" : m.ballsLeft >= 36 || m.wickets >= 8 ? "thrash" : "routine";
  return m.runs <= 10 ? "tight" : m.runs >= 45 ? "thrash" : "routine";
}

/**
 * The sharpest fall of the innings: at least four wickets for 25 runs or fewer, if there was one.
 * The runs are counted from the score at the wicket before, so the first of the four is included
 * ("four for 25" from 100/1 means 125/5).
 */
function collapse(inn: InningsResult): { wickets: number; runs: number } | null {
  const fow = inn.fallOfWickets;
  let best: { wickets: number; runs: number } | null = null;
  for (let i = 0; i < fow.length; i += 1) {
    for (let j = i + 4; j < fow.length; j += 1) {
      const runs = fow[j]!.runs - fow[i]!.runs;
      if (runs <= 25 && (!best || j - i > best.wickets)) best = { wickets: j - i, runs };
    }
  }
  return best;
}

function biggestStand(inn: InningsResult) {
  return [...inn.partnerships].sort((a, b) => b.runs - a.runs)[0] ?? null;
}

export function storyFor(f: FixtureResult, ctx: StoryContext): Story {
  const { me } = ctx;
  const key = `${ctx.seed}:${f.stageId}:${f.teams.join()}`;
  const opp = f.teams[0] === me ? f.teams[1] : f.teams[0];
  const where = ctx.city ? ` in ${ctx.city}` : "";
  const kicker = `${ctx.stageLabel}${f.group ? ` · Group ${f.group}` : ""}`;
  const [i1, i2] = f.innings ?? [];
  if (!i1 || !i2) return { kicker, headline: `No play${where}`, standfirst: `${me} and ${opp} share the points.`, paragraphs: [`${me} and ${opp} could not finish a game${where}.`] };

  const shape = shapeOf(f);
  const won = f.winner === me;
  const mineInn = i1.team === me ? i1 : i2;
  const oppInn = i1.team === me ? i2 : i1;
  const myBat = topBatter(mineInn), myBowl = topBowler(oppInn), theirBat = topBatter(oppInn);
  const heroBat = myBat && myBat.runs >= 60 ? myBat : null;
  const heroBowl = myBowl && myBowl.wickets >= 4 ? myBowl : null;
  const hero = heroBowl ? familiar(heroBowl.id, heroBowl.name) : heroBat ? familiar(heroBat.id, heroBat.name) : null;
  const nemesis = theirBat && theirBat.runs >= 70 ? theirBat : null;

  const headline = (() => {
    if (shape === "rained") return pick([`Rain has the last word${where}`, `Washed out${where}`], key);
    if (ctx.final && won) return pick([`${me} are world champions`, `${me} lift the World Cup`], key);
    if (ctx.final) return pick([`Heartbreak for ${me} in the final`, `${opp} deny ${me} the World Cup`], key);
    if (ctx.knockout && won) return pick([`${me} march on past ${opp}`, `${me} knock out ${opp}`], key);
    if (ctx.last && !won) return pick([`${me} crash out to ${opp}`, `The road ends for ${me}`], key);
    if (shape === "tied") return `${f.winner} take it after a tie with ${won ? opp : me}`;
    if (won && shape === "tight") return pick([`${me} hold their nerve against ${opp}`, `${me} edge a thriller with ${opp}`], key);
    if (won && hero && shape === "thrash") return pick([`${hero} flattens ${opp}`, `${hero} leads the rout of ${opp}`], key);
    if (won && shape === "thrash") return pick([`${me} crush ${opp}`, `${opp} swept aside by ${me}`], key);
    if (won && hero) return pick([`${hero} sees ${me} past ${opp}`, `${hero} the difference for ${me}`], key);
    if (won) return pick([`${me} beat ${opp}`, `${me} too good for ${opp}`], key);
    if (shape === "tight") return pick([`${opp} break ${me} at the death`, `So close for ${me} against ${opp}`], key);
    if (shape === "thrash") return pick([`${me} humbled by ${opp}`, `${opp} run riot against ${me}`], key);
    if (nemesis) return pick([`${familiar(nemesis.id, nemesis.name)} sinks ${me}`, `${familiar(nemesis.id, nemesis.name)} too hot for ${me}`], key);
    return pick([`${opp} too strong for ${me}`, `${me} beaten by ${opp}`], key);
  })();

  const marginWords = (() => {
    const m = f.margin;
    if (!f.winner) return "";
    if (f.tieBreak) return i1.runs === i2.runs ? "after the scores finished level" : "after rain left the scores level on par";
    if (!m) return "";
    if ("wickets" in m) return `by ${m.wickets} wicket${m.wickets === 1 ? "" : "s"} ${m.ballsLeft ? `with ${ball(m.ballsLeft)} to spare` : "off the last ball"}`;
    return `by ${m.runs} run${m.runs === 1 ? "" : "s"}${"dls" in m ? " on DLS" : ""}`;
  })();

  const standfirst = f.winner
    ? `${f.winner} won ${marginWords}${where}.${f.potm ? ` ${fullName(f.potm.id, f.potm.name)} was player of the match.` : ""}`
    : i2.legalBalls > 0 ? `Rain stopped play${where} with ${i2.team} on ${i2.runs} for ${i2.wickets}, chasing ${i2.target ?? i1.runs + 1}.` : `Rain stopped play${where} after ${i1.team} had made ${score(i1)}.`;

  const inningsParagraph = (inn: InningsResult, chase: boolean): string => {
    const bat = topBatter(inn), bowl = topBowler(inn);
    const stand = biggestStand(inn);
    const parts: string[] = [];
    if (chase) parts.push(`Chasing ${inn.target ?? i1.runs + 1}, ${inn.team} made ${score(inn)}.`);
    else parts.push(`${inn.team} ${f.tossWinner === inn.team ? "chose to bat and " : "were sent in and "}made ${score(inn)}.`);
    if (bat && bat.runs > 0) parts.push(`${fullName(bat.id, bat.name)} led the way with ${batLine(bat)}${bat.sixes >= 3 ? `, hitting ${bat.sixes} sixes` : ""}.`);
    if (stand && stand.runs >= 50) {
      const pair = inn.batting.filter((b) => stand.batters.includes(b.id));
      if (pair.length === 2) parts.push(`A stand of ${stand.runs} between ${familiar(pair[0]!.id, pair[0]!.name)} and ${familiar(pair[1]!.id, pair[1]!.name)} was the heart of the innings.`);
    }
    if (bowl && bowl.wickets >= 3) parts.push(`${fullName(bowl.id, bowl.name)} took ${bowlLine(bowl)} for ${inn.team === i1.team ? i2.team : i1.team}.`);
    const c = collapse(inn);
    if (c && f.winner && inn.team !== f.winner) parts.push(`The damage was done when ${c.wickets} wickets went for ${c.runs}.`);
    return parts.join(" ");
  };

  const replied = i2.legalBalls > 0;
  const paragraphs = [inningsParagraph(i1, false), replied ? inningsParagraph(i2, true) : `Rain ended the match before ${i2.team} could begin their reply.`];
  if (shape === "tied" && f.tieBreak) {
    const [so1, so2] = f.tieBreak.innings ?? [];
    const superOver = so1 && so2 ? ` ${so1.team} made ${so1.runs} for ${so1.wickets} and ${so2.team} ${so2.runs} for ${so2.wickets}.` : "";
    const level = i1.runs === i2.runs ? `The scores finished level on ${i1.runs}` : "Rain left the scores level on par";
    const decider = f.tieBreak.method === "super-over" ? "the super over" : f.tieBreak.method === "coin" ? "on the toss of a coin" : "the bowl-out";
    paragraphs.push(`${level}, and ${f.winner} won ${decider}.${superOver}`);
  }
  const { won: w, lost: l } = ctx.record;
  if (!ctx.knockout && w + l > 0) {
    paragraphs.push(`${me} ${l === 0 && w > 0 ? `stay unbeaten after ${w + l}` : `are now ${w}–${l}`} in the ${ctx.stageLabel}.`);
  }

  return { kicker, headline, standfirst, paragraphs };
}

export interface Verdict {
  grade: string;
  title: string;
  line: string;
}

/** The run's one-line result: a grade and a verdict that fit the finish. */
export function verdictFor(id: { won: number; lost: number; played: number; exit: string; champion: boolean; unbeaten: boolean }, me: string, stageCount: number, exitStage: number): Verdict {
  const record = `${id.won} won, ${id.lost} lost`;
  if (id.unbeaten && id.champion) return { grade: "A+", title: "The invincibles", line: `${me} won the World Cup without losing a match.` };
  if (id.champion) return { grade: "A", title: "World champions", line: `${me} took the title: ${record}.` };
  if (id.exit === "Final") return { grade: "B+", title: "So near", line: `${me} reached the final: ${record}.` };
  if (exitStage >= stageCount - 2) return { grade: "B", title: "Semi-finalists", line: `${me} fell one win short of the final: ${record}.` };
  if (exitStage >= 1) return id.won >= id.lost ? { grade: "C+", title: "Respectable", line: `${me} went out in the ${id.exit}: ${record}.` } : { grade: "C", title: "Out of their depth", line: `${me} ran out of answers in the ${id.exit}: ${record}.` };
  return id.won > 0 ? { grade: "D", title: "Early flight home", line: `${me} went out in the ${id.exit}: ${record}.` } : { grade: "E", title: "Back to the drawing board", line: `${me} did not win a match.` };
}
