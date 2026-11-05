/**
 * A player's full card (2026-11-03, opened from his tile; made shorter the same day, Yash: succinct
 * and legible). Who he is in one line, his batting and bowling numbers in this World Cup large with
 * the card's phases under each, then the slots he can go in, each with his batting number there.
 * How each number is reached (era, position, pace/spin mix, coach) folds away under them. Placement
 * is always the user's choice: the slots offered are the open ones he fits, and the rest when none
 * fits. Numbers only; where a number came from is not the player's concern (Yash).
 */

import type { CoachOut } from "../../../wcdraft/src/engine/data.ts";
import { coachNote, phasesHere, type PlayerFit, type SkillFit } from "../game/fit.ts";
import { batInSlot, describeWeights, type PhaseWeights } from "../game/slots.ts";
import type { PoolPlayer, Slot } from "../game/types.ts";
import { teamLabel } from "../lib/names.ts";
import { Digits, Rating, STYLE_NOTES, TierBadge, hereNumbers, roleLine, splitClass, styleTitle } from "./PlayerCard.tsx";

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

type Phases = Record<"pp" | "mid" | "death", number>;

const USAGE_PHASES = [["pp", "PP", "powerplay"], ["mid", "Mid", "middle overs"], ["death", "Death", "death"]] as const;

/**
 * His number by phase (2026-11-04): one segment a phase, as wide as his share of balls faced or overs
 * bowled there, with his rating for the phase in this World Cup inside and the phase and share under
 * it. The number is these ratings weighted by these shares; for bowling the shares are also what the
 * engine's allocation reads (the bowling-roles research).
 */
/**
 * The segment's shade by its rating (2026-11-04): four steps of the card's green, darker the higher,
 * cut near the pool's quartiles of phase ratings (batting p25 56, p50 67, p75 75; bowling 63, 70, 76).
 */
const ratingBand = (r: number) => (r >= 80 ? 4 : r >= 70 ? 3 : r >= 60 ? 2 : 1);

function UsageBar({ ratings, shares, unit }: { ratings: Phases; shares: Phases; unit: "balls faced" | "overs bowled" }) {
  const pct = (s: number) => Math.round(100 * s);
  const label = `His ${unit} by phase: ${USAGE_PHASES.map(([k, , name]) => `${name} ${pct(shares[k])}%, rated ${ratings[k]}`).join("; ")}`;
  return (
    <div className="usage" role="img" aria-label={label}>
      <div className="usage-row">
        {USAGE_PHASES.map(([k, short]) => (
          <div key={k} className={`usage-col ${pct(shares[k]) === 0 ? "none" : ""}`} style={{ flexGrow: shares[k] }}>
            <span className={`usage-seg band-${ratingBand(ratings[k])}`}>{ratings[k]}</span>
            <span className="usage-label">{short}<br />{pct(shares[k])}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * One skill in one section: the number in this World Cup, large, beside his card by phase (the
 * usage bar), with any split boxes under them. 2026-11-04, Yash: one section for the overall number
 * and the phases, batting and bowling alike; the card's own number is not repeated (the large
 * number is the one that plays).
 */
function Skill({ label, value, card, phases: cardPhases, usage, extra, none }: {
  label: string; value: number | null; card: number; phases: Phases;
  usage: { shares: Phases; unit: "balls faced" | "overs bowled" } | null;
  extra?: React.ReactNode; none: string;
}) {
  if (value === null) {
    return (
      <div className="pd-skill off">
        <span className="pd-k">{label}</span>
        <div className="pd-skill-body"><Digits n={null} size="lg" /><span className="pd-line">{none}</span></div>
      </div>
    );
  }
  // The phases in this World Cup, so the bar agrees with the large number beside it.
  const phases = phasesHere(cardPhases, card, value);
  return (
    <div className="pd-skill">
      <span className="pd-k">{label}</span>
      <div className="pd-skill-body">
        <Digits n={value} size="lg" />
        {usage ? <UsageBar ratings={phases} shares={usage.shares} unit={usage.unit} /> : <span className="pd-line">PP {phases.pp} · mid {phases.mid} · death {phases.death}</span>}
      </div>
      {extra && <div className="pd-boxes">{extra}</div>}
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
        <Skill
          label={`Batting in ${hereEdition}`} value={n.bat} card={p.bat} phases={p.batPhases}
          usage={p.batWeights ? { shares: p.batWeights, unit: "balls faced" } : null}
          none="Rarely bats: plays as a typical batter at his slot."
          extra={<><Rating label="v pace" n={p.vsPace?.n ?? null} tone={splitClass(p.vsPace, p.vsSpin)} /><Rating label="v spin" n={p.vsSpin?.n ?? null} tone={splitClass(p.vsSpin, p.vsPace)} /></>}
        />
        <Skill
          label={`Bowling in ${hereEdition}`} value={n.bowl} card={p.bowl} phases={p.bowlPhases}
          usage={p.bowlShares ? { shares: p.bowlShares, unit: "overs bowled" } : null}
          none="Rarely bowls: he will not be given overs."
        />
      </div>

      <section className="pd-place">
        <h4>Place him</h4>
        {locked ? <p className="small lock-note">{locked}</p> : (
          <>
            {!natural && <p className="small">No natural slot is open; any open slot.</p>}
            <div className="pd-slots">
              {slots.map((s) => {
                const at = fit?.atSlot[s.index] ?? (p.batShown ? batInSlot(p, weights[s.index]!) : null);
                // A slot shows a number only where he bats differently from the large number above.
                const differs = at !== null && n.bat !== null && at !== n.bat;
                return (
                  <button key={s.index} type="button" className="pd-slot" title={describeWeights(weights[s.index]!)} aria-label={`Place at ${s.label}${at !== null ? `, batting ${at}` : ""}`} onClick={() => onPlace(s.index)}>
                    <span>{s.label}</span>{differs && <Digits n={at} />}
                  </button>
                );
              })}
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
