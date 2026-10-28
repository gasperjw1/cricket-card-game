/**
 * Per-edition profile: scoring environment plus the facts that only make sense at the
 * tournament level (groups, host advantage, associate upsets, team list, dates, rules).
 */

import type { Config, EditionConfig } from "../config.js";
import type { Match } from "../cricsheet/match.js";
import { pct } from "../util/stats.js";
import { EnvironmentAccumulator } from "./environment.js";

class EditionAccumulator {
  env = new EnvironmentAccumulator();
  teams = new Set<string>();
  dates: string[] = [];
  groups = new Map<string, Set<string>>();
  stages = new Map<string, number>();
  hostMatches = 0;
  hostWins = 0;
  crossTierMatches = 0;
  associateUpsets = 0;
  matchesWithMissingData = 0;
  venues = new Map<string, number>();

  constructor(readonly cfg: EditionConfig) {}

  add(m: Match, config: Config, venueId: string): void {
    this.env.add(m);
    for (const t of m.teams) this.teams.add(t);
    this.dates.push(m.date);
    this.venues.set(venueId, (this.venues.get(venueId) ?? 0) + 1);
    const stageLabel = m.stage ?? (m.group ? `group ${m.group}` : "unlabelled");
    this.stages.set(stageLabel, (this.stages.get(stageLabel) ?? 0) + 1);
    if (m.group) {
      const g = this.groups.get(m.group) ?? new Set<string>();
      for (const t of m.teams) g.add(t);
      this.groups.set(m.group, g);
    }
    const winner = m.winner ?? m.tieWinner;
    if (winner) {
      const hosts = m.teams.filter((t) => this.cfg.hostTeams.includes(t));
      if (hosts.length === 1) {
        this.hostMatches += 1;
        if (hosts[0] === winner) this.hostWins += 1;
      }
      const associates = m.teams.filter((t) => !config.isFullMember(t, this.cfg.year));
      if (associates.length === 1) {
        this.crossTierMatches += 1;
        if (associates[0] === winner) this.associateUpsets += 1;
      }
    }
    if (m.hasMissingData) this.matchesWithMissingData += 1;
  }

  summary() {
    const groups: Record<string, string[]> = {};
    for (const [g, teams] of [...this.groups.entries()].sort()) groups[g] = [...teams].sort();
    return {
      id: this.cfg.id,
      year: this.cfg.year,
      seasonKey: this.cfg.seasonKey,
      hosts: this.cfg.hosts,
      hostTeams: this.cfg.hostTeams,
      format: this.cfg.format,
      rules: this.cfg.rules,
      afghanistan: this.cfg.afghanistan,
      standIn: this.cfg.standIn,
      slotChanges: this.cfg.slotChanges,
      firstMatch: this.dates.length ? this.dates.reduce((a, b) => (a < b ? a : b)) : null,
      lastMatch: this.dates.length ? this.dates.reduce((a, b) => (a > b ? a : b)) : null,
      teams: [...this.teams].sort(),
      groups,
      stages: Object.fromEntries(this.stages),
      venues: Object.fromEntries([...this.venues.entries()].sort((a, b) => b[1] - a[1])),
      hostWinPct: this.hostMatches ? pct(this.hostWins, this.hostMatches, 0) : null,
      associateUpsets: { wins: this.associateUpsets, crossTierMatches: this.crossTierMatches },
      matchesWithMissingData: this.matchesWithMissingData,
      environment: this.env.summary(),
    };
  }
}

export class EditionsAnalysis {
  private readonly acc = new Map<string, EditionAccumulator>();

  constructor(private readonly config: Config) {
    for (const e of config.editions.editions) this.acc.set(e.id, new EditionAccumulator(e));
  }

  add(editionId: string, m: Match, venueId: string): void {
    this.acc.get(editionId)?.add(m, this.config, venueId);
  }

  summary() {
    return [...this.acc.values()].map((a) => a.summary());
  }
}

export type EditionSummary = ReturnType<EditionAccumulator["summary"]>;
