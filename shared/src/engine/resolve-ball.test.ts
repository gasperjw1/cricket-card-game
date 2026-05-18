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
        outcome: { type: "runs", value: 6, shot: "cover drive", shotCategory: "drive-cover" },
      },
    ],
    neutrals: [
      {
        zone: { line: "Middle stump", length: "Good length" },
        outcome: { type: "runs", value: 2, shot: "push", shotCategory: "defend" },
      },
    ],
    weaknesses: [
      {
        zone: { line: "Outside off", length: "Full" },
        outcome: { type: "wicket", mode: "edge to keeper", dismissalCategory: "caught-keeper" },
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
    adjectives: [],
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
        delivery: { line: "Outside off", length: "Full" },
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
      bowler: makeBowler({ adjectives: ["Seam"], fielding: [] }),
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
      bowler: makeBowler({ adjectives: ["Seam"], fielding: [] }),
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
        delivery: { line: "Outside off", length: "Full" },
        adjectives: ["Swing"],
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
      bowler: makeBowler({ adjectives: ["Slower"], fielding: ["Cover"] }),
      battingSituation: null,
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 2);
  });

  it("Invariable Bounce + adjective + fielding stacks all the way down", () => {
    const r = resolveBall({
      batsman: makeBatter({ resistances: [] }),
      bowler: makeBowler({ adjectives: ["Slower"], fielding: ["Cover"] }),
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
        delivery: { line: "Outside off", length: "Full" },
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
        delivery: { line: "Outside off", length: "Full" },
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
          outcome: { type: "runs", value: 6, shot: "flick", shotCategory: "flick" },
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

// ─── DRS + Review Appeal mutual cancel ───

describe("DRS Review + Review Appeal mutual cancel", () => {
  it("both played on the same ball → both skip, base outcome survives untouched", () => {
    // Base lookup: Outside off / Full → weakness wicket (caught-keeper).
    // DRS Review + Review Appeal both in play → mutual cancel; neither fires.
    // Lucky escape: no phase → perksEnabled = false → skip.
    // Final: wicket stands.
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "Outside off", length: "Full" },
        fielding: [],
      }),
      battingSituation: sit("drs-review", "batting"),
      bowlingSituation: sit("review-appeal", "bowling"),
    });
    assert.equal(r.finalOutcome.type, "wicket");
    const drs = r.steps.find((s) => s.kind === "drs-review");
    assert.ok(drs, "drs-review step should appear");
    assert.equal(drs!.applied, false, "DRS Review should NOT apply (cancelled)");
    const ra = r.steps.find((s) => s.kind === "review-appeal");
    assert.ok(ra, "review-appeal step should appear");
    assert.equal(ra!.applied, false, "Review Appeal should NOT apply (cancelled)");
  });

  it("DRS alone still saves a wicket (no mutual cancel when RA absent)", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({ delivery: { line: "Outside off", length: "Full" }, fielding: [] }),
      battingSituation: sit("drs-review", "batting"),
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "dot");
    const drs = r.steps.find((s) => s.kind === "drs-review");
    assert.equal(drs!.applied, true);
  });

  it("Review Appeal alone still promotes a dot to a wicket (no mutual cancel when DRS absent)", () => {
    // Blank batter → dot. RA roll = 0 < 0.40 → wicket.
    const r = resolveBall({
      batsman: makeBatter({ strengths: [], neutrals: [], weaknesses: [] }),
      bowler: makeBowler({ delivery: { line: "Leg stump", length: "Short" }, fielding: [] }),
      battingSituation: null,
      bowlingSituation: sit("review-appeal", "bowling"),
      random: () => 0,
    });
    assert.equal(r.finalOutcome.type, "wicket");
    const ra = r.steps.find((s) => s.kind === "review-appeal");
    assert.equal(ra!.applied, true);
  });
});

// ─── No Ball ───

describe("No Ball", () => {
  it("overturns a wicket to a dot, +1 extra, ball re-bowled", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "Outside off", length: "Full" },
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

  // Regression tests for "No Ball didn't nullify the wicket" report
  // (May 2026). All paths through the engine that can produce a wicket
  // should still get overturned when batting plays no-ball, unless the
  // bowling side plays Biryani or Old School (bowling).
  it("overturns a wicket caused by Review Appeal (dot→wicket upgrade)", () => {
    // Blank batter, bowler on Leg stump Short — no zone match → dot.
    // Review Appeal upgrades dot → wicket (rolled below threshold).
    // No-ball should overturn the upgraded wicket.
    const r = resolveBall({
      batsman: makeBatter({ strengths: [], neutrals: [], weaknesses: [] }),
      bowler: makeBowler({
        delivery: { line: "Leg stump", length: "Short" },
        fielding: [],
      }),
      battingSituation: sit("no-ball", "batting"),
      bowlingSituation: sit("review-appeal", "bowling"),
      random: () => 0, // 0 < 0.4 → Review Appeal upgrades to wicket
    });
    assert.equal(r.finalOutcome.type, "dot", "no-ball should overturn Review Appeal wicket");
    assert.equal(r.extraRuns, 1);
    assert.equal(r.rebowled, true);
    assert.equal(r.extrasNote, "no-ball");
  });

  it("overturns a Day-5-Pitch wide that became a wicket — wait, wides don't become wickets, so this just covers normal weakness wicket + a different bowling sit", () => {
    // Bowler on Outside off Full → weakness → wicket.
    // Day-5-Pitch would push line further off → auto-wide (per engine).
    // The wide path short-circuits and outcome is dot, so no-ball still
    // adds +1 and rebowled (no wicket to nullify in this case).
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "Outside off", length: "Full" },
        fielding: [],
      }),
      battingSituation: sit("no-ball", "batting"),
      bowlingSituation: sit("day-5-pitch", "bowling"),
    });
    // Day-5 short-circuits to wide on Outside off, so outcome is dot.
    assert.equal(r.finalOutcome.type, "dot");
  });

  it("overturns a wicket when bowler also plays Invariable Bounce (which only downgrades runs, not wickets)", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "Outside off", length: "Full" },
        fielding: [],
      }),
      battingSituation: sit("no-ball", "batting"),
      bowlingSituation: sit("invariable-bounce", "bowling"),
    });
    assert.equal(r.finalOutcome.type, "dot", "no-ball should still overturn even with Invariable Bounce");
    assert.equal(r.extraRuns, 1);
    assert.equal(r.rebowled, true);
  });

  it("returns bowler card to deck via the rebowled flag (server-side behavior, asserted indirectly)", () => {
    // The engine just sets rebowled=true; returning the bowler card to
    // the deck is the server's responsibility (see returnCardToActiveDeck
    // in server/src/innings.ts). This test documents the engine contract:
    // rebowled=true is the SIGNAL the server reads.
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({ delivery: { line: "Outside off", length: "Full" }, fielding: [] }),
      battingSituation: sit("no-ball", "batting"),
      bowlingSituation: null,
    });
    assert.equal(r.rebowled, true, "engine flags rebowled; server uses this to return bowler card");
  });

  it("does NOT overturn when bowler plays Biryani", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "Outside off", length: "Full" },
        fielding: [],
      }),
      battingSituation: sit("no-ball", "batting"),
      bowlingSituation: sit("biryani", "bowling"),
    });
    assert.equal(r.finalOutcome.type, "wicket", "Biryani makes No Ball a legal delivery");
    assert.equal(r.extraRuns, 0);
    assert.equal(r.rebowled, false);
    // The resolution trail should explicitly include a 'biryani' step so
    // the player can SEE why their no-ball was nullified.
    const hasBiryaniStep = r.steps.some((s) => s.kind === "biryani");
    assert.ok(hasBiryaniStep, "Must log a Biryani step so the UI can show why no-ball was canceled");
  });
});

// ─── Wide outside off mechanic ───

describe("Outside off", () => {
  // The default makeBatter() weakness sits on Outside off Full now, so for
  // wide-call tests we use a batter with no Outside off zones — the lookup
  // resolves to dot and the wide-call check fires.
  const blankBatter = (overrides: Partial<BatsmanCard> = {}): BatsmanCard =>
    makeBatter({ strengths: [], neutrals: [], weaknesses: [], ...overrides });

  it("calls a wide on a Bronze bowler with low roll, on a dot ball", () => {
    const r = resolveBall({
      batsman: blankBatter(),
      bowler: makeBowler({
        tier: "Bronze",
        delivery: { line: "Outside off", length: "Full" },
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
      batsman: blankBatter(),
      bowler: makeBowler({
        tier: "Elite",
        delivery: { line: "Outside off", length: "Full" },
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
            zone: { line: "Outside off", length: "Full" },
            outcome: { type: "runs", value: 4, shot: "slash", shotCategory: "cut" },
          },
        ],
        neutrals: [],
        weaknesses: [],
      }),
      bowler: makeBowler({
        tier: "Bronze",
        delivery: { line: "Outside off", length: "Full" },
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
          outcome: { type: "runs", value: 6, shot: "slog", shotCategory: "slog" },
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

  it("auto-wides on Leg stump (batter shuffles past the line)", () => {
    const batter = makeBatter({
      strengths: [
        {
          zone: { line: "Leg stump", length: "Full" },
          outcome: { type: "runs", value: 6, shot: "flick", shotCategory: "flick" },
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
    // Auto-wide takes precedence — outcome is dot, +1 extra, rebowled.
    assert.equal(r.finalOutcome.type, "dot");
    assert.equal(r.extraRuns, 1);
    assert.equal(r.rebowled, true);
    assert.equal(r.extrasNote, "wide");
    const wideStep = r.steps.find((s) => s.kind === "wide");
    assert.ok(wideStep);
  });
});

// ─── Day 5 Pitch auto-wide on Outside off ───

describe("Day 5 Pitch auto-wide", () => {
  it("triggers a wide call when delivery is already on Outside off", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "Outside off", length: "Full" },
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: sit("day-5-pitch", "bowling"),
    });
    assert.equal(r.finalOutcome.type, "dot");
    assert.equal(r.extraRuns, 1);
    assert.equal(r.rebowled, true);
    assert.equal(r.extrasNote, "wide");
  });
});

// ─── Deep in the Crease ───

describe("Deep in the Crease", () => {
  it("auto-wides on a Short delivery", () => {
    const r = resolveBall({
      batsman: makeBatter(),
      bowler: makeBowler({
        delivery: { line: "Off stump", length: "Short" },
        fielding: [],
      }),
      battingSituation: sit("deep-in-crease", "batting"),
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "dot");
    assert.equal(r.extraRuns, 1);
    assert.equal(r.rebowled, true);
    assert.equal(r.extrasNote, "wide");
  });

  it("shifts Full → Good length on the lookup", () => {
    const batter = makeBatter({
      strengths: [
        {
          zone: { line: "Off stump", length: "Good length" },
          outcome: { type: "runs", value: 6, shot: "drive", shotCategory: "drive-cover" },
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
      battingSituation: sit("deep-in-crease", "batting"),
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 6);
  });
});

// ─── Biryani cancel ───

describe("Third Umpire Distracted by Biryani", () => {
  it("cancels a No Ball — wicket is NOT overturned, no extras, ball counts", () => {
    const r = resolveBall({
      batsman: makeBatter(), // weakness on Outside off Full
      bowler: makeBowler({
        delivery: { line: "Outside off", length: "Full" },
        fielding: [],
      }),
      battingSituation: sit("no-ball", "batting"),
      bowlingSituation: sit("biryani", "bowling"),
    });
    assert.equal(r.finalOutcome.type, "wicket");
    assert.equal(r.extraRuns, 0);
    assert.equal(r.rebowled, false);
  });

  it("cancels an Outside-off auto-wide from Day 5 Pitch — outcome is plain dot", () => {
    const r = resolveBall({
      batsman: makeBatter({ strengths: [], neutrals: [], weaknesses: [] }),
      bowler: makeBowler({
        delivery: { line: "Outside off", length: "Full" },
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: sit("biryani", "bowling"),
      // Note: Day 5 Pitch + Biryani is impossible (both bowling-side cards).
      // So this exercises the tier-based wide cancel instead.
      random: () => 0,
    });
    assert.equal(r.finalOutcome.type, "dot");
    assert.equal(r.extraRuns, 0);
    assert.equal(r.rebowled, false);
  });

  it("cancels a Shuffle Across auto-wide", () => {
    const r = resolveBall({
      batsman: makeBatter({
        strengths: [
          {
            zone: { line: "Leg stump", length: "Full" },
            outcome: { type: "runs", value: 6, shot: "flick", shotCategory: "flick" },
          },
        ],
        neutrals: [],
        weaknesses: [],
      }),
      bowler: makeBowler({
        delivery: { line: "Leg stump", length: "Full" },
        fielding: [],
      }),
      battingSituation: sit("shuffle-across", "batting"),
      bowlingSituation: sit("biryani", "bowling"),
    });
    // Wide cancelled → plain dot, no extras, no rebowl.
    assert.equal(r.finalOutcome.type, "dot");
    assert.equal(r.extraRuns, 0);
    assert.equal(r.rebowled, false);
  });
});

// ─── Two-adjective no-stack rule ───

describe("Two-adjective no-stack rule", () => {
  it("only one adjective downgrades when both are un-resisted", () => {
    const r = resolveBall({
      batsman: makeBatter({ resistances: [] }), // no resistances
      bowler: makeBowler({
        adjectives: ["Seam", "Slower"],
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: null,
    });
    // 6 → 4 (one downgrade), not 6 → 4 → 2.
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 4);
    const fired = r.steps.filter(
      (s) => s.kind === "adjective" && s.applied,
    );
    assert.equal(fired.length, 1);
  });

  it("if batter resists one, the other fires", () => {
    const r = resolveBall({
      batsman: makeBatter({ resistances: ["Seam"] }),
      bowler: makeBowler({
        adjectives: ["Seam", "Slower"],
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 4);
  });

  it("if batter resists both, no downgrade", () => {
    const r = resolveBall({
      batsman: makeBatter({ resistances: ["Seam", "Slower"] }),
      bowler: makeBowler({
        adjectives: ["Seam", "Slower"],
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: null,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 6);
  });
});

// ─── Role / phase perks ───
// Note: these perks are gated by `phase` being provided. Tests above
// omit phase to get deterministic legacy behavior.

// ─── Lucky escape (unified wicket-save + inside edge) ───
// LUCKY_ESCAPE_CHANCE = 0.30 — roll < 0.30 triggers escape.
// Escape type is determined by dismissal category.

describe("Lucky escape — bowled", () => {
  it("bails don't fall (Full) → 2 byes, dot, no rebowl (batter in phase)", () => {
    const r = resolveBall({
      batsman: makeBatter({
        role: "middle-order", // in phase — escape can fire
        weaknesses: [{
          zone: { line: "Middle stump", length: "Full" },
          outcome: { type: "wicket", mode: "clean bowled", dismissalCategory: "bowled" },
        }],
      }),
      bowler: makeBowler({ delivery: { line: "Middle stump", length: "Full" }, fielding: [] }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "middle",
      random: () => 0.05, // 0.05 < 0.20 → escape fires
    });
    assert.equal(r.finalOutcome.type, "dot");
    assert.equal(r.extraRuns, 2);
    assert.equal(r.extrasNote, "byes");
    assert.equal(r.rebowled, false);
    const step = r.steps.find((s) => s.kind === "lucky-escape");
    assert.ok(step?.applied);
  });

  it("bails don't fall (Short) → 2 byes with different narrative (batter in phase)", () => {
    const r = resolveBall({
      batsman: makeBatter({
        role: "middle-order",
        weaknesses: [{
          zone: { line: "Middle stump", length: "Short" },
          outcome: { type: "wicket", mode: "top edge bowled", dismissalCategory: "bowled" },
        }],
      }),
      bowler: makeBowler({ delivery: { line: "Middle stump", length: "Short" }, fielding: [] }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "middle",
      random: () => 0.05,
    });
    assert.equal(r.extraRuns, 2);
    assert.equal(r.extrasNote, "byes");
  });
});

describe("Lucky escape — LBW", () => {
  it("leg-stump LBW → 'sliding down leg' → 2 leg byes (batter in phase)", () => {
    const r = resolveBall({
      batsman: makeBatter({
        role: "middle-order",
        weaknesses: [{
          zone: { line: "Leg stump", length: "Good length" },
          outcome: { type: "wicket", mode: "trapped LBW", dismissalCategory: "lbw" },
        }],
      }),
      bowler: makeBowler({ delivery: { line: "Leg stump", length: "Good length" }, fielding: [] }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "middle",
      random: () => 0.05,
    });
    assert.equal(r.finalOutcome.type, "dot");
    assert.equal(r.extraRuns, 2);
    assert.equal(r.extrasNote, "leg-byes");
    const step = r.steps.find((s) => s.kind === "lucky-escape");
    assert.ok(step?.detail.includes("leg"));
  });

  it("outside-off LBW → 'pitched outside off' → 2 leg byes (batter in phase)", () => {
    const r = resolveBall({
      batsman: makeBatter({
        role: "middle-order",
        weaknesses: [{
          zone: { line: "Outside off", length: "Full" },
          outcome: { type: "wicket", mode: "LBW", dismissalCategory: "lbw" },
        }],
      }),
      bowler: makeBowler({ delivery: { line: "Outside off", length: "Full" }, fielding: [] }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "middle",
      random: () => 0.05,
    });
    assert.equal(r.extrasNote, "leg-byes");
    const step = r.steps.find((s) => s.kind === "lucky-escape");
    assert.ok(step?.detail.includes("outside off"));
  });
});

describe("Lucky escape — caught", () => {
  it("caught-deep → dropped on the rope → 4 bat runs (batter in phase)", () => {
    const r = resolveBall({
      batsman: makeBatter({
        role: "middle-order",
        weaknesses: [{
          zone: { line: "Middle stump", length: "Short" },
          outcome: { type: "wicket", mode: "top edge caught deep", dismissalCategory: "caught-deep" },
        }],
      }),
      bowler: makeBowler({ delivery: { line: "Middle stump", length: "Short" }, fielding: [] }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "middle",
      random: () => 0.05,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 4);
    assert.equal(r.extraRuns, 0, "bat runs are not extras");
  });

  it("caught-midwicket → fumbled → 1 bat run (batter in phase)", () => {
    const r = resolveBall({
      batsman: makeBatter({
        role: "middle-order",
        weaknesses: [{
          zone: { line: "Leg stump", length: "Full" },
          outcome: { type: "wicket", mode: "top edge midwicket", dismissalCategory: "caught-midwicket" },
        }],
      }),
      bowler: makeBowler({ delivery: { line: "Leg stump", length: "Full" }, fielding: [] }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "middle",
      random: () => 0.05,
    });
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 1);
  });
});

describe("Lucky escape — stumped", () => {
  it("inside edge → keeper can't gather → 2 bat runs (batter in phase)", () => {
    const r = resolveBall({
      batsman: makeBatter({
        role: "middle-order",
        weaknesses: [{
          zone: { line: "Outside off", length: "Full" },
          outcome: { type: "wicket", mode: "stumped", dismissalCategory: "stumped" },
        }],
      }),
      bowler: makeBowler({ delivery: { line: "Outside off", length: "Full" }, fielding: [] }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "middle",
      random: () => 0.05,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") assert.equal(r.finalOutcome.value, 2);
    assert.equal(r.extraRuns, 0);
  });
});

describe("Lucky escape — wicket stands / run-out excluded", () => {
  it("wicket stands when batter is in phase but roll fails (>= 0.20)", () => {
    const r = resolveBall({
      batsman: makeBatter({ role: "middle-order" }), // in phase
      bowler: makeBowler({ delivery: { line: "Outside off", length: "Full" }, fielding: [] }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "middle",
      random: () => 0.50, // 0.50 >= 0.20 → escape roll fails
    });
    assert.equal(r.finalOutcome.type, "wicket");
  });

  it("wicket stands when batter is OUT of phase — no escape regardless of roll", () => {
    // Finisher in middle overs = out of phase → escape gate blocked entirely.
    // Roll 0.01 is below both old (0.30) and new (0.20) thresholds but won't fire.
    const r = resolveBall({
      batsman: makeBatter({ role: "finisher" }), // finisher → death; current phase = middle → OOP
      bowler: makeBowler({ delivery: { line: "Outside off", length: "Full" }, fielding: [] }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "middle",
      random: () => 0.01, // low roll, but escape is gated by batterInPhase
    });
    assert.equal(r.finalOutcome.type, "wicket", "OOP batter gets no lucky escape");
    const escape = r.steps.find((s) => s.kind === "lucky-escape");
    assert.equal(escape, undefined, "lucky-escape step must not appear for OOP batter");
  });

  it("run-out keeps runs scored AND flags the dismissal — lucky escape does NOT apply", () => {
    // Batter (no role) neutral 2 runs at Middle stump / Good length.
    // Roll: 0.05 < BOWLER_NEUTRAL_RUNOUT_CHANCE (0.10) → run-out fires
    // (batter has no role → not in phase → not protected from run-out).
    // Result: runs (2) + runOut:true. Lucky escape gate also requires
    // batterInPhase which is false here, so it's doubly blocked.
    const r = resolveBall({
      batsman: makeBatter({ role: undefined }),
      bowler: makeBowler({
        delivery: { line: "Middle stump", length: "Good length" },
        fielding: [],
        role: undefined,
      }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "middle",
      random: () => 0.05,
    });
    assert.equal(r.finalOutcome.type, "runs", "run-out result is runs, not wicket");
    if (r.finalOutcome.type === "runs") {
      assert.equal(r.finalOutcome.value, 2, "runs scored are preserved");
      assert.equal(r.finalOutcome.runOut, true, "runOut flag set");
    }
    assert.equal(r.extraRuns, 0, "no extras on run-out");
    const escape = r.steps.find((s) => s.kind === "lucky-escape");
    assert.equal(escape, undefined, "lucky-escape must not fire on run-out");
  });

  it("in-phase batter cannot be run out (even with low roll)", () => {
    // Middle-order in middle phase = in phase → run-out perk blocked.
    // Roll 0.15: skips batter in-phase upgrade (0.15 > 0.10).
    // Outcome: plain 2 runs, no runOut flag.
    const r = resolveBall({
      batsman: makeBatter({ role: "middle-order" }),
      bowler: makeBowler({
        delivery: { line: "Middle stump", length: "Good length" },
        fielding: [],
        role: undefined,
      }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "middle",
      random: () => 0.15,
    });
    assert.equal(r.finalOutcome.type, "runs");
    if (r.finalOutcome.type === "runs") {
      assert.equal(r.finalOutcome.value, 2);
      assert.equal(r.finalOutcome.runOut, undefined, "in-phase batter is immune to run-out perk");
    }
  });
});

describe("Phase perks — batter out of phase", () => {
  it("converts a scoring shot to a dot when batter is out of phase", () => {
    const r = resolveBall({
      batsman: makeBatter({ role: "finisher" }), // built for death overs
      bowler: makeBowler({
        delivery: { line: "Off stump", length: "Full" }, // batter's 6 zone
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "powerplay", // finisher in powerplay → out of phase
      random: () => 0.10, // 0.10 < 0.25 → triggers dot
    });
    assert.equal(r.finalOutcome.type, "dot", "OOP scoring shot becomes dot");
  });

  it("does NOT downgrade when batter is in phase", () => {
    const r = resolveBall({
      batsman: makeBatter({ role: "top-order" }),
      bowler: makeBowler({
        delivery: { line: "Off stump", length: "Full" },
        fielding: [],
      }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "powerplay", // top-order in powerplay = in phase
      random: () => 0.10,
    });
    // In phase → no OOP penalty. Could get in-phase upgrade though.
    // Final outcome should be runs (4 after fielding cover downgrade from 6).
    assert.equal(r.finalOutcome.type, "runs");
  });
});

describe("Phase perks — bowler in-phase wicket", () => {
  it("converts a dot to a wicket when bowler is in phase", () => {
    // Blank batter so base lookup → dot. Bowler in phase → dot→wicket (roll[0]=0.05).
    // Lucky escape also fires if roll < 0.30 — use roll[1]=0.50 to suppress it
    // (in-phase wicket now fires BEFORE lucky escape in the new tree order).
    const rolls = [0.05, 0.50];
    let idx = 0;
    const r = resolveBall({
      batsman: makeBatter({
        strengths: [], neutrals: [], weaknesses: [],
        role: "middle-order",
      }),
      bowler: makeBowler({
        delivery: { line: "Leg stump", length: "Short" },
        fielding: [],
        role: "death-overs",
      }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "death", // bowler in phase
      random: () => rolls[idx++ % rolls.length]!,
    });
    assert.equal(r.finalOutcome.type, "wicket");
    const step = r.steps.find((s) => s.kind === "bowler-in-phase-wicket");
    assert.ok(step?.applied);
  });
});

describe("Phase perks — bowler OOP wide bump", () => {
  it("calls a wide on leg stump when bowler is out of phase and random rolls low", () => {
    const r = resolveBall({
      batsman: makeBatter({
        strengths: [], neutrals: [], weaknesses: [],
        role: "middle-order",
      }),
      bowler: makeBowler({
        delivery: { line: "Leg stump", length: "Good length" },
        fielding: [],
        role: "death-overs",
      }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "powerplay", // bowler OOP → +20% leg-stump wide chance
      random: () => 0.05, // 0.05 < 0.20 → wide called
    });
    assert.equal(r.extrasNote, "wide");
    assert.equal(r.rebowled, true);
  });
});

// ─── DRS Review + bowler in-phase wicket interaction ───
// In the new tree order, bowler in-phase fires BEFORE DRS Review, so
// DRS Review can now save a wicket produced by the bowler's phase perk.

describe("DRS Review + Phase Wicket interaction (new tree order)", () => {
  it("DRS Review saves a wicket produced by bowler in-phase", () => {
    // Blank batter → dot from base lookup. Bowler in phase →
    // dot→wicket (roll[0]=0.05 < 0.10). DRS Review played →
    // wicket saved back to dot. Lucky escape: no random call (outcome is dot).
    const rolls = [0.05]; // only one roll consumed: bowler in-phase
    let idx = 0;
    const r = resolveBall({
      batsman: makeBatter({ strengths: [], neutrals: [], weaknesses: [] }),
      bowler: makeBowler({
        delivery: { line: "Leg stump", length: "Short" },
        fielding: [],
        role: "death-overs",
      }),
      battingSituation: sit("drs-review", "batting"),
      bowlingSituation: null,
      phase: "death",
      random: () => rolls[idx++ % rolls.length]!,
    });
    assert.equal(r.finalOutcome.type, "dot", "DRS saved the in-phase wicket");
    const phaseStep = r.steps.find((s) => s.kind === "bowler-in-phase-wicket");
    assert.ok(phaseStep?.applied, "bowler in-phase wicket fired");
    const drsStep = r.steps.find((s) => s.kind === "drs-review");
    assert.ok(drsStep?.applied, "DRS Review saved it");
  });

  it("in-phase wicket confirmed when DRS Review is not played", () => {
    // Blank batter → dot. Bowler in phase, no DRS.
    // roll[0]=0.05 fires in-phase wicket; roll[1]=0.50 blocks lucky escape.
    const rolls = [0.05, 0.50];
    let idx = 0;
    const r = resolveBall({
      batsman: makeBatter({ strengths: [], neutrals: [], weaknesses: [] }),
      bowler: makeBowler({ delivery: { line: "Leg stump", length: "Short" }, fielding: [], role: "death-overs" }),
      battingSituation: null,
      bowlingSituation: null,
      phase: "death",
      random: () => rolls[idx++ % rolls.length]!,
    });
    assert.equal(r.finalOutcome.type, "wicket");
    const phaseStep = r.steps.find((s) => s.kind === "bowler-in-phase-wicket");
    assert.ok(phaseStep?.applied);
  });
});
