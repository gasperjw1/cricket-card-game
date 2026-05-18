import type {
  AnyCard,
  BallSelection,
  BatsmanCard,
  BotDifficulty,
  BowlerCard,
  PlayerSlot,
  Tier,
} from "@swipe-sixer/shared";
import type { ServerMatch } from "../match-registry.js";

/**
 * Bot controller — decides what a CPU player picks at each decision
 * point. Phase 1 implementation:
 *   - Gully: pure random valid picks
 *   - Domestic: shallow heuristic (avoid weakness zones / target weakness zones)
 *   - International: Domestic + tier prioritization (save Elite for late overs)
 *
 * Decision points covered: coin-toss call, coin-toss role choose,
 * ball selection (mandatory + optional situation), swap-pick.
 */

// ─── Coin toss ───

export function botCallCoinToss(): "heads" | "tails" {
  return Math.random() < 0.5 ? "heads" : "tails";
}

export function botChooseRole(): "bat" | "bowl" {
  // Slight preference for bat (chase the target) — feels like the
  // "right" call in T20, makes the bot feel mildly competent.
  return Math.random() < 0.55 ? "bat" : "bowl";
}

// ─── Ball selection ───

interface BallSelectionContext {
  /** Cards currently in the bot's hand. */
  hand: AnyCard[];
  /** Whether the bot is batting or bowling this innings. */
  role: "batting" | "bowling";
  /** Difficulty tunes the heuristic depth. */
  difficulty: BotDifficulty;
  /** Innings progress. Used by International difficulty to decide whether
   *  to spend an Elite card now or hoard it. */
  ballsBowled: number;
  wicketsFallen: number;
  /** Format-derived totals — used to scale "late innings" / pressure
   *  thresholds across T1/T3/T5 etc. */
  ballsPerInnings: number;
  wicketsPerInnings: number;
  /** Most recently revealed opponent card on the corresponding side
   *  (e.g. for bowling bot, the last batter card the human played).
   *  null on the first ball. Drives the Domestic heuristic. */
  lastOpponentCard: AnyCard | null;
}

export function botPickBallSelection(ctx: BallSelectionContext): BallSelection {
  const requiredKind = ctx.role === "batting" ? "batsman" : "bowler";
  const validMandatory = ctx.hand.filter(
    (c): c is BatsmanCard | BowlerCard => c.kind === requiredKind,
  );
  if (validMandatory.length === 0) {
    // Pathological — shouldn't happen because the deck always carries
    // at least one card of each role per innings. Defensive: pick anything.
    return {
      mandatoryCardId: ctx.hand[0]!.id,
      situationCardId: null,
      autoPicked: true,
    };
  }

  let mandatory: BatsmanCard | BowlerCard;
  switch (ctx.difficulty) {
    case "Gully":
      mandatory = pickRandom(validMandatory);
      break;
    case "Domestic":
      mandatory = pickHeuristicMandatory(validMandatory, ctx);
      break;
    case "International":
      mandatory = pickHeuristicMandatory(validMandatory, ctx);
      mandatory = applyTierPrioritization(mandatory, validMandatory, ctx);
      break;
  }

  // Situation card: Phase 1 keeps it simple — ~30% chance to play one
  // if available. Phase 2 will add strategic timing.
  const situations = ctx.hand.filter((c) => c.kind === "situation");
  let situationCardId: string | null = null;
  if (situations.length > 0 && Math.random() < 0.3) {
    situationCardId = pickRandom(situations).id;
  }

  return {
    mandatoryCardId: mandatory.id,
    situationCardId,
    autoPicked: true,
  };
}

/** Domestic difficulty: shallow heuristic.
 *   - Bowling: pick the bowler whose delivery zone hits a weakness zone
 *     on the most-recently-seen batter. Falls back to any valid card.
 *   - Batting: pick the batter with the fewest weakness zones on the
 *     most-recently-seen bowler's delivery line. Falls back to whoever
 *     has the fewest weaknesses overall.
 */
function pickHeuristicMandatory(
  candidates: (BatsmanCard | BowlerCard)[],
  ctx: BallSelectionContext,
): BatsmanCard | BowlerCard {
  const opponent = ctx.lastOpponentCard;

  if (ctx.role === "bowling") {
    const bowlers = candidates as BowlerCard[];
    if (opponent && opponent.kind === "batsman") {
      const batter = opponent;
      // Score each bowler by how many of the batter's weakness zones
      // their delivery hits. Higher is better.
      const scored = bowlers.map((b) => ({
        card: b,
        score: batter.weaknesses.filter(
          (w) => w.zone.line === b.delivery.line && w.zone.length === b.delivery.length,
        ).length,
      }));
      scored.sort((a, b) => b.score - a.score);
      // Tiebreak by tier (Bronze < Silver < Gold < Elite preferred when score tied)
      return scored[0]!.card;
    }
    return pickRandom(bowlers);
  }

  // Batting: pick the batter with the fewest *weaknesses overall*.
  // Phase 2 will narrow this to weakness count vs the bowler's likely line.
  const batters = candidates as BatsmanCard[];
  const scored = batters.map((b) => ({
    card: b,
    weakCount: b.weaknesses.length,
  }));
  scored.sort((a, b) => a.weakCount - b.weakCount);
  return scored[0]!.card;
}

/** International difficulty add-on: hold Elite/Gold cards for the final
 *  third of the innings or once at least 1 wicket has fallen, when pressure
 *  is highest. If the heuristic picked an Elite/Gold but it's still
 *  early with wickets in hand, swap to a lower-tier valid card. */
function applyTierPrioritization(
  pick: BatsmanCard | BowlerCard,
  candidates: (BatsmanCard | BowlerCard)[],
  ctx: BallSelectionContext,
): BatsmanCard | BowlerCard {
  // "Late" = past the first 2/3 of the innings. For T1 (6 balls) that's
  // ball 5+; for T3 (18 balls) ball 13+; scales naturally with format.
  const lateThreshold = Math.ceil((ctx.ballsPerInnings * 2) / 3);
  const isLateOrPressure =
    ctx.ballsBowled >= lateThreshold || ctx.wicketsFallen >= 1;
  const isHighTier = pick.tier === "Elite" || pick.tier === "Gold";
  if (!isLateOrPressure && isHighTier) {
    // Look for a lower-tier alternative that's still reasonable.
    const lower = candidates.filter(
      (c) => c.tier === "Silver" || c.tier === "Bronze",
    );
    if (lower.length > 0) {
      return pickRandom(lower);
    }
  }
  return pick;
}

// ─── Swap pick (Mankad / Retired Out / Cramps) ───

/**
 * Strategically pick the best replacement card when a Mankad / Retired Out
 * / Cramps swap forces the bot to swap out its current mandatory card.
 *
 * Swap type drives the strategy:
 *   - Bot is batting (Mankad or Retired Out hit it): pick the batsman with
 *     the FEWEST weakness zones that match the bowler's delivery. Tiebreak
 *     by higher tier.
 *   - Bot is bowling (Cramps hit it): pick the bowler whose delivery zone
 *     hits the MOST weakness zones on the current batter. Tiebreak by
 *     higher tier.
 *
 * Falls back to random if the candidate list can't be resolved to full
 * card objects (pathological — shouldn't happen with a healthy deck).
 */
export function botPickSwap(match: ServerMatch): string {
  const swap = match.pendingSwap!;
  const candidateIds = swap.candidateIds;

  // Resolve candidate IDs to full card objects from the bot's hand.
  const botHand = match.decks?.[swap.fromSlot]?.hand ?? [];
  const candidates = candidateIds
    .map((id) => botHand.find((c) => c.id === id))
    .filter((c): c is AnyCard => c != null);

  if (candidates.length === 0) {
    // Pathological fallback.
    return candidateIds[Math.floor(Math.random() * candidateIds.length)]!;
  }

  const table = swap.table;
  const isBattingSwap = swap.fromSlot === table.battingSlot;

  if (isBattingSwap) {
    // Bot needs the best replacement BATSMAN to face the current bowler.
    // Fewer weakness zone matches against the bowler's delivery = better.
    const batters = candidates.filter((c): c is BatsmanCard => c.kind === "batsman");
    if (batters.length === 0) return candidateIds[0]!;
    const bowler = table.bowlingMandatory;
    const scored = batters.map((b) => ({
      id: b.id,
      weakVsBowler: b.weaknesses.filter(
        (w) =>
          w.zone.line === bowler.delivery.line &&
          w.zone.length === bowler.delivery.length,
      ).length,
      tierScore: tierValue(b.tier),
    }));
    // Fewest weaknesses vs this bowler; tiebreak by higher overall tier.
    scored.sort((a, b) => a.weakVsBowler - b.weakVsBowler || b.tierScore - a.tierScore);
    return scored[0]!.id;
  } else {
    // Bot needs the best replacement BOWLER to bowl at the current batter.
    // More weakness zone hits on the batter = better.
    const bowlers = candidates.filter((c): c is BowlerCard => c.kind === "bowler");
    if (bowlers.length === 0) return candidateIds[0]!;
    const batter = table.battingMandatory;
    const scored = bowlers.map((b) => ({
      id: b.id,
      weaknessHits: batter.weaknesses.filter(
        (w) =>
          w.zone.line === b.delivery.line &&
          w.zone.length === b.delivery.length,
      ).length,
      tierScore: tierValue(b.tier),
    }));
    // Most weakness hits on the batter; tiebreak by higher tier.
    scored.sort((a, b) => b.weaknessHits - a.weaknessHits || b.tierScore - a.tierScore);
    return scored[0]!.id;
  }
}

/** Numeric weight for a card tier — used to tiebreak equal heuristic scores. */
function tierValue(tier: Tier): number {
  switch (tier) {
    case "Elite": return 4;
    case "Gold": return 3;
    case "Silver": return 2;
    case "Bronze": return 1;
  }
}

// ─── Helpers ───

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Find the most recently revealed opponent card from the innings log.
 *  Used by Domestic+ to inform the next ball's pick. */
export function lastOpponentMandatory(
  match: ServerMatch,
  botSlot: PlayerSlot,
): AnyCard | null {
  const innings = match.currentInnings === 1 ? match.innings1 : match.innings2;
  if (!innings || innings.log.length === 0) return null;
  const lastBall = innings.log[innings.log.length - 1]!;
  // Bot wants the OPPONENT's card. Bot's slot determines which side.
  const opp = lastBall.battingSelection.player === botSlot
    ? lastBall.bowlingSelection
    : lastBall.battingSelection;
  return opp.mandatoryCard;
}

/** Type-guard helper: is this player slot a bot? */
export function isBotSlot(match: ServerMatch, slot: PlayerSlot): boolean {
  const player = match.players[slot];
  return !!player?.isBot;
}

/** Returns the bot player's difficulty, or null if not a bot. */
export function botDifficultyFor(
  match: ServerMatch,
  slot: PlayerSlot,
): BotDifficulty | null {
  const player = match.players[slot];
  if (!player?.isBot) return null;
  return player.botDifficulty;
}

// Suppress "unused export" warning for the Tier type imported above —
// kept for future Phase 2 deeper heuristics.
export type _UsedTier = Tier;
