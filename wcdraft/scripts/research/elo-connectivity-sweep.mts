// Associate Elo correction sweep (2026-11-02). Plain Elo underneath, as now; only the rating read
// out changes. Two forms:
//   cap=<C>  the current rule with a different cap: excess above C kept in proportion to the share
//            of the last 20 matches against full members (today C = 1500)
//   iso=<D>  raw minus D × the share of the last 20 matches NOT against full members (a side that
//            only meets its own circuit reads D lower; one that always meets full members, as read)
// For each: on matches before 2024, associate-v-full-member T20Is expected v real associate win
// share and log loss, and log loss over every decided T20I (the guard: the correction must not
// hurt Elo elsewhere); then 2024–26 associate-v-full-member expected v real (includes the World
// Cup hold-out, so a check, not a fit).
//   npx tsx scripts/research/elo-connectivity-sweep.mts cap=1500,cap=1400,iso=150 ...
import { ARCHIVES, loadIndex, readMatch } from "../../src/cricsheet/archive.ts";
import { normaliseMatch } from "../../src/cricsheet/match.ts";
import { loadConfig } from "../../src/config.ts";
import { ELO, TeamStrengthAnalysis } from "../../src/analysis/team-strength.ts";

const variants = (process.argv[2] ?? "cap=1500").split(",").map((s) => { const [k, v] = s.split("="); return { kind: k as "cap" | "iso", value: Number(v), label: s }; });
const config = loadConfig();
const index = loadIndex(ARCHIVES.t20).filter((e) => e.gender === "male").sort((a, b) => a.date.localeCompare(b.date));
const matches = index.map((e) => normaliseMatch(readMatch(e.file), e.id));

for (const v of variants) {
  const strength = new TeamStrengthAnalysis(config.isFullMember);
  const recent = (strength as unknown as { recentOpposition: Map<string, boolean[]> }).recentOpposition;
  const read = (team: string, date: string) => {
    const raw = strength.rawRatingOf(team, date);
    const list = recent.get(team);
    const share = list && list.length ? list.filter(Boolean).length / list.length : 0;
    if (v.kind === "iso") return raw - v.value * (1 - share);
    if (!list || !list.length || raw <= v.value) return raw;
    return v.value + (raw - v.value) * share;
  };
  const acc = { pre: { n: 0, e: 0, w: 0, ll: 0 }, all: { n: 0, ll: 0 }, late: { n: 0, e: 0, w: 0 } };
  for (const m of matches) {
    const year = +m.date.slice(0, 4);
    const [a, b] = m.teams;
    const winner = m.winner ?? m.tieWinner;
    if (a && b && winner && year >= 2010) {
      const ra = read(a, m.date), rb = read(b, m.date);
      const pa = 1 / (1 + 10 ** ((rb - ra) / 400));
      const ll = -Math.log(Math.max(1e-6, winner === a ? pa : 1 - pa));
      if (year < 2024) { acc.all.n += 1; acc.all.ll += ll; }
      const fa = config.isFullMember(a, year), fb = config.isFullMember(b, year);
      if (fa !== fb) {
        const assoc = fa ? b : a, pAssoc = assoc === a ? pa : 1 - pa, won = winner === assoc ? 1 : 0;
        if (year < 2024) { acc.pre.n += 1; acc.pre.e += pAssoc; acc.pre.w += won; acc.pre.ll += ll; }
        else { acc.late.n += 1; acc.late.e += pAssoc; acc.late.w += won; }
      }
    }
    strength.add(m);
  }
  const pct = (x: number, n: number) => `${((100 * x) / Math.max(1, n)).toFixed(1)}%`;
  console.log(`${v.label.padEnd(10)} | pre-2024 cross-tier ${acc.pre.n}: expected ${pct(acc.pre.e, acc.pre.n)} real ${pct(acc.pre.w, acc.pre.n)} log loss ${(acc.pre.ll / acc.pre.n).toFixed(4)} | all pre-2024 ${acc.all.n}: log loss ${(acc.all.ll / acc.all.n).toFixed(4)} | 2024–26 cross-tier ${acc.late.n}: expected ${pct(acc.late.e, acc.late.n)} real ${pct(acc.late.w, acc.late.n)}`);
}
void ELO;
