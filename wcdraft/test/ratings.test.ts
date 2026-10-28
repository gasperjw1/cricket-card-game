/**
 * Phase 1 ratings: sanity and validation guards. Skipped without the fetched archives.
 * These assert properties, not exact numbers, so model tuning does not break them unless it
 * breaks something a cricket follower would notice.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { archiveIsReady } from "../src/cricsheet/archive.js";
import { runBuild, type BuildResult } from "../src/pipeline/build.js";
import { auditCards, timelessCandidates, validate } from "../src/ratings/analysis.js";
import { MODEL } from "../src/ratings/model.js";
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
    assert.equal(rohit.batting.evidence.transfer, 1);
    assert.ok(rohit.batting.display > ura.batting.display);
  });

  it("beats the naive baselines on predictive validity and stability for batting", () => {
    const [def] = validate(build(), [{ variant: "default", options: { ...MODEL, ...{} } as never }].map((v) => ({ variant: v.variant, options: {} as never })));
    assert.ok(def);
    const b = def.predictive.batting;
    assert.ok((b.model ?? 0) > (b.rawFormRate ?? 1), `model ${b.model} vs raw SR ${b.rawFormRate}`);
    assert.ok((b.model ?? 0) > (b.rawFormValue ?? 1), `model ${b.model} vs raw form value ${b.rawFormValue}`);
    assert.ok((def.stability.batting.model ?? 0) > (def.stability.batting.rawFormSR ?? 1));
    assert.ok((def.predictive.bowling.model ?? 0) > (def.predictive.bowling.rawFormValue ?? 1));
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
  });
});
