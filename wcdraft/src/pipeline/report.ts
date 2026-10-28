/**
 * Renders COVERAGE.md: which teams and players each edition gives us, who lacks data,
 * the measured edition environments, and the venue table. Human-readable companion to the JSON.
 */

import type { BuildResult } from "./build.js";

export function renderCoverage(r: BuildResult): string {
  const lines: string[] = [];
  const h = (s: string) => lines.push("", s, "");
  lines.push("# World Cup Draft — data coverage (Phase 0)", "");
  lines.push(`Generated ${r.meta.generatedAt.slice(0, 16)}Z from Cricsheet \`${r.meta.archive.name}\` (snapshot ${r.meta.archive.downloadedAt.slice(0, 10)}, ${r.meta.archive.fileCount} matches). Licence: ${r.meta.archive.licence}.`);
  lines.push("", `Form window: ${r.meta.formWindowMonths} months before each edition. "Has form data" means ≥ ${r.meta.thresholds.batBalls} balls faced or ≥ ${r.meta.thresholds.bowlBalls} balls bowled in that window. Afghanistan is withheld by Cricsheet and absent throughout.`);

  h("## Editions");
  lines.push("| Edition | Dates | Matches | Teams | Afghanistan slot | Stand-in | Host win % | Associate upsets |", "|---|---|---|---|---|---|---|---|");
  for (const e of r.editions) {
    lines.push(`| ${e.id} | ${e.firstMatch} → ${e.lastMatch} | ${e.environment.matches} | ${e.teams.length} | ${e.afghanistan ? `${e.afghanistan.stage}, group ${e.afghanistan.group}` : "—"} | ${e.afghanistan ? (e.standIn?.team ?? "TBD") : "—"} | ${e.hostWinPct ?? "–"} | ${e.associateUpsets.wins}/${e.associateUpsets.crossTierMatches} |`);
  }

  h("## Scoring environment by edition");
  lines.push("| Edition | RPO | Dot % | 4s % | 6s % | Balls/wkt | PP RPO | Death RPO | 1st-inns avg (SD) | Chase win % | Toss→field % | Chase uplift | Reduced inns | DRS reviews |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const e of r.editions) {
    const v = e.environment;
    lines.push(`| ${e.id} | ${v.runsPerOver} | ${v.dotPct} | ${v.fourPct} | ${v.sixPct} | ${v.ballsPerWicket} | ${v.powerplayRpo} | ${v.deathRpo} | ${v.firstInningsAvg} (${v.firstInningsSd}) | ${v.chaseWinPct} | ${v.tossFieldPct} | ${v.chaseUplift > 0 ? "+" : ""}${v.chaseUplift} | ${v.reducedInnings} | ${v.reviews.total || "none"} |`);
  }

  h("## Dismissal fingerprint by edition (% of wickets)");
  const kinds = ["caught", "bowled", "lbw", "run out", "stumped", "caught and bowled", "hit wicket"];
  lines.push(`| Edition | ${kinds.join(" | ")} |`, `|---|${kinds.map(() => "---").join("|")}|`);
  for (const e of r.editions) lines.push(`| ${e.id} | ${kinds.map((k) => e.environment.dismissalFingerprintPct[k] ?? 0).join(" | ")} |`);

  h("## Stand-in squads (teams inserted into Afghanistan's slot)");
  lines.push("Built from each team's T20Is in the form window; `defaultXI` is the most-used eleven in modal batting order.", "");
  lines.push("| Edition | Team | Squad source | Matches used | Squad | Default XI |", "|---|---|---|---|---|---|");
  for (const s of r.squads.filter((x) => x.standIn)) {
    const xi = s.defaultXI.map((p) => p.name).join(", ");
    lines.push(`| ${s.editionId} | ${s.team} | ${s.source} | ${s.matchesUsed} | ${s.players.length} | ${xi ? `${xi}${s.source === "hand" ? " (listed order; no match data)" : ""}` : "— (squad needed)"} |`);
  }

  h("## Player coverage by edition and team");
  lines.push(`Low-sample badge: fewer than ${r.meta.badgeThresholds.batBalls} balls faced and fewer than ${r.meta.badgeThresholds.bowlBalls} bowled in the form window.`, "");
  lines.push("| Edition | Team | Squad | Form batting | Form bowling | Any prior T20I | Lacking data | Low-sample badge |", "|---|---|---|---|---|---|---|---|");
  for (const e of r.coverage.editions) {
    for (const t of e.teams) lines.push(`| ${e.editionId} | ${t.team}${t.standIn ? " (stand-in)" : ""} | ${t.squadSize} | ${t.withFormBatting} | ${t.withFormBowling} | ${t.withAnyPriorT20I} | ${t.lackingData.length} | ${t.lowSampleBadge} |`);
  }
  lines.push("", `**Totals:** ${r.coverage.totals.distinctPeople} distinct people, ${r.coverage.totals.playerEditions} player-editions, ${r.coverage.totals.lackingData} lacking form data, ${r.coverage.totals.lowSampleBadge} carrying the low-sample badge.`);

  h("## Players lacking form data");
  lines.push("Players whose form window has fewer than the thresholds above. Their ratings will shrink toward the era average and should carry a low-sample badge until hand-rated.", "");
  for (const e of r.coverage.editions) {
    const all = e.teams.flatMap((t) => t.lackingData.map((p) => ({ ...p, team: t.team })));
    if (all.length === 0) continue;
    lines.push(`<details><summary>${e.editionId}: ${all.length} player-editions</summary>`, "", "| Team | Player | Prior T20Is | Form balls faced | Form balls bowled |", "|---|---|---|---|---|");
    for (const p of all) lines.push(`| ${p.team} | ${p.name} | ${p.priorMatches} | ${p.formBatBalls} | ${p.formBowlBalls} |`);
    lines.push("", "</details>", "");
  }

  h("## Venues");
  lines.push("| Venue | Country | Matches | Editions | RPO | Balls/wkt | 1st-inns avg | Chase win % | Chase uplift | Stumped % | Bowled+lbw % |", "|---|---|---|---|---|---|---|---|---|---|---|");
  for (const v of r.venues) {
    const o = v.overall;
    const f = o.dismissalFingerprintPct;
    lines.push(`| ${v.name} | ${v.country} | ${o.matches} | ${Object.keys(v.byEdition).join(", ")} | ${o.runsPerOver} | ${o.ballsPerWicket} | ${o.firstInningsAvg} | ${o.chaseWinPct} | ${o.chaseUplift > 0 ? "+" : ""}${o.chaseUplift} | ${f["stumped"] ?? 0} | ${((f["bowled"] ?? 0) + (f["lbw"] ?? 0)).toFixed(1)} |`);
  }

  h("## Team strength (Elo over all men's T20Is) at each edition's start");
  lines.push("| Edition | Strongest five in the field | Weakest three | Stand-in |", "|---|---|---|---|");
  for (const e of r.editions) {
    const month = (e.firstMatch ?? "").slice(0, 7);
    const field = [...e.teams, ...r.squads.filter((s) => s.standIn && s.editionId === e.id).map((s) => s.team)];
    const rated = field
      .map((t) => {
        const months = r.teamStrength.teams[t]?.byMonth ?? {};
        const prior = Object.keys(months).filter((k) => k < month).sort().pop();
        return { t, r: prior ? months[prior]! : null };
      })
      .filter((x) => x.r !== null)
      .sort((a, b) => (b.r ?? 0) - (a.r ?? 0));
    const fmt = (x: { t: string; r: number | null }) => `${x.t} ${x.r}`;
    const standIn = r.squads.find((s) => s.standIn && s.editionId === e.id);
    lines.push(`| ${e.id} | ${rated.slice(0, 5).map(fmt).join(", ")} | ${rated.slice(-3).map(fmt).join(", ")} | ${standIn ? fmt(rated.find((x) => x.t === standIn.team) ?? { t: standIn.team, r: null }) : "—"} |`);
  }

  h("## Bowler usage norms by edition (complete 20-over innings)");
  lines.push("| Edition | Innings | Bowlers used (5/6/7 %) | Mean | Overs 19–20 by opener % | 6th bowler overs | Return after 18+ over % |", "|---|---|---|---|---|---|---|");
  for (const [ed, u] of Object.entries(r.bowlingUsage.byEdition)) {
    const hp = u.bowlersUsed.histogramPct;
    lines.push(`| ${ed} | ${u.completeInnings} | ${hp["5"] ?? 0}/${hp["6"] ?? 0}/${hp["7"] ?? 0} | ${u.bowlersUsed.mean} | ${u.overs19And20ByOpeningBowlerPct} | ${u.sixthBowler.oversPerInnings} | ${u.returnsLaterByOverCost["18+"]?.pct ?? "–"} |`);
  }

  h("## Batting-order deviation by edition (positions 3–8, % non-modal batter by phase of entry)");
  lines.push("| Edition | Powerplay | Middle | Death |", "|---|---|---|---|");
  for (const [ed, d] of Object.entries(r.lineupDeviation.byEdition)) {
    lines.push(`| ${ed} | ${d.pp?.deviationPct ?? "–"} (n=${d.pp?.entries ?? 0}) | ${d.mid?.deviationPct ?? "–"} (n=${d.mid?.entries ?? 0}) | ${d.death?.deviationPct ?? "–"} (n=${d.death?.entries ?? 0}) |`);
  }

  lines.push("");
  return lines.join("\n");
}
