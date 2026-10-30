/** Renders RATINGS.md: validation, top lists per edition, Timeless candidates, card audit. */

import type { BuildResult } from "../pipeline/build.js";
import { tierDistribution, type CardAudit, type TimelessCandidate, type TransferGap, type ValidationRow } from "./analysis.js";
import { MODEL, TIERS, type PlayerRating } from "./model.js";

export function renderRatings(
  r: BuildResult,
  ratings: PlayerRating[],
  validation: ValidationRow[],
  timeless: TimelessCandidate[],
  audit: CardAudit,
  transfer: TransferGap[] = [],
): string {
  const L: string[] = [];
  const h = (s: string) => L.push("", s, "");
  L.push("# World Cup Draft — ratings (Phase 1.5)", "");
  L.push(`Generated ${new Date().toISOString().slice(0, 16)}Z. Model: ${MODEL.evidence} evidence, prior strength ${MODEL.priorStrength} balls (bowling ×${MODEL.bowlPriorMultiplier}), phase prior ${MODEL.phasePriorStrength}, hazard prior ${MODEL.hazardPriorStrength}, career prior ${MODEL.careerPriorStrength}, ODI prior ${MODEL.odiPriorStrength}, transfer scale ${MODEL.transferScaleElo} Elo to the ${MODEL.transferDestination === "topThird" ? "strongest third" : "opponent mix"}, cohort centre ${MODEL.cohort.centre}, wicket cost ${MODEL.wicketCost} runs, display ${MODEL.display.min}–${MODEL.display.max}, low-sample badge < ${MODEL.badge.batBalls} balls faced / < ${MODEL.badge.bowlBalls} bowled.`);
  L.push("", "Ratings are per-phase outcome vectors; the display number maps the phase-weighted value (per cent of population expected runs, standardised per edition against the squads of its ten strongest teams) onto 40–99 across every rated player-edition, so a 90 in 2009 and a 90 in 2026 mean the same thing relative to their eras.");

  h("## Validation");
  L.push("**Predictive validity** — correlation between the pre-tournament rating (form only; the tournament itself is excluded) and the player's raw value in that tournament, for player-editions with ≥ 60 balls faced / ≥ 72 bowled in both. Two targets: *edition* values the tournament against the whole edition's population; *adjusted* values it against the tournament's own population mixed over the opponent strengths (Elo bins) the player actually faced, which is the fairer target for an opposition-adjusted rating because associates mostly meet associates in the first round. Baselines use the same formula on raw form (no shrinkage, no tier), raw strike rate/economy, and career rate.", "");
  L.push("The **within-edition** columns demean every edition first and are the primary metric: the pooled correlation also rewards matching each edition's *level*, which depends on the field's composition (ten strong teams in 2009, twenty teams in 2024) rather than on player skill.", "");
  L.push("| Variant | Bat n | Within: model | raw form value | raw SR | Pooled: model→edition | model→adjusted | raw form value | raw SR | career SR | Bowl n | Within: model | raw form value | raw econ | Pooled: model→edition | model→adjusted | raw form value | raw econ |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const v of validation) {
    const b = v.predictive.batting, w = v.predictive.bowling;
    L.push(`| ${v.variant} | ${b.n} | **${b.within.model}** | ${b.within.rawFormValue} | ${b.within.rawFormRate} | ${b.model} | ${b.modelTiered} | ${b.rawFormValue} | ${b.rawFormRate} | ${b.careerRate} | ${w.n} | **${w.within.model}** | ${w.within.rawFormValue} | ${w.within.rawFormRate} | ${w.model} | ${w.modelTiered} | ${w.rawFormValue} | ${w.rawFormRate} |`);
  }
  L.push("", "**Components** — how well the model's runs-per-ball and dismissal-rate each predict the tournament's, against the raw-form equivalents.", "");
  L.push("| Variant | Bat runs: model | raw | Bat hazard: model | raw | Bowl runs: model | raw | Bowl hazard: model | raw |", "|---|---|---|---|---|---|---|---|---|");
  for (const v of validation) {
    const b = v.predictive.batting, w = v.predictive.bowling;
    L.push(`| ${v.variant} | ${b.runs.model} | ${b.runs.rawForm} | ${b.hazard.model} | ${b.hazard.rawForm} | ${w.runs.model} | ${w.runs.rawForm} | ${w.hazard.model} | ${w.hazard.rawForm} |`);
  }
  L.push("", "**Stability** — correlation between a player's rating in one edition and in their next edition.", "");
  L.push("| Variant | Batting n | Model | Raw form SR | Bowling n | Model | Raw form economy |", "|---|---|---|---|---|---|---|");
  for (const v of validation) L.push(`| ${v.variant} | ${v.stability.batting.n} | ${v.stability.batting.model} | ${v.stability.batting.rawFormSR} | ${v.stability.bowling.n} | ${v.stability.bowling.model} | ${v.stability.bowling.rawFormEconomy} |`);

  if (transfer.length) {
    L.push("", "**Edge transfer against the strongest third** — for players with enough form balls against both the weak bins (two or more below the edition's top-third cutoff bin) and the strong bins (the cutoff bin and above), the log edge in each group is actual ÷ context-expected runs net of the wicket cost, from the per-ball context model. The slope of strong on weak is the share of an edge earned against weak opposition that shows up against strong opposition (1 = all of it).", "");
    L.push("| Skill | n | Slope | r | Mean edge vs weak | Mean edge vs strong | Min balls per group |", "|---|---|---|---|---|---|---|");
    for (const t of transfer) L.push(`| ${t.skill} | ${t.n} | ${t.slope ?? "n/a"} | ${t.correlation ?? "n/a"} | ${t.meanEdgeWeak ?? "n/a"} | ${t.meanEdgeStrong ?? "n/a"} | ${t.minBalls} |`);
  }

  h("## Evidence sources");
  const bySource: Record<string, number> = {};
  for (const x of ratings) bySource[`bat:${x.batting.evidence.source}`] = (bySource[`bat:${x.batting.evidence.source}`] ?? 0) + 1;
  for (const x of ratings) bySource[`bowl:${x.bowling.evidence.source}`] = (bySource[`bowl:${x.bowling.evidence.source}`] ?? 0) + 1;
  L.push("| Skill | form | career | odi | population |", "|---|---|---|---|---|");
  for (const s of ["bat", "bowl"]) L.push(`| ${s} | ${bySource[`${s}:form`] ?? 0} | ${bySource[`${s}:career`] ?? 0} | ${bySource[`${s}:odi`] ?? 0} | ${bySource[`${s}:population`] ?? 0} |`);
  L.push("", `Roles: ${["batter", "bowler", "all-rounder", "unknown"].map((role) => `${role} ${ratings.filter((x) => x.role === role).length}`).join(", ")}. Positionless: ${ratings.filter((x) => x.position.positionless).length}. Low-sample batting: ${ratings.filter((x) => x.batting.lowSample).length}; bowling: ${ratings.filter((x) => x.bowling.lowSample).length}. Squad Player tag (picked for under ${Math.round(MODEL.usage.squadPlayerShare * 100)}% of the tournament): ${ratings.filter((x) => x.usage.squadPlayer).length}. Selection prior applied (batting / bowling): ${ratings.filter((x) => x.batting.evidence.selectionShift > 0).length} / ${ratings.filter((x) => x.bowling.evidence.selectionShift > 0).length}.`);

  h("## Tiers (spec §5.6)");
  L.push("Tier = the better of the batting and bowling percentiles plus an all-round bonus, cut at the percentile thresholds in `data/config/tiers.json` (the rarity dial; Elite = top 8% of a skill); a best skill on thin form evidence is capped. Role-relative: a finisher is valued over the death overs he bats in, a new-ball bowler over the powerplay (headline phase weights = own exposure).", "");
  const dist = tierDistribution(ratings);
  L.push("| Edition | Players | Elite | Gold | Silver | Bronze |", "|---|---|---|---|---|---|");
  for (const [ed, d] of Object.entries(dist).sort()) L.push(`| ${ed} | ${d.total} | ${d.Elite} | ${d.Gold} | ${d.Silver} | ${d.Bronze} |`);
  const all = ratings.length;
  L.push(`| all | ${all} | ${TIERS.slice().reverse().map((t) => `${ratings.filter((x) => x.tier === t).length} (${Math.round((100 * ratings.filter((x) => x.tier === t).length) / all)}%)`).join(" | ")} |`);
  const card = (x: PlayerRating) => {
    const arch = [x.role === "bowler" ? null : x.archetype.batting, x.role === "batter" ? null : x.archetype.bowling ? `${x.archetype.bowling} bowler` : null].filter(Boolean).join(" / ");
    const tag = x.usage.squadPlayer ? ", squad player" : "";
    return `${x.name} (${x.team.slice(0, 3)}; ${x.role}${arch ? `, ${arch}` : ""}; bat ${x.batting.display}${x.batting.lowSample ? "*" : ""} / bowl ${x.bowling.display}${x.bowling.lowSample ? "*" : ""}${tag})`;
  };
  L.push("", "Elite and Gold cards per edition (`*` = low-sample skill). For review: a name in the wrong tier is a test case.", "");
  for (const e of r.editions) {
    const inEd = ratings.filter((x) => x.editionId === e.id).sort((a, b) => b.tierScore - a.tierScore);
    L.push(`**${e.id}** — Elite: ${inEd.filter((x) => x.tier === "Elite").map(card).join("; ") || "—"}`);
    L.push(`  Gold: ${inEd.filter((x) => x.tier === "Gold").map(card).join("; ") || "—"}`, "");
  }

  h("## Top ten batters and bowlers per edition (display rating, not low-sample)");
  for (const e of r.editions) {
    const inEd = ratings.filter((x) => x.editionId === e.id);
    const bats = inEd.filter((x) => !x.batting.lowSample).sort((a, b) => b.batting.value - a.batting.value).slice(0, 10);
    const bowls = inEd.filter((x) => !x.bowling.lowSample).sort((a, b) => b.bowling.value - a.bowling.value).slice(0, 10);
    L.push(`**${e.id}** — bat: ${bats.map((x) => `${x.name} (${x.team.slice(0, 3)}) ${x.batting.display}${x.tournamentForm.batting ? ` ${x.tournamentForm.batting > 0 ? "+" : ""}${x.tournamentForm.batting}` : ""}`).join(", ")}`);
    L.push(`  bowl: ${bowls.map((x) => `${x.name} (${x.team.slice(0, 3)}) ${x.bowling.display}${x.tournamentForm.bowling ? ` ${x.tournamentForm.bowling > 0 ? "+" : ""}${x.tournamentForm.bowling}` : ""}`).join(", ")}`, "");
  }

  h("## Timeless candidates (top decile in ≥ 3 editions spanning ≥ 8 years)");
  L.push("| Player | Skill | Editions | Span | Best display |", "|---|---|---|---|---|");
  for (const t of timeless) L.push(`| ${t.name} | ${t.skill} | ${t.editions.join(", ")} | ${t.spanYears} | ${t.bestDisplay} |`);
  if (!timeless.length) L.push("| — | | | | |");

  h("## Audit against the hand-rated card roster");
  L.push(`${audit.rows.length} cards matched to people by surname + initial (unique matches only). Mean display rating of the person's latest edition by card tier; Spearman rank correlation between tier and display: **${audit.spearman ?? "n/a"}**.`, "");
  L.push("| Card tier | Cards matched | Mean display | Derived Elite | Gold | Silver | Bronze |", "|---|---|---|---|---|---|---|");
  for (const [tier, v] of Object.entries(audit.byTier)) {
    const c = audit.tiers.confusion[tier];
    L.push(`| ${tier} | ${v.n} | ${v.meanDisplay} | ${c?.Elite ?? 0} | ${c?.Gold ?? 0} | ${c?.Silver ?? 0} | ${c?.Bronze ?? 0} |`);
  }
  L.push("", `Derived tier vs card tier: exact agreement **${audit.tiers.exact ?? "n/a"}**, within one tier **${audit.tiers.withinOne ?? "n/a"}**, Spearman **${audit.tiers.spearman ?? "n/a"}**. (The hand tiers rate whole careers; the derived tier is the person's best edition. Display is the latest edition.)`);
  const outliers = audit.rows
    .map((x) => ({ ...x, gap: x.display - ({ Elite: 90, Gold: 78, Silver: 66, Bronze: 54 }[x.tier] ?? 70) }))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 15);
  L.push("", "Largest disagreements (card tier vs data rating):", "", "| Card | Kind | Tier | Latest edition | Display | Derived tier |", "|---|---|---|---|---|---|");
  for (const x of outliers) L.push(`| ${x.card} | ${x.kind} | ${x.tier} | ${x.latestEdition} | ${x.display} | ${x.derivedTier} |`);
  L.push("");
  return L.join("\n");
}
