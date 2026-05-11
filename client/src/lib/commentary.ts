/**
 * Generated commentary text — context-aware lines per ball.
 *
 * Two style sets:
 *   - "classic": measured British-broadcast tone ("Marvellous shot, that!")
 *   - "modern": punchy IPL/T20 tone ("BUMRAH COOKS HIM!")
 *
 * Templates are filtered by `fits()` against the ball + match context,
 * then one is picked at random and interpolated with `{batter}`,
 * `{bowler}`, `{runs}`, etc.
 *
 * Adding more variety: just push more lines into the matching style
 * array — no other code changes required.
 */

import type { BallResult, PlayerSlot } from "@swipe-sixer/shared";
import type { CommentaryStyle } from "./settings.ts";

export interface CommentaryContext {
  /** Which slot the commentary is being generated for (the perspective
   *  doesn't change the line text; this is here for future use). */
  perspective?: PlayerSlot;
  /** Innings number. */
  inningsNumber: 1 | 2;
  /** Ball number within innings (1-6). */
  ballNumber: number;
  /** Current innings runs/wickets after this ball. */
  runs: number;
  wickets: number;
  /** Target run total for innings 2 (null in innings 1). */
  target: number | null;
  /** Player display names for both sides. */
  battingPlayerName: string;
  bowlingPlayerName: string;
}

interface Template {
  /** Predicate — does this template fit the situation? */
  fits: (b: BallResult, ctx: CommentaryContext) => boolean;
  /** One of these is picked at random. */
  lines: string[];
}

// ─────────────────────────── Helpers ───────────────────────────

function isBoundary(b: BallResult): boolean {
  return b.finalOutcome.type === "runs" && b.finalOutcome.value >= 4;
}
function isSix(b: BallResult): boolean {
  return b.finalOutcome.type === "runs" && b.finalOutcome.value === 6;
}
function isWicket(b: BallResult): boolean {
  return b.finalOutcome.type === "wicket";
}
function isDot(b: BallResult): boolean {
  return b.finalOutcome.type === "dot" && b.extraRuns === 0;
}
function isLastBall(_: BallResult, ctx: CommentaryContext): boolean {
  return ctx.ballNumber === 6;
}
function isFirstBall(_: BallResult, ctx: CommentaryContext): boolean {
  return ctx.ballNumber === 1;
}
function chaseNeedsBig(_: BallResult, ctx: CommentaryContext): boolean {
  return (
    ctx.target !== null &&
    ctx.inningsNumber === 2 &&
    ctx.target - ctx.runs >= 6 &&
    ctx.ballNumber >= 5
  );
}

function batterName(b: BallResult): string {
  return b.battingSelection.mandatoryCard.name;
}
function bowlerName(b: BallResult): string {
  return b.bowlingSelection.mandatoryCard.name;
}
function shotShort(b: BallResult): string {
  if (b.finalOutcome.type !== "runs") return "shot";
  return b.finalOutcome.shot;
}
function dismissalShort(b: BallResult): string {
  if (b.finalOutcome.type !== "wicket") return "out";
  return b.finalOutcome.mode;
}

// ─────────────────────────── CLASSIC templates ───────────────────────────

const CLASSIC: Template[] = [
  // ─── Sixes ───
  {
    fits: (b) => isSix(b),
    lines: [
      "Marvellous shot — {batter} times that beautifully for six!",
      "Up, up, and over the rope. Six runs to {batter}.",
      "Cleanly struck. {batter} dispatches that into the crowd.",
      "Brilliant, just brilliant — {batter} clears the boundary with ease.",
      "Oh, that's huge. {batter} has timed that to perfection.",
    ],
  },
  // ─── Fours ───
  {
    fits: (b) => b.finalOutcome.type === "runs" && b.finalOutcome.value === 4,
    lines: [
      "Lovely shot — four to {batter}.",
      "Pierced through the field. Four runs.",
      "{batter} finds the gap and the ball races to the rope.",
      "Crisp timing from {batter}. That's a boundary.",
      "Good shot — well played, {batter}.",
    ],
  },
  // ─── Wickets — bowled ───
  {
    fits: (b) =>
      isWicket(b) &&
      b.finalOutcome.type === "wicket" &&
      b.finalOutcome.dismissalCategory === "bowled",
    lines: [
      "{bowler} cleans him up! Stumps in disarray.",
      "Through the gate! What a delivery from {bowler}.",
      "Bowled him! {batter} has no answer to that.",
      "The off-stump goes back. Magnificent bowling.",
    ],
  },
  // ─── Wickets — LBW ───
  {
    fits: (b) =>
      isWicket(b) &&
      b.finalOutcome.type === "wicket" &&
      b.finalOutcome.dismissalCategory === "lbw",
    lines: [
      "Plumb in front! {batter} is on his way.",
      "That's leg before — {bowler} appeals and the umpire raises the finger.",
      "Trapped! Dead in front, {batter} has to go.",
    ],
  },
  // ─── Wickets — caught ───
  {
    fits: (b) =>
      isWicket(b) &&
      b.finalOutcome.type === "wicket" &&
      b.finalOutcome.dismissalCategory.startsWith("caught"),
    lines: [
      "Caught! {batter} mistimes that completely.",
      "Up in the air... and held. {batter} departs.",
      "Edged and taken — what a catch!",
      "Skies it, and the fielder makes no mistake.",
    ],
  },
  // ─── Generic wickets fallback ───
  {
    fits: (b) => isWicket(b),
    lines: [
      "{batter} is gone — {dismissal}.",
      "That's the end of {batter}.",
    ],
  },
  // ─── Dot balls ───
  {
    fits: (b) => isDot(b),
    lines: [
      "Defended back to the bowler. Dot ball.",
      "{batter} watches it pass through to the keeper.",
      "Beaten — that's a maiden bowler's delivery.",
      "Solid defence. No run.",
    ],
  },
  // ─── Singles ───
  {
    fits: (b) => b.finalOutcome.type === "runs" && b.finalOutcome.value === 1,
    lines: [
      "Quick single. Good running between the wickets.",
      "Nudged into the gap, one run.",
      "Single taken. Strike rotated.",
    ],
  },
  // ─── Twos ───
  {
    fits: (b) => b.finalOutcome.type === "runs" && b.finalOutcome.value === 2,
    lines: [
      "Two runs — well placed by {batter}.",
      "Hard run for the second. Couple of runs added.",
    ],
  },
  // ─── Last ball drama ───
  {
    fits: (b, ctx) => isLastBall(b, ctx) && isSix(b),
    lines: [
      "On the last ball — and {batter} sends it sailing! What a finish!",
      "Six off the final ball! Drama at the death!",
    ],
  },
  {
    fits: (b, ctx) => isLastBall(b, ctx) && isWicket(b),
    lines: [
      "{bowler} strikes on the very last ball! Heartbreak for {batter}.",
      "Last ball — and a wicket. What a way to finish.",
    ],
  },
  {
    fits: (b, ctx) => isFirstBall(b, ctx) && isBoundary(b),
    lines: [
      "{batter} comes out swinging — boundary first ball!",
      "What a start! Boundary off the very first delivery.",
    ],
  },
  {
    fits: chaseNeedsBig,
    lines: [
      "Pressure-cooker stuff — {batter} needs to swing for it.",
      "Run-rate climbing. The chase is in the balance.",
    ],
  },
];

// ─────────────────────────── MODERN templates ───────────────────────────

const MODERN: Template[] = [
  // ─── Sixes ───
  {
    fits: (b) => isSix(b),
    lines: [
      "THAT IS HUGE! {batter} smashes it for six!",
      "Maximum! {batter} sends it into orbit!",
      "Boom! Six! No chance for the fielders.",
      "{batter} just deposited that into the stands. SIX!",
      "Goodnight, that. Cleared by miles.",
    ],
  },
  // ─── Fours ───
  {
    fits: (b) => b.finalOutcome.type === "runs" && b.finalOutcome.value === 4,
    lines: [
      "FOUR! Pierced through the gap by {batter}!",
      "Boundary! {batter} finds the rope.",
      "Smashed! Four runs to {batter}.",
      "{batter} times it sweetly — boundary!",
      "There's the four — easy peasy.",
    ],
  },
  // ─── Wickets — bowled ───
  {
    fits: (b) =>
      isWicket(b) &&
      b.finalOutcome.type === "wicket" &&
      b.finalOutcome.dismissalCategory === "bowled",
    lines: [
      "BOWLED HIM! {bowler} cooks {batter}!",
      "TIMBER! Stumps go cartwheeling!",
      "{bowler} cleans him up! What a ball!",
      "Through the gate! Game over for {batter}!",
    ],
  },
  // ─── Wickets — LBW ───
  {
    fits: (b) =>
      isWicket(b) &&
      b.finalOutcome.type === "wicket" &&
      b.finalOutcome.dismissalCategory === "lbw",
    lines: [
      "LBW! Finger goes up — {batter} is gone!",
      "Plumb! {bowler} traps him in front!",
      "DEAD in front. The umpire has no doubts.",
    ],
  },
  // ─── Wickets — caught ───
  {
    fits: (b) =>
      isWicket(b) &&
      b.finalOutcome.type === "wicket" &&
      b.finalOutcome.dismissalCategory.startsWith("caught"),
    lines: [
      "CAUGHT! {batter} skies it and the fielder takes it!",
      "Up in the air — and snaffled! {batter} walks!",
      "Top edge! Held in the deep — gone!",
      "{bowler} gets the wicket! Big catch!",
    ],
  },
  // ─── Generic wickets fallback ───
  {
    fits: (b) => isWicket(b),
    lines: [
      "WICKET! {batter} is OUT!",
      "Got him! {bowler} strikes!",
    ],
  },
  // ─── Dot balls ───
  {
    fits: (b) => isDot(b),
    lines: [
      "Dot ball. Pressure mounting.",
      "Beaten! No run.",
      "{batter} can't get it away — dot.",
      "Tight stuff. The pressure builds.",
    ],
  },
  // ─── Singles ───
  {
    fits: (b) => b.finalOutcome.type === "runs" && b.finalOutcome.value === 1,
    lines: [
      "Quick single — they steal one.",
      "One run. Strike rotates.",
      "Pushed for one. Easy single.",
    ],
  },
  // ─── Twos ───
  {
    fits: (b) => b.finalOutcome.type === "runs" && b.finalOutcome.value === 2,
    lines: [
      "Couple of runs — good running.",
      "{batter} takes two. Smart cricket.",
    ],
  },
  // ─── Last ball drama ───
  {
    fits: (b, ctx) => isLastBall(b, ctx) && isSix(b),
    lines: [
      "OFF THE LAST BALL! {batter} HITS IT FOR SIX! WHAT A MOMENT!",
      "SIX off the final delivery! UNBELIEVABLE!",
    ],
  },
  {
    fits: (b, ctx) => isLastBall(b, ctx) && isWicket(b),
    lines: [
      "WICKET on the last ball! {bowler} has done it!",
      "GONE! Last-ball drama at its finest!",
    ],
  },
  {
    fits: (b, ctx) => isFirstBall(b, ctx) && isBoundary(b),
    lines: [
      "{batter} comes out blazing — boundary first ball!",
      "WHAT A START! Hits a boundary off ball one!",
    ],
  },
  {
    fits: chaseNeedsBig,
    lines: [
      "{batter} needs to GO BIG! No singles will do!",
      "It's now or never — boundary required!",
    ],
  },
];

// ─────────────────────────── API ───────────────────────────

export function commentaryFor(
  ball: BallResult,
  ctx: CommentaryContext,
  style: CommentaryStyle,
): string | null {
  if (style === "off") return null;
  const pool = style === "modern" ? MODERN : CLASSIC;
  // Walk in declaration order — last-ball/first-ball/chase templates
  // come AFTER generic templates so they outweigh when applicable.
  // We pick from ALL fitting templates so generic + situational both
  // contribute, then bias toward the most-specific by sampling within
  // the last 3 fits when situational ones exist.
  const fits = pool.filter((t) => t.fits(ball, ctx));
  if (fits.length === 0) return null;
  // Bias toward later (more specific) matches: take the last 2 if there
  // are >2 candidates, else use all.
  const candidates = fits.length > 2 ? fits.slice(-2) : fits;
  const template = candidates[Math.floor(Math.random() * candidates.length)]!;
  const line = template.lines[Math.floor(Math.random() * template.lines.length)]!;
  return interpolate(line, ball);
}

function interpolate(line: string, b: BallResult): string {
  return line
    .replace(/\{batter\}/g, batterName(b))
    .replace(/\{bowler\}/g, bowlerName(b))
    .replace(/\{shot\}/g, shotShort(b))
    .replace(/\{dismissal\}/g, dismissalShort(b));
}
