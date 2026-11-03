/**
 * A player's full card (2026-11-03, opened from his tile; made shorter the same day, Yash: succinct
 * and legible). Who he is in one line, his batting and bowling numbers in this World Cup large with
 * the card's phases under each, then the slots he can go in, each with his batting number there.
 * How each number is reached (era, position, pace/spin mix, coach) folds away under them. Placement
 * is always the user's choice: the slots offered are the open ones he fits, and the rest when none
 * fits. Numbers only; where a number came from is not the player's concern (Yash).
 */

import type { CoachOut } from "../../../wcdraft/src/engine/data.ts";
import { coachNote, type PlayerFit, type SkillFit } from "../game/fit.ts";
import { batInSlot, describeWeights, type PhaseWeights } from "../game/slots.ts";
import type { PoolPlayer, Slot } from "../game/types.ts";
import { teamLabel } from "../lib/names.ts";
import { Digits, STYLE_NOTES, TierBadge, VsNumber, hereNumbers, roleLine, styleTitle } from "./PlayerCard.tsx";

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

/** One skill: the number in this World Cup, large, and the card's phases in one line under it. */
function Skill({ label, value, card, phases, extra, none }: { label: string; value: number | null; card: number; phases: Record<"pp" | "mid" | "death", number>; extra?: React.ReactNode; none: string }) {
  return (
    <div className={`pd-skill ${value === null ? "off" : ""}`}>
      <span className="pd-k">{label}</span>
      <Digits n={value} size="lg" />
      {value === null ? <span className="pd-line">{none}</span> : (
        <>
          <span className="pd-line">Card {card} · PP {phases.pp} · mid {phases.mid} · death {phases.death}</span>
          {extra && <span className="pd-line">{extra}</span>}
        </>
      )}
    </div>
  );
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
  const n = hereNumbers(p, fit);
  const note = coachNote(p, fit ?? undefined, coach);
  const usually = p.position ? `usually No. ${p.position}` : p.positionless ? "floats in the order" : null;
  return (
    <div className={`pd tier-edge-${p.tier.toLowerCase()}`}>
      <div className="pd-head">
        <div>
          <div className="pd-name">{p.name}</div>
          <div className="pd-sub"><TierBadge tier={p.tier} /> {teamLabel(p.team)} {p.editionId} · {roleLine(p)}{usually ? ` · ${usually}` : ""}</div>
          {p.style && p.batShown && p.role !== "bowler" && <div className="pd-sub"><span className={`tag style style-${p.style.tag.toLowerCase()}`} title={styleTitle(p.style)}>{p.style.tag}</span> {STYLE_NOTES[p.style.tag]}</div>}
        </div>
        <button type="button" className="pd-close" onClick={onClose} aria-label="Close the card">×</button>
      </div>

      <div className="pd-nums">
        <Skill label={`Batting in ${hereEdition}`} value={n.bat} card={p.bat} phases={p.batPhases} none="Rarely bats: plays as a typical batter at his slot." extra={<>v pace <VsNumber value={p.vsPace} other={p.vsSpin} /> · v spin <VsNumber value={p.vsSpin} other={p.vsPace} /></>} />
        <Skill label={`Bowling in ${hereEdition}`} value={n.bowl} card={p.bowl} phases={p.bowlPhases} none="Rarely bowls: he will not be given overs." />
      </div>

      <section className="pd-place">
        <h4>Place him</h4>
        {locked ? <p className="small lock-note">{locked}</p> : (
          <>
            {!natural && <p className="small">No natural slot is open; any open slot, at the batting number shown.</p>}
            <div className="pd-slots">
              {slots.map((s) => {
                const at = fit?.atSlot[s.index] ?? (p.batShown ? batInSlot(p, weights[s.index]!) : null);
                return (
                  <button key={s.index} type="button" className="pd-slot" title={describeWeights(weights[s.index]!)} aria-label={`Place at ${s.label}${at !== null ? `, batting ${at}` : ""}`} onClick={() => onPlace(s.index)}>
                    <span>{s.label}</span>{at !== null ? <small>bats {at}</small> : <small>&nbsp;</small>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {fit && (fit.batting || fit.bowling) && (
        <details className="pd-how">
          <summary>How {[n.bat !== null && fit.batting ? n.bat : null, n.bowl !== null && fit.bowling ? n.bowl : null].filter((x) => x !== null).join(" and ")} {n.bat !== null && n.bowl !== null && fit.batting && fit.bowling ? "are" : "is"} worked out</summary>
          <div className="pd-grid">
            {fit.batting && p.batShown && <Steps skill={fit.batting} label="Batting" />}
            {fit.bowling && p.bowlShown && <Steps skill={fit.bowling} label="Bowling" />}
          </div>
          {note && <p className="small pd-coach">{note}</p>}
        </details>
      )}
    </div>
  );
}
