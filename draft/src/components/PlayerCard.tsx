import type { PoolPlayer } from "../game/types.ts";

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
export function splitClass(mine: number | null, other: number | null): string {
  if (mine === null || other === null) return "";
  return mine - other >= 5 ? "num-good" : other - mine >= 5 ? "num-bad" : "";
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
  return (
    <button type="button" className={`player ${selected ? "selected" : ""} ${compact ? "compact" : ""} ${ineligible ? "ineligible" : ""}`} onClick={onClick} disabled={!onClick || ineligible} title={ineligible ? "Your side still needs bowlers or a keeper; only they can be taken now" : undefined}>
      <div className="player-head">
        <TierBadge tier={p.tier} />
        <span className="player-name">{p.name}</span>
        <span className="player-meta">{p.team} {p.editionId}</span>
      </div>
      <div className="player-line">
        <span className="arch">{archetypeLabel(p)}</span>
        {p.keeper && <span className="tag">WK</span>}
        {p.hand && <span className="tag muted">{p.hand === "L" ? "LHB" : "RHB"}</span>}
        {p.bowlingType && p.bowlingType !== "none" && (p.bowlShown || p.role === "bowler" || p.role === "all-rounder") && <span className="tag muted" title={bowlingTypeName(p.bowlingType)}>{p.bowlingType}</span>}
        {p.squadPlayer && <span className="tag muted">squad player</span>}
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
      {!compact && p.batShown && (p.vsPace !== null || p.vsSpin !== null) && (
        <div className="vs-line" title="His batting number against pace and against spin, from his own record by bowler type (60+ balls against each)">
          <span className="k">v pace</span> <b className={splitClass(p.vsPace, p.vsSpin)}>{p.vsPace ?? "–"}</b>
          <span className="k">v spin</span> <b className={splitClass(p.vsSpin, p.vsPace)}>{p.vsSpin ?? "–"}</b>
        </div>
      )}
    </button>
  );
}
