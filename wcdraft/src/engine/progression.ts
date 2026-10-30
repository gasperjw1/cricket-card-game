/**
 * Machine-readable tournament progression per edition (design spec §7.6), compiled from
 * `data/config/formats.json` (hand-compiled formats) and the Afghanistan stand-in rules in
 * `editions.json`. Nothing here is guessed: group lists, seed slots and knockout pairings come
 * straight from the format file; the stand-in simply takes Afghanistan's slot at every stage.
 */

export type AdvanceMode = "seedSlots" | "finish";

export interface GroupsStage {
  type: "groups";
  id: string;
  label: string;
  /** Group → entries: team names, or slot references into the previous stage ("A1", "B2"). */
  groups: Record<string, string[]>;
  /** Pre-tournament seed labels (slot → team) when the edition pre-seeded the next stage. */
  seeds: Record<string, string>;
  advance: { perGroup: number; mode: AdvanceMode };
  /** Original group-stage order used as the last tie-breaker. */
  seedOrder: string[];
}

export interface KnockoutStage {
  type: "knockout";
  id: string;
  label: string;
  /** Pairings as slot references: "<group><position>" into the previous groups stage, or "W<n>" winners of the previous knockout stage. */
  pairings: [string, string][];
}

export type Stage = GroupsStage | KnockoutStage;

export interface Progression {
  editionId: string;
  teams: string[];
  stages: Stage[];
  standIn: string | null;
}

/** The shape of one `formats.json` edition we rely on. */
export interface FormatEdition {
  editionId: string;
  teams: number;
  stages: {
    name: string;
    groups?: Record<string, string[]>;
    seeds?: Record<string, string>;
    slots?: Record<string, string[]>;
    matchesPerTeam?: number;
    advancement?: string;
    knockoutPairing?: string | null;
  }[];
}

export interface StandInRules {
  standIn: { team: string } | null;
  slotChanges: { action: "add" | "move"; team: string; stage: string; group: string; fromStage?: string; fromGroup?: string }[];
}

/** editions.json names the opening stage "Group" or "First Round" whatever the format file calls it. */
function findStage(slots: GroupsStage[], configName: string): GroupsStage | undefined {
  const wanted = configName.toLowerCase().replace(/ stage$/, "");
  const direct = slots.find((st) => st.label.toLowerCase().startsWith(wanted));
  if (direct) return direct;
  if (/^(group|first round)$/.test(wanted)) return slots[0];
  return undefined;
}

/** "A1" → A1; "X1 (A1)" → A1; "First Round B winner" → B1; "England (1)" → England. */
function slotRef(entry: string, previous: GroupsStage | null): string {
  const paren = entry.match(/\(([A-Z]\d)\)/);
  if (paren) return paren[1]!;
  const winner = entry.match(/First Round ([A-Z]) winner/);
  if (winner) return `${winner[1]}1`;
  const seeded = entry.match(/^(.+?) \(\d+\)$/);
  if (seeded) return seeded[1]!;
  if (/^[A-Z]\d$/.test(entry) && previous) return entry;
  return entry;
}

/** "E2 v F1; E1 v F2" or "G2-1 v G1-2; G1-1 v G2-2" → [["E2","F1"],["E1","F2"]]. */
function parsePairings(s: string): [string, string][] {
  return s.split(";").map((part) => {
    const sides = part.trim().split(/\s+v\s+/).map((x) => x.trim().replace(/^G/, "").replace("-", ""));
    if (sides.length !== 2) throw new Error(`cannot parse knockout pairing "${part}"`);
    return [sides[0]!, sides[1]!];
  });
}

export function buildProgression(format: FormatEdition, rules: StandInRules): Progression {
  const standIn = rules.standIn?.team ?? null;
  const stages: Stage[] = [];
  let previousGroups: GroupsStage | null = null;
  let previousKnockout: KnockoutStage | null = null;
  for (const s of format.stages) {
    const name = s.name;
    if (s.groups || s.slots) {
      const raw = s.slots ?? s.groups!;
      const groups: Record<string, string[]> = {};
      for (const [g, entries] of Object.entries(raw)) groups[g] = entries.map((e) => slotRef(e, previousGroups));
      const seeds: Record<string, string> = { ...(s.seeds ?? {}) };
      // Top-two seeds per group only; third seeds never carry a slot forward.
      for (const k of Object.keys(seeds)) if (!/^[A-Z][12]$/.test(k)) delete seeds[k];
      const mode: AdvanceMode = Object.keys(seeds).length ? "seedSlots" : "finish";
      const perGroup = /winner only/i.test(s.advancement ?? "") ? 1 : 2;
      const stage: GroupsStage = {
        type: "groups",
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        label: name,
        groups,
        seeds,
        advance: { perGroup, mode },
        seedOrder: Object.values(groups).flat(),
      };
      stages.push(stage);
      previousGroups = stage;
      previousKnockout = null;
    } else if (/semi/i.test(name)) {
      const pairings = parsePairings(s.knockoutPairing ?? "");
      const stage: KnockoutStage = { type: "knockout", id: "semi-finals", label: name, pairings };
      stages.push(stage);
      previousKnockout = stage;
    } else if (/final/i.test(name)) {
      stages.push({ type: "knockout", id: "final", label: name, pairings: [["W1", "W2"]] });
      void previousKnockout;
    }
  }

  // Afghanistan's slot goes to the stand-in; moves and additions follow editions.json.
  if (standIn) {
    const slots = stages.filter((x): x is GroupsStage => x.type === "groups");
    const afghan: { stage: GroupsStage; group: string; index: number }[] = [];
    for (const st of slots) for (const [g, list] of Object.entries(st.groups)) list.forEach((t, i) => { if (t === "Afghanistan") afghan.push({ stage: st, group: g, index: i }); });
    for (const a of afghan) a.stage.groups[a.group]![a.index] = `__slot__`;
    for (const c of rules.slotChanges) {
      const target = findStage(slots, c.stage);
      if (!target) throw new Error(`${format.editionId}: slot change stage "${c.stage}" not found`);
      if (c.action === "move" && c.fromStage && c.fromGroup) {
        const from = findStage(slots, c.fromStage);
        const list = from?.groups[c.fromGroup];
        if (list) { const i = list.indexOf(c.team); if (i >= 0) list.splice(i, 1); }
      }
      const list = target.groups[c.group]!;
      const hole = list.indexOf("__slot__");
      if (hole >= 0) list[hole] = c.team;
      else list.push(c.team);
    }
    for (const st of slots) for (const list of Object.values(st.groups)) { const i = list.indexOf("__slot__"); if (i >= 0) list[i] = standIn; }
    for (const st of slots) for (const [slot, team] of Object.entries(st.seeds)) if (team === "Afghanistan") st.seeds[slot] = standIn;
    for (const st of slots) st.seedOrder = Object.values(st.groups).flat();
  }

  const first = stages.find((x): x is GroupsStage => x.type === "groups")!;
  const teams = new Set<string>(Object.values(first.groups).flat());
  // Direct entrants to a later stage (2014–2022 Super stages) are named teams, not slot refs.
  for (const st of stages) if (st.type === "groups") for (const list of Object.values(st.groups)) for (const t of list) if (!/^[A-Z]\d$/.test(t)) teams.add(t);
  return { editionId: format.editionId, teams: [...teams], stages, standIn };
}
