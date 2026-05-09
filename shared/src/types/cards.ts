export type Tier = "Elite" | "Gold" | "Silver" | "Bronze";

export type Line =
  | "Leg stump"
  | "Middle stump"
  | "Off stump"
  | "Outside off";

export type Length = "Short" | "Good length" | "Full";

export interface Zone {
  line: Line;
  length: Length;
}

/**
 * Bowler skills. Pace/Reverse/Spin generic kinds were removed in the v1.1
 * rebalance — only specific variations remain. Pacers get one or more of
 * Swing/Seam/Cutter/Slower; spinners get Googly/Carrom/Topspin/Drift.
 * Bronze and Silver bowlers carry no adjective (they're the "plain" tier
 * that gets scored off freely).
 */
export type Adjective =
  | "Swing"
  | "Seam"
  | "Cutter"
  | "Slower"
  | "Googly"
  | "Carrom"
  | "Topspin"
  | "Drift";

export type FieldingRegion =
  | "Slip cordon"
  | "Gully/Point"
  | "Cover"
  | "Mid-wicket"
  | "Fine leg/Leg slip"
  | "Short leg/Silly point";

export type RunValue = 0 | 1 | 2 | 4 | 6;

export type OutcomeKind =
  | { type: "runs"; value: RunValue; shot: string }
  | { type: "wicket"; mode: string };

export interface BatsmanOutcome {
  zone: Zone;
  outcome: OutcomeKind;
}

export type Nation =
  | "India"
  | "Australia"
  | "England"
  | "South Africa"
  | "New Zealand"
  | "Pakistan"
  | "Sri Lanka"
  | "West Indies"
  | "Bangladesh"
  | "Zimbabwe"
  | "Afghanistan"
  | "Ireland"
  | "Nepal"
  | "Hong Kong"
  | "Scotland"
  | "USA"
  | "Netherlands"
  | "Namibia";

export type CardKind = "batsman" | "bowler" | "situation";

export interface BatsmanCard {
  id: string;
  kind: "batsman";
  name: string;
  nation: Nation;
  tier: Tier;
  description: string;
  strengths: BatsmanOutcome[];
  neutrals: BatsmanOutcome[];
  weaknesses: BatsmanOutcome[];
  resistances: Adjective[];
}

export interface BowlerCard {
  id: string;
  kind: "bowler";
  name: string;
  nation: Nation;
  tier: Tier;
  description: string;
  delivery: Zone;
  /**
   * Bowler's signature skill(s). 0 entries = no skill (Bronze/Silver bowlers).
   * 1 entry = single skill (Gold bowlers, most Elite). 2 entries = Elite only,
   * with the no-stack engine rule (only one downgrade fires per ball even
   * when both adjectives are un-resisted).
   */
  adjectives: Adjective[];
  fielding: FieldingRegion[];
}

export type SituationDeck = "batting" | "bowling";

export type SituationEffectId =
  | "drs-review"
  | "power-surge"
  | "retired-out"
  | "switch-hit"
  | "trot-down"
  | "no-ball"
  | "shuffle-across"
  | "deep-in-crease"
  | "mankad"
  | "review-appeal"
  | "cramps"
  | "invariable-bounce"
  | "day-5-pitch"
  | "biryani"
  | "old-school-batting"
  | "old-school-bowling";

export interface SituationCard {
  id: SituationEffectId;
  kind: "situation";
  name: string;
  flavor: string;
  description: string;
  deck: SituationDeck;
}

export type PlayerCard = BatsmanCard | BowlerCard;
export type AnyCard = BatsmanCard | BowlerCard | SituationCard;

export interface CardRoster {
  batsmen: BatsmanCard[];
  bowlers: BowlerCard[];
  situations: SituationCard[];
}
