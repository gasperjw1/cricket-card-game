/**
 * Node loader: reads one edition's engine inputs from `data/out/` and `data/config/` and hands
 * them to `buildEditionData` (`data.ts`, which has no file-system dependency and is what the
 * browser client uses with fetched JSON).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SituationTables } from "../analysis/situation.js";
import type { MatchupTables } from "../analysis/matchups.js";
import type { EditionPopulations, PlayerRating } from "../ratings/model.js";
import { readCsv } from "../util/csv.js";
import { paths, readJson } from "../util/io.js";
import { SituationModel } from "./ball.js";
import { buildEditionData, type AfghanistanFixture, type CaptainOut, type CoachOut, type EditionData, type EditionOut, type LeaderOut, type PlayerLabel, type SquadOut, type VenueOut } from "./data.js";
import type { FormatEdition } from "./progression.js";

export { matchEnvironment, teamFromDefault, teamFromMatch, toEnginePlayer, buildEditionData } from "./data.js";
export type { AfghanistanFixture, CaptainOut, CoachOut, EditionData, EditionOut, LeaderOut, PlayerLabel, SquadMatchOut, SquadOut, TeamProfile, VenueOut } from "./data.js";

let shared: { situation: SituationModel; editions: EditionOut[]; venues: VenueOut[]; populations: EditionPopulations[]; formats: FormatEdition[]; afghanistanFixtures: AfghanistanFixture[]; coaches: CoachOut[]; captains: CaptainOut[]; leaders: LeaderOut[]; labels: Map<string, PlayerLabel>; situationTables: SituationTables; matchups: MatchupTables | null } | null = null;

function readShared() {
  if (shared) return shared;
  const optional = <T>(file: string, fallback: T): T => (existsSync(file) ? readJson<T>(file) : fallback);
  const labelsFile = resolve(paths.labels, "players.csv");
  const labels = new Map<string, PlayerLabel>();
  if (existsSync(labelsFile)) for (const row of readCsv(readFileSync(labelsFile, "utf8"))) if (row.personId) labels.set(row.personId, { handedness: row.handedness ?? "", bowlingType: row.bowlingType ?? "", keeper: row.keeper, keeperCareer: row.keeperCareer, keeperAnyT20I: row.keeperAnyT20I });
  const situationTables = readJson<SituationTables>(resolve(paths.out, "situation.json"));
  const matchups = optional<MatchupTables | null>(resolve(paths.out, "matchups.json"), null);
  const captaincy = optional<{ captains: CaptainOut[]; leaders: LeaderOut[] }>(resolve(paths.out, "captaincy.json"), { captains: [], leaders: [] });
  shared = {
    situationTables,
    matchups,
    situation: new SituationModel(situationTables, matchups),
    editions: readJson<EditionOut[]>(resolve(paths.out, "editions.json")),
    venues: readJson<VenueOut[]>(resolve(paths.out, "venues.json")),
    populations: readJson<EditionPopulations[]>(resolve(paths.out, "ratings", "populations.json")),
    formats: readJson<{ editions: FormatEdition[] }>(resolve(paths.config, "formats.json")).editions,
    afghanistanFixtures: readJson<{ fixtures: AfghanistanFixture[] }>(resolve(paths.config, "afghanistan-fixtures.json")).fixtures,
    coaches: optional<{ coaches: CoachOut[] }>(resolve(paths.out, "coaches.json"), { coaches: [] }).coaches,
    captains: captaincy.captains,
    leaders: captaincy.leaders,
    labels,
  };
  return shared;
}

export function loadEdition(editionId: string): EditionData {
  const s = readShared();
  const squads = readJson<SquadOut[]>(resolve(paths.out, "squads", `${editionId}.json`));
  const ratings = readJson<PlayerRating[]>(resolve(paths.out, "ratings", `${editionId}.json`));
  return buildEditionData({ editionId, editions: s.editions, venues: s.venues, squads, populations: s.populations, ratings, situation: s.situationTables, matchups: s.matchups, formats: s.formats, afghanistanFixtures: s.afghanistanFixtures, coaches: s.coaches, captains: s.captains, leaders: s.leaders, labels: s.labels }, s.situation);
}

export function engineReady(): boolean {
  return existsSync(resolve(paths.out, "situation.json")) && existsSync(resolve(paths.out, "ratings", "populations.json"));
}
