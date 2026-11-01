import type { BattingStyle, StyleOut } from "../../../wcdraft/src/ratings/model.ts";
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

const vsTitle = (label: string, v: VsClass | null) => {
  if (!v) return "";
  if (v.estimated) return `${label}: estimate from the batting level and hand; only ${v.balls} balls faced`;
  return `${label}: from ${v.balls} balls faced${v.odi ? ", ODIs included because there were too few in T20" : ""}`;
};

/** What each batting style means, for tooltips and the who-won panel. */
export const STYLE_NOTES: Record<BattingStyle, string> = {
  Aggressor: "fast from ball one and keeps going",
  Complete: "rotates early, then scores big",
  Builder: "starts slowly, then scores big",
  Starter: "fast start, ordinary after it",
  Rotator: "few dots, few boundaries",
  Anchor: "steady start, few boundaries",
};

const signedPoints = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;

function styleTitle(s: StyleOut): string {
  return `${s.tag}: ${STYLE_NOTES[s.tag]}. Against peers, first 10 balls: boundary % ${signedPoints(s.startBoundary)}, dot % ${signedPoints(s.startDot)}, strike rate ${signedPoints(s.startSR)}. Ball 11 on: strike rate ${signedPoints(s.laterSR)}.`;
}

/** The card's projected tag, or null when both numbers rest on the record before the World Cup. */
function projectedTitle(p: PoolPlayer): string | null {
  const skills = [p.batProjected && p.batShown ? `Batting (${p.batProjected} balls)` : "", p.bowlProjected && p.bowlShown ? `Bowling (${p.bowlProjected} balls)` : ""].filter(Boolean);
  return skills.length ? `${skills.join(" and ")} leans on the balls after this World Cup began, because the record before it was too thin.` : null;
}

export function archetypeLabel(p: PoolPlayer): string {
  const parts: string[] = [];
  if (p.role !== "bowler" && p.archetype.batting) parts.push(p.archetype.batting);
  if (p.role !== "batter" && p.archetype.bowling) parts.push(`${p.archetype.bowling} bowler`);
  if (p.positionless) parts.push("positionless");
  return parts.join(" · ") || p.role;
}

export function PlayerCard({ player, selected, compact, ineligible, onClick }: { player: PoolPlayer; selected?: boolean; compact?: boolean; ineligible?: boolean; onClick?: () => void }) {
  const p = player;
  const projected = projectedTitle(p);
  return (
    <button type="button" className={`player ${selected ? "selected" : ""} ${compact ? "compact" : ""} ${ineligible ? "ineligible" : ""}`} onClick={onClick} disabled={!onClick || ineligible} title={ineligible ? "Your side still needs bowlers or a keeper; only they can be taken now" : undefined}>
      <div className="player-head">
        <TierBadge tier={p.tier} />
        <span className="player-name">{p.name}</span>
        <span className="player-meta">{p.team} {p.editionId}</span>
      </div>
      <div className="player-line">
        <span className="arch">{archetypeLabel(p)}</span>
        {p.style && p.batShown && p.role !== "bowler" && <span className={`tag style style-${p.style.tag.toLowerCase()}`} title={styleTitle(p.style)}>{p.style.tag}</span>}
        {p.keeper && <span className="tag">WK</span>}
        {p.hand && <span className="tag muted">{p.hand === "L" ? "LHB" : "RHB"}</span>}
        {p.bowlingType && p.bowlingType !== "none" && (p.bowlShown || p.role === "bowler" || p.role === "all-rounder") && <span className="tag muted" title={bowlingTypeName(p.bowlingType)}>{p.bowlingType}</span>}
        {p.squadPlayer && <span className="tag muted">squad player</span>}
        {projected && <span className="tag muted" title={projected}>projected</span>}
      </div>
      {!compact && (
        <div className="phases">
          {p.batShown ? (
            <div><span className="k">Bat</span> <b>{p.bat}{p.batLow ? "*" : ""}</b> <small>{p.batPhases.pp} / {p.batPhases.mid} / {p.batPhases.death}</small></div>
          ) : <div><span className="k">Bat</span> <small className="muted">rarely bats</small></div>}
          {p.bowlShown ? (
            <div><span className="k">Bowl</span> <b>{p.bowl}{p.bowlLow ? "*" : ""}</b> <small>{p.bowlPhases.pp} / {p.bowlPhases.mid} / {p.bowlPhases.death}</small></div>
          ) : <div><span className="k">Bowl</span> <small className="muted">rarely bowls</small></div>}
        </div>
      )}
      {!compact && p.batShown && (
        <div className="vs-line" title={`${vsTitle("Against pace", p.vsPace)}. ${vsTitle("Against spin", p.vsSpin)}.`}>
          <span className="k">v pace</span> <VsNumber value={p.vsPace} other={p.vsSpin} />
          <span className="k">v spin</span> <VsNumber value={p.vsSpin} other={p.vsPace} />
        </div>
      )}
    </button>
  );
}
