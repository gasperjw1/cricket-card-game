/**
 * Grounds and conditions for the identity's World Cup (asked 2026-10-30): the edition's scoring
 * environment against the whole archive, the grounds the drafted side will actually play at, and
 * what that asks of the eleven. Everything here is measured from the ball-by-ball data the engine
 * plays on (edition and venue profiles in the wcdraft outputs); nothing is hand-written per venue.
 */

import type { EditionOut, EnvironmentOut, SquadOut, VenueOut } from "../../../wcdraft/src/engine/data.ts";

interface Baseline {
  rpo: number;
  ppRpo: number;
  deathRpo: number;
  bpw: number;
  chasePct: number;
  spinRpo: number;
  paceRpo: number;
}

/** Ball-weighted archive averages, the yardstick for "low-scoring" and the like. */
export function archiveBaseline(editions: EditionOut[]): Baseline {
  let balls = 0, rpo = 0, pp = 0, death = 0, bpw = 0, matches = 0, chase = 0, spinBalls = 0, spinRuns = 0, paceBalls = 0, paceRuns = 0;
  for (const e of editions) {
    const v = e.environment;
    const n = v.legalBalls || 0;
    balls += n; rpo += n * v.runsPerOver; pp += n * (v.powerplayRpo ?? v.runsPerOver); death += n * (v.deathRpo ?? v.runsPerOver); bpw += n * (v.ballsPerWicket ?? 17);
    matches += v.matches; chase += v.matches * (v.chaseWinPct ?? 50);
    if (v.paceSpin) { spinBalls += v.paceSpin.spin.balls; spinRuns += v.paceSpin.spin.balls * v.paceSpin.spin.rpo; paceBalls += v.paceSpin.pace.balls; paceRuns += v.paceSpin.pace.balls * v.paceSpin.pace.rpo; }
  }
  const d = balls || 1;
  return { rpo: rpo / d, ppRpo: pp / d, deathRpo: death / d, bpw: bpw / d, chasePct: chase / (matches || 1), spinRpo: spinRuns / (spinBalls || 1), paceRpo: paceRuns / (paceBalls || 1) };
}

/** Plain-words character of a ground or an edition against the archive. */
export function character(env: EnvironmentOut, base: Baseline): string[] {
  const chips: string[] = [];
  if (env.runsPerOver <= base.rpo - 0.5) chips.push("low-scoring");
  else if (env.runsPerOver >= base.rpo + 0.5) chips.push("high-scoring");
  const ps = env.paceSpin;
  if (ps && ps.spin.balls >= 120 && ps.pace.balls >= 120) {
    if (ps.spin.rpo <= ps.pace.rpo - 0.6) chips.push("spin-friendly");
    else if (ps.pace.rpo <= ps.spin.rpo - 0.6) chips.push("pace-friendly");
  }
  if (env.chaseWinPct !== undefined && env.matches >= 4) {
    if (env.chaseWinPct >= 60) chips.push("chase ground");
    else if (env.chaseWinPct <= 40) chips.push("bat-first ground");
  }
  if (env.deathRpo !== undefined) {
    const lift = env.deathRpo - env.runsPerOver - (base.deathRpo - base.rpo);
    if (lift >= 0.7) chips.push("death overs fly");
    else if (lift <= -0.7) chips.push("death overs held");
  }
  if (env.ballsPerWicket !== undefined) {
    if (env.ballsPerWicket <= base.bpw - 2) chips.push("wickets fall");
    else if (env.ballsPerWicket >= base.bpw + 2) chips.push("hard to dismiss");
  }
  return chips;
}

const NEEDS: Record<string, string> = {
  "spin-friendly": "spinners, and batters who score off spin",
  "pace-friendly": "quick bowlers with the new ball",
  "low-scoring": "wicket-takers and strike rotation over pure six-hitting",
  "high-scoring": "boundary hitters, and death bowlers who hold their nerve",
  "death overs fly": "specialist death bowlers and finishers",
  "death overs held": "a top order that sets the innings up early",
  "chase ground": "a middle order that can chase",
  "bat-first ground": "openers who bat deep and defendable totals",
  "wickets fall": "batting depth down to No. 8",
  "hard to dismiss": "bowlers who keep it tight rather than hunt wickets",
};

/** Matches per venue for the identity side: its real fixtures, or the edition's grounds for a stand-in without any. */
export function venueCountsFor(team: string, squads: SquadOut[], edition: EditionOut | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of squads.find((s) => s.team === team)?.matches ?? []) counts[m.venueId] = (counts[m.venueId] ?? 0) + 1;
  if (Object.keys(counts).length) return counts;
  return edition?.venues ?? {};
}

export function VenueBrief({ editionId, editions, venues, venueCounts }: { editionId: string; editions: EditionOut[]; venues: VenueOut[]; venueCounts: Record<string, number> }) {
  const edition = editions.find((e) => e.id === editionId);
  if (!edition) return null;
  const base = archiveBaseline(editions);
  const env = edition.environment;
  const grounds = Object.entries(venueCounts)
    .map(([id, n]) => ({ venue: venues.find((v) => v.id === id), n }))
    .filter((g): g is { venue: VenueOut; n: number } => !!g.venue)
    .sort((a, b) => b.n - a.n);
  const totalMatches = grounds.reduce((a, g) => a + g.n, 0);
  // A ground's stats from this edition when it hosted enough, otherwise its whole World Cup record.
  const statsOf = (v: VenueOut) => {
    const own = v.byEdition[editionId];
    return own && own.matches >= 3 ? { env: own, scope: `${own.matches} matches in ${editionId}` } : { env: v.overall, scope: `${v.overall.matches} World Cup matches, all editions` };
  };
  const needWeight = new Map<string, number>();
  for (const g of grounds) for (const chip of character(statsOf(g.venue).env, base)) needWeight.set(chip, (needWeight.get(chip) ?? 0) + g.n);
  const needs = [...needWeight.entries()].filter(([, w]) => w >= 0.4 * totalMatches).map(([chip]) => NEEDS[chip]).filter(Boolean);
  const f1 = (x: number | undefined) => (x === undefined ? "–" : x.toFixed(1));
  return (
    <div className="brief">
      <p>
        <b>{editionId} overall:</b> {f1(env.runsPerOver)} an over (archive {base.rpo.toFixed(1)}), powerplay {f1(env.powerplayRpo)}, death {f1(env.deathRpo)}; a wicket every {f1(env.ballsPerWicket)} balls; chases won {env.chaseWinPct ?? "–"}%
        {env.paceSpin ? <>; spin {f1(env.paceSpin.spin.rpo)} an over against pace {f1(env.paceSpin.pace.rpo)}, spin bowling {env.paceSpin.spin.sharePct}% of the overs</> : null}.
        {" "}{character(env, base).map((c) => <span key={c} className="tag">{c}</span>)}
      </p>
      {grounds.length > 0 && (
        <ul className="grounds">
          {grounds.map(({ venue, n }) => {
            const { env: ve, scope } = statsOf(venue);
            return (
              <li key={venue.id}>
                <b>{venue.name}, {venue.city}</b> <span className="small">· {n} of your {totalMatches} matches · {scope}</span>
                <div className="small">
                  {f1(ve.runsPerOver)} an over · powerplay {f1(ve.powerplayRpo)} · death {f1(ve.deathRpo)} · wicket every {f1(ve.ballsPerWicket)} balls · chases won {ve.chaseWinPct ?? "–"}%
                  {ve.paceSpin && ve.paceSpin.spin.balls >= 120 ? <> · spin {f1(ve.paceSpin.spin.rpo)} / pace {f1(ve.paceSpin.pace.rpo)}</> : null}
                  {" "}{character(ve, base).map((c) => <span key={c} className="tag">{c}</span>)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {needs.length > 0 && <p><b>What your grounds ask for:</b> {needs.join("; ")}.</p>}
    </div>
  );
}
