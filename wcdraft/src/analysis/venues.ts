/**
 * Per-venue profiles, overall and per edition. Venue is the engine's primary modifier
 * source; edition is the fallback for thin venues (shrinkage happens in Phase 1).
 */

import type { Config, VenueConfig } from "../config.js";
import type { Match } from "../cricsheet/match.js";
import { getOrCreate } from "../util/stats.js";
import { EnvironmentAccumulator } from "./environment.js";

export class VenuesAnalysis {
  private readonly overall = new Map<string, EnvironmentAccumulator>();
  private readonly perEdition = new Map<string, Map<string, EnvironmentAccumulator>>();

  constructor(private readonly config: Config) {}

  /** Resolve a Cricsheet venue string to a canonical venue; throws for unmapped World Cup venues. */
  resolve(m: Match): VenueConfig {
    const v = m.venue ? this.config.venueByAlias.get(m.venue) : undefined;
    if (!v) throw new Error(`Unmapped World Cup venue "${m.venue}" (${m.city}) in match ${m.id}. Add it to data/config/venues.json.`);
    return v;
  }

  add(editionId: string, venue: VenueConfig, m: Match): void {
    getOrCreate(this.overall, venue.id, () => new EnvironmentAccumulator()).add(m);
    getOrCreate(getOrCreate(this.perEdition, venue.id, () => new Map()), editionId, () => new EnvironmentAccumulator()).add(m);
  }

  summary() {
    return this.config.venues
      .filter((v) => this.overall.has(v.id))
      .map((v) => ({
        id: v.id,
        name: v.name,
        city: v.city,
        country: v.country,
        homeTeam: v.homeTeam,
        overall: this.overall.get(v.id)!.summary(),
        byEdition: Object.fromEntries(
          [...(this.perEdition.get(v.id) ?? new Map<string, EnvironmentAccumulator>()).entries()].map(([e, acc]) => [e, acc.summary()]),
        ),
      }))
      .sort((a, b) => b.overall.matches - a.overall.matches);
  }
}
