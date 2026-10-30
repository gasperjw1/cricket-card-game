/**
 * Tournament layer (design spec §7.6): progression compiles for every edition, fixtures and
 * standings are consistent, the stand-in takes Afghanistan's slot and venues, the identity team
 * is tracked, and the rarity measurement runs. Skipped until the engine data is built.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { paths } from "../src/util/io.js";
import { engineReady, loadEdition, teamFromDefault } from "../src/engine/load.js";
import { draftPool, measureRarity, randomDraft } from "../src/engine/rarity.js";
import { Rng } from "../src/engine/rng.js";
import { simulateTournament } from "../src/engine/tournament.js";

const EXPECTED_TEAMS: Record<string, number> = { "2007": 12, "2009": 12, "2010": 12, "2012": 12, "2014": 16, "2016": 16, "2021": 16, "2022": 16, "2024": 20, "2026": 20 };

describe("tournament", { skip: !engineReady() && "engine data not built" }, () => {
  it("compiles every edition's progression with the right team count, squads for all, and the stand-in in Afghanistan's slot", () => {
    for (const [ed, n] of Object.entries(EXPECTED_TEAMS)) {
      const d = loadEdition(ed);
      const p = d.progression;
      assert.equal(p.teams.length, n, `${ed}: ${p.teams.length} teams`);
      for (const t of p.teams) assert.ok(d.squads.has(t), `${ed}: no squad for ${t}`);
      assert.ok(!p.teams.includes("Afghanistan"), `${ed}: Afghanistan still listed`);
      if (p.standIn) assert.ok(p.teams.includes(p.standIn), `${ed}: stand-in ${p.standIn} missing`);
      const last = p.stages[p.stages.length - 1]!;
      assert.equal(last.id, "final");
    }
    const p2024 = loadEdition("2024").progression;
    const group = p2024.stages[0]!;
    assert.equal(group.type, "groups");
    if (group.type === "groups") {
      assert.ok(group.groups["C"]!.includes("Zimbabwe"), "Zimbabwe takes Afghanistan's group C slot in 2024");
      assert.equal(group.advance.mode, "seedSlots");
    }
    const p2021 = loadEdition("2021").progression;
    const s12 = p2021.stages[1]!;
    if (s12.type === "groups") assert.ok(s12.groups["2"]!.includes("Scotland"), "Scotland moves up to Afghanistan's Super 12 slot in 2021");
  });

  it("simulates 2024 end to end with consistent fixtures, standings and progression", () => {
    const data = loadEdition("2024");
    const xi = teamFromDefault(data, "India");
    const a = simulateTournament(data, data.progression, { seed: "t-2024", identity: { team: "India", xi } });
    const b = simulateTournament(data, data.progression, { seed: "t-2024", identity: { team: "India", xi } });
    assert.deepEqual(a, b, "deterministic per seed");
    const group = a.stages[0]!;
    assert.ok(group.groups);
    for (const [g, rows] of Object.entries(group.groups!)) {
      assert.equal(rows.length, 5, `group ${g} size`);
      for (const r of rows) assert.equal(r.played, 4, `${r.team} played ${r.played}`);
      const points = rows.reduce((s, r) => s + r.points, 0);
      assert.equal(points, 2 * 10, `group ${g} points`);
      for (let i = 1; i < rows.length; i += 1) assert.ok(rows[i - 1]!.points >= rows[i]!.points, "sorted by points");
    }
    assert.equal(group.fixtures.length, 40);
    const super8 = a.stages[1]!;
    assert.equal(super8.fixtures.length, 12);
    for (const rows of Object.values(super8.groups!)) assert.equal(rows.length, 4);
    assert.equal(a.stages[2]!.fixtures.length, 2);
    assert.equal(a.stages[3]!.fixtures.length, 1);
    assert.equal(a.champion, a.stages[3]!.fixtures[0]!.winner);
    const id = a.identity!;
    assert.ok(id.played >= 4 && id.won + id.lost === id.played);
    assert.equal(id.unbeaten, id.champion && id.lost === 0);
    // The exit names a stage the side actually played in (a group-stage exit must not read "Super 8").
    for (let i = 0; i < 12; i += 1) {
      const r = simulateTournament(data, data.progression, { seed: `exit-${i}`, identity: { team: "Netherlands", xi: teamFromDefault(data, "Netherlands") } });
      const exit = r.identity!.exit;
      if (exit === "champion") continue;
      const stage = r.stages.find((s) => s.label === exit)!;
      assert.ok(stage, `exit "${exit}" is a stage`);
      assert.ok(stage.fixtures.some((f) => f.teams.includes("Netherlands")), `Netherlands played in the ${exit} they went out in`);
    }
    // The stand-in plays Afghanistan's real fixtures at their venues.
    const zimUga = group.fixtures.find((f) => f.teams.includes("Zimbabwe") && f.teams.includes("Uganda"))!;
    const afg = data.afghanistanFixtures.find((f) => f.opponent === "Uganda")!;
    assert.equal(zimUga.venueId, afg.venueId);
    // Real pairings keep their real venue.
    const indPak = group.fixtures.find((f) => f.teams.includes("India") && f.teams.includes("Pakistan"))!;
    assert.equal(indPak.venueId, "new-york");
  });

  it("runs every other edition end to end", () => {
    for (const ed of Object.keys(EXPECTED_TEAMS)) {
      const data = loadEdition(ed);
      const r = simulateTournament(data, data.progression, { seed: `all-${ed}` });
      assert.ok(r.champion, `${ed}: no champion`);
      assert.ok(data.progression.teams.includes(r.champion!), `${ed}: champion ${r.champion} not in the field`);
      const fixtures = r.stages.flatMap((s) => s.fixtures);
      for (const f of fixtures) assert.ok(f.teams[0] !== f.teams[1] && !/^[A-Z]\d$|^W\d$|#/.test(f.teams[0]) && !/^[A-Z]\d$|^W\d$|#/.test(f.teams[1]), `${ed}: unresolved fixture ${f.teams.join(" v ")}`);
    }
  });

  it("derives coach philosophy and captaincy tables that cover the World Cup field", () => {
    const coaches = JSON.parse(readFileSync(resolve(paths.out, "coaches.json"), "utf8")) as { coaches: { team: string; worldCups: string[]; tags: string[]; intent: Record<string, number> }[] };
    assert.ok(coaches.coaches.length >= 80, `${coaches.coaches.length} coaches with style data`);
    for (const c of coaches.coaches) for (const v of Object.values(c.intent)) assert.ok(Math.abs(v) <= 1.5);
    const withCups = coaches.coaches.filter((c) => c.worldCups.length);
    assert.ok(withCups.length >= 60, `${withCups.length} coaches tied to World Cups`);
    const captaincy = JSON.parse(readFileSync(resolve(paths.out, "captaincy.json"), "utf8")) as { captains: { name: string; z: number; matches: number }[]; unmatched: { reason: string }[] };
    assert.ok(captaincy.captains.length >= 100);
    assert.ok(captaincy.captains.some((c) => c.name === "MS Dhoni") && captaincy.captains.some((c) => c.name === "EJG Morgan"));
    assert.equal(captaincy.unmatched.filter((u) => u.reason === "excluded-source").length, 80, "Cricinfo-sourced rows stay excluded until decided");
    // Every 2024 full-member side has a coach profile; most have a captain in the squad.
    const data = loadEdition("2024");
    for (const team of ["India", "Australia", "England", "South Africa", "Pakistan", "New Zealand", "West Indies"]) assert.ok(data.profiles.get(team)?.coach, `${team} 2024 coach`);
    assert.ok([...data.profiles.values()].filter((p) => p.captain).length >= 10);
  });

  it("drafts legal random elevens and measures rarity", () => {
    const data = loadEdition("2016");
    const pool = draftPool(data);
    assert.ok(pool.length > 150);
    for (let i = 0; i < 20; i += 1) {
      const xi = randomDraft(pool, new Rng(i));
      assert.equal(new Set(xi.players.map((p) => p.id)).size, 11);
      assert.ok(xi.players.filter((p) => p.canBowl).length >= 5, `draft ${i} has ${xi.players.filter((p) => p.canBowl).length} bowlers`);
    }
    const s = measureRarity(data, { sims: 12, realSims: 6 });
    assert.equal(s.runs, 12);
    assert.ok(s.unbeatenPct >= 0 && s.unbeatenPct <= 100 && s.championPct >= s.unbeatenPct);
    assert.equal(s.byDecile.length, 10);
  });
});
