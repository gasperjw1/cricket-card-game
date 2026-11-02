// Associates against full members, team by team (2026-11-02): which associate sides the sim gets
// wrong, and whether World Cup newcomers differ from established associates. For each associate
// side at an edition: its full-member fixtures, real wins against the sim's win share, its batting
// and its bowling (runs an over, balls per wicket) real against sim, its side Elo, and how many
// earlier editions it played. Real balls are overs started × 6 from the squad records, as in
// associates.mts (about 1% off legal balls).
//   npx tsx scripts/research/associates-newcomers.mts [editions=2014,2016,2021,2022,2024,2026] [sims=30]
import { loadEdition, matchEnvironment, teamFromMatch, type EditionData, type SquadMatchOut } from "../../src/engine/load.ts";
import { simulateMatch } from "../../src/engine/match.ts";
import { fullMembersAt } from "../../../draft/src/game/facts.ts";

const ids = (process.argv[2] ?? "2014,2016,2021,2022,2024,2026").split(",");
const sims = Number(process.argv[3] ?? 30);
const ALL_EDITIONS = ["2007", "2009", "2010", "2012", "2014", "2016", "2021", "2022", "2024", "2026"];

type Side = { runs: number; balls: number; wkts: number };
const z = (): Side => ({ runs: 0, balls: 0, wkts: 0 });
type Row = { team: string; ed: string; prior: number; elo: number | null; n: number; realWins: number; simWins: number; bat: { real: Side; sim: Side }; bowl: { real: Side; sim: Side } };

// Earlier editions each side played (not as a stand-in).
const played = new Map<string, Set<string>>();
for (const ed of ALL_EDITIONS) for (const s of loadEdition(ed).squads.values()) if (!s.standIn) (played.get(s.team) ?? played.set(s.team, new Set()).get(s.team)!).add(ed);

const rows: Row[] = [];
for (const ed of ids) {
  const data: EditionData = loadEdition(ed);
  const full = fullMembersAt(ed);
  const seen = new Map<string, { team: string; match: SquadMatchOut }[]>();
  for (const squad of data.squads.values()) { if (squad.standIn) continue; for (const m of squad.matches) (seen.get(m.id) ?? seen.set(m.id, []).get(m.id)!).push({ team: squad.team, match: m }); }
  const byTeam = new Map<string, Row>();
  for (const [, sides] of seen) {
    if (sides.length !== 2) continue;
    const [x, y] = sides as [typeof sides[0], typeof sides[0]];
    if (x.match.xi.length !== 11 || y.match.xi.length !== 11 || full.has(x.team) === full.has(y.team) || !x.match.winner) continue;
    const assoc = full.has(x.team) ? y.team : x.team;
    const a = teamFromMatch(data, x.team, x.match), b = teamFromMatch(data, y.team, y.match);
    if (a.players.length < 11 || b.players.length < 11) continue;
    const prior = [...(played.get(assoc) ?? [])].filter((e) => e < ed).length;
    const assocSide = assoc === x.team ? a : b;
    const row = byTeam.get(assoc) ?? byTeam.set(assoc, { team: assoc, ed, prior, elo: assocSide.players.find((p) => p.teamElo != null)?.teamElo ?? null, n: 0, realWins: 0, simWins: 0, bat: { real: z(), sim: z() }, bowl: { real: z(), sim: z() } }).get(assoc)!;
    const env = matchEnvironment(data, x.match.venueId || null, 20);
    let w = 0;
    for (let s = 1; s <= sims; s += 1) {
      const r = simulateMatch(a, b, env, data.situation, { seed: `assoc-${ed}-${x.match.id}-${s}`, battingFirst: x.match.battedFirst ? x.team : y.team });
      if (r.winner === assoc) w += 1;
      for (const inn of r.innings) { const side = inn.team === assoc ? row.bat.sim : row.bowl.sim; side.runs += inn.runs; side.balls += inn.legalBalls; side.wkts += inn.wickets; }
    }
    for (const [team, m, bowledBy] of [[x.team, x.match, y.match], [y.team, y.match, x.match]] as const) {
      const side = team === assoc ? row.bat.real : row.bowl.real;
      const balls = bowledBy.bowlerByOver.length * 6;
      if (m.total !== null && balls > 0) { side.runs += m.total; side.balls += balls; side.wkts += m.wickets ?? 0; }
    }
    row.n += 1; row.simWins += w / sims; if (x.match.winner === assoc) row.realWins += 1;
  }
  rows.push(...byTeam.values());
}

const rpo = (s: Side) => (s.balls ? (6 * s.runs) / s.balls : NaN);
const bpw = (s: Side) => (s.wkts ? s.balls / s.wkts : NaN);
const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "–");
console.log("team edition | prior WCs | Elo | v FM | wins real / sim | associate bats: rpo real/sim, bpw real/sim | FM bats v them: rpo real/sim, bpw real/sim");
for (const r of rows.sort((a, b) => a.ed.localeCompare(b.ed) || a.team.localeCompare(b.team))) {
  console.log(`${(r.team + " " + r.ed).padEnd(22)} | ${r.prior} | ${r.elo === null ? "–" : r.elo.toFixed(0)} | ${r.n} | ${r.realWins} / ${f(r.simWins, 1)} | ${f(rpo(r.bat.real))}/${f(rpo(r.bat.sim))}, ${f(bpw(r.bat.real), 1)}/${f(bpw(r.bat.sim), 1)} | ${f(rpo(r.bowl.real))}/${f(rpo(r.bowl.sim))}, ${f(bpw(r.bowl.real), 1)}/${f(bpw(r.bowl.sim), 1)}`);
}
const group = (label: string, pick: (r: Row) => boolean) => {
  const g = rows.filter(pick);
  const add = (k: "bat" | "bowl", w: "real" | "sim") => g.reduce((a, r) => ({ runs: a.runs + r[k][w].runs, balls: a.balls + r[k][w].balls, wkts: a.wkts + r[k][w].wkts }), z());
  const n = g.reduce((a, r) => a + r.n, 0), real = g.reduce((a, r) => a + r.realWins, 0), sim = g.reduce((a, r) => a + r.simWins, 0);
  console.log(`${label.padEnd(44)} ${String(n).padStart(3)} fixtures | wins real ${real} (${f((100 * real) / Math.max(1, n), 1)}%) sim ${f(sim, 1)} (${f((100 * sim) / Math.max(1, n), 1)}%) | assoc bat rpo ${f(rpo(add("bat", "real")))}/${f(rpo(add("bat", "sim")))} bpw ${f(bpw(add("bat", "real")), 1)}/${f(bpw(add("bat", "sim")), 1)} | FM bat rpo ${f(rpo(add("bowl", "real")))}/${f(rpo(add("bowl", "sim")))} bpw ${f(bpw(add("bowl", "real")), 1)}/${f(bpw(add("bowl", "sim")), 1)}`);
};
console.log("");
const hold = (r: Row) => r.ed >= "2024";
group("fit, established (played an earlier edition)", (r) => !hold(r) && r.prior > 0);
group("fit, newcomers (first edition)", (r) => !hold(r) && r.prior === 0);
group("hold-out, established", (r) => hold(r) && r.prior > 0);
group("hold-out, newcomers", (r) => hold(r) && r.prior === 0);
group("all, Elo below 1450", (r) => (r.elo ?? 0) < 1450);
group("all, Elo 1450 and up", (r) => (r.elo ?? 0) >= 1450);
