import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FixtureResult, StageResult } from "../../wcdraft/src/engine/tournament.ts";
import type { InningsResult } from "../../wcdraft/src/engine/types.ts";
import { deriveDisplayName, splitShortName } from "../../wcdraft/src/util/names.ts";
import { storyFor, verdictFor } from "../src/game/gazette.ts";
import { familiar, fullName, setNames, surnameOf } from "../src/lib/names.ts";
import { datedStages, exitStageOf, inPlayOrder, sideProfile, tableTo, totalsKey, tournamentTotals } from "../src/game/stats.ts";

const phases = (over: Partial<Record<"pp" | "mid" | "death", number>> = {}) => ({
  pp: { runs: (over.pp ?? 8) * 6, balls: 36, wickets: 1 }, mid: { runs: (over.mid ?? 8) * 9, balls: 54, wickets: 2 }, death: { runs: (over.death ?? 8) * 5, balls: 30, wickets: 2 },
});

const innings = (team: string, index: 1 | 2, runs: number, wickets: number, extra: Partial<InningsResult> = {}): InningsResult => ({
  index, team, scheduledOvers: 20, runs, wickets, legalBalls: 120, extras: 5,
  batting: [{ id: "a", name: "RG Sharma", runs: 71, balls: 44, fours: 6, sixes: 4, out: true, dismissal: null, position: 1 }, { id: "b", name: "V Kohli", runs: 20, balls: 15, fours: 2, sixes: 0, out: false, dismissal: null, position: 3 }],
  bowling: [{ id: "c", name: "JJ Bumrah", overs: [0, 1, 2, 3], balls: 24, runs: 22, wickets: 4, maidens: 0, dots: 12, wides: 0, noBalls: 0 }],
  fallOfWickets: [], partnerships: [], extrasDetail: { wides: 3, noBalls: 1, byes: 1 }, phaseRuns: phases(), outcomes: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 }, byeBalls: 0, target: index === 2 ? 181 : null,
  ...extra,
} as unknown as InningsResult);

const fixture = (over: Partial<FixtureResult>): FixtureResult => ({
  stageId: "s1", stageLabel: "Group stage", group: "A", teams: ["India", "Australia"], venueId: null, date: "2024-06-01", realId: null,
  winner: "India", scores: ["180/5", "150/9"], margin: { runs: 30 }, tieBreak: null, rain: null, tossWinner: "India", tossDecision: "bat",
  innings: [innings("India", 1, 180, 5), innings("Australia", 2, 150, 9)], potm: null, ...over,
} as FixtureResult);

const ctx = { me: "India", seed: "s", stageLabel: "Group stage", city: "Mumbai", last: false, final: false, knockout: false, record: { won: 1, lost: 0 } };

describe("display names", () => {
  it("uses the first given name and Cricsheet's surname", () => {
    assert.equal(deriveDisplayName("RG Sharma", "Rohit Gurunath Sharma"), "Rohit Sharma");
    assert.equal(deriveDisplayName("AB de Villiers", "Abraham Benjamin de Villiers"), "Abraham de Villiers");
    assert.equal(deriveDisplayName("Yuvraj Singh", "Yuvraj Singh"), "Yuvraj Singh");
  });

  it("keeps the short name when the legal name does not fit the initials", () => {
    assert.equal(deriveDisplayName("KD Karthik", "Dinesh Karthik"), "KD Karthik");
    assert.equal(deriveDisplayName("RG Sharma", ""), "RG Sharma");
  });

  it("splits initials from surnames of more than one word", () => {
    assert.deepEqual(splitShortName("AB de Villiers"), { initials: "AB", surname: "de Villiers" });
    assert.equal(surnameOf("V Kohli"), "Kohli");
    assert.equal(surnameOf("Shakib Al Hasan"), "Shakib Al Hasan");
  });

  it("shows the name list and falls back to the short name", () => {
    setNames({ a: "Rohit Sharma" });
    assert.equal(fullName("a", "RG Sharma"), "Rohit Sharma");
    assert.equal(fullName("x", "V Kohli"), "V Kohli");
    setNames({});
  });
});

describe("gazette copy", () => {
  it("reports what the scorecard says", () => {
    const s = storyFor(fixture({}), ctx);
    assert.match(s.standfirst, /India won by 30 runs in Mumbai/);
    assert.match(s.paragraphs[0]!, /India chose to bat and made 180 for 5/);
    assert.match(s.paragraphs[1]!, /Chasing 181, Australia made 150 for 9/);
  });

  it("does not put the wrong side in the headline", () => {
    const lost = storyFor(fixture({ winner: "Australia", margin: { runs: 60 } }), ctx);
    assert.match(lost.headline, /India|Australia/);
    assert.doesNotMatch(lost.headline, /India (crush|beat|hold)/);
    const rained = storyFor(fixture({ winner: null, margin: null }), ctx);
    assert.match(rained.headline, /Rain|Washed/);
    assert.equal(storyFor(fixture({}), { ...ctx, final: true }).headline.includes("India"), true);
  });

  it("handles a washout, a last-ball win and a tied match on the facts", () => {
    const washed = storyFor(fixture({ winner: null, margin: null, innings: [innings("India", 1, 27, 3), innings("Australia", 2, 0, 0, { legalBalls: 0, target: null })] }), ctx);
    assert.doesNotMatch(washed.paragraphs.join(" "), /Chasing/);
    assert.match(washed.standfirst, /Rain stopped play in Mumbai after India had made 27 for 3/);
    const lastBall = storyFor(fixture({ margin: { wickets: 3, ballsLeft: 0 } }), ctx);
    assert.match(lastBall.standfirst, /by 3 wickets off the last ball/);
    const tied = storyFor(fixture({ tieBreak: { winner: "India", method: "super-over" }, innings: [innings("India", 1, 158, 5), innings("Australia", 2, 158, 9)] }), ctx);
    assert.match(tied.paragraphs.join(" "), /scores finished level on 158/);
    const parTie = storyFor(fixture({ tieBreak: { winner: "India", method: "super-over" }, innings: [innings("India", 1, 158, 5), innings("Australia", 2, 110, 2)] }), ctx);
    assert.doesNotMatch(parTie.paragraphs.join(" "), /level on 158/);
  });

  it("counts a collapse from the score at the wicket before it", () => {
    const fall = [100, 105, 110, 115, 125].map((runs, i) => ({ runs, over: 10, ball: i, batter: "x" }));
    const s = storyFor(fixture({ winner: "Australia", margin: { runs: 20 }, innings: [innings("India", 1, 160, 7, { fallOfWickets: fall }), innings("Australia", 2, 180, 3)] }), ctx);
    assert.match(s.paragraphs[0]!, /4 wickets went for 25/);
  });

  it("names both batters in a stand", () => {
    const stand = { batters: ["a", "b"], runs: 62, balls: 40, wicket: 1 } as never;
    const s = storyFor(fixture({ innings: [innings("India", 1, 180, 5, { partnerships: [stand] }), innings("Australia", 2, 150, 9)] }), ctx);
    assert.match(s.paragraphs[0]!, /stand of 62 between Sharma and Kohli/);
  });

  it("calls a player what fans do, not what Cricsheet does", () => {
    setNames({ h: "Wanindu Hasaranga", k: "Virat Kohli" });
    assert.equal(familiar("h", "PWH de Silva"), "Hasaranga");
    assert.equal(familiar("k", "V Kohli"), "Kohli");
    assert.equal(familiar("x", "AB de Villiers"), "de Villiers");
    setNames({});
  });

  it("reprints the same paper from the same seed", () => {
    assert.deepEqual(storyFor(fixture({}), ctx), storyFor(fixture({}), ctx));
  });

  it("grades the run by how far it went", () => {
    const run = { won: 7, lost: 1, played: 8, exit: "Final", champion: false, unbeaten: false };
    assert.equal(verdictFor({ ...run, won: 8, lost: 0, champion: true, unbeaten: true }, "India", 4, 3).grade, "A+");
    assert.equal(verdictFor(run, "India", 4, 3).grade, "B+");
    assert.equal(verdictFor({ ...run, won: 0, lost: 3, exit: "Group stage" }, "India", 4, 0).grade, "E");
  });
});

describe("running numbers", () => {
  it("builds a table only from the matches played so far, even from a copied fixture", () => {
    const first = fixture({});
    const second = fixture({ teams: ["India", "Pakistan"], winner: "Pakistan" });
    const third = fixture({ teams: ["Australia", "Pakistan"], winner: "Australia" });
    const stage = { fixtures: [first, second, third] } as unknown as StageResult;
    const rows = tableTo(stage, { ...second });
    assert.equal(rows.find((r) => r.team === "India")!.played, 2);
    assert.equal(rows.find((r) => r.team === "Australia")!.played, 1);
    assert.equal(rows.find((r) => r.team === "Pakistan")!.points, 2);
  });

  it("keeps a drafted player apart from his real side's line, and plays fixtures in date order", () => {
    const shared = fixture({ innings: [innings("India", 1, 180, 5), innings("Australia", 2, 150, 9)], potm: null });
    const totals = tournamentTotals([shared]);
    assert.equal(totals.get(totalsKey("India", "a"))!.runs, 71);
    assert.equal(totals.get(totalsKey("Australia", "a"))!.runs, 71, "two separate lines, not 142");
    const order = inPlayOrder([{ date: "2024-06-03" }, { date: null }, { date: "2024-06-01" }]);
    assert.deepEqual(order.map((f) => f.date), ["2024-06-01", "2024-06-03", null]);
    const stage = { fixtures: [fixture({ teams: ["India", "Pakistan"], date: "2024-06-05" }), fixture({ teams: ["India", "Australia"], date: "2024-06-01" })] } as unknown as StageResult;
    assert.equal(tableTo(stage, stage.fixtures[1]!).find((r) => r.team === "India")!.played, 1, "a later match stored first is not counted yet");
  });

  it("dates undated fixtures from their stage, or back from the last day", () => {
    const stages = [
      { id: "g", fixtures: [fixture({ date: "2024-06-01" }), fixture({ date: null }), fixture({ date: "2024-06-09" })] },
      { id: "s", fixtures: [fixture({ date: null })] },
      { id: "f", fixtures: [fixture({ date: null })] },
    ] as unknown as StageResult[];
    const dated = datedStages(stages, "2024-06-29");
    assert.ok(dated[0]!.fixtures.every((f) => f.date));
    assert.equal(dated[1]!.fixtures[0]!.date, "2024-06-26");
    assert.equal(dated[2]!.fixtures[0]!.date, "2024-06-29");
  });

  it("never gives a side two matches on one day", () => {
    const stage = { id: "g", fixtures: [
      fixture({ teams: ["India", "Pakistan"], date: "2024-06-01" }), fixture({ teams: ["England", "Oman"], date: "2024-06-02" }), fixture({ teams: ["Nepal", "Oman"], date: "2024-06-03" }),
      fixture({ teams: ["India", "Oman"], date: null }), fixture({ teams: ["India", "England"], date: null }), fixture({ teams: ["India", "Nepal"], date: null }), fixture({ teams: ["India", "Canada"], date: null }),
    ] } as unknown as StageResult;
    const dates = datedStages([stage], "2024-06-29")[0]!.fixtures.filter((f) => f.teams.includes("India")).map((f) => f.date);
    assert.equal(new Set(dates).size, dates.length, dates.join());
  });

  it("finds a run's last stage even when it ended on a reserve day", () => {
    const stages = [{ id: "g" }, { id: "semi" }, { id: "final" }] as unknown as StageResult[];
    assert.equal(exitStageOf(stages, [{ stageId: "g" }, { stageId: "semi-reserve" }]), 1);
  });

  it("reads conceding quickly at the death as a weakness", () => {
    const leaky = fixture({ innings: [innings("India", 1, 150, 5), innings("Australia", 2, 200, 3, { phaseRuns: phases({ death: 14 }) })] });
    const others = fixture({ teams: ["Pakistan", "England"], innings: [innings("Pakistan", 1, 150, 5), innings("England", 2, 150, 5)] });
    const profile = sideProfile([leaky, others, others], "India");
    assert.deepEqual(profile.find((p) => /death/.test(p.label)), { label: "Thin at the death", good: false });
  });
});
