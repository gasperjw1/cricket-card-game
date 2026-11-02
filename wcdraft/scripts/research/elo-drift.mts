// Associate Elo drift (2026-11-02): does associate team Elo rise over the years without associates
// beating full members any more often? Every men's T20I between an associate and a full member,
// by year: the associate's pre-match Elo (connectivity-regularised, as the ratings read it), the
// win share Elo expects for it, and the share it really won. Expected above real = the associate
// circuit is rated too high against full members.
//   npx tsx scripts/research/elo-drift.mts [fromYear=2010]
import { ARCHIVES, loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { normaliseMatch } from "../../src/cricsheet/match.ts";
import { loadConfig } from "../../src/config.ts";
import { TeamStrengthAnalysis } from "../../src/analysis/team-strength.ts";

const fromYear = Number(process.argv[2] ?? 2010);
const config = loadConfig();
const strength = new TeamStrengthAnalysis(config.isFullMember);
type Y = { n: number; elo: number; fmElo: number; expected: number; won: number; aa: number; aaElo: number };
const byYear = new Map<number, Y>();
const index = loadIndex(ARCHIVES.t20).filter((e) => e.gender === "male").sort((a, b) => a.date.localeCompare(b.date));
for (const e of index) {
  const m = normaliseMatch(readMatch(e.file), e.id);
  const year = +m.date.slice(0, 4);
  const [a, b] = m.teams;
  if (a && b && year >= fromYear) {
    const fa = config.isFullMember(a, year), fb = config.isFullMember(b, year);
    const y = byYear.get(year) ?? byYear.set(year, { n: 0, elo: 0, fmElo: 0, expected: 0, won: 0, aa: 0, aaElo: 0 }).get(year)!;
    if (!fa && !fb) { y.aa += 2; y.aaElo += strength.ratingOf(a, m.date) + strength.ratingOf(b, m.date); }
    const winner = m.winner ?? m.tieWinner;
    if (fa !== fb && winner) {
      const assoc = fa ? b : a, fm = fa ? a : b;
      const ra = strength.ratingOf(assoc, m.date), rf = strength.ratingOf(fm, m.date);
      y.n += 1; y.elo += ra; y.fmElo += rf; y.expected += 1 / (1 + 10 ** ((rf - ra) / 400)); if (winner === assoc) y.won += 1;
    }
  }
  strength.add(m);
}
console.log("year | associate v full-member T20Is | associate Elo / full member Elo | Elo-expected associate wins | real | associates' mean Elo in games among themselves");
let tn = 0, te = 0, tw = 0;
for (const [year, y] of [...byYear.entries()].sort((p, q) => p[0] - q[0])) {
  if (!y.n) { console.log(`${year} | 0 | – | – | – | ${y.aa ? (y.aaElo / y.aa).toFixed(0) : "–"}`); continue; }
  console.log(`${year} | ${String(y.n).padStart(3)} | ${(y.elo / y.n).toFixed(0)} / ${(y.fmElo / y.n).toFixed(0)} | ${(100 * y.expected / y.n).toFixed(1)}% | ${(100 * y.won / y.n).toFixed(1)}% (${y.won}) | ${y.aa ? (y.aaElo / y.aa).toFixed(0) : "–"}`);
  tn += y.n; te += y.expected; tw += y.won;
}
console.log(`all | ${tn} | expected ${(100 * te / tn).toFixed(1)}% | real ${(100 * tw / tn).toFixed(1)}%`);
