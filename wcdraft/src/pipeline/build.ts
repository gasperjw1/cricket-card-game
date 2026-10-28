/**
 * Phase 0 build: one chronological pass over the men's T20I archive producing every derived
 * table the draft game and the later engine need.
 *
 * Pass structure
 *   1. Index pass (cached): match-level facts for all matches, sorted by date.
 *   2. From the index: identify World Cup matches, edition start dates, form windows, squads.
 *   3. Main pass, in date order, one match in memory at a time:
 *        - snapshot career-to-date for an edition's squads when its first match date arrives
 *        - fold the match into career / tournament / form blocks as applicable
 *        - World Cup matches also feed edition, venue, usage, lineup and partnership analyses
 */

import { BowlingUsageAnalysis } from "../analysis/bowling-usage.js";
import { EditionsAnalysis } from "../analysis/editions.js";
import { LineupDeviationAnalysis } from "../analysis/lineup-deviation.js";
import { PartnershipsAnalysis } from "../analysis/partnerships.js";
import { PlayerStore } from "../analysis/players.js";
import { TeamStrengthAnalysis } from "../analysis/team-strength.js";
import { TeamStyleAnalysis } from "../analysis/team-style.js";
import { VenuesAnalysis } from "../analysis/venues.js";
import { WindowPopulationAnalysis } from "../analysis/window-population.js";
import { loadConfig, type Config } from "../config.js";
import { ARCHIVE, ARCHIVES, archiveIsReady, loadIndex, readMatch, readSnapshot, type MatchIndexEntry } from "../cricsheet/archive.js";
import { isCompleteInnings, mainInnings, normaliseMatch } from "../cricsheet/match.js";
import { addMonths, getOrCreate } from "../util/stats.js";

/** "Has form data" for coverage reporting. */
export const FORM_THRESHOLDS = { batBalls: 30, bowlBalls: 48 } as const;
/** Below either of these in the form window, the draft UI shows a low-sample badge (decided 2026-10-28). */
export const BADGE_THRESHOLDS = { batBalls: 60, bowlBalls: 72 } as const;
/** Stand-in squads with no T20Is in the form window use their nearest T20Is after the edition, within this span. */
export const STAND_IN_FALLBACK_MONTHS = 60;
export const STAND_IN_FALLBACK_MATCHES = 12;

interface EditionWindow {
  id: string;
  start: string;
  end: string;
  windowStart: string;
}

export interface BuildResult {
  meta: {
    generatedAt: string;
    archive: { name: string; url: string; licence: string; downloadedAt: string; fileCount: number };
    formWindowMonths: number;
    thresholds: typeof FORM_THRESHOLDS;
    badgeThresholds: typeof BADGE_THRESHOLDS;
  };
  editions: ReturnType<EditionsAnalysis["summary"]>;
  venues: ReturnType<VenuesAnalysis["summary"]>;
  playerEditions: ReturnType<PlayerStore["playerEditions"]>;
  people: ReturnType<PlayerStore["people"]>;
  squads: ReturnType<PlayerStore["squadsOut"]>;
  bowlingUsage: ReturnType<BowlingUsageAnalysis["summary"]>;
  lineupDeviation: ReturnType<LineupDeviationAnalysis["summary"]>;
  partnerships: ReturnType<PartnershipsAnalysis["summary"]>;
  teamStyle: ReturnType<TeamStyleAnalysis["summary"]>;
  teamStrength: ReturnType<TeamStrengthAnalysis["summary"]>;
  /** Elo over men's ODIs: team strength before T20Is existed, and the ODI captaincy baseline. */
  odiTeamStrength: ReturnType<TeamStrengthAnalysis["summary"]>;
  /** ODI batting norms per calendar year (balls faced, batter runs, striker dismissals), for the ODI prior. */
  odiPopulationByYear: Record<string, { balls: number; runs: number; outs: number }>;
  /** Per-edition form-window population vectors by opposition tier: shrinkage priors and normalisation targets. */
  windowPopulation: ReturnType<WindowPopulationAnalysis["summary"]>;
  coverage: Coverage;
}

export interface Coverage {
  editions: {
    editionId: string;
    teams: {
      team: string;
      standIn: boolean;
      squadSize: number;
      withFormBatting: number;
      withFormBowling: number;
      withAnyPriorT20I: number;
      lowSampleBadge: number;
      lackingData: { id: string; name: string; priorMatches: number; formBatBalls: number; formBowlBalls: number }[];
    }[];
  }[];
  totals: { distinctPeople: number; playerEditions: number; lackingData: number; lowSampleBadge: number };
}

export function runBuild(log: (msg: string) => void = () => {}): BuildResult {
  const t0 = Date.now();
  const config = loadConfig();
  const snapshot = readSnapshot();
  const index = loadIndex().filter((e) => e.gender === "male");
  log(`Index: ${index.length} men's T20Is (${snapshot.downloadedAt.slice(0, 10)} snapshot)`);

  const wcEditionOf = (e: MatchIndexEntry): string | null =>
    e.eventName && config.worldCupEventNames.has(e.eventName) ? (config.editionBySeason.get(e.season)?.id ?? null) : null;

  const windows = editionWindows(index, config, wcEditionOf);
  log(`World Cup editions found: ${windows.map((w) => `${w.id} (${w.start}…${w.end})`).join(", ")}`);

  const store = new PlayerStore(config);
  for (const e of index) {
    const ed = wcEditionOf(e);
    if (!ed) continue;
    for (const [team, names] of Object.entries(e.players)) {
      store.registerSquad(ed, team, names.map((n) => e.registry[n] ?? `name:${n}`), e.registry);
    }
  }
  // Stand-in teams never played the edition. Their squad is everyone they fielded in the form
  // window; if they had no T20Is then (pre-2019 associates), fall back to their nearest T20Is
  // within STAND_IN_FALLBACK_MONTHS after the edition; beyond that the squad must be hand-made.
  const fallbackByMatch = new Map<string, { editionId: string; team: string }[]>();
  for (const w of windows) {
    const cfg = config.editions.editions.find((c) => c.id === w.id)!;
    for (const team of cfg.slotChanges.filter((s) => s.action === "add").map((s) => s.team)) {
      const inWindow = index.filter((e) => e.date >= w.windowStart && e.date < w.start && e.teams.includes(team));
      if (inWindow.length > 0) {
        for (const e of inWindow) store.registerSquad(w.id, team, (e.players[team] ?? []).map((n) => e.registry[n] ?? `name:${n}`), e.registry, { source: "form-window" });
        continue;
      }
      const limit = addMonths(w.start, STAND_IN_FALLBACK_MONTHS);
      const nearest = index.filter((e) => e.date >= w.start && e.date < limit && e.teams.includes(team)).slice(0, STAND_IN_FALLBACK_MATCHES);
      if (nearest.length === 0) {
        const hand = config.handSquads.find((h) => h.editionId === w.id && h.team === team);
        if (!hand) {
          log(`WARNING: stand-in ${team} has no T20Is within ${STAND_IN_FALLBACK_MONTHS} months of ${w.id} and no entry in hand-squads.json`);
          store.registerSquad(w.id, team, [], {}, { source: "hand" });
          continue;
        }
        // Synthetic ids keep hand-made players distinct from Cricsheet people; they carry no match data.
        const ids = hand.players.map((p) => `hand:${w.id}:${slug(p.shortName ?? p.name)}`);
        const names = Object.fromEntries(hand.players.map((p, i) => [p.shortName ?? p.name, ids[i]!]));
        store.registerSquad(w.id, team, ids, names, { source: "hand" });
        log(`stand-in ${team} ${w.id}: hand-made squad of ${ids.length} from hand-squads.json`);
        continue;
      }
      log(`stand-in ${team} ${w.id}: no T20Is in the form window; using ${nearest.length} nearest T20Is from ${nearest[0]!.date}`);
      for (const e of nearest) {
        store.registerSquad(w.id, team, (e.players[team] ?? []).map((n) => e.registry[n] ?? `name:${n}`), e.registry, { source: "nearest-t20is" });
        getOrCreate(fallbackByMatch, e.id, () => []).push({ editionId: w.id, team });
      }
    }
  }

  const editions = new EditionsAnalysis(config);
  const venues = new VenuesAnalysis(config);
  const usage = new BowlingUsageAnalysis();
  const lineup = new LineupDeviationAnalysis();
  const partnerships = new PartnershipsAnalysis();
  const teamStyle = new TeamStyleAnalysis();
  const teamStrength = new TeamStrengthAnalysis(config.isFullMember);
  const windowPopulation = new WindowPopulationAnalysis(config);

  const pendingSnapshots = [...windows].sort((a, b) => a.start.localeCompare(b.start));
  let read = 0;

  for (const entry of index) {
    while (pendingSnapshots.length && pendingSnapshots[0]!.start <= entry.date) {
      const w = pendingSnapshots.shift()!;
      store.snapshotCareer(w.id);
      // Team strength at the edition's start, for every squad in it (stand-ins included).
      const elos = new Map<string, number>();
      for (const team of store.squads.get(w.id)?.keys() ?? []) elos.set(team, teamStrength.ratingOf(team, w.start));
      store.teamEloAtEdition.set(w.id, elos);
    }
    const wcEdition = wcEditionOf(entry);
    const formEditions = windows.filter((w) => w.windowStart <= entry.date && entry.date < w.start).map((w) => w.id);
    // Every match is read: matches after the last edition still feed all-time signals (e.g. stumpings).

    const m = normaliseMatch(readMatch(entry.file), entry.id);
    read += 1;
    const venue = wcEdition ? venues.resolve(m) : null;
    // Pre-match Elo of both sides, read before this match updates the ratings.
    const elo = Object.fromEntries(m.teams.map((t) => [t, teamStrength.ratingOf(t, m.date)]));
    store.addMatch(m, { wcEdition, formEditions, standInFallback: fallbackByMatch.get(entry.id) ?? [], venueId: venue?.id ?? null, elo });
    teamStyle.add(m);
    teamStrength.add(m);
    for (const ed of formEditions) windowPopulation.add(ed, m, elo, "window");
    if (wcEdition) windowPopulation.add(wcEdition, m, elo, "tournament");

    if (wcEdition && venue) {
      editions.add(wcEdition, m, venue.id);
      venues.add(wcEdition, venue, m);
      for (const inn of mainInnings(m)) {
        if (isCompleteInnings(inn)) usage.add(wcEdition, inn);
        lineup.add(wcEdition, inn);
        partnerships.add(wcEdition, inn, memberOf(store, wcEdition, inn.team), `${m.id}:${inn.index}`);
      }
    }
    for (const ed of formEditions) {
      for (const inn of mainInnings(m)) partnerships.add(ed, inn, memberOf(store, ed, inn.team), `${m.id}:${inn.index}`);
    }
  }
  log(`Read ${read} T20I files in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // ODI pass: career snapshots at each edition's start (weak prior for 2007/2009) and an ODI Elo.
  const odiStrength = new TeamStrengthAnalysis(config.isFullMember);
  const odiPopulationByYear: Record<string, { balls: number; runs: number; outs: number }> = {};
  let odiRead = 0;
  if (archiveIsReady(ARCHIVES.odi)) {
    const odiIndex = loadIndex(ARCHIVES.odi).filter((e) => e.gender === "male");
    const pending = [...windows].sort((a, b) => a.start.localeCompare(b.start));
    const lastStart = pending[pending.length - 1]?.start ?? "";
    for (const entry of odiIndex) {
      while (pending.length && pending[0]!.start <= entry.date) store.snapshotOdiCareer(pending.shift()!.id);
      const m = normaliseMatch(readMatch(entry.file), entry.id);
      odiRead += 1;
      odiStrength.add(m);
      // Era norms for the ODI prior: balls, batter runs and striker dismissals per calendar year.
      const pop = (odiPopulationByYear[m.date.slice(0, 4)] ??= { balls: 0, runs: 0, outs: 0 });
      for (const inn of mainInnings(m)) {
        for (const b of inn.balls) {
          if (b.wide) continue;
          pop.balls += 1;
          pop.runs += b.runsBatter;
          if (b.wickets.some((w) => w.playerOut === b.batter)) pop.outs += 1;
        }
      }
      if (entry.date < lastStart) store.addOdiMatch(m);
    }
    while (pending.length) store.snapshotOdiCareer(pending.shift()!.id);
    log(`Read ${odiRead} ODI files (${odiIndex.length} indexed)`);
  } else {
    log("ODI archive not fetched: odiCareerToDate will be empty (run `npm run data:fetch`)");
  }

  const playerEditions = store.playerEditions();
  const result: BuildResult = {
    meta: {
      generatedAt: new Date().toISOString(),
      archive: { name: ARCHIVE.name, url: ARCHIVE.url, licence: ARCHIVE.licence, downloadedAt: snapshot.downloadedAt, fileCount: snapshot.fileCount },
      formWindowMonths: config.editions.formWindowMonths,
      thresholds: FORM_THRESHOLDS,
      badgeThresholds: BADGE_THRESHOLDS,
    },
    editions: editions.summary(),
    venues: venues.summary(),
    playerEditions,
    people: store.people(),
    squads: store.squadsOut(),
    bowlingUsage: usage.summary(),
    lineupDeviation: lineup.summary(store.names),
    partnerships: partnerships.summary(store.names),
    teamStyle: teamStyle.summary(),
    teamStrength: teamStrength.summary(),
    odiTeamStrength: odiStrength.summary(),
    odiPopulationByYear,
    windowPopulation: windowPopulation.summary(),
    coverage: computeCoverage(playerEditions),
  };
  log(`Built ${result.playerEditions.length} player-editions, ${result.people.length} people, ${result.squads.length} squads in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return result;
}

function slug(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function memberOf(store: PlayerStore, editionId: string, team: string): (id: string) => boolean {
  return (id) => store.teamOf.get(id)?.get(editionId) === team;
}

function editionWindows(index: MatchIndexEntry[], config: Config, wcEditionOf: (e: MatchIndexEntry) => string | null): EditionWindow[] {
  const dates = new Map<string, string[]>();
  for (const e of index) {
    const ed = wcEditionOf(e);
    if (ed) (dates.get(ed) ?? dates.set(ed, []).get(ed)!).push(e.date);
  }
  return config.editions.editions
    .filter((e) => dates.has(e.id))
    .map((e) => {
      const ds = dates.get(e.id)!;
      const start = ds.reduce((a, b) => (a < b ? a : b));
      const end = ds.reduce((a, b) => (a > b ? a : b));
      return { id: e.id, start, end, windowStart: addMonths(start, -config.editions.formWindowMonths) };
    });
}

function computeCoverage(rows: BuildResult["playerEditions"]): Coverage {
  const byEdition = new Map<string, Map<string, typeof rows>>();
  for (const r of rows) {
    const teams = byEdition.get(r.editionId) ?? byEdition.set(r.editionId, new Map()).get(r.editionId)!;
    (teams.get(r.team) ?? teams.set(r.team, []).get(r.team)!).push(r);
  }
  let lacking = 0;
  let badged = 0;
  const people = new Set(rows.map((r) => r.personId));
  const editions = [...byEdition.entries()].sort().map(([editionId, teams]) => ({
    editionId,
    teams: [...teams.entries()].sort().map(([team, list]) => {
      const formBat = (r: (typeof rows)[number]) => r.form.summary.bat.balls;
      const formBowl = (r: (typeof rows)[number]) => r.form.summary.bowl.balls;
      const lackingData = list
        .filter((r) => formBat(r) < FORM_THRESHOLDS.batBalls && formBowl(r) < FORM_THRESHOLDS.bowlBalls)
        .map((r) => ({ id: r.personId, name: r.name, priorMatches: r.careerToDate.summary.matches, formBatBalls: formBat(r), formBowlBalls: formBowl(r) }));
      const lowSampleBadge = list.filter((r) => formBat(r) < BADGE_THRESHOLDS.batBalls && formBowl(r) < BADGE_THRESHOLDS.bowlBalls).length;
      lacking += lackingData.length;
      badged += lowSampleBadge;
      return {
        team,
        standIn: list[0]?.standIn ?? false,
        squadSize: list.length,
        withFormBatting: list.filter((r) => formBat(r) >= FORM_THRESHOLDS.batBalls).length,
        withFormBowling: list.filter((r) => formBowl(r) >= FORM_THRESHOLDS.bowlBalls).length,
        withAnyPriorT20I: list.filter((r) => r.careerToDate.summary.matches > 0).length,
        lowSampleBadge,
        lackingData,
      };
    }),
  }));
  return { editions, totals: { distinctPeople: people.size, playerEditions: rows.length, lackingData: lacking, lowSampleBadge: badged } };
}
