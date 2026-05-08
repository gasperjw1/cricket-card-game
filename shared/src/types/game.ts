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

export interface ResolutionStep {
  step: string; // human-readable label
  detail: string;
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

export interface PublicMatchState {
  matchId: string;
  inviteCode: string;
  phase: MatchPhase;
  players: { A: PublicPlayerInfo; B: PublicPlayerInfo | null };
  currentInnings: 1 | 2 | null;
  innings1: InningsState | null;
  innings2: InningsState | null;
  coinToss: CoinTossState | null;
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
