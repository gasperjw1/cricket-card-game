/**
 * Phase 1 ratings: sanity and validation guards. Skipped without the fetched archives.
 * These assert properties, not exact numbers, so model tuning does not break them unless it
 * breaks something a cricket follower would notice.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { archiveIsReady } from "../src/cricsheet/archive.js";
import { runBuild, type BuildResult } from "../src/pipeline/build.js";
import { auditCards, timelessCandidates, transferGaps, validate } from "../src/ratings/analysis.js";
import { MODEL, OUTCOMES, PHASE_LIST, TIERS, type PlayerEditionIn } from "../src/ratings/model.js";
import { styleOf } from "../src/analysis/tempo.js";
import { rateAll } from "../src/ratings/rate.js";
import { normalise, shrink, shrinkWithHazard, transport } from "../src/ratings/vectors.js";

describe("vector arithmetic", () => {
  const pop = normalise({ "0": 0.4, "1": 0.3, "2": 0.08, "3": 0.01, "4": 0.12, "6": 0.04, W: 0.05 });
  it("shrinks fully toward the prior with no evidence and toward the data with lots", () => {
    const none = shrink({ "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 }, 0, pop, 50);
    for (const k of Object.keys(pop) as (keyof typeof pop)[]) assert.ok(Math.abs(none[k] - pop[k]) < 1e-9);
    const lots = shrink({ "0": 0, "1": 0, "2": 0, "3": 0, "4": 5000, "6": 5000, W: 0 }, 10000, pop, 50);
    assert.ok(lots["4"] > 0.45 && lots["6"] > 0.45);
  });
  it("keeps the hazard cell on its own stronger prior", () => {
    const v = shrinkWithHazard({ "0": 50, "1": 30, "2": 5, "3": 0, "4": 10, "6": 5, W: 0 }, 100, pop, 50, 1000);
    assert.ok(Math.abs(v.W - pop.W) < 0.006, `hazard barely moves on 100 balls: ${v.W}`);
    assert.ok(Math.abs(Object.values(v).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  });
  it("transport preserves relative edges", () => {
    const rel = { "0": 1, "1": 1, "2": 1, "3": 1, "4": 2, "6": 2, W: 1 };
    const v = transport(rel, pop);
    assert.ok(v["4"] / pop["4"] > v["0"] / pop["0"]);
  });
});

const ready = archiveIsReady();
let result: BuildResult | null = null;
const build = (): BuildResult => (result ??= runBuild());

describe("batting styles", () => {
  const cuts = { fastBoundary: 0.02, fastRuns: 0.1, lowDot: -0.03, big: 0.07 };
  it("reads the six styles from how an innings starts and grows", () => {
    assert.equal(styleOf({ startBoundary: 0.09, startDot: -0.08, startRuns: 0.4, laterRuns: 0.4 }, cuts), "Aggressor");
    assert.equal(styleOf({ startBoundary: 0, startDot: -0.05, startRuns: 0, laterRuns: 0.2 }, cuts), "Complete");
    assert.equal(styleOf({ startBoundary: 0, startDot: 0.05, startRuns: 0, laterRuns: 0.2 }, cuts), "Builder");
    assert.equal(styleOf({ startBoundary: 0.05, startDot: 0, startRuns: 0.2, laterRuns: 0 }, cuts), "Starter");
    assert.equal(styleOf({ startBoundary: 0, startDot: -0.05, startRuns: 0, laterRuns: 0 }, cuts), "Rotator");
    assert.equal(styleOf({ startBoundary: 0, startDot: 0.05, startRuns: 0, laterRuns: 0 }, cuts), "Anchor");
  });
  it("keeps boundaries without a quick start out of Aggressor", () => {
    assert.equal(styleOf({ startBoundary: 0.03, startDot: 0.07, startRuns: 0.02, laterRuns: 0.26 }, cuts), "Builder");
  });
});

describe("Phase 1 ratings", { skip: !ready && "archive not fetched" }, () => {
  it("rates every player-edition within the display range with normalised vectors", () => {
    const ratings = rateAll(build());
    assert.equal(ratings.length, build().playerEditions.length);
    for (const x of ratings) {
      for (const s of [x.batting, x.bowling]) {
        assert.ok(s.display >= MODEL.display.min && s.display <= MODEL.display.max, `${x.name} display out of range`);
        for (const p of ["pp", "mid", "death"] as const) {
          const sum = Object.values(s.vectors[p]).reduce((a, b) => a + b, 0);
          assert.ok(Math.abs(sum - 1) < 1e-6, `${x.name} ${p} vector not normalised`);
        }
      }
    }
  });

  it("puts the obvious names near the top and tail-enders near the bottom", () => {
    const r = rateAll(build());
    const get = (name: string, ed: string) => r.find((x) => x.name === name && x.editionId === ed);
    assert.ok((get("SA Yadav", "2024")?.batting.display ?? 0) >= 95, "Suryakumar 2024");
    // Kohli's value is scoring-rate led (his low dismissal rate is shrunk hard; see the spec's open items), so the bar is "clearly good", not "elite".
    assert.ok((get("V Kohli", "2016")?.batting.display ?? 0) >= 78, "Kohli 2016");
    assert.ok((get("CH Gayle", "2016")?.batting.display ?? 0) >= 85, "Gayle 2016");
    assert.ok((get("JJ Bumrah", "2026")?.bowling.display ?? 0) >= 90, "Bumrah 2026");
    assert.ok((get("DL Vettori", "2010")?.bowling.display ?? 0) >= 90, "Vettori 2010");
    assert.ok((get("JJ Bumrah", "2024")?.batting.display ?? 99) <= 75, "Bumrah bats like a tail-ender");
    assert.equal(get("RG Sharma", "2024")?.role, "batter");
  });

  it("carries less of an associate's edge into a World Cup than a full member's", () => {
    const r = rateAll(build());
    const ura = r.find((x) => x.name === "TP Ura" && x.editionId === "2024");
    const rohit = r.find((x) => x.name === "RG Sharma" && x.editionId === "2024");
    assert.ok(ura && rohit);
    assert.ok(ura.batting.evidence.transfer < 0.7, `PNG edge transfer ${ura.batting.evidence.transfer}`);
    // The gap is measured to the edition's strongest third, so even India carries a little less than everything.
    assert.ok(rohit.batting.evidence.transfer > 0.7 && rohit.batting.evidence.transfer > ura.batting.evidence.transfer + 0.3, `India edge transfer ${rohit.batting.evidence.transfer}`);
    assert.ok(rohit.batting.display > ura.batting.display);
  });

  it("beats the naive baselines on predictive validity and stability for batting", () => {
    const [def] = validate(build(), [{ variant: "default", options: { ...MODEL, ...{} } as never }].map((v) => ({ variant: v.variant, options: {} as never })));
    assert.ok(def);
    // Within-edition correlations: the pooled ones also score level alignment, which cohort centring deliberately changes.
    const b = def.predictive.batting.within, w = def.predictive.bowling.within;
    assert.ok((b.model ?? 0) > (b.rawFormRate ?? 1), `model ${b.model} vs raw SR ${b.rawFormRate}`);
    assert.ok((b.model ?? 0) > (b.rawFormValue ?? 1), `model ${b.model} vs raw form value ${b.rawFormValue}`);
    assert.ok((def.stability.batting.model ?? 0) > (def.stability.batting.rawFormSR ?? 1));
    assert.ok((w.model ?? 0) > (w.rawFormValue ?? 1), `bowling model ${w.model} vs raw form value ${w.rawFormValue}`);
  });

  it("accumulates context-expected counts that sum to the balls they cover (Phase 1.5)", () => {
    const rows = build().playerEditions as unknown as PlayerEditionIn[];
    let checked = 0;
    for (const pe of rows) {
      for (const block of [pe.form, pe.careerToDate, pe.tournament]) {
        for (const skill of ["bat", "bowl"] as const) {
          for (const p of PHASE_LIST) {
            const pc = block[skill].phases[p];
            if (!pc || pc.balls === 0) continue;
            const sum = OUTCOMES.reduce((a, k) => a + (pc.expected?.[k] ?? 0), 0);
            assert.ok(Math.abs(sum - pc.balls) < 0.01 * pc.balls + 0.01, `${pe.name} ${pe.editionId} ${skill} ${p}: expected sums to ${sum} over ${pc.balls} balls`);
            checked += 1;
          }
        }
      }
    }
    assert.ok(checked > 5000, `checked ${checked} phase cells`);
  });

  it("derives usage shares and the Squad Player tag from selection, not from balls", () => {
    const r = rateAll(build());
    for (const x of r) {
      for (const s of [x.usage.formShare, x.usage.tournamentShare]) if (s !== null) assert.ok(s >= 0 && s <= 1, `${x.name} share ${s}`);
      if (x.standIn) assert.equal(x.usage.tournamentShare, null, `${x.name} stand-in has no tournament share`);
    }
    const sundar = r.find((x) => x.name === "Washington Sundar" && x.editionId === "2026");
    assert.ok(sundar?.usage.squadPlayer, "Sundar played 2 of India's 9 matches in 2026");
    const bumrah = r.find((x) => x.name === "JJ Bumrah" && x.editionId === "2026");
    assert.equal(bumrah?.usage.squadPlayer, false);
    const tagged = r.filter((x) => x.usage.squadPlayer).length;
    assert.ok(tagged > 20 && tagged < 0.1 * r.length, `Squad Player tags: ${tagged}`);
    // Default weight is 0 (set by the sweep), so no rating is shifted by selection.
    assert.ok(r.every((x) => x.batting.evidence.selectionShift === 0 && x.bowling.evidence.selectionShift === 0));
    // With the prior on, a rarely-picked player rating above the team median loses value and nobody gains.
    const on = rateAll(build(), { selectionWeight: 0.5, selectionMaxShare: 0.5 });
    const shifted = on.filter((x) => x.bowling.evidence.selectionShift > 0);
    assert.ok(shifted.length > 0 && shifted.every((x) => (x.usage.formShare ?? 1) < 0.5));
    const sundarOn = on.find((x) => x.name === "Washington Sundar" && x.editionId === "2026");
    assert.ok((sundarOn?.bowling.value ?? 0) < (sundar?.bowling.value ?? 0));
  });

  it("measures an edge-transfer slope well below 1 against the strongest third", () => {
    for (const t of transferGaps(build(), 60)) {
      assert.ok(t.n >= 50, `${t.skill}: n = ${t.n}`);
      assert.ok(t.slope !== null && t.slope < 0.6, `${t.skill}: slope ${t.slope}`);
    }
  });

  it("assigns role-relative tiers: finishers keep their grade, thin evidence is capped (spec §5.6)", () => {
    const r = rateAll(build());
    const get = (name: string, ed: string) => r.find((x) => x.name === name && x.editionId === ed)!;
    for (const x of r) {
      assert.ok(TIERS.includes(x.tier), `${x.name} tier ${x.tier}`);
      for (const s of [x.batting, x.bowling]) {
        const w = Object.values(s.evidence.phaseWeights).reduce((a, b) => a + b, 0);
        assert.ok(Math.abs(w - 1) < 1e-3, `${x.name} phase weights sum ${w}`);
        for (const p of PHASE_LIST) assert.ok(s.displayByPhase[p] >= MODEL.display.min && s.displayByPhase[p] <= MODEL.display.max);
      }
      const best = x.batting.percentile >= x.bowling.percentile ? x.batting : x.bowling;
      if (best.lowSample) assert.ok(x.tier === "Bronze" || x.tier === "Silver", `${x.name} ${x.editionId}: low-sample best skill but ${x.tier}`);
    }
    const sammy = get("DJG Sammy", "2016");
    assert.equal(sammy.archetype.batting, "finisher");
    assert.ok(sammy.batting.evidence.phaseWeights.death > 0.5, `Sammy death weight ${sammy.batting.evidence.phaseWeights.death}`);
    assert.ok(sammy.tier === "Gold" || sammy.tier === "Elite", `Sammy 2016 is ${sammy.tier}`);
    // Kohli 2016 sits at the Gold/Elite margin (89th batting percentile): his value is scoring-rate led while his
    // low dismissal rate is shrunk hard (parked: hazard credit for anchors). Review case, not a regression gate.
    assert.ok(["Gold", "Elite"].includes(get("V Kohli", "2016").tier), `Kohli 2016 is ${get("V Kohli", "2016").tier}`);
    assert.equal(get("JJ Bumrah", "2026").tier, "Elite");
    assert.equal(get("JJ Bumrah", "2026").archetype.bowling !== null, true);
    assert.notEqual(get("C Munro", "2016").tier, "Elite", "Munro 2016 (99 form balls) is capped below Elite");
    const elite = r.filter((x) => x.tier === "Elite").length / r.length;
    assert.ok(elite > 0.03 && elite < 0.2, `Elite share ${elite}`);
  });

  it("hides skills a player rarely shows and backs thin T20I records with domestic T20 and ODI evidence", () => {
    const r = rateAll(build());
    const get = (name: string, ed: string) => r.find((x) => x.name === name && x.editionId === ed)!;
    assert.equal(get("V Kohli", "2024").bowling.shown, false, "Kohli does not bowl");
    assert.equal(get("V Kohli", "2024").batting.shown, true);
    const batters = r.filter((x) => x.role === "batter" && !x.batting.lowSample);
    const shownBowling = batters.filter((x) => x.bowling.shown).length / Math.max(1, batters.length);
    assert.ok(shownBowling < 0.35, `${(100 * shownBowling).toFixed(0)}% of specialist batters show a bowling number`);
    // A bowler with a franchise career gets a batting record from it even when his T20I batting is thin
    // (Dube had faced 112 T20I balls by June 2024 and over a thousand in the IPL); Bumrah's bowling
    // carries thousands of league balls, and a specialist's own skill is always shown.
    const dube = get("S Dube", "2024");
    assert.ok(dube.batting.evidence.domesticBalls > 1000 && dube.batting.shown, `Dube domestic balls faced ${dube.batting.evidence.domesticBalls}`);
    const bumrah = get("JJ Bumrah", "2024");
    assert.ok(bumrah.bowling.evidence.domesticBalls > 1000 && bumrah.bowling.shown, `Bumrah domestic balls bowled ${bumrah.bowling.evidence.domesticBalls}`);
    for (const x of r) {
      if (x.role === "bowler" || x.role === "all-rounder") assert.ok(x.bowling.shown, `${x.name} ${x.editionId} is a ${x.role} with hidden bowling`);
      if (x.role === "batter" || x.role === "all-rounder") assert.ok(x.batting.shown, `${x.name} ${x.editionId} is a ${x.role} with hidden batting`);
    }
    // Projection is off by default (2026-11-01 audit: its window starts at the edition itself, so it
    // leaked the tournament into replays). A debutant is rated from the tournament's own balls and
    // no card is projected.
    const rohit = get("RG Sharma", "2007");
    assert.equal(rohit.batting.evidence.source, "tournament");
    assert.ok(rohit.batting.shown && !rohit.batting.projected, "Rohit 2007 batting from the tournament, not projected");
    assert.ok(r.every((x) => !x.batting.projected && !x.bowling.projected), "nothing is projected by default");
    // Opted in, projected cards borrow later balls, fix a thin record's role and stop short of Elite.
    const projected = rateAll(build(), { projection: true });
    const getP = (name: string, ed: string) => projected.find((x) => x.name === name && x.editionId === ed)!;
    assert.equal(getP("RG Sharma", "2007").batting.evidence.source, "later");
    assert.equal(getP("GJ Maxwell", "2012").role, "all-rounder");
    assert.equal(getP("Shakib Al Hasan", "2007").role, "all-rounder");
    for (const x of projected) {
      const best = x.batting.percentile >= x.bowling.percentile ? x.batting : x.bowling;
      if (best.projected) assert.notEqual(x.tier, "Elite", `${x.name} ${x.editionId} is Elite on a projected number`);
      if (x.batting.projected) assert.ok(x.batting.evidence.laterBalls >= MODEL.projection.minBalls.bat);
    }
    assert.equal(getP("V Kohli", "2024").batting.projected, false);
    const mathews = get("AD Mathews", "2009");
    assert.ok(mathews.batting.shown || mathews.bowling.shown, "Mathews 2009 (debutant with a thin IPL record) has a card");
    // Position prior: tail-enders rest on the tail's own pooled vector, so their mid-overs hazard sits
    // above the all-batters population and their scoring below it, even with thin records.
    const tail = r.filter((x) => x.editionId === "2024" && (x.position.median ?? 0) >= 9);
    const top = r.filter((x) => x.editionId === "2024" && (x.position.median ?? 11) <= 3);
    const meanW = (xs: typeof r) => xs.reduce((a, x) => a + x.batting.vectors.mid.W, 0) / xs.length;
    assert.ok(meanW(tail) > 1.08 * meanW(top), `tail hazard ${meanW(tail).toFixed(4)} vs top ${meanW(top).toFixed(4)}`);
    // Pace/spin split: a regular batter carries both numbers, a batter the card hides carries neither.
    const kohliSplit = get("V Kohli", "2024").batting.byBowlClass!;
    assert.ok(kohliSplit.pace.balls > 1000 && kohliSplit.spin.balls > 500 && kohliSplit.pace.display !== null && kohliSplit.spin.display !== null, "Kohli has a pace/spin split");
    for (const x of r.filter((y) => !y.batting.shown)) assert.equal(x.batting.byBowlClass?.pace.display ?? null, null, `${x.name} ${x.editionId} rarely bats, so prints no split`);
    for (const x of r) if (x.batting.byBowlClass) for (const cls of ["pace", "spin"] as const) for (const v of Object.values(x.batting.byBowlClass[cls].rel)) assert.ok(v >= 0.6 && v <= 1.6, `${x.name} split residual ${v}`);
    // Every batter the card shows has both numbers; league balls fill Sehwag's spin gap, so ODIs stay out.
    for (const x of r.filter((y) => y.batting.shown)) for (const cls of ["pace", "spin"] as const) assert.notEqual(x.batting.byBowlClass![cls].display, null, `${x.name} ${x.editionId} has no ${cls} number`);
    const sehwag = get("V Sehwag", "2012").batting.byBowlClass!;
    assert.ok(sehwag.spin.t20Balls >= 60 && !sehwag.spin.estimated && !sehwag.spin.fromOdi, `Sehwag's spin number comes from T20s (${sehwag.spin.t20Balls} balls)`);
    // ODIs stand in only below the bar, and an estimate means the bar was missed even with them.
    for (const x of r) {
      const split = x.batting.byBowlClass!;
      for (const cls of ["pace", "spin"] as const) {
        const p = split[cls];
        if (p.t20Balls >= 60) assert.ok(!p.fromOdi && !p.estimated, `${x.name} ${x.editionId} ${cls}: enough T20 balls`);
        assert.equal(p.estimated, p.balls < 60, `${x.name} ${x.editionId} ${cls} estimate flag`);
      }
      // The split moves a batter between classes, not up or down overall. Batters using ODIs are left
      // out: their mean of 1 holds over the weighted pool, which the printed balls do not show.
      const total = split.pace.balls + split.spin.balls;
      if (total >= 120 && split.pace.t20Balls >= 60 && split.spin.t20Balls >= 60) {
        const share = split.pace.balls / total;
        const six = share * split.pace.rel["6"] + (1 - share) * split.spin.rel["6"];
        assert.ok(six > 0.93 && six < 1.07, `${x.name} ${x.editionId} mean six residual ${six.toFixed(3)}`);
      }
    }
    const blank = r.filter((x) => !x.batting.shown && !x.bowling.shown);
    assert.ok(blank.length < 30, `${blank.length} player-editions with nothing shown`);
    for (const x of blank) assert.equal(x.tier, "Bronze", `${x.name} ${x.editionId} has no record but is ${x.tier}`);
    const withDomestic = r.filter((x) => x.batting.evidence.domesticBalls > 0).length / r.length;
    assert.ok(withDomestic > 0.4, `${(100 * withDomestic).toFixed(0)}% of player-editions carry domestic batting evidence`);
    // Phase numbers agree with the headline for an unmeasured skill (both at the median).
    for (const x of r) if (!x.bowling.shown && x.bowling.evidence.source === "population") {
      for (const p of PHASE_LIST) assert.ok(Math.abs(x.bowling.displayByPhase[p] - x.bowling.display) <= 1, `${x.name} bowling ${x.bowling.display} vs phase ${x.bowling.displayByPhase[p]}`);
    }
  });

  it("lists the expected Timeless candidates and agrees with the card tiers in direction", () => {
    const r = build();
    const ratings = rateAll(r);
    const timeless = timelessCandidates(ratings, new Map(r.editions.map((e) => [e.id, e.year])));
    const names = new Set(timeless.map((t) => t.name));
    const expected = ["CH Gayle", "GJ Maxwell", "DA Warner", "JJ Bumrah", "AJ Finch"];
    const hits = expected.filter((n) => names.has(n));
    assert.ok(hits.length >= 3, `expected at least three of ${expected.join(", ")} as Timeless candidates; got ${[...names].join(", ")}`);
    const audit = auditCards(ratings);
    assert.ok(audit.rows.length > 150);
    assert.ok((audit.byTier["Elite"]?.meanDisplay ?? 0) > (audit.byTier["Bronze"]?.meanDisplay ?? 99));
    assert.ok((audit.spearman ?? 0) > 0.2);
    assert.ok((audit.tiers.withinOne ?? 0) > 0.6, `derived tier within one of the card tier: ${audit.tiers.withinOne}`);
    assert.ok((audit.tiers.spearman ?? 0) > 0.2, `tier Spearman ${audit.tiers.spearman}`);
  });
});
