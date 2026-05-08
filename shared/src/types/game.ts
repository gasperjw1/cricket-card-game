import type {
  AnyCard,
  BatsmanCard,
  BowlerCard,
  SituationCard,
} from "./cards.js";

export type PlayerSlot = "A" | "B";

export type MatchPhase =
  | "lobby"
  | "draft"
  | "coin-toss"
  | "innings"
  | "innings-break"
  | "match-over";

export type Role = "batting" | "bowling";

export interface InningsState {
  battingPlayer: PlayerSlot;
  bowlingPlayer: PlayerSlot;
  runs: number;
  wickets: number;
  ballsBowled: number; // 0..6
  target: number | null; // set on second innings
  isComplete: boolean;
  log: BallResult[];
}

export interface BallSelection {
  mandatoryCardId: string; // batsman or bowler
  situationCardId: string | null;
  autoPicked: boolean;
}

export interface RevealedSelection {
  player: PlayerSlot;
  role: Role;
  mandatoryCard: BatsmanCard | BowlerCard;
  situationCard: SituationCard | null;
  autoPicked: boolean;
}

export interface BallResult {
  ballNumber: number; // 1..6
  battingSelection: RevealedSelection;
  bowlingSelection: RevealedSelection;
  resolutionSteps: ResolutionStep[];
  finalOutcome: BallOutcome;
}

/**
 * Each ResolutionStep represents one transformation applied during ball
 * resolution (or a played card whose effect didn't fire — applied:false).
 * The UI uses this list to drive the breakdown animation and tooltips.
 */
export type ResolutionStepKind =
  | "old-school-cancel"
  | "trot-down"
  | "day-5-pitch"
  | "switch-hit"
  | "base-lookup"
  | "invariable-bounce"
  | "adjective"
  | "fielding"
  | "power-surge"
  | "drs-review"
  | "review-appeal"
  | "mankad"
  | "retired-out"
  | "cramps";

export interface ResolutionStep {
  kind: ResolutionStepKind;
  /** Short label for inline display, e.g. "Seam adjective". */
  label: string;
  /** Plain-English explanation, suitable for a tooltip. */
  detail: string;
  /** Outcome before this step ran (omitted for swap/cancel records). */
  before?: BallOutcome;
  /** Outcome after this step ran. */
  after?: BallOutcome;
  /** False when a played card was nullified (e.g. resistance blocked an adjective, Power Surge couldn't help a wicket). */
  applied: boolean;
}

export type BallOutcome =
  | { type: "runs"; value: number; shot: string }
  | { type: "wicket"; mode: string }
  | { type: "dot" };

export interface PlayerHand {
  cards: AnyCard[];
  deckRemaining: number;
}

export type CoinTossStage =
  | "countdown"
  | "calling"
  | "choosing"
  | "complete";

export interface CoinTossState {
  stage: CoinTossStage;
  callerSlot: PlayerSlot; // always B in v1 (the joining player)
  deadlineEpochMs: number | null;
  call: "heads" | "tails" | null;
  flip: "heads" | "tails" | null;
  winnerSlot: PlayerSlot | null;
  battingSlot: PlayerSlot | null;
  autoCalled: boolean;
  autoChose: boolean;
}

export type SwapReason = "mankad" | "retired-out" | "cramps";

/**
 * Snapshot of what's currently on the table — both players' played cards,
 * post-Old-School-cancellation. Sent inside PendingSwap so the swap picker
 * can show the affected player exactly what they're up against while
 * choosing a replacement.
 */
export interface TableSnapshot {
  battingSlot: PlayerSlot;
  bowlingSlot: PlayerSlot;
  battingMandatory: import("./cards.js").BatsmanCard;
  bowlingMandatory: import("./cards.js").BowlerCard;
  battingSituation: import("./cards.js").SituationCard | null;
  bowlingSituation: import("./cards.js").SituationCard | null;
}

/**
 * After both players submit, a Mankad / Retired Out / Cramps card may force
 * one player to swap their played mandatory card. Resolution pauses while
 * that player picks from a list of candidate ids in their hand.
 */
export interface PendingSwap {
  fromSlot: PlayerSlot;
  reason: SwapReason;
  /** The card being swapped out (its current name shown to the player). */
  originalCardId: string;
  originalCardName: string;
  /** Card ids in the affected player's hand that are valid replacements. */
  candidateIds: string[];
  /** Auto-pick deadline. */
  deadlineEpochMs: number;
  /** What's on the table right now — visible to both players. */
  table: TableSnapshot;
}

export interface PublicMatchState {
  matchId: string;
  inviteCode: string;
  phase: MatchPhase;
  players: { A: PublicPlayerInfo; B: PublicPlayerInfo | null };
  currentInnings: 1 | 2 | null;
  innings1: InningsState | null;
  innings2: InningsState | null;
  coinToss: CoinTossState | null;
  /** Epoch-ms deadline for the active ball's submit timer; null when not awaiting selections. */
  currentBallDeadlineEpochMs: number | null;
  /** Epoch-ms deadline for the post-reveal pause; null outside that window. */
  postBallDeadlineEpochMs: number | null;
  /** Set when ball resolution is paused waiting on a swap pick. */
  pendingSwap: PendingSwap | null;
  result: MatchResult | null;
}

export interface PublicPlayerInfo {
  slot: PlayerSlot;
  displayName: string;
  connected: boolean;
  handSize: number; // opponent sees count, not contents
  deckRemaining: number;
}

export interface PrivatePlayerView {
  slot: PlayerSlot;
  hand: PlayerHand;
  activeDeck: Role;
}

export interface MatchResult {
  winner: PlayerSlot | "tie";
  margin: string; // e.g. "won by 12 runs", "won by 1 wicket"
}

export interface DraftRound {
  index: number; // 0..19
  tier: "Elite" | "Gold" | "Silver" | "Bronze";
  options: AnyCard[]; // 4 options; one may be a SituationCard
  deadlineEpochMs: number;
}

export interface DraftState {
  deck: Role; // which deck is being drafted in this round
  roundIndex: number;
  totalRounds: number;
  currentRound: DraftRound | null;
  pickedCardIds: string[];
}
