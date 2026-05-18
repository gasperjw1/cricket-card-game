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

/** Categorical tag for batsman shots — used by the result-screen UI to
 *  pick a matching action image. The `shot` free-text field stays as
 *  the human-readable display string; this tag is the canonical key. */
export type ShotCategory =
  // Drives — direction matters visually
  | "drive-straight"
  | "drive-cover"
  | "drive-off"
  // Cross-batted / horizontal
  | "cut"
  | "late-cut"
  | "pull"
  // Wristy on-side
  | "flick"
  | "glance"
  // Sweeps
  | "sweep"
  | "reverse-sweep"
  // Lofts (controlled aerial) — direction matters
  | "loft-straight"
  | "loft-off"
  | "loft-leg"
  // Aerial cricket-specific
  | "slog"
  | "ramp"
  | "scoop"
  // Catch-alls
  | "defend"
  | "mistime";

/** Categorical tag for dismissals. Same role as ShotCategory — the
 *  `mode` free-text stays for display, this tag is the image key. */
export type DismissalCategory =
  | "bowled"
  | "lbw"
  | "caught-keeper"
  | "caught-slip"
  | "caught-cover"
  | "caught-midwicket"
  | "caught-point"
  | "caught-deep"
  | "caught-and-bowled"
  | "stumped"
  | "runout";

export type OutcomeKind =
  | { type: "runs"; value: RunValue; shot: string; shotCategory: ShotCategory }
  | { type: "wicket"; mode: string; dismissalCategory: DismissalCategory };

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

export type Handedness = "right" | "left";

/** Match phase a batter is built for. Drives the in-phase bonus / out-of-phase
 *  penalty system: batters get a 25% chance their scoring shot becomes a dot
 *  when bowling outside their preferred phase, and a small upgrade chance
 *  when bowling inside it.
 *   - top-order: Powerplay (overs 1-2 in longer formats)
 *   - middle-order: Middle Overs
 *   - finisher: Death Overs */
export type BatterRole = "top-order" | "middle-order" | "finisher";

/** Match phase a bowler specializes in. Mirrors BatterRole — bowlers get a
 *  wide chance bump when out of phase, and a wicket bonus when in phase.
 *   - powerplay: new-ball swingers + early pacers
 *   - middle-overs: spinners + economical pacers
 *   - death-overs: yorker specialists + slower-ball merchants */
export type BowlerRole = "powerplay" | "middle-overs" | "death-overs";

/** Convert role keys to the phase they prefer — shared with phaseForBall()
 *  so the engine can compare on the same key. Named "InningsPhase" to avoid
 *  collision with the broader MatchPhase enum in game.ts (lobby/draft/etc). */
export type InningsPhase = "powerplay" | "middle" | "death";

export interface BatsmanCard {
  id: string;
  kind: "batsman";
  name: string;
  nation: Nation;
  tier: Tier;
  description: string;
  /** Batting handedness — drives card UI (mirrored zone grid + silhouette).
   *  Engine doesn't use this; lookup is by line/length only. Default "right"
   *  when missing from the data (back-compat). */
  handedness?: Handedness;
  /** Where in the innings this batter is built to perform. Drives the
   *  in-phase bonus / out-of-phase penalty engine rolls. Default
   *  "middle-order" when missing. */
  role?: BatterRole;
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
  /** Phase this bowler is built for. Drives the in-phase wicket bonus +
   *  out-of-phase wide chance increase. Default "middle-overs". */
  role?: BowlerRole;
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
