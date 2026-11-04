/**
 * The squad tile and the pieces the full card shares with it (2026-11-03, after Era Ball and 82-0):
 * the tier down the left edge, the name, what he is, and his batting and bowling numbers in the
 * World Cup being played. Numbers only: no marks for where a number came from (Yash: the player
 * cares about the number, not its source). Tapping a tile opens the full card.
 */

import type { BattingStyle, StyleOut } from "../../../wcdraft/src/ratings/model.ts";
import type { PlayerFit } from "../game/fit.ts";
import type { PoolPlayer, VsClass } from "../game/types.ts";

export function TierBadge({ tier }: { tier: string }) {
  return <span className={`tier tier-${tier.toLowerCase()}`}>{tier}</span>;
}

/** Cricinfo bowling codes spelled out for the tag's tooltip. */
export function bowlingTypeName(code: string): string {
  const names: Record<string, string> = {
    RF: "right-arm fast", RFM: "right-arm fast-medium", RM: "right-arm medium", LF: "left-arm fast", LFM: "left-arm fast-medium", LM: "left-arm medium",
    OB: "off spin", LB: "leg spin", LBG: "leg spin", SLA: "left-arm orthodox spin", SLW: "left-arm wrist spin", SLC: "left-arm wrist spin",
  };
  return names[code] ?? code;
}

/** Colour the stronger side of a pace/spin split when the gap is worth noticing (5 points or more). */
export function splitClass(mine: VsClass | null, other: VsClass | null): string {
  if (!mine || !other || mine.estimated || other.estimated) return "";
  return mine.n - other.n >= 5 ? "num-good" : other.n - mine.n >= 5 ? "num-bad" : "";
}

/** What each batting style means, for tooltips and the full card. */
export const STYLE_NOTES: Record<BattingStyle, string> = {
  Aggressor: "fast from ball one and keeps going",
  Complete: "rotates early, then scores big",
  Builder: "starts slowly, then scores big",
  Starter: "fast start, ordinary after it",
  Rotator: "few dots, few boundaries",
  Anchor: "steady start, few boundaries",
};

const signedPoints = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;

export function styleTitle(s: StyleOut): string {
  return `${s.tag}: ${STYLE_NOTES[s.tag]}. Against peers, first 10 balls: boundary % ${signedPoints(s.startBoundary)}, dot % ${signedPoints(s.startDot)}, strike rate ${signedPoints(s.startSR)}; from ball 11: strike rate ${signedPoints(s.laterSR)}.`;
}

export function archetypeLabel(p: PoolPlayer): string {
  const parts: string[] = [];
  if (p.role !== "bowler" && p.archetype.batting) parts.push(p.archetype.batting);
  if (p.role !== "batter" && p.archetype.bowling) parts.push(`${p.archetype.bowling} bowler`);
  if (p.positionless) parts.push("floats in the order");
  // The ratings' "unknown" role is internal; say what the card shows instead.
  const role = p.role === "unknown" ? (p.batShown ? "batter" : p.bowlShown ? "bowler" : "") : p.role;
  return parts.join(" · ") || role;
}

/** Whether the card shows the player as someone who bowls (a bowler or all-rounder, or anyone with a shown bowling number). */
export const bowls = (p: PoolPlayer) => !!p.bowlingType && p.bowlingType !== "none" && (p.bowlShown || p.role === "bowler" || p.role === "all-rounder");

/** Where he bats, from his usual number: 1–2 opener, 3 top order, 4–6 middle order, 7–8 lower order, 9–11 tailender. */
export function batPlace(p: PoolPlayer): string | null {
  const n = p.position;
  if (n) return n <= 2 ? "opener" : n === 3 ? "top order" : n <= 6 ? "middle order" : n <= 8 ? "lower order" : "tailender";
  // A man who floats in the order has no usual number; his batting archetype says where he mostly bats.
  const byArchetype: Record<string, string> = { opener: "opener", "top order": "top order", "middle order": "middle order", finisher: "lower order", tail: "tailender" };
  return p.archetype.batting ? byArchetype[p.archetype.batting] ?? null : null;
}

/**
 * What he is, in Yash's order (2026-11-03): WK and/or his bowling as its code (RFM, OB, SLA), then
 * his batting hand and where he bats. "WK – RHB opener", "OB – RHB middle order", "RFM – LHB tailender",
 * and "WK/OB – RHB middle order" for a keeper who bowls (Phillips, Dilshan): he bowls whenever
 * another man in the eleven keeps, so his bowling is shown too.
 */
export function roleLine(p: PoolPlayer): string {
  const bowling = bowls(p) ? (p.bowlingType === "LBG" ? "LB" : p.bowlingType!) : null;
  const first = [p.keeper ? "WK" : null, bowling].filter(Boolean).join("/") || null;
  const second = [p.hand ? (p.hand === "L" ? "LHB" : "RHB") : null, batPlace(p)].filter(Boolean).join(" ");
  return [first, second].filter(Boolean).join(" – ") || archetypeLabel(p);
}

/** His two numbers in the World Cup being played (the card's own until those have loaded); null when not shown. */
export function hereNumbers(p: PoolPlayer, fit: PlayerFit | null | undefined): { bat: number | null; bowl: number | null } {
  return {
    bat: p.batShown ? fit?.batting?.final ?? p.bat : null,
    bowl: p.bowlShown ? fit?.bowling?.final ?? p.bowl : null,
  };
}

/**
 * A number as the scoreboard shows it, each digit on its own tile; two blank tiles when there is no
 * number, so every plate keeps the same width (Yash, 2026-11-03).
 */
/** A rating in tiles; `xs` for inside a sentence or a button (2026-11-04, Yash: every rating boxed or graphed). */
export function Digits({ n, size = "sm" }: { n: number | null; size?: "xs" | "sm" | "lg" }) {
  const chars = n === null ? ["–", "–"] : String(n).split("");
  // Read as one number (it now sits in tables and sentences too, not only inside labelled buttons).
  // A decimal point sits between the tiles, not in one (the squad rating carries a decimal).
  return <span className={`dg dg-${size} ${n === null ? "off" : ""}`} role="img" aria-label={n === null ? "none" : String(n)}>{chars.map((c, i) => (c === "." ? <b key={i} className="dg-dot">.</b> : <i key={i}>{c}</i>))}</span>;
}

/** One rating in its own box, its name painted above it; `tone` outlines the box (num-good / num-bad). */
export function Rating({ label, n, size = "sm", tone = "" }: { label: string; n: number | null; size?: "sm" | "lg"; tone?: string }) {
  return <span className={`rt rt-${size} ${tone}`}><span className="rt-k">{label}</span><Digits n={n} size={size} /></span>;
}

/**
 * One squad member as a name plate (2026-11-03, after the Adelaide Oval and WACA boards): his name
 * on the plate, what he is under it, and his batting and bowling in this World Cup each in its own
 * box. The card numbers, phases and how they move live on the full card the plate opens.
 */
export function PlayerRow({ player, fit, selected, ineligible, onClick }: { player: PoolPlayer; fit?: PlayerFit | null; selected?: boolean; ineligible?: boolean; onClick?: () => void }) {
  const p = player;
  const n = hereNumbers(p, fit);
  return (
    <button type="button" className={`pr tier-edge-${p.tier.toLowerCase()} ${selected ? "selected" : ""} ${ineligible ? "ineligible" : ""}`} onClick={onClick} aria-pressed={selected} aria-label={`${p.name}, ${roleLine(p)}${n.bat !== null ? `, batting ${n.bat}` : ""}${n.bowl !== null ? `, bowling ${n.bowl}` : ""}${ineligible ? ", cannot be taken now" : ""}`}>
      <span className="pr-who">
        <span className="pr-name">{p.name}</span>
        <span className="pr-sub">{roleLine(p)}</span>
      </span>
      <Rating label="Bat" n={n.bat} />
      <Rating label="Bowl" n={n.bowl} />
    </button>
  );
}
