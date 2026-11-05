/**
 * Do captains matter, and for what? (2026-11-04, Yash: captain IQ in bowling usage, the six-bowler
 * habit perhaps the captain's rather than the coach's, and a captain-set batting order.) Men's T20Is
 * since 2010; each side's captain from the tenures in `captaincy.json` (the tenure covering the year
 * whose captain is in the eleven, as in `captain-phase.mts`) and its coach from `coaches.csv`.
 *
 * Every measure is a residual against its year's mean, then split between captain and coach by a
 * two-way additive fit (ridge-shrunk, `LAMBDA` rows), which only the changes of one with the other in
 * place can separate. A trait is real only if it repeats: the fit is run on alternate rows of each
 * side and the two halves' effects are correlated across captains (and across coaches) with enough
 * rows in both. "True spread" is the SD of the effects that the split-half correlation backs.
 *
 *   A. Results: win minus the pre-match Elo expectation (`team-strength.json`), per side per match.
 *   B. Bowling habits of the fielding side, per full innings:
 *      - bowlers used;
 *      - death trust: share of overs 16–20 to whoever bowled over 1 or 2;
 *      - best at the death: share of overs 16–20 to the side's two best bowlers that day by career
 *        economy before the match (60+ balls), which is Yash's "Bumrah for the 18th";
 *      - hook: after an over of 14+ runs before over 16, with overs left, the bowler never returns.
 *   C. Runs conceded beyond the bowlers: each ball's runs less the bowler's career rate in that phase
 *      before the match (shrunk to the year's phase rate), summed per full innings. What is left is
 *      fields, plans, within-phase choices, the opposition and luck; the opposition and luck do not
 *      follow a captain from half to half.
 *   E. Matchup choice (Yash, 2026-11-05: do captains bowl the right type at the right batter?): at
 *      the start of each over, the chosen bowler's matchup edge in runs and wickets against the two
 *      batters in (hand × class × phase, `matchups.json`), less the mean edge of those who could
 *      have bowled it, summed per full innings. Negative runs is a better pick than chance.
 *   D. Batting order: the share of batters at Nos. 3–7 who are not the side's usual man there that
 *      year (modal by position), per full batting innings, and runs scored beyond the batters
 *      (each ball's runs less the batter's career rate before the match in that phase).
 *
 *   node --import tsx scripts/research/captain-effects.mts [minRows=30]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { mainInnings, normaliseMatch } from "../../src/cricsheet/match.ts";
import { readCsv } from "../../src/util/csv.ts";
import { bowlClassOf, handOf, type BowlClass, type MatchupTables } from "../../src/analysis/matchups.ts";
import { tenureOf } from "../../src/analysis/captaincy.ts";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const MIN = Number(process.argv[2] ?? 30);
const LAMBDA = 10;
const PRIOR_BALLS = 120;

type Phase = "pp" | "mid" | "death";
const phaseOf = (over: number): Phase => (over < 6 ? "pp" : over < 15 ? "mid" : "death");

// Captains: the tenure covering the year whose captain is in the eleven, the busier one when several are (`tenureOf`).
const tenures = JSON.parse(readFileSync(resolve(ROOT, "data/out/captaincy.json"), "utf8")).captains as { personId: string; captainName: string; team: string; firstYear: number; lastYear: number; matches: number }[];
const captainOf = (team: string, date: string, xi: string[]) => { const t = tenureOf(tenures, team, date.slice(0, 4), xi); return t ? `${team} | ${t.captainName}` : null; };
// Coaches: the latest-starting tenure covering the date (year-only dates overlap at hand-overs).
const coachRows = readCsv(readFileSync(resolve(ROOT, "data/config/coaches.csv"), "utf8"));
const pad = (d: string, end: boolean) => (!d ? (end ? "2099-12-31" : "1900-01-01") : d.length === 4 ? `${d}${end ? "-12-31" : "-01-01"}` : d.length === 7 ? `${d}${end ? "-31" : "-01"}` : d);
const coachOf = (team: string, date: string) => {
  const hits = coachRows.filter((r) => r.team === team && pad(r.fromDate ?? "", false) <= date && date <= pad(r.toDate ?? "", true)).sort((a, b) => pad(b.fromDate ?? "", false).localeCompare(pad(a.fromDate ?? "", false)));
  return hits.length ? `${team} | ${hits[0]!.coachName}` : null;
};
// Pre-match win expectation by match and side.
const strength = JSON.parse(readFileSync(resolve(ROOT, "data/out/team-strength.json"), "utf8")) as { teams: Record<string, { history: { id: string; expected: number; result: number }[] }> };
const expected = new Map<string, { expected: number; result: number }>();
for (const [team, t] of Object.entries(strength.teams)) for (const h of t.history) expected.set(`${h.id}|${team}`, h);

// Matchups: batting hand and bowler class from the labels, and each hand × class × phase cell's runs
// and wickets a ball beyond both players' own averages (`matchups.json`), the phase cell shrunk
// toward the pooled cell and that toward nothing with `MATCHUP_PRIOR` balls, as the engine does.
const MATCHUP_PRIOR = 2000;
const labels = new Map<string, { hand: "R" | "L" | null; cls: BowlClass | null }>();
for (const file of ["data/labels/players.csv", "data/labels/bowler-types.csv"]) {
  for (const r of readCsv(readFileSync(resolve(ROOT, file), "utf8"))) {
    const was = labels.get(r.personId ?? "");
    labels.set(r.personId ?? "", { hand: was?.hand ?? handOf(r.handedness), cls: was?.cls ?? bowlClassOf(r.bowlingType) });
  }
}
const matchupCells = (JSON.parse(readFileSync(resolve(ROOT, "data/out/matchups.json"), "utf8")) as MatchupTables).cells;
const RUNS: Record<string, number> = { "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "6": 6, W: 0 };
const cellDelta = (key: string) => {
  const c = matchupCells[key];
  if (!c) return { runs: 0, w: 0, balls: 0 };
  let ro = 0, re = 0;
  for (const k of Object.keys(RUNS)) { ro += RUNS[k]! * c.observed[k as keyof typeof c.observed]; re += RUNS[k]! * c.expected[k as keyof typeof c.expected]; }
  return { runs: (ro - re) / c.balls, w: (c.observed.W - c.expected.W) / c.balls, balls: c.balls };
};
/** Runs and wickets a ball the matchup adds, for a striker of this hand against this class in this phase. */
const matchupEdge = (hand: "R" | "L", cls: BowlClass, p: Phase) => {
  const all = cellDelta(`${hand}|${cls}|all`), ph = cellDelta(`${hand}|${cls}|${p}`);
  const pooled = { runs: (all.runs * all.balls) / (all.balls + MATCHUP_PRIOR), w: (all.w * all.balls) / (all.balls + MATCHUP_PRIOR) };
  const k = ph.balls / (ph.balls + MATCHUP_PRIOR);
  return { runs: pooled.runs + k * (ph.runs - pooled.runs), w: pooled.w + k * (ph.w - pooled.w) };
};
const matchupTotals = { overs: 0, runs: 0, w: 0, spreadRuns: 0, placebo: 0 };

// One pass, chronological: compact rows, and career rates updated after each match.
interface Row { cap: string; coach: string; year: string; side: string; value: number }
const rows: Record<string, Row[]> = { results: [], bowlersUsed: [], deathTrust: [], bestAtDeath: [], hook: [], concededBeyond: [], matchupRuns: [], matchupWickets: [], matchupHand: [], orderChange: [], scoredBeyond: [] };
const bowlCareer = new Map<string, Record<Phase, { r: number; b: number }>>();
const batCareer = new Map<string, Record<Phase, { r: number; b: number }>>();
const yearPhase = new Map<string, Record<Phase, { r: number; b: number }>>();
const blank = () => ({ pp: { r: 0, b: 0 }, mid: { r: 0, b: 0 }, death: { r: 0, b: 0 } });
const rate = (career: Map<string, Record<Phase, { r: number; b: number }>>, id: string, p: Phase, prior: number) => {
  const c = career.get(id)?.[p] ?? { r: 0, b: 0 };
  return (c.r + PRIOR_BALLS * prior) / (c.b + PRIOR_BALLS);
};
// Each side-year's usual man at each position, from a first count.
const orderCount = new Map<string, Map<number, Map<string, number>>>();

const index = loadIndex().filter((e) => e.gender === "male" && e.date >= "2010-01-01").sort((a, b) => a.date.localeCompare(b.date));
const matches = [];
for (const e of index) {
  const m = normaliseMatch(readMatch(e.file), e.id);
  if (m.hasMissingData) continue;
  matches.push(m);
  for (const inn of mainInnings(m)) {
    if (inn.reduced || inn.superOver) continue;
    const key = `${inn.team}|${m.date.slice(0, 4)}`;
    const byPos = orderCount.get(key) ?? orderCount.set(key, new Map()).get(key)!;
    inn.battingOrder.forEach((id, i) => { const c = byPos.get(i + 1) ?? byPos.set(i + 1, new Map()).get(i + 1)!; c.set(id, (c.get(id) ?? 0) + 1); });
  }
}
const deathEcon = { best: { r: 0, b: 0 }, rest: { r: 0, b: 0 } };
const usual = (team: string, year: string, pos: number) => {
  const c = orderCount.get(`${team}|${year}`)?.get(pos);
  return c ? [...c.entries()].sort((a, b) => b[1] - a[1])[0]![0] : null;
};

for (const m of matches) {
  const year = m.date.slice(0, 4);
  const yp = yearPhase.get(year) ?? yearPhase.set(year, blank()).get(year)!;
  // The year's phase rates so far (falls back to a T20 norm early in a year).
  const norm = (p: Phase) => (yp[p].b > 600 ? yp[p].r / yp[p].b : p === "pp" ? 1.25 : p === "mid" ? 1.2 : 1.55);
  const who = (team: string) => ({ cap: captainOf(team, m.date, m.xis[team] ?? []), coach: coachOf(team, m.date) });
  for (const team of m.teams) {
    const { cap, coach } = who(team);
    const ex = expected.get(`${m.id}|${team}`);
    if (cap && coach && ex) rows.results!.push({ cap, coach, year, side: team, value: ex.result - ex.expected });
  }
  for (const inn of mainInnings(m)) {
    if (inn.superOver) continue;
    const full = !inn.reduced && inn.legalBalls >= 114;
    const field = who(inn.bowlingTeam), bat = who(inn.team);
    if (full && field.cap && field.coach) {
      const base = { cap: field.cap, coach: field.coach, year, side: inn.bowlingTeam };
      const overs = inn.bowlerByOver;
      rows.bowlersUsed!.push({ ...base, value: new Set(overs.filter(Boolean)).size });
      const openers = new Set(overs.slice(0, 2));
      const death = overs.slice(15, 20).filter(Boolean);
      if (death.length) rows.deathTrust!.push({ ...base, value: death.filter((b) => openers.has(b)).length / death.length });
      // The two best that day by career economy before the match, among the eleven's men with 60+ balls.
      const known = [...new Set(overs.filter(Boolean))].map((id) => {
        const c = bowlCareer.get(id); const b = c ? c.pp.b + c.mid.b + c.death.b : 0;
        return { id, b, econ: c && b ? (c.pp.r + c.mid.r + c.death.r) / b : 9 };
      }).filter((x) => x.b >= 60).sort((a, b) => a.econ - b.econ);
      if (known.length >= 4 && death.length) {
        const best = new Set(known.slice(0, 2).map((x) => x.id));
        rows.bestAtDeath!.push({ ...base, value: death.filter((b) => best.has(b)).length / death.length });
        // What a death over from the best two is worth against one from the rest, on the day.
        for (const b of inn.balls) if (b.over >= 15) { const g = best.has(b.bowler) ? deathEcon.best : deathEcon.rest; g.r += b.runsConceded; g.b += b.legal ? 1 : 0; }
      }
      // Hooks: an over of 14+ before over 16, the bowler with overs left, and whether he came back.
      const runsByOver = new Map<number, number>();
      for (const b of inn.balls) runsByOver.set(b.over, (runsByOver.get(b.over) ?? 0) + b.runsConceded);
      overs.forEach((bowler, o) => {
        if (!bowler || o >= 15 || (runsByOver.get(o) ?? 0) < 14) return;
        const bowled = overs.slice(0, o + 1).filter((x) => x === bowler).length;
        if (bowled >= 4) return;
        rows.hook!.push({ ...base, value: overs.slice(o + 1).includes(bowler) ? 0 : 1 });
      });
      // Runs conceded beyond the bowlers' own phase rates.
      let beyond = 0;
      for (const b of inn.balls) { if (!b.legal && !b.wide && !b.noBall) continue; const p = phaseOf(b.over); beyond += b.runsConceded - (b.legal ? rate(bowlCareer, b.bowler, p, norm(p)) : 0); }
      rows.concededBeyond!.push({ ...base, value: beyond });
      // Matchup choice: at the start of each over, the chosen bowler's matchup edge against the two
      // batters in (half the over each) less the mean edge of the bowlers who could have bowled it
      // (bowled in this innings, overs left, not the last over's man). Negative runs = a better pick.
      // The placebo keeps each pick but reads the batters from the innings' other overs of the same
      // phase: what the pick is worth for its phase and the roster alone. The gap to it is the part
      // that answers the batters actually in.
      let mRuns = 0, mW = 0, mHand = 0, counted = 0;
      const firstBall = new Map<number, { batter: string; nonStriker: string }>();
      for (const b of inn.balls) if (!firstBall.has(b.over)) firstBall.set(b.over, { batter: b.batter, nonStriker: b.nonStriker });
      const used = [...new Set(overs.filter(Boolean))];
      const handsAt = (o: number) => {
        const fb = firstBall.get(o);
        const h = fb ? [labels.get(fb.batter)?.hand, labels.get(fb.nonStriker)?.hand] : [];
        return h[0] && h[1] ? (h as ["R" | "L", "R" | "L"]) : null;
      };
      const picks: { o: number; bowler: string; pool: string[]; hands: ["R" | "L", "R" | "L"] }[] = [];
      overs.forEach((bowler, o) => {
        const hands = handsAt(o);
        if (!bowler || !hands) return;
        const pool = used.filter((id) => id !== overs[o - 1] && overs.slice(0, o).filter((x) => x === id).length < 4 && labels.get(id)?.cls);
        if (pool.length < 3 || !pool.includes(bowler)) return;
        picks.push({ o, bowler, pool, hands });
      });
      const choice = (p: (typeof picks)[number], hands: ["R" | "L", "R" | "L"]) => {
        const edge = (id: string) => {
          const cls = labels.get(id)!.cls!;
          const a = matchupEdge(hands[0], cls, phaseOf(p.o)), c = matchupEdge(hands[1], cls, phaseOf(p.o));
          return { runs: 3 * (a.runs + c.runs), w: 3 * (a.w + c.w) };
        };
        const es = p.pool.map(edge), mine = edge(p.bowler);
        return { runs: mine.runs - es.reduce((s, e) => s + e.runs, 0) / es.length, w: mine.w - es.reduce((s, e) => s + e.w, 0) / es.length, spread: Math.max(...es.map((e) => e.runs)) - Math.min(...es.map((e) => e.runs)) };
      };
      for (const p of picks) {
        const real = choice(p, p.hands);
        const others = picks.filter((q) => q.o !== p.o && phaseOf(q.o) === phaseOf(p.o));
        if (!others.length) continue;
        const placebo = others.reduce((s, q) => s + choice(p, q.hands).runs, 0) / others.length;
        mRuns += real.runs; mW += real.w; mHand += real.runs - placebo; counted += 1;
        matchupTotals.spreadRuns += real.spread; matchupTotals.placebo += placebo;
      }
      if (counted >= 10) {
        rows.matchupRuns!.push({ ...base, value: mRuns });
        rows.matchupWickets!.push({ ...base, value: mW });
        rows.matchupHand!.push({ ...base, value: mHand });
        matchupTotals.overs += counted; matchupTotals.runs += mRuns; matchupTotals.w += mW;
      }
    }
    if (full && bat.cap && bat.coach) {
      const base = { cap: bat.cap, coach: bat.coach, year, side: inn.team };
      const mid = inn.battingOrder.slice(2, 7).map((id, i) => ({ id, u: usual(inn.team, year, i + 3) })).filter((x) => x.u);
      if (mid.length) rows.orderChange!.push({ ...base, value: mid.filter((x) => x.id !== x.u).length / mid.length });
      let beyond = 0;
      for (const b of inn.balls) { if (!b.legal) continue; const p = phaseOf(b.over); beyond += b.runsBatter - rate(batCareer, b.batter, p, norm(p) * 0.93); }
      rows.scoredBeyond!.push({ ...base, value: beyond });
    }
  }
  // After the match: careers and the year's phase rates.
  for (const inn of mainInnings(m)) {
    if (inn.superOver) continue;
    for (const b of inn.balls) {
      if (!b.legal) continue;
      const p = phaseOf(b.over);
      const bc = bowlCareer.get(b.bowler) ?? bowlCareer.set(b.bowler, blank()).get(b.bowler)!; bc[p].r += b.runsConceded; bc[p].b += 1;
      const tc = batCareer.get(b.batter) ?? batCareer.set(b.batter, blank()).get(b.batter)!; tc[p].r += b.runsBatter; tc[p].b += 1;
      yp[p].r += b.runsConceded; yp[p].b += 1;
    }
  }
}

// Residual against the year mean, then the two-way fit on each half.
function fit(rs: Row[]) {
  const cap = new Map<string, number>(), coach = new Map<string, number>();
  const nCap = new Map<string, number>(), nCoach = new Map<string, number>();
  for (const r of rs) { nCap.set(r.cap, (nCap.get(r.cap) ?? 0) + 1); nCoach.set(r.coach, (nCoach.get(r.coach) ?? 0) + 1); }
  for (let it = 0; it < 40; it += 1) {
    const sc = new Map<string, number>();
    for (const r of rs) sc.set(r.cap, (sc.get(r.cap) ?? 0) + r.value - (coach.get(r.coach) ?? 0));
    for (const [k, s] of sc) cap.set(k, s / (nCap.get(k)! + LAMBDA));
    const sk = new Map<string, number>();
    for (const r of rs) sk.set(r.coach, (sk.get(r.coach) ?? 0) + r.value - (cap.get(r.cap) ?? 0));
    for (const [k, s] of sk) coach.set(k, s / (nCoach.get(k)! + LAMBDA));
  }
  return { cap, coach, nCap, nCoach };
}
function capOnly(rs: Row[]) {
  const s = new Map<string, { s: number; n: number }>();
  for (const r of rs) { const x = s.get(r.cap) ?? s.set(r.cap, { s: 0, n: 0 }).get(r.cap)!; x.s += r.value; x.n += 1; }
  return { cap: new Map([...s].map(([k, x]) => [k, x.s / (x.n + LAMBDA)])), nCap: new Map([...s].map(([k, x]) => [k, x.n])) };
}
const corr = (xs: number[], ys: number[]) => {
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let c = 0, vx = 0, vy = 0; xs.forEach((x, i) => { c += (x - mx) * (ys[i]! - my); vx += (x - mx) ** 2; vy += (ys[i]! - my) ** 2; });
  return c / Math.sqrt(vx * vy);
};
const sd = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, xs.length - 1)); };

const LABELS: Record<string, [string, number, string]> = {
  results: ["A. wins beyond the Elo expectation", 10, "wins per 10 matches"],
  bowlersUsed: ["B. bowlers used an innings", 1, "bowlers"],
  deathTrust: ["B. death overs to an opening bowler", 100, "points of the death overs"],
  bestAtDeath: ["B. death overs to the day's two best bowlers", 100, "points of the death overs"],
  hook: ["B. hooked after an over of 14+", 100, "points"],
  concededBeyond: ["C. runs conceded beyond the bowlers' own rates", 1, "runs an innings"],
  matchupRuns: ["E. matchup runs from the bowler chosen, against those available", 1, "runs an innings"],
  matchupWickets: ["E. matchup wickets from the bowler chosen, against those available", 1, "wickets an innings"],
  matchupHand: ["E. matchup runs from reading the batters in (real less placebo hands)", 1, "runs an innings"],
  orderChange: ["D. Nos. 3–7 not the side's usual man that year", 100, "points"],
  scoredBeyond: ["D. runs scored beyond the batters' own rates", 1, "runs an innings"],
};

const effectsBy = new Map<string, Map<string, number>>();
for (const [key, rs0] of Object.entries(rows)) {
  const [label, scale, unit] = LABELS[key]!;
  const ym = new Map<string, { s: number; n: number }>();
  for (const r of rs0) { const x = ym.get(r.year) ?? ym.set(r.year, { s: 0, n: 0 }).get(r.year)!; x.s += r.value; x.n += 1; }
  const rs = rs0.map((r) => ({ ...r, value: r.value - ym.get(r.year)!.s / ym.get(r.year)!.n }));
  // Halves: alternate rows of each side, in date order.
  const seen = new Map<string, number>();
  const halves: [Row[], Row[]] = [[], []];
  for (const r of rs) { const i = seen.get(r.side) ?? 0; seen.set(r.side, i + 1); halves[i % 2]!.push(r); }
  const [f0, f1] = halves.map(fit) as [ReturnType<typeof fit>, ReturnType<typeof fit>];
  const [c0, c1] = halves.map(capOnly) as [ReturnType<typeof capOnly>, ReturnType<typeof capOnly>];
  const half = MIN / 2;
  const both = (a: Map<string, number>, b: Map<string, number>, na: Map<string, number>, nb: Map<string, number>) => [...a.keys()].filter((k) => (na.get(k) ?? 0) >= half && (nb.get(k) ?? 0) >= half && b.has(k));
  const report = (name: string, a: Map<string, number>, b: Map<string, number>, na: Map<string, number>, nb: Map<string, number>) => {
    const ks = both(a, b, na, nb);
    if (ks.length < 8) return `${name}: too few (${ks.length})`;
    const xs = ks.map((k) => a.get(k)!), ys = ks.map((k) => b.get(k)!);
    const r = corr(xs, ys);
    // The SD of the whole-sample effects the split-half correlation backs: sqrt(r) × SD of a half's effects.
    const spread = Math.sqrt(Math.max(0, r)) * Math.sqrt((sd(xs) ** 2 + sd(ys) ** 2) / 2);
    return `${name}: ${ks.length} with ${half}+ rows a half, split-half r ${r.toFixed(2)}, true spread ${(spread * scale).toFixed(2)} ${unit}`;
  };
  console.log(`\n${label} (${rs.length} rows; SD of a row ${(sd(rs.map((r) => r.value)) * scale).toFixed(2)} ${unit})`);
  console.log(`  ${report("captain alone        ", c0.cap, c1.cap, c0.nCap, c1.nCap)}`);
  console.log(`  ${report("captain, coach held  ", f0.cap, f1.cap, f0.nCap, f1.nCap)}`);
  console.log(`  ${report("coach, captain held  ", f0.coach, f1.coach, f0.nCoach, f1.nCoach)}`);
  if (key === "scoredBeyond" || key === "orderChange" || key === "bestAtDeath" || key === "matchupRuns" || key === "matchupHand") {
    const whole = fit(rs);
    const ranked = [...whole.cap.entries()].filter(([k]) => (whole.nCap.get(k) ?? 0) >= MIN).sort((a, b) => b[1] - a[1]);
    for (const [k, v] of [...ranked.slice(0, 4), ...ranked.slice(-4)]) console.log(`    ${k.padEnd(34)} ${whole.nCap.get(k)!.toString().padStart(3)} rows  ${(v * scale >= 0 ? "+" : "") + (v * scale).toFixed(1)}`);
    effectsBy.set(key, whole.cap);
  }
}

const per = (g: { r: number; b: number }) => (6 * g.r) / g.b;
console.log(`\nDeath overs (16–20): the day's best two ${per(deathEcon.best).toFixed(2)} an over, the rest ${per(deathEcon.rest).toFixed(2)}; one more death over from the best two is worth ${(per(deathEcon.rest) - per(deathEcon.best)).toFixed(2)} runs`);

// Do sides pick for matchups at all? The average chosen-less-available edge, and the room there was.
const mt = matchupTotals;
console.log(`\nMatchups over ${mt.overs} overs: the chosen bowler's edge against the available mean ${(mt.runs / mt.overs).toFixed(4)} runs and ${(mt.w / mt.overs).toFixed(5)} wickets an over (placebo hands ${(mt.placebo / mt.overs).toFixed(4)}); best-to-worst available ${(mt.spreadRuns / mt.overs).toFixed(3)} runs an over; ${(mt.overs / rows.matchupRuns!.length).toFixed(1)} overs counted an innings`);

// Do sides that move the order score more? Captains' effects on the two batting measures, side by side.
const oc = effectsBy.get("orderChange"), sb = effectsBy.get("scoredBeyond");
if (oc && sb) {
  const ks = [...oc.keys()].filter((k) => sb.has(k));
  console.log(`\nCaptains' order changes against runs beyond the batters: r ${corr(ks.map((k) => oc.get(k)!), ks.map((k) => sb.get(k)!)).toFixed(2)} over ${ks.length} captains`);
}
