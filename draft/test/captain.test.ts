import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HOLD_BASE, captainChoices, captainFor, captaincyOf, holdShare } from "../src/game/captain.ts";
import type { PoolPlayer } from "../src/game/types.ts";

const p = (id: string) => ({ id, name: id }) as PoolPlayer;
const tenure = (personId: string, matches: number, firstYear = 2020, collapseHold?: number) => ({ personId, name: personId, team: "T", firstYear, lastYear: firstYear + 1, matches, won: 0, z: 0, collapseHold });

describe("captains", () => {
  const c = captaincyOf(
    [tenure("rohit", 50, 2022, 0.04), tenure("hardik", 16, 2023, -0.02)],
    // A rated tenure is a leader too; a stand-in is a leader only.
    [tenure("rohit", 50, 2022), tenure("bumrah", 2, 2022)],
  );

  it("tags everyone who has led his country, counting a tenure once", () => {
    assert.equal(c.matches.get("rohit"), 50);
    assert.equal(c.matches.get("bumrah"), 2);
    assert.equal(c.matches.has("kohli"), false);
  });

  it("chooses among the eleven's captains, or anyone when none has captained", () => {
    const xi = [p("kohli"), p("hardik"), p("rohit"), null];
    assert.deepEqual(captainChoices(xi, c).map((x) => x.id), ["hardik", "rohit"]);
    assert.equal(captainFor(xi, null, c), "rohit", "the most experienced until the user picks");
    assert.equal(captainFor(xi, "hardik", c), "hardik", "the user's pick among captains stands");
    assert.equal(captainFor(xi, "kohli", c), "rohit", "a non-captain cannot lead when there are captains");
    const none = [p("kohli"), p("pant")];
    assert.deepEqual(captainChoices(none, c).map((x) => x.id), ["kohli", "pant"]);
    assert.equal(captainFor(none, null, c), null, "nobody has captained: the user must mark one");
    assert.equal(captainFor(none, "pant", c), "pant");
  });

  it("plays a rated captain's collapse habit and the average for anyone else", () => {
    assert.equal(holdShare("rohit", c), HOLD_BASE + 0.04);
    assert.equal(holdShare("bumrah", c), HOLD_BASE);
    assert.equal(holdShare("pant", c), HOLD_BASE);
  });
});
