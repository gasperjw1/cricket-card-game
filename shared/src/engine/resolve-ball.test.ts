import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type {
  BatsmanCard,
  BowlerCard,
  SituationCard,
} from "../types/cards.js";
import { resolveBall } from "./resolve-ball.js";

// ─── Test fixtures ───
function makeBatter(overrides: Partial<BatsmanCard> = {}): BatsmanCard {
  return {
    id: "test-bat",
    kind: "batsman",
    name: "Test Batter",
    nation: "India",
    tier: "Gold",
    description: "",
    strengths: [
      {
        zone: { line: "Off stump", length: "Full" },
        outcome: { type: "runs", value: 6, shot: "cover drive" },
      },
    ],
    neutrals: [
      {
        zone: { line: "Middle stump", length: "Good length" },
        outcome: { type: "runs", value: 2, shot: "push" },
      },
    ],
    weaknesses: [
      {
        zone: { line: "5th stump", length: "Full" },
        outcome: { type: "wicket", mode: "edge to keeper" },
      },
    ],
    resistances: [],
    ...overrides,
  };
}

function makeBowler(overrides: Partial<BowlerCard> = {}): BowlerCard {
  return {
    id: "test-bowl",
    kind: "bowler",
    name: "Test Bowler",
    nation: "India",
    tier: "Gold",
    description: "",
    delivery: { line: "Off stump", length: "Full" },
    adjective: null,
    fielding: ["Cover"],
    ...overrides,
  };
}

function sit(id: SituationCard["id"], deck: "batting" | "bowling"): SituationCard {
  return {
    id,
    kind: "situation",
    name: id,
    flavor: "",
    description: "",
    deck,
  };
}

// ─── Base lookup ───

describe("base lookup", () => {
  it("returns the strength outcome when delivery hits a strength zone", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({ delivery: { line: "Off stump", length: "Full" } }),
      battingSituation: null,
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") {
      // Cover drive normally goes to Cover; default bowler covers Cover →
      // 6 gets downgraded to 4.
      assert.equal(r.finalOutcome.value, 4);
      assert.equal(r.finalOutcome.shot, "cover drive");
    }
  });

  it("returns dot when delivery zone isn't on the card", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({ delivery: { line: "Leg stump", length: "Short" } }),
      battingSituation: null,
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "dot");
  });

  it("returns wicket when delivery hits a weakness zone", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "5th stump", length: "Full" },
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "wicket");
  });
});

// ─── Adjective downgrades ───

describe("adjective downgrade", () => {
  it("downgrades runs by one tier when batter isn't resistant", () => {
    const r = resolveBall({
      batsman: makeBatter({ resistances: [] }),
      bowler: makeBowler({ adjective: "Seam", fielding: [] }),
      battingSituation: null,
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") {
      assert.equal(r.finalOutcome.value, 4); // 6 → 4
    }
    const adjStep = r.steps.find((s) => s.kind === "adjective");
    assert.ok(adjStep);
    assert.equal(adjStep!.applied, true);
  });

  it("does not downgrade when batter is resistant", () => {
    const r = resolveBall({
      batsman: makeBatter({ resistances: ["Seam"] }),
      bowler: makeBowler({ adjective: "Seam", fielding: [] }),
      battingSituation: null,
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") {
      assert.equal(r.finalOutcome.value, 6); // unchanged
    }
    const adjStep = r.steps.find((s) => s.kind === "adjective");
    assert.ok(adjStep);
    assert.equal(adjStep!.applied, false);
  });

  it("wickets stay wickets even with adjective", () => {
    const r = resolveBall({
      batsman: makeBatter({ resistances: [] }),
      bowler: makeBowler({
        delivery: { line: "5th stump", length: "Full" },
        adjective: "Swing",
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "wicket");
  });
});

// ─── Fielding coverage ───

describe("fielding coverage", () => {
  it("downgrades a cover drive when bowler covers Cover", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({ fielding: ["Cover"] }),
      battingSituation: null,
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 4); // 6 → 4
  });

  it("does not downgrade when bowler covers a different region", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({ fielding: ["Mid-wicket"] }),
      battingSituation: null,
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 6);
  });
});

// ─── Stacking: adjective + fielding ───

describe("stacking", () => {
  it("adjective AND fielding both fire — 6 → 4 → 2", () => {
    const r = resolveBall({
      batsman: makeBatter({ resistances: [] }),
      bowler: makeBowler({ adjective: "Pace", fielding: ["Cover"] }),
      battingSituation: null,
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 2);
  });

  it("Invariable Bounce + adjective + fielding stacks all the way down", () => {
    const r = resolveBall({
      batsman: makeBatter({ resistances: [] }),
      bowler: makeBowler({ adjective: "Pace", fielding: ["Cover"] }),
      battingSituation: null,
      bowlingSituation: sit("invariable-bounce", "bowling"),
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 1); // 6→4→2→1
  });
});

// ─── Power Surge ───

describe("Power Surge", () => {
  it("upgrades a 2 → 4", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "Middle stump", length: "Good length" },
        fielding: [],
      }),
      battingSituation: sit("power-surge", "batting"),
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 4); // 2 → 4
  });

  it("does not protect against a wicket", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "5th stump", length: "Full" },
        fielding: [],
      }),
      battingSituation: sit("power-surge", "batting"),
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "wicket");
    const ps = r.steps.find((s) => s.kind === "power-surge");
    assert.ok(ps);
    assert.equal(ps!.applied, false);
  });

  it("upgrades a dot to a scrambled single", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "Leg stump", length: "Short" },
        fielding: [],
      }),
      battingSituation: sit("power-surge", "batting"),
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 1);
  });
});

// ─── DRS Review ───

describe("DRS Review", () => {
  it("overturns a wicket to a dot ball", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "5th stump", length: "Full" },
        fielding: [],
      }),
      battingSituation: sit("drs-review", "batting"),
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "dot");
  });

  it("does nothing on a non-wicket", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({ fielding: [] }),
      battingSituation: sit("drs-review", "batting"),
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    const drs = r.steps.find((s) => s.kind === "drs-review");
    assert.ok(drs);
    assert.equal(drs!.applied, false);
  });
});

// ─── Review Appeal ───

describe("Review Appeal", () => {
  it("upgrades a dot to a wicket on a successful 40% roll (deterministic random=0)", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "Leg stump", length: "Short" },
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: sit("review-appeal", "bowling"),
      random: () => 0,
    });
    assert.equal(r.finalOutcome.type, "wicket");
  });

  it("does nothing when the roll fails (random=0.99)", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "Leg stump", length: "Short" },
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: sit("review-appeal", "bowling"),
      random: () => 0.99,
    });
    assert.equal(r.finalOutcome.type, "dot");
    const ra = r.steps.find((s) => s.kind === "review-appeal");
    assert.ok(ra);
    assert.equal(ra!.applied, false);
  });

  it("does nothing on a non-dot outcome", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({ fielding: [] }),
      battingSituation: null,
      bowlingSituation: sit("review-appeal", "bowling"),
      random: () => 0,
    });
    assert.equal(r.finalOutcome.type, "runs");
  });
});

// ─── Zone modifiers ───

describe("Trot Down", () => {
  it("shifts Good length → Full so a Good-length delivery hits a Full strength", () => {
    const r = resolveBall({
      batsman: makeBatter(), // strength on Full off stump
      bowler: makeBowler({
        delivery: { line: "Off stump", length: "Good length" },
        fielding: [],
      }),
      battingSituation: sit("trot-down", "batting"),
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 6);
  });
});

describe("Day 5 Pitch", () => {
  it("shifts Off stump → 5th stump pushing into a weakness", () => {
    const r = resolveBall({
      batsman: makeBatter(), // weakness on 5th stump full
      bowler: makeBowler({
        delivery: { line: "Off stump", length: "Full" },
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: sit("day-5-pitch", "bowling"),
    });
    assert.equal(r.finalOutcome.type, "wicket");
  });
});

describe("Switch Hit", () => {
  it("mirrors Off stump → Leg stump on the batter card lookup", () => {
    const batter = makeBatter({
      strengths: [
        {
          zone: { line: "Leg stump", length: "Full" },
          outcome: { type: "runs", value: 6, shot: "flick" },
        },
      ],
      neutrals: [],
      weaknesses: [],
    });
    const r = resolveBall({
      batsman: batter,
      bowler: makeBowler({
        delivery: { line: "Off stump", length: "Full" },
        fielding: [],
      }),
      battingSituation: sit("switch-hit", "batting"),
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 6);
  });
});

// ─── DRS + Review Appeal interaction ───

describe("DRS then Review Appeal", () => {
  it("DRS turns wicket into dot, then Review Appeal can upgrade dot back to wicket", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "5th stump", length: "Full" },
        fielding: [],
      }),
      battingSituation: sit("drs-review", "batting"),
      bowlingSituation: sit("review-appeal", "bowling"),
      random: () => 0, // ensure appeal succeeds
    });
    assert.equal(r.finalOutcome.type, "wicket");
  });
});

// ─── No Ball ───

describe("No Ball", () => {
  it("overturns a wicket to a dot, +1 extra, ball re-bowled", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "5th stump", length: "Full" },
        fielding: [],
      }),
      battingSituation: sit("no-ball", "batting"),
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "dot");
    assert.equal(r.extraRuns, 1);
    assert.equal(r.rebowled, true);
    assert.equal(r.extrasNote, "no-ball");
  });

  it("preserves a 6 outcome and adds +1 extra, ball re-bowled", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({ fielding: [] }),
      battingSituation: sit("no-ball", "batting"),
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 6);
    assert.equal(r.extraRuns, 1);
    assert.equal(r.rebowled, true);
  });
});

// ─── Wide outside off mechanic ───

describe("Wide outside off", () => {
  it("calls a wide on a Bronze bowler with low roll, on a dot ball", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        tier: "Bronze",
        delivery: { line: "Wide outside off", length: "Full" },
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: null,
      random: () => 0, // 0% < 40% Bronze chance
    });
    assert.equal(r.finalOutcome.type, "dot");
    assert.equal(r.extraRuns, 1);
    assert.equal(r.rebowled, true);
    assert.equal(r.extrasNote, "wide");
  });

  it("does NOT call a wide on an Elite bowler with mid roll", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        tier: "Elite",
        delivery: { line: "Wide outside off", length: "Full" },
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: null,
      random: () => 0.5, // > 5% Elite chance
    });
    assert.equal(r.extraRuns, 0);
    assert.equal(r.rebowled, false);
  });

  it("doesn't trigger when batter scored runs (only on dots)", () => {
    const r = resolveBall({
      batsman: makeBatter({
        strengths: [
          {
            zone: { line: "Wide outside off", length: "Full" },
            outcome: { type: "runs", value: 4, shot: "slash" },
          },
        ],
        neutrals: [],
        weaknesses: [],
      }),
      bowler: makeBowler({
        tier: "Bronze",
        delivery: { line: "Wide outside off", length: "Full" },
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: null,
      random: () => 0,
    });
    assert.equal(r.finalOutcome.type, "runs");
    assert.equal(r.extraRuns, 0);
    assert.equal(r.rebowled, false);
  });
});

// ─── Shuffle Across ───

describe("Shuffle Across", () => {
  it("shifts Off stump → Middle stump on the batter's card lookup", () => {
    const batter = makeBatter({
      strengths: [
        {
          zone: { line: "Middle stump", length: "Full" },
          outcome: { type: "runs", value: 6, shot: "slog" },
        },
      ],
      neutrals: [],
      weaknesses: [],
    });
    const r = resolveBall({
      batsman: batter,
      bowler: makeBowler({
        delivery: { line: "Off stump", length: "Full" },
        fielding: [],
      }),
      battingSituation: sit("shuffle-across", "batting"),
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 6);
  });

  it("clamps at Leg stump", () => {
    const batter = makeBatter({
      strengths: [
        {
          zone: { line: "Leg stump", length: "Full" },
          outcome: { type: "runs", value: 6, shot: "flick" },
        },
      ],
      neutrals: [],
      weaknesses: [],
    });
    const r = resolveBall({
      batsman: batter,
      bowler: makeBowler({
        delivery: { line: "Leg stump", length: "Full" },
        fielding: [],
      }),
      battingSituation: sit("shuffle-across", "batting"),
      bowlingSituation: null,
    });
    // Leg → Leg (clamped), so the strength still hits.
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 6);
    const step = r.steps.find((s) => s.kind === "shuffle-across");
    assert.ok(step);
    assert.equal(step!.applied, false);
  });
});
