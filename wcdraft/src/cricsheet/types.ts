/**
 * Minimal typings for the Cricsheet JSON match format (v1.x).
 * Only the fields the pipeline reads are declared; everything else is ignored.
 * Spec: https://cricsheet.org/format/json/
 */

export interface RawMatch {
  meta: { data_version: string; created: string; revision: number };
  info: RawInfo;
  innings: RawInnings[];
}

export interface RawInfo {
  balls_per_over: number;
  city?: string;
  dates: string[];
  event?: { name: string; match_number?: number; group?: string | number; stage?: string };
  gender: "male" | "female";
  match_type: string;
  match_type_number?: number;
  outcome: {
    winner?: string;
    by?: { runs?: number; wickets?: number; innings?: number };
    method?: string;
    result?: "tie" | "no result" | "draw";
    eliminator?: string;
    bowl_out?: string;
  };
  overs?: number;
  /** Data Cricsheet knows it lacks for this match (e.g. "powerplays", or per-innings over lists). */
  missing?: unknown[];
  player_of_match?: string[];
  players: Record<string, string[]>;
  registry: { people: Record<string, string> };
  season: string | number;
  team_type: string;
  teams: string[];
  toss: { winner: string; decision: "bat" | "field"; uncontested?: boolean };
  venue?: string;
}

export interface RawInnings {
  team: string;
  overs?: RawOver[];
  powerplays?: { from: number; to: number; type: string }[];
  target?: { overs: number; runs: number };
  super_over?: boolean;
  declared?: boolean;
  forfeited?: boolean;
  absent_hurt?: string[];
  penalty_runs?: { pre?: number; post?: number };
}

export interface RawOver {
  over: number;
  deliveries: RawDelivery[];
}

export interface RawDelivery {
  batter: string;
  bowler: string;
  non_striker: string;
  runs: { batter: number; extras: number; total: number; non_boundary?: boolean };
  extras?: { byes?: number; legbyes?: number; noballs?: number; wides?: number; penalty?: number };
  wickets?: RawWicket[];
  review?: {
    by: string;
    umpire?: string;
    batter: string;
    decision: "struck down" | "upheld";
    type?: string;
    umpires_call?: boolean;
  };
  replacements?: unknown;
}

export interface RawWicket {
  kind: string;
  player_out: string;
  fielders?: { name: string; substitute?: boolean }[];
}
