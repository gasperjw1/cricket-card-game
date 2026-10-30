/**
 * Fetches the synced data files (public/data) and builds engine inputs in the browser. Shared
 * tables are fetched once; per-edition squads, pools and ratings on demand.
 */

import type { SituationTables } from "../../../wcdraft/src/analysis/situation.ts";
import type { MatchupTables } from "../../../wcdraft/src/analysis/matchups.ts";
import type { EditionPopulations, PlayerRating } from "../../../wcdraft/src/ratings/model.ts";
import { readCsv } from "../../../wcdraft/src/util/csv.ts";
import { SituationModel } from "../../../wcdraft/src/engine/ball.ts";
import { buildEditionData, type AfghanistanFixture, type CaptainOut, type CoachOut, type EditionData, type EditionOut, type PlayerLabel, type SquadOut, type VenueOut } from "../../../wcdraft/src/engine/data.ts";
import type { FormatEdition } from "../../../wcdraft/src/engine/progression.ts";
import type { PoolPlayer } from "../game/types.ts";

export interface SharedData {
  editions: EditionOut[];
  venues: VenueOut[];
  populations: EditionPopulations[];
  situationTables: SituationTables;
  matchups: MatchupTables | null;
  situation: SituationModel;
  formats: FormatEdition[];
  afghanistanFixtures: AfghanistanFixture[];
  coaches: CoachOut[];
  captains: CaptainOut[];
  labels: Map<string, PlayerLabel>;
  editionIds: string[];
  /** Squads the sync script found mostly blank (no record in that era); simulated, never spun. */
  blankSquads: { editionId: string; team: string }[];
}

const base = `${import.meta.env.BASE_URL}data`;

async function json<T>(path: string): Promise<T> {
  const res = await fetch(`${base}/${path}`);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  return (await res.json()) as T;
}

async function text(path: string): Promise<string> {
  const res = await fetch(`${base}/${path}`);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  return res.text();
}

let sharedPromise: Promise<SharedData> | null = null;

export function loadShared(): Promise<SharedData> {
  sharedPromise ??= (async () => {
    const [index, editions, venues, populations, situationTables, matchups, formats, afghanistan, coaches, captains, labelsCsv] = await Promise.all([
      json<{ editions: string[]; blankSquads?: { editionId: string; team: string }[] }>("index.json"),
      json<EditionOut[]>("editions.json"),
      json<VenueOut[]>("venues.json"),
      json<EditionPopulations[]>("ratings/populations.json"),
      json<SituationTables>("situation.json"),
      json<MatchupTables>("matchups.json").catch(() => null),
      json<{ editions: FormatEdition[] }>("config/formats.json"),
      json<{ fixtures: AfghanistanFixture[] }>("config/afghanistan-fixtures.json"),
      json<{ coaches: CoachOut[] }>("coaches.json").catch(() => ({ coaches: [] as CoachOut[] })),
      json<{ captains: CaptainOut[] }>("captaincy.json").catch(() => ({ captains: [] as CaptainOut[] })),
      text("players.csv"),
    ]);
    const labels = new Map<string, PlayerLabel>();
    for (const row of readCsv(labelsCsv)) if (row.personId) labels.set(row.personId, { handedness: row.handedness ?? "", bowlingType: row.bowlingType ?? "", keeper: row.keeper, keeperCareer: row.keeperCareer, keeperAnyT20I: row.keeperAnyT20I });
    return {
      editions, venues, populations, situationTables, matchups, situation: new SituationModel(situationTables, matchups),
      formats: formats.editions, afghanistanFixtures: afghanistan.fixtures, coaches: coaches.coaches, captains: captains.captains, labels, editionIds: index.editions,
      blankSquads: index.blankSquads ?? [],
    };
  })();
  return sharedPromise;
}

const squadCache = new Map<string, Promise<SquadOut[]>>();
const poolCache = new Map<string, Promise<PoolPlayer[]>>();
const ratingsCache = new Map<string, Promise<PlayerRating[]>>();
const editionCache = new Map<string, Promise<EditionData>>();

export function loadSquads(editionId: string): Promise<SquadOut[]> {
  let p = squadCache.get(editionId);
  if (!p) squadCache.set(editionId, (p = json<SquadOut[]>(`squads/${editionId}.json`)));
  return p;
}

export function loadPool(editionId: string): Promise<PoolPlayer[]> {
  let p = poolCache.get(editionId);
  if (!p) poolCache.set(editionId, (p = json<PoolPlayer[]>(`pool/${editionId}.json`)));
  return p;
}

export function loadRatings(editionId: string): Promise<PlayerRating[]> {
  let p = ratingsCache.get(editionId);
  if (!p) ratingsCache.set(editionId, (p = json<PlayerRating[]>(`ratings/${editionId}.json`)));
  return p;
}

/** Full engine data for one edition (CPU elevens, environment, progression). */
export function loadEditionData(editionId: string): Promise<EditionData> {
  let p = editionCache.get(editionId);
  if (!p) {
    p = (async () => {
      const [s, squads, ratings] = await Promise.all([loadShared(), loadSquads(editionId), loadRatings(editionId)]);
      return buildEditionData({ editionId, editions: s.editions, venues: s.venues, squads, populations: s.populations, ratings, situation: s.situationTables, matchups: s.matchups, formats: s.formats, afghanistanFixtures: s.afghanistanFixtures, coaches: s.coaches, captains: s.captains, labels: s.labels }, s.situation);
    })();
    editionCache.set(editionId, p);
  }
  return p;
}
