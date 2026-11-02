/**
 * The draft card (overhauled 2026-11-01): every card has the same geometry so a grid of them
 * lines up. A tier bar down the left edge; the name on one line with the side and year on the
 * right; a fixed row of marks (role, hand, bowling code, WK); a Bat cell and a Bowl cell side by
 * side, each a big number over a three-segment phase bar, dimmed with a dash when the card hides
 * that skill; and a last line with the card's numbers in the World Cup being played (era, position
 * and pace/spin mix) and what the coach does to it. One footnote mark covers a thin record, an
 * estimate or a projection; the detail pane says which.
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

/** The number with its marks: * for an estimate, a small ODI tag when ODIs stood in for T20 balls. */
export function VsNumber({ value, other }: { value: VsClass | null; other: VsClass | null }) {
  if (!value) return <b>–</b>;
  return <><b className={splitClass(value, other)}>{value.n}{value.estimated ? "*" : ""}</b>{value.odi && <span className="vs-odi">ODI</span>}</>;
}

/** What each batting style means, for tooltips and the detail pane. */
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
  return `${s.tag}: ${STYLE_NOTES[s.tag]}. Against peers, first 10 balls: boundary % ${signedPoints(s.startBoundary)}, dot % ${signedPoints(s.startDot)}, strike rate ${signedPoints(s.startSR)}; from ball 11: strike rate ${signedPoints(s.laterSR)} (${s.balls} balls).`;
}

export function archetypeLabel(p: PoolPlayer): string {
  const parts: string[] = [];
  if (p.role !== "bowler" && p.archetype.batting) parts.push(p.archetype.batting);
  if (p.role !== "batter" && p.archetype.bowling) parts.push(`${p.archetype.bowling} bowler`);
  if (p.positionless) parts.push("positionless");
  return parts.join(" · ") || p.role;
}

/** The card's one footnote: why a number should be read with care, or null. */
export function footnote(p: PoolPlayer): string | null {
  const notes: string[] = [];
  if ((p.batShown && p.batLow) || (p.bowlShown && p.bowlLow)) notes.push("thin record");
  if ((p.batShown && p.batProjected) || (p.bowlShown && p.bowlProjected)) notes.push("projected from later balls");
  if (p.batShown && (p.vsPace?.estimated || p.vsSpin?.estimated)) notes.push("pace/spin split estimated");
  return notes.length ? notes.join("; ") : null;
}

/** Whether the card shows the player as someone who bowls (a bowler or all-rounder, or anyone with a shown bowling number). */
export const bowls = (p: PoolPlayer) => !!p.bowlingType && p.bowlingType !== "none" && (p.bowlShown || p.role === "bowler" || p.role === "all-rounder");

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const deltaClass = (n: number) => (n > 0 ? "num-good" : n < 0 ? "num-bad" : "muted");

function PhaseBar({ phases, shown }: { phases: Record<"pp" | "mid" | "death", number>; shown: boolean }) {
  // Each segment's height is the phase number on the 40–99 card scale, so a death-overs specialist reads at a glance.
  const h = (n: number) => `${Math.max(8, Math.min(100, ((n - 40) / 59) * 100))}%`;
  return (
    <span className={`pc-bar ${shown ? "" : "off"}`} aria-hidden="true">
      <i style={{ height: shown ? h(phases.pp) : "8%" }} /><i style={{ height: shown ? h(phases.mid) : "8%" }} /><i style={{ height: shown ? h(phases.death) : "8%" }} />
    </span>
  );
}

function SkillCell({ label, shown, value, low, phases, title }: { label: string; shown: boolean; value: number; low: boolean; phases: Record<"pp" | "mid" | "death", number>; title: string }) {
  return (
    <span className={`pc-skill ${shown ? "" : "off"}`} title={title}>
      <span className="pc-k">{label}</span>
      <span className="pc-n">{shown ? <>{value}{low ? <sup>*</sup> : null}</> : "–"}</span>
      <PhaseBar phases={phases} shown={shown} />
      <span className="pc-ph">{shown ? `${phases.pp} · ${phases.mid} · ${phases.death}` : label === "Bat" ? "rarely bats" : "rarely bowls"}</span>
    </span>
  );
}

export function PlayerCard({ player, fit, hereEdition, selected, ineligible, onClick }: { player: PoolPlayer; fit?: PlayerFit | null; hereEdition?: string; selected?: boolean; ineligible?: boolean; onClick?: () => void }) {
  const p = player;
  const note = footnote(p);
  const wk = p.keeper;
  return (
    <button type="button" className={`pc tier-edge-${p.tier.toLowerCase()} ${selected ? "selected" : ""} ${ineligible ? "ineligible" : ""}`} onClick={onClick} disabled={ineligible} aria-pressed={selected}>
      <span className="pc-head">
        <span className="pc-name" title={p.name}>{p.name}</span>
        <span className="pc-from">{p.team} {p.editionId}</span>
      </span>
      <span className="pc-marks">
        <span className="pc-role" title={archetypeLabel(p)}>{archetypeLabel(p)}</span>
        <span className={`pc-mark ${p.hand ? "" : "blank"}`}>{p.hand ? (p.hand === "L" ? "LHB" : "RHB") : " "}</span>
        <span className={`pc-mark ${bowls(p) ? "" : "blank"}`} title={bowls(p) ? bowlingTypeName(p.bowlingType!) : undefined}>{bowls(p) ? p.bowlingType : " "}</span>
        <span className={`pc-mark ${wk ? "wk" : "blank"}`}>{wk ? "WK" : " "}</span>
      </span>
      <span className="pc-skills">
        <SkillCell label="Bat" shown={p.batShown} value={p.bat} low={!!note && p.batShown && (p.batLow || !!p.batProjected)} phases={p.batPhases} title={p.batShown ? `Batting ${p.bat}: powerplay ${p.batPhases.pp}, middle ${p.batPhases.mid}, death ${p.batPhases.death}` : "The card does not rate his batting"} />
        <SkillCell label="Bowl" shown={p.bowlShown} value={p.bowl} low={!!note && p.bowlShown && (p.bowlLow || !!p.bowlProjected)} phases={p.bowlPhases} title={p.bowlShown ? `Bowling ${p.bowl}: powerplay ${p.bowlPhases.pp}, middle ${p.bowlPhases.mid}, death ${p.bowlPhases.death}` : "The card does not rate his bowling"} />
      </span>
      <span className="pc-foot">
        {p.batShown ? (
          <span className="pc-vs" title={`Batting number against pace and against spin${note ? ` (${note})` : ""}`}>
            <span className="pc-k">v pace</span> <VsNumber value={p.vsPace} other={p.vsSpin} /> <span className="pc-k">v spin</span> <VsNumber value={p.vsSpin} other={p.vsPace} />
          </span>
        ) : <span className="pc-vs muted">no batting record</span>}
        <span className="pc-here" title={hereEdition ? `The card in ${hereEdition}: era, usual position and pace/spin mix, then the coach's intent` : undefined}>
          {fit === undefined ? "" : fit === null ? <span className="muted">…</span> : (
            <>
              {hereEdition ? <span className="pc-k">{hereEdition}</span> : null}
              {fit.batting ? <> <span className="pc-k">bat</span> <b>{fit.batting.final}</b>{fit.batting.coachFit !== 0 ? <small className={deltaClass(fit.batting.coachFit)} title="Fit with the coach: how he fares against what the coach's tempo does to every batter">{signed(fit.batting.coachFit)} fit</small> : null}</> : null}
              {fit.bowling ? <> <span className="pc-k">bowl</span> <b>{fit.bowling.final}</b></> : null}
            </>
          )}
        </span>
      </span>
    </button>
  );
}
