/**
 * The squad tile and the pieces the full card shares with it (2026-11-03, after Era Ball and 82-0):
 * the tier down the left edge, the name, what he is, and his batting and bowling numbers in the
 * World Cup being played. Numbers only: no marks for where a number came from (Yash: the player
 * cares about the number, not its source). Tapping a tile opens the full card.
 */

import type { BattingStyle, StyleOut } from "../../../wcdraft/src/ratings/model.ts";
import type { PlayerFit } from "../game/fit.ts";
import type { PoolPlayer, VsClass } from "../game/types.ts";
import { slotRange } from "../game/rules.ts";

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

/**
 * A batter's lean between pace and spin, only where it stands out (2026-11-05, Yash: a tag in place
 * of the two boxes). Across the ten pools pace minus spin runs −6 to +7 with its middle at +2, so
 * nearly every card read a little better against pace; the tag goes to the ends of that spread, pace
 * 5 or more above spin (43 batters) or spin 2 or more above pace (30). The engine plays the split
 * ball by ball off each bowler's class.
 */
export function paceSpinLean(pace: VsClass | null, spin: VsClass | null): "pace" | "spin" | null {
  if (!pace || !spin || pace.estimated || spin.estimated) return null;
  const gap = pace.n - spin.n;
  return gap >= 5 ? "pace" : gap <= -2 ? "spin" : null;
}

export function LeanTag({ lean }: { lean: "pace" | "spin" }) {
  return <span className={`tag lean lean-${lean}`} title={`Bats better against ${lean} than most`}>Favours {lean}</span>;
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

/** The Captain tag (2026-11-05): he has led his country in a men's T20I, so he can captain this eleven. */
export function CaptainTag() {
  return <span className="tag captain" title="Has captained his country in T20Is">Captain</span>;
}

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

/**
 * Where he bats, from his usual number: 1–2 opener, 3–4 top order, 5–6 middle order, 7–8 lower order,
 * 9–11 tailender. The same bands as the slot ranges (rules.ts `slotRange`; a No. 4 read "middle
 * order" here until 2026-11-05 while the rules played him as top order).
 */
export function batPlace(p: PoolPlayer): string | null {
  // A man who floats bats anywhere (a bowler who floats, in the tail), whatever his most common number
  // (2026-11-05: Sharafu read "middle order" and could open).
  if (p.positionless) return slotRange(p)[0] === 1 ? "floater" : "tailender";
  const n = p.position;
  if (n) return n <= 2 ? "opener" : n <= 4 ? "top order" : n <= 6 ? "middle order" : n <= 8 ? "lower order" : "tailender";
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
export function PlayerRow({ player, fit, captain, selected, ineligible, onClick }: { player: PoolPlayer; fit?: PlayerFit | null; captain?: boolean; selected?: boolean; ineligible?: boolean; onClick?: () => void }) {
  const p = player;
  const n = hereNumbers(p, fit);
  return (
    <button type="button" className={`pr tier-edge-${p.tier.toLowerCase()} ${selected ? "selected" : ""} ${ineligible ? "ineligible" : ""}`} onClick={onClick} aria-pressed={selected} aria-label={`${p.name}${captain ? ", has captained" : ""}, ${roleLine(p)}${n.bat !== null ? `, batting ${n.bat}` : ""}${n.bowl !== null ? `, bowling ${n.bowl}` : ""}${ineligible ? ", cannot be taken now" : ""}`}>
      <span className="pr-who">
        <span className="pr-name">{p.name}{captain && <CaptainTag />}</span>
        <span className="pr-sub">{roleLine(p)}</span>
      </span>
      <Rating label="Bat" n={n.bat} />
      <Rating label="Bowl" n={n.bowl} />
    </button>
  );
}
