/**
 * Typed access to the hand-authored config under `data/config/`.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { paths, readJson } from "./util/io.js";

export interface EditionRules {
  tieBreak: "bowl-out" | "super-over";
  freeHit: "foot-fault-only" | "all-no-balls";
  drs: boolean;
  concussionSub: boolean;
  stopClock: boolean;
}

/**
 * How the field changes when Afghanistan is removed: a stand-in is added to a slot, and in the
 * cascade editions an already-present team moves up a stage first.
 */
export interface SlotChange {
  action: "add" | "move";
  team: string;
  stage: string;
  group: string;
  /** for "move": where the team came from */
  fromStage?: string;
  fromGroup?: string;
}

export interface EditionConfig {
  id: string;
  seasonKey: string;
  year: number;
  hosts: string[];
  hostTeams: string[];
  format: string;
  rules: EditionRules;
  afghanistan: { stage: string; group: string; groupmates: string[]; finish: string } | null;
  /** Summary of the stand-in decision; `slotChanges` is the operational form. */
  standIn: { team: string; reason: string } | null;
  slotChanges: SlotChange[];
}

export interface EditionsConfig {
  worldCupEventNames: string[];
  /** Full-member status is time-varying (Ireland and Afghanistan joined in 2017). */
  fullMembers: { team: string; since: number }[];
  formWindowMonths: number;
  editions: EditionConfig[];
}

export interface VenueConfig {
  id: string;
  name: string;
  city: string;
  country: string;
  homeTeam: string;
  aliases: string[];
}

/** A hand-made squad for a stand-in team that has no T20Is near the edition (e.g. Namibia 2012). */
export interface HandSquad {
  editionId: string;
  team: string;
  source: string;
  players: { name: string; shortName?: string; handedness?: string; bowlingType?: string; keeper?: string; captain?: string; dob?: string; role?: string; sourceUrl?: string; notes?: string }[];
}

export interface Config {
  editions: EditionsConfig;
  venues: VenueConfig[];
  handSquads: HandSquad[];
  /** seasonKey → edition */
  editionBySeason: Map<string, EditionConfig>;
  /** raw Cricsheet venue string → canonical venue */
  venueByAlias: Map<string, VenueConfig>;
  /** Was `team` a full member in `year`? */
  isFullMember: (team: string, year: number) => boolean;
  worldCupEventNames: Set<string>;
}

export function loadConfig(): Config {
  const editions = readJson<EditionsConfig>(resolve(paths.config, "editions.json"));
  const { venues } = readJson<{ venues: VenueConfig[] }>(resolve(paths.config, "venues.json"));
  const handSquadsFile = resolve(paths.config, "hand-squads.json");
  const handSquads = existsSync(handSquadsFile) ? readJson<{ squads: HandSquad[] }>(handSquadsFile).squads : [];

  const editionBySeason = new Map(editions.editions.map((e) => [e.seasonKey, e]));
  const venueByAlias = new Map<string, VenueConfig>();
  for (const v of venues) {
    for (const alias of v.aliases) {
      if (venueByAlias.has(alias)) throw new Error(`Duplicate venue alias in venues.json: ${alias}`);
      venueByAlias.set(alias, v);
    }
  }
  const since = new Map(editions.fullMembers.map((m) => [m.team, m.since]));
  return {
    editions,
    venues,
    handSquads,
    editionBySeason,
    venueByAlias,
    isFullMember: (team, year) => (since.get(team) ?? Infinity) <= year,
    worldCupEventNames: new Set(editions.worldCupEventNames),
  };
}
