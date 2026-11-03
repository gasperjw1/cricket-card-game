/**
 * A player's full card (2026-11-03: opened from his row in the squad list). His numbers and what
 * the row leaves out: the per-phase table, pace and spin, the card in the World Cup being played
 * step by step (era, position, pace/spin mix, coach), and where he can bat. Placing him comes first
 * on the card, the reason for opening it. Placement is always the user's choice: the slots offered
 * are the open ones he fits, with his batting number in each, and the rest when none fits. Numbers
 * only; where a number came from is not the player's concern (Yash).
 */

import type { CoachOut } from "../../../wcdraft/src/engine/data.ts";
import { coachNote, type PlayerFit, type SkillFit } from "../game/fit.ts";
import { batInSlot, describeWeights, type PhaseWeights } from "../game/slots.ts";
import type { PoolPlayer, Slot } from "../game/types.ts";
import { teamLabel } from "../lib/names.ts";
import { STYLE_NOTES, TierBadge, VsNumber, archetypeLabel, bowlingTypeName, bowls, styleTitle } from "./PlayerCard.tsx";

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const deltaClass = (n: number) => (n > 0 ? "num-good" : n < 0 ? "num-bad" : "muted");

function Steps({ skill, label }: { skill: SkillFit; label: string }) {
  return (
    <table className="pd-steps">
      <tbody>
        <tr><td>{label} on the card</td><td>{skill.card}</td></tr>
        {skill.steps.map((s) => <tr key={s.key}><td>{s.label}</td><td className={deltaClass(s.delta)}>{signed(s.delta)}</td></tr>)}
        <tr className="pd-total"><td>Here, under this coach</td><td>{skill.final}</td></tr>
      </tbody>
    </table>
  );
}

function Phases({ phases }: { phases: Record<"pp" | "mid" | "death", number> }) {
  return <table className="pd-phases"><thead><tr><th>Powerplay</th><th>Middle</th><th>Death</th></tr></thead><tbody><tr><td>{phases.pp}</td><td>{phases.mid}</td><td>{phases.death}</td></tr></tbody></table>;
}

export function PlayerDetail({ player, fit, hereEdition, coach, slots, weights, natural, locked, onPlace, onClose }: {
  player: PoolPlayer;
  fit: PlayerFit | null | undefined;
  hereEdition: string;
  coach: CoachOut | null;
  /** Open slots he may go into, and whether they are his natural ones. */
  slots: Slot[];
  weights: PhaseWeights[];
  natural: boolean;
  /** The draft guard: he cannot be taken now, and why. */
  locked: string | null;
  onPlace: (slot: number) => void;
  onClose: () => void;
}) {
  const p = player;
  const note = coachNote(p, fit ?? undefined, coach);
  return (
    <div className={`pd tier-edge-${p.tier.toLowerCase()}`}>
      <div className="pd-head">
        <div>
          <div className="pd-name">{p.name}</div>
          <div className="small">{teamLabel(p.team)} {p.editionId} · <TierBadge tier={p.tier} /> {archetypeLabel(p)}</div>
        </div>
        <button type="button" className="pd-close" onClick={onClose} aria-label="Close the card">×</button>
      </div>
      <div className="pd-marks">
        {p.hand && <span className="tag">{p.hand === "L" ? "Left-hand bat" : "Right-hand bat"}</span>}
        {bowls(p) && <span className="tag">{bowlingTypeName(p.bowlingType!)}</span>}
        {p.keeper && <span className="tag">Wicketkeeper</span>}
        {p.style && p.batShown && p.role !== "bowler" && <span className={`tag style style-${p.style.tag.toLowerCase()}`} title={styleTitle(p.style)}>{p.style.tag}: {STYLE_NOTES[p.style.tag]}</span>}
        {p.position ? <span className="tag muted">usually bats No. {p.position}</span> : p.positionless ? <span className="tag muted">floats in the order</span> : null}
      </div>

      <section className="pd-place">
        <h4>Place him</h4>
        {locked ? <p className="small lock-note">{locked}</p> : (
          <>
            <p className="small">{natural ? "The slots he fits, with his batting number in each" : "No natural slot is open; any open slot, at the number shown"}{fit ? ` in ${hereEdition}${coach ? ` under ${coach.coachName}` : ""}.` : "."}</p>
            <div className="pd-slots">
              {slots.map((s) => {
                const n = fit?.atSlot[s.index] ?? (p.batShown ? batInSlot(p, weights[s.index]!) : null);
                return (
                  <button key={s.index} type="button" className="pd-slot" title={describeWeights(weights[s.index]!)} aria-label={`Place at ${s.label}${n !== null ? `, batting ${n}` : ""}`} onClick={() => onPlace(s.index)}>
                    <span>{s.label}</span>{n !== null ? <small>bat {n}</small> : <small>&nbsp;</small>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      <div className="pd-grid">
        <section>
          <h4>Batting {p.batShown ? <b>{p.bat}</b> : <span className="muted">not rated</span>}</h4>
          {p.batShown ? (
            <>
              <Phases phases={p.batPhases} />
              <p className="small">v pace <VsNumber value={p.vsPace} other={p.vsSpin} /> · v spin <VsNumber value={p.vsSpin} other={p.vsPace} /></p>
            </>
          ) : <p className="small muted">Rarely bats; he plays as a typical batter at his slot.</p>}
        </section>
        <section>
          <h4>Bowling {p.bowlShown ? <b>{p.bowl}</b> : <span className="muted">not rated</span>}</h4>
          {p.bowlShown ? <Phases phases={p.bowlPhases} /> : <p className="small muted">Rarely bowls; he will not be given overs.</p>}
        </section>
      </div>

      <section className="pd-here">
        <h4>In {hereEdition}</h4>
        {fit === null || fit === undefined ? <p className="small muted">Working out his numbers in this World Cup…</p> : (
          <>
            <div className="pd-grid">
              {fit.batting && <Steps skill={fit.batting} label="Batting" />}
              {fit.bowling && <Steps skill={fit.bowling} label="Bowling" />}
            </div>
            {note && <p className="small pd-coach">{note}</p>}
          </>
        )}
      </section>
    </div>
  );
}
