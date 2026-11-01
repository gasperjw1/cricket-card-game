/**
 * Player-edition store.
 *
 * For every (person, edition) where the person was in a World Cup squad, keeps three blocks:
 *   tournament   — their record in that World Cup
 *   form         — all T20Is in the `formWindowMonths` before the edition's first match
 *   careerToDate — cumulative T20I record snapshotted at the edition's first match
 * plus the squad lists and real XIs the CPU teams will replay.
 */

import type { Config } from "../config.js";
import { PHASES, mainInnings, phaseOf, type Match, type Phase } from "../cricsheet/match.js";
import type { ContextPopulation } from "./context-population.js";
import { getOrCreate } from "../util/stats.js";
import { addInnings, cloneBlock, emptyBlock, summariseBlock, type PlayerBlock } from "./player-block.js";
import { ELO_BINS, eloBin, type EloBin } from "./team-strength.js";
import type { MatchElo } from "./window-population.js";

export interface SquadMatch {
  id: string;
  date: string;
  stage: string | null;
  group: string | null;
  venueId: string;
  opponent: string;
  battedFirst: boolean;
  xi: string[];
  battingOrder: string[];
  bowlerByOver: string[];
  total: number | null;
  wickets: number | null;
  winner: string | null;
  result: string | null;
}

export type SquadSource = "world-cup" | "form-window" | "nearest-t20is" | "hand";

interface SquadRecord {
  players: Map<string, { matches: number }>;
  /** World Cup matches (real squads) or the T20Is a stand-in's squad was built from. */
  matches: SquadMatch[];
  /** True for a team inserted into Afghanistan's slot: it never played this edition. */
  standIn: boolean;
  source: SquadSource;
}

type BlockMap = Map<string, PlayerBlock>;

export type Exposure = { bat: Record<EloBin, number>; bowl: Record<EloBin, number> };
const emptyExposure = (): Exposure => ({
  bat: Object.fromEntries(ELO_BINS.map((b) => [b, 0])) as Record<EloBin, number>,
  bowl: Object.fromEntries(ELO_BINS.map((b) => [b, 0])) as Record<EloBin, number>,
});

export class PlayerStore {
  /** editionId → team → squad record */
  readonly squads = new Map<string, Map<string, SquadRecord>>();
  /** editionId → set of person ids across all its squads */
  readonly squadMembers = new Map<string, Set<string>>();
  /** personId → { editionId → team } */
  readonly teamOf = new Map<string, Map<string, string>>();
  readonly names = new Map<string, string>();

  private readonly tournament = new Map<string, BlockMap>();
  private readonly form = new Map<string, BlockMap>();
  /** Form and tournament split by the opposition's tier at the time (full member vs associate), for opposition adjustment. */
  private readonly formVsFull = new Map<string, BlockMap>();
  private readonly formVsAssociate = new Map<string, BlockMap>();
  private readonly tournamentVsFull = new Map<string, BlockMap>();
  private readonly tournamentVsAssociate = new Map<string, BlockMap>();
  /** Balls faced / bowled per opponent-Elo bin, per (edition, person): the exposure behind the opposition adjustment. */
  private readonly formExposure = new Map<string, Map<string, Exposure>>();
  private readonly tournamentExposure = new Map<string, Map<string, Exposure>>();
  /** editionId → team → Elo at the edition's start (set by the build when it snapshots careers). */
  readonly teamEloAtEdition = new Map<string, Map<string, number>>();
  /** Per (edition, person): form balls by venue string, batting and bowling, for venue normalisation. */
  private readonly formVenueBalls = new Map<string, Map<string, { bat: Record<string, number>; bowl: Record<string, number> }>>();
  /**
   * Phase 1.5: form blocks split by the opponent's Elo bin, keyed `${personId}|${bin}` per edition.
   * Only pooled counts are exported; they feed the edge-transfer measurement (weak vs strong opposition).
   */
  private readonly formByBin = new Map<string, BlockMap>();
  /** editionId → team → matches the team played inside the edition's form window (the usage denominator). */
  private readonly formTeamMatches = new Map<string, Map<string, number>>();
  private readonly career: BlockMap = new Map();
  private readonly careerSnapshots = new Map<string, BlockMap>();
  /** Stumpings credited to a person anywhere in the archive, any date: the broadest "has kept" signal. */
  private readonly allTimeStumpings = new Map<string, number>();
  /** ODI career blocks (innings-level only) and their snapshots at each edition's start: the weak prior for early editions. */
  private readonly odiCareer: BlockMap = new Map();
  private readonly odiSnapshots = new Map<string, BlockMap>();
  /**
   * T20Is from an edition's first match on, for projected cards: a block per skill, so the batting
   * block can stop at its target while the bowling one keeps filling. Stand-ins built from their
   * nearest T20Is are left out; those balls are already their form window.
   */
  private readonly laterBat = new Map<string, BlockMap>();
  private readonly laterBowl = new Map<string, BlockMap>();
  private readonly laterExposure = new Map<string, Map<string, Exposure>>();

  constructor(private readonly config: Config, private readonly laterTargetBalls = Infinity) {}

  /** Who in this match still needs later balls for this edition, per skill, decided before the match is folded in. */
  private laterOpen(editionId: string, m: Match): Record<"bat" | "bowl", Set<string>> {
    const open = { bat: new Set<string>(), bowl: new Set<string>() };
    const batBlocks = getOrCreate(this.laterBat, editionId, () => new Map()), bowlBlocks = getOrCreate(this.laterBowl, editionId, () => new Map());
    for (const id of Object.values(m.xis).flat()) {
      const team = this.teamOf.get(id)?.get(editionId);
      if (!team || this.squads.get(editionId)?.get(team)?.source === "nearest-t20is") continue;
      if (phaseBallsOf(batBlocks.get(id)?.bat) < this.laterTargetBalls) open.bat.add(id);
      if (phaseBallsOf(bowlBlocks.get(id)?.bowl) < this.laterTargetBalls) open.bowl.add(id);
    }
    return open;
  }

  /**
   * Register players as squad members for an edition (called from the index pass): a World Cup
   * match's XIs for real squads, or form-window XIs for a stand-in team.
   */
  registerSquad(editionId: string, team: string, playerIds: string[], names: Record<string, string>, opts: { source?: SquadSource } = {}): void {
    const source = opts.source ?? "world-cup";
    const squad = getOrCreate(getOrCreate(this.squads, editionId, () => new Map()), team, () => ({ players: new Map(), matches: [], standIn: source !== "world-cup", source }));
    const members = getOrCreate(this.squadMembers, editionId, () => new Set());
    for (const id of playerIds) {
      getOrCreate(squad.players, id, () => ({ matches: 0 }));
      members.add(id);
      getOrCreate(this.teamOf, id, () => new Map()).set(editionId, team);
    }
    for (const [name, id] of Object.entries(names)) if (!this.names.has(id)) this.names.set(id, name);
  }

  /** Freeze every squad member's career block as their career-to-date for this edition. */
  snapshotCareer(editionId: string): void {
    const snap: BlockMap = new Map();
    for (const id of this.squadMembers.get(editionId) ?? []) snap.set(id, cloneBlock(this.career.get(id) ?? emptyBlock()));
    this.careerSnapshots.set(editionId, snap);
  }

  /** Same for ODIs (run as a separate chronological pass over the ODI archive). */
  snapshotOdiCareer(editionId: string): void {
    const snap: BlockMap = new Map();
    for (const id of this.squadMembers.get(editionId) ?? []) snap.set(id, cloneBlock(this.odiCareer.get(id) ?? emptyBlock()));
    this.odiSnapshots.set(editionId, snap);
  }

  /** Fold an ODI into every player's ODI career block (innings-level figures; no T20 phase vectors). */
  addOdiMatch(m: Match): void {
    for (const [id, name] of m.names) if (!this.names.has(id)) this.names.set(id, name);
    const touched = new Set<string>();
    for (const inn of mainInnings(m)) addInnings(inn, (id) => getOrCreate(this.odiCareer, id, emptyBlock), touched, { phaseVectors: false });
    for (const xi of Object.values(m.xis)) for (const id of xi) getOrCreate(this.odiCareer, id, emptyBlock).matches += 1;
  }

  /**
   * Fold one match into the career blocks (all players), the tournament blocks (if it is a
   * World Cup match) and the form blocks of every edition whose window contains it.
   */
  /**
   * @param ctx.formEditions   editions whose form window contains this match (all squad members accumulate)
   * @param ctx.standInFallback editions for which this match is a stand-in team's nearest-T20I
   *                            fallback (only that team's members accumulate form)
   */
  addMatch(
    m: Match,
    ctx: {
      wcEdition: string | null;
      formEditions: string[];
      standInFallback: { editionId: string; team: string }[];
      /** Editions this match falls after the start of, within the projection span. */
      laterEditions?: string[];
      venueId: string | null;
      elo: MatchElo;
      /** Frozen context populations from the first pass; when present, blocks also accumulate expected outcomes. */
      context?: ContextPopulation;
      /** Whether the per-ball expectation includes the ground's scoring factor (default true), optionally per skill. */
      contextVenue?: boolean | { bat: boolean; bowl: boolean };
    },
  ): void {
    for (const [id, name] of m.names) if (!this.names.has(id)) this.names.set(id, name);
    const later = (ctx.laterEditions ?? []).map((editionId) => ({ editionId, open: this.laterOpen(editionId, m) }));
    this.recordExposure(m, ctx, later);
    for (const inn of m.innings) {
      for (const b of inn.balls) {
        for (const w of b.wickets) if (w.kind === "stumped" && w.fielders[0]) this.allTimeStumpings.set(w.fielders[0], (this.allTimeStumpings.get(w.fielders[0]) ?? 0) + 1);
      }
    }

    // Each target optionally restricts to innings where the *opposition* is of a given tier, or
    // (binned) files each member's balls under the opponent's Elo bin instead of under the member alone.
    type Target = { blocks: BlockMap; member: (id: string) => boolean; opponentTier?: "full" | "associate"; binned?: boolean };
    const targets: Target[] = [{ blocks: this.career, member: () => true }];
    if (ctx.wcEdition) {
      const members = this.squadMembers.get(ctx.wcEdition) ?? new Set<string>();
      const member = (id: string) => members.has(id);
      targets.push({ blocks: getOrCreate(this.tournament, ctx.wcEdition, () => new Map()), member });
      targets.push({ blocks: getOrCreate(this.tournamentVsFull, ctx.wcEdition, () => new Map()), member, opponentTier: "full" });
      targets.push({ blocks: getOrCreate(this.tournamentVsAssociate, ctx.wcEdition, () => new Map()), member, opponentTier: "associate" });
    }
    const formTargets: { editionId: string; member: (id: string) => boolean }[] = [];
    for (const e of ctx.formEditions) {
      const members = this.squadMembers.get(e) ?? new Set<string>();
      formTargets.push({ editionId: e, member: (id) => members.has(id) });
    }
    for (const { editionId, team } of ctx.standInFallback) {
      formTargets.push({ editionId, member: (id) => this.teamOf.get(id)?.get(editionId) === team });
    }
    for (const f of formTargets) {
      targets.push({ blocks: getOrCreate(this.form, f.editionId, () => new Map()), member: f.member });
      targets.push({ blocks: getOrCreate(this.formVsFull, f.editionId, () => new Map()), member: f.member, opponentTier: "full" });
      targets.push({ blocks: getOrCreate(this.formVsAssociate, f.editionId, () => new Map()), member: f.member, opponentTier: "associate" });
      targets.push({ blocks: getOrCreate(this.formByBin, f.editionId, () => new Map()), member: f.member, binned: true });
    }
    for (const { editionId, open } of later) {
      targets.push({ blocks: getOrCreate(this.laterBat, editionId, () => new Map()), member: (id) => open.bat.has(id) });
      targets.push({ blocks: getOrCreate(this.laterBowl, editionId, () => new Map()), member: (id) => open.bowl.has(id) });
    }
    // Usage denominator: every match a squad's team played inside the window counts, whether or
    // not a given member was picked for it.
    for (const e of ctx.formEditions) {
      for (const team of m.teams) if (this.squads.get(e)?.has(team)) this.bumpTeamMatches(e, team);
    }
    for (const { editionId, team } of ctx.standInFallback) if (m.teams.includes(team)) this.bumpTeamMatches(editionId, team);

    const year = Number(m.date.slice(0, 4));
    const tierOf = (team: string): "full" | "associate" => (this.config.isFullMember(team, year) ? "full" : "associate");
    for (const t of targets) {
      const touched = new Set<string>();
      const blocks = (id: string) => getOrCreate(t.blocks, id, emptyBlock);
      for (const inn of mainInnings(m)) {
        // A member batting faces the bowling side; a member bowling faces the batting side. Both
        // are "the opposition" for that member, so the innings qualifies if either side has the tier.
        const scratch = emptyBlock();
        const battingTier = tierOf(inn.team);
        const bowlingTier = tierOf(inn.bowlingTeam);
        const attackBin = eloBin(ctx.elo[inn.bowlingTeam] ?? 1500);
        const batsideBin = eloBin(ctx.elo[inn.team] ?? 1500);
        // Phase 1.5: per-ball expected outcomes for the striker (vs the attack) and the bowler (vs the batting side).
        const cp = ctx.context;
        // Context is constant within an innings except for the phase, so memoise per phase.
        const memo: Record<string, Record<string, number>> = {};
        const lookup = (skill: "bat" | "bowl", opp: number, over: number) => {
          const key = `${skill}|${phaseOf(over)}`;
          const useVenue = typeof ctx.contextVenue === "object" ? ctx.contextVenue[skill] : ctx.contextVenue !== false;
          return (memo[key] ??= cp!.expected(skill, m.date, opp, phaseOf(over), useVenue ? m.venue : null));
        };
        const context = cp
          ? {
              bat: (b: { over: number }) => lookup("bat", ctx.elo[inn.bowlingTeam] ?? 1500, b.over) as Record<"0" | "1" | "2" | "3" | "4" | "6" | "W", number>,
              bowl: (b: { over: number }) => lookup("bowl", ctx.elo[inn.team] ?? 1500, b.over) as Record<"0" | "1" | "2" | "3" | "4" | "6" | "W", number>,
            }
          : undefined;
        addInnings(
          inn,
          (id) => {
            if (!t.member(id)) return scratch;
            // A batter in this innings faces the bowling side; anyone else credited (bowler, fielder) faces the batting side.
            if (t.opponentTier) {
              const oppTier = inn.batters.has(id) ? bowlingTier : battingTier;
              if (oppTier !== t.opponentTier) return scratch;
            }
            if (t.binned) return blocks(`${id}|${inn.batters.has(id) ? attackBin : batsideBin}`);
            return blocks(id);
          },
          touched,
          { context },
        );
      }
      if (t.binned) continue;
      for (const xi of Object.values(m.xis)) for (const id of xi) if (t.member(id) && !t.opponentTier) blocks(id).matches += 1;
      if (t.opponentTier) {
        for (const [team, xi] of Object.entries(m.xis)) {
          const opp = m.teams.find((x) => x !== team) ?? "";
          if (tierOf(opp) !== t.opponentTier) continue;
          for (const id of xi) if (t.member(id)) blocks(id).matches += 1;
        }
      }
    }

    if (ctx.wcEdition && ctx.venueId) this.recordSquadMatch(ctx.wcEdition, ctx.venueId, m, false);
    // Stand-in squads collect the matches their squad was built from, to derive a default XI.
    for (const e of ctx.formEditions) {
      if (m.teams.some((t) => this.squads.get(e)?.get(t)?.source === "form-window")) this.recordSquadMatch(e, ctx.venueId ?? "", m, true);
    }
    for (const { editionId } of ctx.standInFallback) this.recordSquadMatch(editionId, ctx.venueId ?? "", m, true);
  }

  private bumpTeamMatches(editionId: string, team: string): void {
    const byTeam = getOrCreate(this.formTeamMatches, editionId, () => new Map<string, number>());
    byTeam.set(team, (byTeam.get(team) ?? 0) + 1);
  }

  /** Balls faced (vs the bowling side's Elo bin) and bowled (vs the batting side's Elo bin) per member. */
  private recordExposure(m: Match, ctx: { wcEdition: string | null; formEditions: string[]; standInFallback: { editionId: string; team: string }[]; elo: MatchElo }, later: { editionId: string; open: Record<"bat" | "bowl", Set<string>> }[]): void {
    const targets: { store: Map<string, Map<string, Exposure>>; editionId: string; member: (id: string) => boolean }[] = [];
    for (const { editionId, open } of later) targets.push({ store: this.laterExposure, editionId, member: (id) => open.bat.has(id) || open.bowl.has(id) });
    if (ctx.wcEdition) {
      const members = this.squadMembers.get(ctx.wcEdition) ?? new Set<string>();
      targets.push({ store: this.tournamentExposure, editionId: ctx.wcEdition, member: (id) => members.has(id) });
    }
    for (const e of ctx.formEditions) {
      const members = this.squadMembers.get(e) ?? new Set<string>();
      targets.push({ store: this.formExposure, editionId: e, member: (id) => members.has(id) });
    }
    for (const { editionId, team } of ctx.standInFallback) {
      targets.push({ store: this.formExposure, editionId, member: (id) => this.teamOf.get(id)?.get(editionId) === team });
    }
    if (!targets.length) return;
    const venueKey = m.venue ?? "unknown";
    for (const inn of mainInnings(m)) {
      if (inn.reduced) continue;
      const attackBin = eloBin(ctx.elo[inn.bowlingTeam] ?? 1500);
      const batsideBin = eloBin(ctx.elo[inn.team] ?? 1500);
      for (const b of inn.balls) {
        const strikerOut = b.wickets.some((w) => w.playerOut === b.batter);
        for (const t of targets) {
          const ex = (id: string) => getOrCreate(getOrCreate(t.store, t.editionId, () => new Map()), id, emptyExposure);
          const isForm = t.store === this.formExposure;
          const vb = (id: string) => getOrCreate(getOrCreate(this.formVenueBalls, t.editionId, () => new Map()), id, () => ({ bat: {}, bowl: {} }));
          if ((!b.wide || strikerOut) && t.member(b.batter)) {
            ex(b.batter).bat[attackBin] += 1;
            if (isForm) vb(b.batter).bat[venueKey] = (vb(b.batter).bat[venueKey] ?? 0) + 1;
          }
          if (b.legal && t.member(b.bowler)) {
            ex(b.bowler).bowl[batsideBin] += 1;
            if (isForm) vb(b.bowler).bowl[venueKey] = (vb(b.bowler).bowl[venueKey] ?? 0) + 1;
          }
        }
      }
    }
  }

  private recordSquadMatch(editionId: string, venueId: string, m: Match, standInOnly: boolean): void {
    const inns = mainInnings(m);
    for (const team of m.teams) {
      const squad = this.squads.get(editionId)?.get(team);
      if (!squad || squad.standIn !== standInOnly) continue;
      const xi = m.xis[team] ?? [];
      for (const id of xi) getOrCreate(squad.players, id, () => ({ matches: 0 })).matches += 1;
      const batted = inns.find((i) => i.team === team);
      const bowled = inns.find((i) => i.bowlingTeam === team);
      squad.matches.push({
        id: m.id,
        date: m.date,
        stage: m.stage,
        group: m.group,
        venueId,
        opponent: m.teams.find((t) => t !== team) ?? "",
        battedFirst: inns[0]?.team === team,
        xi,
        battingOrder: batted?.battingOrder ?? [],
        bowlerByOver: bowled?.bowlerByOver ?? [],
        total: batted?.total ?? null,
        wickets: batted?.wickets ?? null,
        winner: m.winner,
        result: m.result,
      });
    }
  }

  /**
   * Inferred keepers per team-edition. `stumpings` counts the tournament plus the form window
   * (evidence they kept around that edition); `allTimeStumpings` counts the whole archive, any
   * date, which catches keepers whose only recorded stumping came years away from the edition.
   */
  inferredKeepers(): Map<string, Map<string, { id: string; stumpings: number; allTimeStumpings: number }[]>> {
    const out = new Map<string, Map<string, { id: string; stumpings: number; allTimeStumpings: number }[]>>();
    for (const [editionId, teams] of this.squads) {
      for (const [team, squad] of teams) {
        const list: { id: string; stumpings: number; allTimeStumpings: number }[] = [];
        for (const id of squad.players.keys()) {
          const st = (this.tournament.get(editionId)?.get(id)?.field.stumpings ?? 0) + (this.form.get(editionId)?.get(id)?.field.stumpings ?? 0);
          const all = this.allTimeStumpings.get(id) ?? 0;
          if (st > 0 || all > 0) list.push({ id, stumpings: st, allTimeStumpings: all });
        }
        list.sort((a, b) => b.stumpings - a.stumpings || b.allTimeStumpings - a.allTimeStumpings);
        getOrCreate(out, editionId, () => new Map()).set(team, list);
      }
    }
    return out;
  }

  playerEditions() {
    const rows = [];
    for (const [editionId, teams] of this.squads) {
      for (const [team, squad] of teams) {
        for (const [id, meta] of squad.players) {
          const tournament = this.tournament.get(editionId)?.get(id) ?? emptyBlock();
          const form = this.form.get(editionId)?.get(id) ?? emptyBlock();
          const career = this.careerSnapshots.get(editionId)?.get(id) ?? emptyBlock();
          const odi = this.odiSnapshots.get(editionId)?.get(id) ?? emptyBlock();
          const laterBat = this.laterBat.get(editionId)?.get(id);
          const laterBowl = this.laterBowl.get(editionId)?.get(id);
          rows.push({
            personId: id,
            name: this.names.get(id) ?? id,
            editionId,
            team,
            standIn: squad.standIn,
            tournamentMatches: squad.standIn ? 0 : meta.matches,
            tournament: blockOut(tournament),
            tournamentByOpposition: {
              full: blockOut(this.tournamentVsFull.get(editionId)?.get(id) ?? emptyBlock()),
              associate: blockOut(this.tournamentVsAssociate.get(editionId)?.get(id) ?? emptyBlock()),
            },
            form: blockOut(form),
            formByOpposition: {
              full: blockOut(this.formVsFull.get(editionId)?.get(id) ?? emptyBlock()),
              associate: blockOut(this.formVsAssociate.get(editionId)?.get(id) ?? emptyBlock()),
            },
            careerToDate: blockOut(career),
            /** Balls faced/bowled per opponent-Elo bin in the form window and in the tournament. */
            formExposure: this.formExposure.get(editionId)?.get(id) ?? emptyExposure(),
            tournamentExposure: this.tournamentExposure.get(editionId)?.get(id) ?? emptyExposure(),
            /** The team's Elo at the edition's start, which places the player in a team-strength tier. */
            teamElo: this.teamEloAtEdition.get(editionId)?.get(team) ?? null,
            /** Form balls by venue string (batting / bowling), for venue normalisation. */
            formVenueBalls: this.formVenueBalls.get(editionId)?.get(id) ?? { bat: {}, bowl: {} },
            /** Pooled form counts (observed and context-expected) per opponent-Elo bin, for the edge-transfer measurement. */
            formByOppBin: Object.fromEntries(
              ELO_BINS.map((bin) => {
                const b = this.formByBin.get(editionId)?.get(`${id}|${bin}`);
                return [bin, b ? { bat: pooledCounts(b.bat.phases), bowl: pooledCounts(b.bowl.phases) } : null];
              }).filter((x) => x[1] !== null),
            ),
            /**
             * Selection evidence: matches the player was picked for against matches the team played,
             * in the form window and in the tournament (both 0 for a stand-in's tournament).
             */
            usage: {
              formMatches: form.matches,
              formTeamMatches: this.formTeamMatches.get(editionId)?.get(team) ?? 0,
              tournamentMatches: squad.standIn ? 0 : meta.matches,
              tournamentTeamMatches: squad.standIn ? 0 : squad.matches.length,
            },
            /** ODI career at the edition's start: summary only (no phases), the weak prior for 2007/2009. */
            odiCareerToDate: { summary: summariseBlock(odi), positions: odi.bat.positions, dismissals: odi.bat.dismissals },
            /** The nearest T20I balls from the edition's first match on, for projected cards; the build adds the league balls. */
            later: { bat: blockOut(laterBat ?? emptyBlock()), bowl: blockOut(laterBowl ?? emptyBlock()), exposure: this.laterExposure.get(editionId)?.get(id) ?? emptyExposure() },
          });
        }
      }
    }
    return rows.sort((a, b) => a.editionId.localeCompare(b.editionId) || a.team.localeCompare(b.team) || a.name.localeCompare(b.name));
  }

  people() {
    const rows = [];
    for (const [id, editions] of this.teamOf) {
      rows.push({
        id,
        name: this.names.get(id) ?? id,
        teams: [...new Set(editions.values())].sort(),
        editions: Object.fromEntries([...editions.entries()].sort()),
        stumpingsAllT20I: this.allTimeStumpings.get(id) ?? 0,
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  squadsOut() {
    const keepers = this.inferredKeepers();
    const rows = [];
    for (const [editionId, teams] of this.squads) {
      for (const [team, squad] of teams) {
        const matches = squad.matches.sort((a, b) => a.date.localeCompare(b.date));
        // Hand-made squads have no matches: take the first eleven as listed (order is not data-derived).
        const defaults = matches.length ? defaultEleven(matches) : { xi: [...squad.players.keys()].slice(0, 11), bowlers: [] };
        rows.push({
          editionId,
          team,
          standIn: squad.standIn,
          source: squad.source,
          players: [...squad.players.entries()]
            .map(([id, m]) => {
              // Balls faced and bowled per phase in the edition itself: the weights the engine
              // centres its cohort on (2026-11-01 audit; matches gave a No. 10 an opener's say).
              const t = this.tournament.get(editionId)?.get(id);
              const balls = (ph: Record<string, { balls: number }> | undefined) => Object.fromEntries(PHASES.map((p) => [p, ph?.[p]?.balls ?? 0])) as Record<Phase, number>;
              return { id, name: this.names.get(id) ?? id, matches: m.matches, exposure: { bat: balls(t?.bat.phases), bowl: balls(t?.bowl.phases) } };
            })
            .sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name)),
          inferredKeepers: keepers.get(editionId)?.get(team) ?? [],
          /** Most-used eleven, in modal batting order, with bowlers by overs bowled — for pairings never played. */
          defaultXI: defaults.xi.map((id) => ({ id, name: this.names.get(id) ?? id })),
          defaultBowlingOrder: defaults.bowlers.map((id) => ({ id, name: this.names.get(id) ?? id })),
          matchesUsed: matches.length,
          matches,
        });
      }
    }
    return rows.sort((a, b) => a.editionId.localeCompare(b.editionId) || a.team.localeCompare(b.team));
  }
}

/**
 * Default eleven from a set of matches: the eleven most-used players, ordered by the median
 * batting position each actually occupied; bowling order by overs bowled.
 */
function defaultEleven(matches: SquadMatch[]): { xi: string[]; bowlers: string[] } {
  const apps = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  const positions = new Map<string, number[]>();
  const overs = new Map<string, number>();
  matches.forEach((m, mi) => {
    for (const id of m.xi) {
      apps.set(id, (apps.get(id) ?? 0) + 1);
      if (!firstSeen.has(id)) firstSeen.set(id, mi);
    }
    m.battingOrder.forEach((id, i) => getOrCreate(positions, id, () => []).push(i + 1));
    for (const id of m.bowlerByOver) if (id) overs.set(id, (overs.get(id) ?? 0) + 1);
  });
  const median = (xs: number[] | undefined) => {
    if (!xs || xs.length === 0) return 12;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)] ?? 12;
  };
  const xi = [...apps.keys()]
    .sort((a, b) => (apps.get(b) ?? 0) - (apps.get(a) ?? 0) || (firstSeen.get(a) ?? 0) - (firstSeen.get(b) ?? 0))
    .slice(0, 11)
    .sort((a, b) => median(positions.get(a)) - median(positions.get(b)));
  const bowlers = xi.filter((id) => (overs.get(id) ?? 0) > 0).sort((a, b) => (overs.get(b) ?? 0) - (overs.get(a) ?? 0));
  return { xi, bowlers };
}

/**
 * Raw counts plus the derived summary, so Phase 1 can re-derive anything (including outcome
 * probabilities, which are deliberately not duplicated here) without re-parsing the archive.
 */
/** Balls in a skill's phase vectors (0 for a block not started). */
function phaseBallsOf(side: PlayerBlock["bat"] | PlayerBlock["bowl"] | undefined): number {
  return side ? Object.values(side.phases).reduce((a, pc) => a + pc.balls, 0) : 0;
}

/** Phase counts summed over phases (observed and context-expected), for compact per-bin exports. */
function pooledCounts(ph: PlayerBlock["bat"]["phases"]) {
  const out = { balls: 0, runs: 0, outcomes: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 } as Record<string, number>, expected: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, W: 0 } as Record<string, number> };
  for (const pc of Object.values(ph)) {
    out.balls += pc.balls;
    out.runs += pc.runs;
    for (const [k, n] of Object.entries(pc.outcomes)) out.outcomes[k] = (out.outcomes[k] ?? 0) + n;
    for (const [k, n] of Object.entries(pc.expected)) out.expected[k] = Math.round(((out.expected[k] ?? 0) + n) * 1e4) / 1e4;
  }
  return out;
}

function blockOut(b: PlayerBlock) {
  const round4 = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 1e4) / 1e4]));
  const phases = (ph: Record<string, PlayerBlock["bat"]["phases"]["pp"]>) =>
    Object.fromEntries(Object.entries(ph).map(([p, pc]) => [p, { balls: pc.balls, runs: pc.runs, outcomes: pc.outcomes, expected: round4(pc.expected) }]));
  return {
    summary: summariseBlock(b),
    bat: {
      positions: b.bat.positions,
      dismissals: b.bat.dismissals,
      notOuts: b.bat.notOuts,
      ducks: b.bat.ducks,
      nonStrikerRunOuts: b.bat.nonStrikerRunOuts,
      phases: phases(b.bat.phases),
    },
    bowl: {
      wides: b.bowl.wides,
      noBalls: b.bowl.noBalls,
      dots: b.bowl.dots,
      fours: b.bowl.fours,
      sixes: b.bowl.sixes,
      oversByPhase: b.bowl.oversByPhase,
      phases: phases(b.bowl.phases),
    },
  };
}
