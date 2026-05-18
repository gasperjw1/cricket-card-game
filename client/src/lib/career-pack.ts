/**
 * World Cup pack generation + ladder builder.
 *
 * Pure functions — no localStorage or React. Easy to test, easy to
 * regenerate decks on demand. Pulls cards from the global CARDS roster
 * imported via @swipe-sixer/shared/data.
 */

import type {
  AnyCard,
  BatsmanCard,
  BowlerCard,
  SituationCard,
  Tier,
} from "@swipe-sixer/shared";
import { CARDS } from "@swipe-sixer/shared/data";
import {
  TOURNAMENT_FORMATS,
  type DifficultyMode,
  type TournamentFormat,
  type WCOpponent,
} from "./career.ts";

// ─────────────────────────── Ladder ───────────────────────────

type BotLevel = "Gully" | "Domestic" | "International";

/**
 * Pick the difficulty tier for a specific ladder slot, given the
 * player's chosen mode + the stage. Casual = always Gully. Legend =
 * always International. Realistic ramps by stage.
 */
function difficultyForSlot(
  mode: DifficultyMode,
  stage: "group" | "qf" | "semi" | "final",
  groupIdx: number,
): BotLevel {
  if (mode === "casual") return "Gully";
  if (mode === "legend") return "International";
  // realistic
  if (stage === "group") return groupIdx < 2 ? "Gully" : "Domestic";
  if (stage === "qf") return "Domestic";
  if (stage === "semi") return "Domestic";
  return "International"; // final
}

/**
 * Generate a tournament ladder. Length + composition depend on the
 * tournament config (TOURNAMENT_FORMATS in career.ts):
 *
 *   - World Cup: 5 group + semi + final = 7 matches
 *   - Asia Cup:  4 group + semi + final = 6 matches (subcontinent pool)
 *   - Champions Trophy: QF + semi + final = 3 matches (knockouts-only)
 *
 * Difficulty per slot is determined by the mode (Casual / Realistic /
 * Legend) — see `difficultyForSlot`.
 */
export function generateLadder(
  tournament: TournamentFormat,
  difficulty: DifficultyMode,
): WCOpponent[] {
  const config = TOURNAMENT_FORMATS[tournament];
  const pool = [...config.eligibleNations];
  const shuffled = shuffle(pool);

  const ladder: WCOpponent[] = [];
  let matchIndex = 0;
  let poolIdx = 0;

  // Group stage (may be 0 for Champions Trophy).
  for (let g = 0; g < config.groupMatches; g++) {
    const nation = shuffled[poolIdx % shuffled.length]!;
    poolIdx += 1;
    ladder.push({
      nation,
      difficulty: difficultyForSlot(difficulty, "group", g),
      stageLabel: "group",
      matchIndex,
    });
    matchIndex += 1;
  }

  // Knockout stages.
  for (const stage of config.knockoutStages) {
    const nation = shuffled[poolIdx % shuffled.length]!;
    poolIdx += 1;
    ladder.push({
      nation,
      difficulty: difficultyForSlot(difficulty, stage, 0),
      stageLabel: stage,
      matchIndex,
    });
    matchIndex += 1;
  }

  return ladder;
}

// ─────────────────────────── Draft pools ───────────────────────────

/** Random sample of Elite batters, no duplicates. */
export function draftPoolEliteBatters(count: number, exclude: string[] = []): BatsmanCard[] {
  return sampleByTier(CARDS.batsmen, "Elite", count, exclude) as BatsmanCard[];
}

export function draftPoolEliteBowlers(count: number, exclude: string[] = []): BowlerCard[] {
  return sampleByTier(CARDS.bowlers, "Elite", count, exclude) as BowlerCard[];
}

export function draftPoolGoldBatters(count: number, exclude: string[] = []): BatsmanCard[] {
  return sampleByTier(CARDS.batsmen, "Gold", count, exclude) as BatsmanCard[];
}

export function draftPoolGoldBowlers(count: number, exclude: string[] = []): BowlerCard[] {
  return sampleByTier(CARDS.bowlers, "Gold", count, exclude) as BowlerCard[];
}

/** All batting-side situation cards (for draft selection). */
export function draftPoolBattingSituations(): SituationCard[] {
  return CARDS.situations.filter((s) => s.deck === "batting");
}

export function draftPoolBowlingSituations(): SituationCard[] {
  return CARDS.situations.filter((s) => s.deck === "bowling");
}

function sampleByTier(
  pool: (BatsmanCard | BowlerCard)[],
  tier: Tier,
  count: number,
  exclude: string[],
): (BatsmanCard | BowlerCard)[] {
  const excludeSet = new Set(exclude);
  const filtered = pool.filter(
    (c) => c.tier === tier && !excludeSet.has(c.id),
  );
  return sample(filtered, count);
}

// ─────────────────────────── Per-win + trophy packs ───────────────────────────

export interface PackContents {
  /** 6 cards offered. Player picks 2. */
  offered: AnyCard[];
  /** Marketing label shown in the pack-opening screen. */
  label: string;
}

/**
 * Generate a per-win pack. 6 slots, each independently rolled by
 * stage-tuned rarity. Guarantees ≥1 batter and ≥1 bowler so packs
 * aren't degenerate single-role piles. Situation cards are NOT
 * guaranteed — they appear ~10% per slot organically.
 */
export function generatePerWinPack(
  stage: "group" | "semi",
  excludeIds: string[] = [],
): PackContents {
  // Stage-based Elite/Gold bias.
  const eliteChance = stage === "group" ? 0.05 : 0.10;
  const goldChance = 0.25;
  const sitChance = 0.10;

  const slots: AnyCard[] = [];
  const used = new Set(excludeIds);

  // Guarantee diversity: 1 batter and 1 bowler at minimum. The kind
  // is forced; the tier still rolls (no situation card on these slots).
  push(slots, used, pickByRoll(eliteChance, goldChance, 0, "batter", used) ?? randomBatter(used));
  push(slots, used, pickByRoll(eliteChance, goldChance, 0, "bowler", used) ?? randomBowler(used));

  // Remaining 4 slots: any kind, situations roll naturally.
  for (let i = 0; i < 4; i++) {
    const r = Math.random();
    let card: AnyCard | null = null;
    if (r < sitChance) card = randomSituation(used);
    else card = Math.random() < 0.5
      ? pickByRoll(eliteChance, goldChance, 0, "batter", used)
      : pickByRoll(eliteChance, goldChance, 0, "bowler", used);
    push(slots, used, card ?? randomSilver(used));
  }

  return { offered: slots, label: stage === "group" ? "Group-stage pack" : "Knockout pack" };
}

/**
 * Trophy-final pack. Different shape: guaranteed Elite + Gold +
 * baseline of Silvers + 1 situation. 6 cards, pick 2.
 */
export function generateTrophyPack(excludeIds: string[] = []): PackContents {
  const slots: AnyCard[] = [];
  const used = new Set(excludeIds);

  // 1 guaranteed Elite (alternates batter / bowler, random)
  const eliteIsBatter = Math.random() < 0.5;
  const elite = eliteIsBatter
    ? sampleByTier(CARDS.batsmen, "Elite", 1, [...used])[0]
    : sampleByTier(CARDS.bowlers, "Elite", 1, [...used])[0];
  if (elite) push(slots, used, elite);

  // 2 guaranteed Golds (one of each kind to maintain diversity)
  const goldBat = sampleByTier(CARDS.batsmen, "Gold", 1, [...used])[0];
  if (goldBat) push(slots, used, goldBat);
  const goldBowl = sampleByTier(CARDS.bowlers, "Gold", 1, [...used])[0];
  if (goldBowl) push(slots, used, goldBowl);

  // 2 Silvers (any kind)
  for (let i = 0; i < 2; i++) {
    const s = randomSilver(used);
    if (s) push(slots, used, s);
  }

  // 1 situation
  const sit = randomSituation(used);
  if (sit) push(slots, used, sit);

  return { offered: slots, label: "🏆 World Cup Trophy pack" };
}

// ─────────────────────────── Helpers ───────────────────────────

function pickByRoll(
  eliteChance: number,
  goldChance: number,
  sitChance: number,
  kind: "batter" | "bowler",
  used: Set<string>,
): AnyCard | null {
  const r = Math.random();
  if (r < sitChance) {
    return randomSituationNoExclusion();
  }
  let tier: Tier = "Silver";
  if (r < sitChance + eliteChance) tier = "Elite";
  else if (r < sitChance + eliteChance + goldChance) tier = "Gold";
  const pool = kind === "batter" ? CARDS.batsmen : CARDS.bowlers;
  // CRITICAL: filter by `used` so cards already in the player's
  // deck/inventory are excluded. Previously this filter was missing
  // and the exclude list only worked via the fallback path (e.g.,
  // randomBatter → randomSilver), which meant duplicates leaked
  // through the primary roll path.
  const filtered = pool.filter(
    (c) => c.tier === tier && !used.has(c.id),
  );
  if (filtered.length === 0) return null;
  return filtered[Math.floor(Math.random() * filtered.length)] ?? null;
}

function randomBatter(used: Set<string>): AnyCard | null {
  const pool = CARDS.batsmen.filter((c) => !used.has(c.id));
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function randomBowler(used: Set<string>): AnyCard | null {
  const pool = CARDS.bowlers.filter((c) => !used.has(c.id));
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

/** Situation cards bypass the no-duplicate rule (per Yash's spec — you
 *  CAN have multiple of the same situation). So we don't filter `used`. */
function randomSituation(_used: Set<string>): AnyCard | null {
  const pool = CARDS.situations;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function randomSituationNoExclusion(): AnyCard | null {
  return CARDS.situations[Math.floor(Math.random() * CARDS.situations.length)] ?? null;
}

function randomSilver(used: Set<string>): AnyCard | null {
  const pool = [
    ...CARDS.batsmen.filter((c) => c.tier === "Silver" && !used.has(c.id)),
    ...CARDS.bowlers.filter((c) => c.tier === "Silver" && !used.has(c.id)),
  ];
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function push(arr: AnyCard[], used: Set<string>, card: AnyCard | null): void {
  if (card) {
    arr.push(card);
    // Only add to `used` for player cards — situation cards are
    // intentionally repeatable per Yash's spec.
    if (card.kind !== "situation") used.add(card.id);
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function sample<T>(pool: readonly T[], n: number): T[] {
  const a = [...pool];
  const out: T[] = [];
  while (out.length < n && a.length > 0) {
    const j = Math.floor(Math.random() * a.length);
    out.push(a.splice(j, 1)[0]!);
  }
  return out;
}
