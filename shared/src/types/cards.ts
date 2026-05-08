export type Tier = "Elite" | "Gold" | "Silver" | "Bronze";

export type Line =
  | "Leg stump"
  | "Middle stump"
  | "Off stump"
  | "5th stump"
  | "Wide outside off";

export type Length = "Short" | "Good length" | "Full";

export interface Zone {
  line: Line;
  length: Length;
}

export type Adjective =
  | "Swing"
  | "Seam"
  | "Cutter"
  | "Spin"
  | "Pace"
  | "Reverse";

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
  | "Ireland";

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
  adjective: Adjective | null;
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
  | "mankad"
  | "review-appeal"
  | "cramps"
  | "invariable-bounce"
  | "day-5-pitch"
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
