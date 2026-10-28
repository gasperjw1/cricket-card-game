/**
 * Acceptance baselines for the Phase 0 pipeline.
 *
 * These numbers were measured independently (Python, 2026-10-27/28) during design and recorded
 * in docs/wc-draft-game-design.md. If a refactor changes them, either the refactor is wrong or
 * the convention changed on purpose and the spec must be updated alongside this file.
 *
 * Skipped when the archive has not been fetched (`npm run data:fetch`).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { archiveIsReady } from "../src/cricsheet/archive.js";
import { runBuild, type BuildResult } from "../src/pipeline/build.js";

const ready = archiveIsReady();
let result: BuildResult | null = null;
const build = (): BuildResult => (result ??= runBuild());

const edition = (id: string) => {
  const e = build().editions.find((x) => x.id === id);
  assert.ok(e, `edition ${id} missing`);
  return e;
};
const close = (actual: number, expected: number, tol: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: expected ${expected}±${tol}, got ${actual}`);

describe("Phase 0 baselines", { skip: !ready && "Cricsheet archive not fetched" }, () => {
  it("finds all ten men's T20 World Cup editions with the expected match counts", () => {
    const counts = Object.fromEntries(build().editions.map((e) => [e.id, e.environment.matches]));
    assert.deepEqual(counts, { 2007: 26, 2009: 27, 2010: 25, 2012: 25, 2014: 32, 2016: 27, 2021: 40, 2022: 39, 2024: 44, 2026: 49 });
  });

  it("reproduces the edition scoring environments", () => {
    close(edition("2026").environment.runsPerOver, 8.74, 0.02, "2026 RPO");
    close(edition("2024").environment.runsPerOver, 7.13, 0.02, "2024 RPO");
    close(edition("2024").environment.dotPct, 44.4, 0.2, "2024 dot %");
    close(edition("2026").environment.sixPct, 6.5, 0.1, "2026 six %");
    assert.equal(edition("2021").environment.chaseWinPct, 68, "2021 chase win %");
    assert.equal(edition("2024").environment.tossFieldPct, 84, "2024 toss→field %");
    // Natural first innings only (20 overs or all out); rain-shortened innings excluded.
    close(edition("2026").environment.firstInningsAvg, 180.2, 1, "2026 first-innings average");
    close(edition("2024").environment.firstInningsAvg, 134.9, 1, "2024 first-innings average");
  });

  it("records DRS reviews only from 2021 onward", () => {
    for (const id of ["2007", "2009", "2010", "2012", "2014", "2016"]) assert.equal(edition(id).environment.reviews.total, 0, `${id} reviews`);
    assert.equal(edition("2021").environment.reviews.total, 81);
    assert.equal(edition("2024").environment.reviews.total, 91);
  });

  it("reproduces the Dubai 2021 chase-uplift (dew) signal", () => {
    const dubai = build().venues.find((v) => v.id === "dubai");
    assert.ok(dubai);
    close(dubai.overall.chaseUplift, 2.2, 0.15, "Dubai chase uplift");
    assert.equal(dubai.overall.chaseWinPct, 92);
  });

  it("flags rain-reduced innings and keeps them out of population vectors", () => {
    // 2014 (Bangladesh) had three D/L finishes; 2026 had none (two nine-down innings are all-outs, not reductions).
    assert.ok((edition("2014").environment.reducedInnings ?? 0) >= 3, "2014 reduced innings");
    assert.equal(edition("2026").environment.reducedInnings, 0);
    const pv = edition("2026").environment.populationVectors.pp;
    assert.ok(pv);
    const sum = Object.values(pv).reduce((a, b) => a + b, 0);
    close(sum, 1, 0.002, "powerplay population vector sums to 1");
  });

  it("builds a stand-in squad with a default eleven for every edition Afghanistan played", () => {
    const r = build();
    for (const e of r.editions) {
      for (const change of e.slotChanges.filter((s) => s.action === "add")) {
        const squad = r.squads.find((s) => s.editionId === e.id && s.team === change.team);
        assert.ok(squad?.standIn, `${e.id} stand-in ${change.team} missing`);
        if (squad.source === "hand") continue; // no T20Is near the edition: squad is a hand-entry task
        assert.ok(squad.players.length >= 11, `${e.id} ${change.team} squad too small (${squad.players.length})`);
        assert.equal(squad.defaultXI.length, 11, `${e.id} ${change.team} default XI`);
        assert.ok(squad.defaultBowlingOrder.length >= 5, `${e.id} ${change.team} needs five bowlers`);
      }
    }
    // Only Namibia 2012 (first T20I 2019) should need a hand-made squad.
    assert.deepEqual(r.squads.filter((s) => s.source === "hand").map((s) => `${s.editionId} ${s.team}`), ["2012 Namibia"]);
  });

  it("attaches ODI career priors and splits form by opposition tier", () => {
    const r = build();
    const dhoni = r.playerEditions.find((p) => p.name === "MS Dhoni" && p.editionId === "2007");
    assert.ok(dhoni);
    assert.ok(dhoni.odiCareerToDate.summary.bat.runs > 2000, "Dhoni's ODI runs before the 2007 World Cup");
    const kohli = r.playerEditions.find((p) => p.name === "V Kohli" && p.editionId === "2024");
    assert.ok(kohli);
    const full = kohli.formByOpposition.full.summary.bat.balls;
    const assoc = kohli.formByOpposition.associate.summary.bat.balls;
    assert.equal(full + assoc, kohli.form.summary.bat.balls, "tier split partitions form balls");
    assert.ok(full > assoc, "India's form is mostly against full members");
    const pop = r.windowPopulation["2024"];
    assert.ok(pop && pop.batting.full.pp && pop.batting.associate.pp, "window population vectors by tier");
    const noT20OrOdi = r.playerEditions.filter((p) => p.editionId === "2007" && p.careerToDate.summary.matches === 0 && p.odiCareerToDate.summary.matches === 0);
    assert.ok(noT20OrOdi.length <= 12, `2007 players with no prior in either format: ${noT20OrOdi.length}`);
  });

  it("produces a sane team-strength timeline", () => {
    const t = build().teamStrength.teams;
    assert.ok((t["India"]?.current ?? 0) > (t["Namibia"]?.current ?? 0));
    assert.ok((t["India"]?.current ?? 0) > (t["Kenya"]?.current ?? 0));
    assert.ok((t["India"]?.matches ?? 0) > 200);
  });

  it("reproduces the bowler-usage norms", () => {
    const u = build().bowlingUsage.byEdition;
    const total = Object.values(u).reduce((n, e) => n + e.completeInnings, 0);
    assert.equal(total, 454, "complete 20-over innings");
    assert.equal(u["2007"]?.bowlersUsed.histogramPct["5"], 28);
    assert.equal(u["2014"]?.bowlersUsed.histogramPct["5"], 5);
    assert.equal(u["2026"]?.bowlersUsed.histogramPct["7"], 25);
  });

  it("reproduces batting-order deviation rising through the innings (2026)", () => {
    const d = build().lineupDeviation.byEdition["2026"];
    assert.ok(d?.pp && d.mid && d.death);
    assert.ok(d.pp.deviationPct < d.mid.deviationPct && d.mid.deviationPct <= d.death.deviationPct, JSON.stringify(d));
  });

  it("builds the expected squad and player universe", () => {
    const r = build();
    const real = r.squads.filter((s) => !s.standIn);
    assert.equal(real.length, 144, "real team-editions");
    assert.equal(r.playerEditions.filter((p) => !p.standIn).length, 1903, "real player-editions");
    assert.equal(new Set(r.playerEditions.filter((p) => !p.standIn).map((p) => p.personId)).size, 903, "people in real squads");
    assert.ok(r.people.every((p) => !p.teams.includes("Afghanistan")), "Afghanistan must be absent");
  });

  it("gets a known player-edition right (V Kohli, 2016)", () => {
    const row = build().playerEditions.find((r) => r.name === "V Kohli" && r.editionId === "2016");
    assert.ok(row);
    assert.equal(row.tournament.summary.bat.runs, 273);
    assert.equal(row.tournament.summary.bat.highScore, "89*");
    assert.equal(row.careerToDate.summary.matches, 37);
    assert.deepEqual(row.tournament.bat.positions, { "3": 5 });
  });

  it("treats full-member status as time-varying when counting associate upsets", () => {
    // Ireland were an associate in 2009 (beat Bangladesh) and a full member by 2024 (lost to Canada).
    assert.deepEqual(edition("2009").associateUpsets, { wins: 2, crossTierMatches: 9 });
    assert.deepEqual(edition("2024").associateUpsets, { wins: 2, crossTierMatches: 21 });
  });

  it("maps every World Cup venue and keeps stand-ins for every Afghanistan edition", () => {
    for (const e of build().editions) {
      if (e.afghanistan) assert.ok(e.standIn?.team, `${e.id} needs a stand-in`);
      else assert.equal(e.standIn, null, `${e.id} should have no stand-in`);
    }
  });
});
