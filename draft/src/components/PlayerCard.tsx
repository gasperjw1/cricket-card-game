/**
 * The squad list row and the pieces the full card shares with it (2026-11-03, after Era Ball and
 * 82-0): one compact row a player, the tier down the left edge, the name with side, year and marks
 * under it, Bat and Bowl each a number over a three-segment phase bar, and his two numbers in the
 * World Cup being played. Numbers only: no marks for where a number came from (Yash: the player
 * cares about the number, not its source). Tapping a row opens the full card.
 */

import type { BattingStyle, StyleOut } from "../../../wcdraft/src/ratings/model.ts";
import type { PlayerFit } from "../game/fit.ts";
import type { PoolPlayer, VsClass } from "../game/types.ts";
import { teamLabel } from "../lib/names.ts";

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

/** A pace or spin number, coloured when it is clearly the stronger side. */
export function VsNumber({ value, other }: { value: VsClass | null; other: VsClass | null }) {
  if (!value) return <b>–</b>;
  return <b className={splitClass(value, other)}>{value.n}</b>;
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

export function PhaseBar({ phases, shown }: { phases: Record<"pp" | "mid" | "death", number>; shown: boolean }) {
  // Each segment's height is the phase number on the 40–99 card scale, so a death-overs specialist reads at a glance.
  const h = (n: number) => `${Math.max(8, Math.min(100, ((n - 40) / 59) * 100))}%`;
  return (
    <span className={`pc-bar ${shown ? "" : "off"}`} aria-hidden="true">
      <i style={{ height: shown ? h(phases.pp) : "8%" }} /><i style={{ height: shown ? h(phases.mid) : "8%" }} /><i style={{ height: shown ? h(phases.death) : "8%" }} />
    </span>
  );
}

function SkillCell({ label, shown, value, phases }: { label: string; shown: boolean; value: number; phases: Record<"pp" | "mid" | "death", number> }) {
  return (
    <span className={`pr-skill ${shown ? "" : "off"}`} title={shown ? `${label} ${value}: powerplay ${phases.pp}, middle ${phases.mid}, death ${phases.death}` : undefined}>
      <span className="pr-k">{label}</span>
      <span className="pr-n">{shown ? value : "–"}</span>
      <PhaseBar phases={phases} shown={shown} />
    </span>
  );
}

/** One squad member as a list row; the whole row opens his full card. */
export function PlayerRow({ player, fit, hereEdition, selected, ineligible, onClick }: { player: PoolPlayer; fit?: PlayerFit | null; hereEdition?: string; selected?: boolean; ineligible?: boolean; onClick?: () => void }) {
  const p = player;
  const marks = [archetypeLabel(p), p.hand ? (p.hand === "L" ? "LHB" : "RHB") : "", bowls(p) ? p.bowlingType! : "", p.keeper ? "WK" : ""].filter(Boolean).join(" · ");
  const here = fit ? [fit.batting ? `bat ${fit.batting.final}` : "", fit.bowling ? `bowl ${fit.bowling.final}` : ""].filter(Boolean).join(" · ") : "";
  return (
    <button type="button" className={`pr tier-edge-${p.tier.toLowerCase()} ${selected ? "selected" : ""} ${ineligible ? "ineligible" : ""}`} onClick={onClick} aria-pressed={selected} aria-label={`${p.name}, ${teamLabel(p.team)} ${p.editionId}${p.batShown ? `, batting ${p.bat}` : ""}${p.bowlShown ? `, bowling ${p.bowl}` : ""}${ineligible ? ", cannot be taken now" : ""}`}>
      <span className="pr-who">
        <span className="pr-name">{p.name}</span>
        <span className="pr-sub">{teamLabel(p.team)} {p.editionId} · {marks}</span>
      </span>
      <SkillCell label="Bat" shown={p.batShown} value={p.bat} phases={p.batPhases} />
      <SkillCell label="Bowl" shown={p.bowlShown} value={p.bowl} phases={p.bowlPhases} />
      <span className="pr-here">{hereEdition && here ? <><span className="pr-k">{hereEdition}</span><b>{here}</b></> : fit === null ? <span className="muted">…</span> : null}</span>
    </button>
  );
}
