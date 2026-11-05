/**
 * A player's full card (2026-11-03, opened from his tile; made shorter the same day, Yash: succinct
 * and legible). Who he is in one line with his tags, his batting and bowling numbers in this World
 * Cup large, then the slots he can go in. How each number is reached (era, position, pace/spin mix,
 * coach) folds away under them. Placement is always the user's choice: the slots offered are the
 * open ones in his range, and none when his range is full. Numbers only; where a number came from
 * is not the player's concern (Yash).
 *
 * 2026-11-05, Yash (the card read messy): the phase ratings and the per-slot batting numbers are
 * gone from the card, and the pace/spin boxes are a tag where the lean stands out. The engine still
 * plays all three; the strict slot ranges keep a man to slots where his number barely moves.
 */

import type { CoachOut } from "../../../wcdraft/src/engine/data.ts";
import { coachNote, type PlayerFit, type SkillFit } from "../game/fit.ts";
import type { PoolPlayer, Slot } from "../game/types.ts";
import { teamLabel } from "../lib/names.ts";
import { slotRange } from "../game/rules.ts";
import { CaptainTag, Digits, LeanTag, STYLE_NOTES, TierBadge, hereNumbers, paceSpinLean, roleLine, styleTitle } from "./PlayerCard.tsx";

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const deltaClass = (n: number) => (n > 0 ? "num-good" : n < 0 ? "num-bad" : "muted");

function Steps({ skill, label }: { skill: SkillFit; label: string }) {
  return (
    <table className="pd-steps">
      <tbody>
        <tr><td>{label} on the card</td><td><Digits n={skill.card} /></td></tr>
        {skill.steps.map((s) => <tr key={s.key}><td>{s.label}</td><td className={deltaClass(s.delta)}>{signed(s.delta)}</td></tr>)}
        <tr className="pd-total"><td>Here, under this coach</td><td><Digits n={skill.final} /></td></tr>
      </tbody>
    </table>
  );
}

/** One skill: the number in this World Cup, large, or a line saying how he plays without one. */
function Skill({ label, value, none }: { label: string; value: number | null; none: string }) {
  return (
    <div className={`pd-skill ${value === null ? "off" : ""}`}>
      <span className="pd-k">{label}</span>
      <div className="pd-skill-body"><Digits n={value} size="lg" />{value === null && <span className="pd-line">{none}</span>}</div>
    </div>
  );
}

export function PlayerDetail({ player, fit, hereEdition, coach, captained, slots, slotNote, locked, onPlace, onPlaceOnSheet, onClose }: {
  player: PoolPlayer;
  /** He has captained his country in T20Is (the Captain tag). */
  captained?: boolean;
  fit: PlayerFit | null | undefined;
  hereEdition: string;
  coach: CoachOut | null;
  /** Open slots in his batting range he may take now. */
  slots: Slot[];
  /** A slot in his range held back, and why (the keeper's last slot). */
  slotNote?: string | null;
  /** The draft guard: he cannot be taken now, and why. */
  locked: string | null;
  onPlace: (slot: number) => void;
  /** Phones: open the team sheet with his slots lit, in place of the slot buttons. */
  onPlaceOnSheet?: () => void;
  onClose: () => void;
}) {
  const p = player;
  const n = hereNumbers(p, fit);
  const note = coachNote(p, fit ?? undefined, coach);
  // Where he may bat, as the rules play it: a floater's most common number is no limit on him.
  const [first, last] = slotRange(p);
  const where = first === 1 && last === 11 ? "bats anywhere" : `bats Nos. ${first}–${last}`;
  const usually = p.position && !p.positionless ? `usually No. ${p.position}, ${where}` : where;
  const batter = p.batShown && p.role !== "bowler";
  const lean = batter ? paceSpinLean(p.vsPace, p.vsSpin) : null;
  return (
    <div className={`pd tier-edge-${p.tier.toLowerCase()}`}>
      <div className="pd-head">
        <div>
          <div className="pd-name">{p.name}{captained ? <CaptainTag /> : null}</div>
          <div className="pd-sub"><TierBadge tier={p.tier} /> {teamLabel(p.team)} {p.editionId} · {roleLine(p)}{usually ? ` · ${usually}` : ""}</div>
          {batter && (p.style || lean) && (
            <div className="pd-sub">
              {p.style && <><span className={`tag style style-${p.style.tag.toLowerCase()}`} title={styleTitle(p.style)}>{p.style.tag}</span> {STYLE_NOTES[p.style.tag]}</>}
              {lean && <LeanTag lean={lean} />}
            </div>
          )}
        </div>
        <button type="button" className="pd-close" onClick={onClose} aria-label="Close the card">×</button>
      </div>

      <div className="pd-nums">
        <Skill label={`Batting in ${hereEdition}`} value={n.bat} none="Rarely bats: plays as a typical batter at his slot." />
        <Skill label={`Bowling in ${hereEdition}`} value={n.bowl} none="Rarely bowls: he will not be given overs." />
      </div>

      <section className="pd-place">
        <h4>Place him</h4>
        {locked ? <p className="small lock-note">{locked}</p> : (
          <>
          {slotNote && <p className="small lock-note">{slotNote}</p>}
          {/* On a phone the choice is made on the team sheet, beside the men already named (2026-11-05, Yash). */}
          {onPlaceOnSheet && slots.length > 0 && <button type="button" className="primary pd-to-sheet only-phone" onClick={onPlaceOnSheet}>Place him on the team sheet</button>}
          <div className="pd-slots only-wide">
            {slots.map((s) => (
              <button key={s.index} type="button" className="pd-slot" aria-label={`Place at ${s.label}`} onClick={() => onPlace(s.index)}>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
          </>
        )}
      </section>

      {fit && (fit.batting || fit.bowling) && (
        <details className="pd-how">
          <summary>How {n.bat !== null && n.bowl !== null && fit.batting && fit.bowling ? "his numbers here are" : "his number here is"} worked out</summary>
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
