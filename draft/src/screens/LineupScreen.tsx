import { useState } from "react";
import type { EditionOut } from "../../../wcdraft/src/engine/data.ts";
import { Digits } from "../components/PlayerCard.tsx";
import { captainChoices, captainFor, holdShare, type Captaincy } from "../game/captain.ts";
import { TeamSheet } from "../components/TeamSheet.tsx";
import { usePicksFit } from "../game/fit-load.ts";
import { SLOTS, bowlerCount, bowlersRequired, designatedKeeper, lineupProblems, squadRating, squadRatingHere } from "../game/rules.ts";
import { batInSlot, describeWeights, slotWeights } from "../game/slots.ts";
import { BUDGET, type RunState } from "../game/types.ts";

// The batting order starts as the order the eleven was drafted in. Line-up moves (2026-11-03, Yash)
// let two batting positions trade places, one move a swap, from a budget shared with the moves
// before matches; the numbers at each slot follow the man who moves. There is no way back into the
// draft: with eleven placed it had nothing left to spin, and soft-locked.
export function LineupScreen({ state, captaincy, editions, onCaptain, onSwap, onSimulate }: { state: RunState; captaincy: Captaincy; editions: EditionOut[]; onCaptain: (id: string | null) => void; onSwap: (a: number, b: number) => void; onSimulate: (captainId: string | null) => void }) {
  const [moving, setMoving] = useState<number | null>(null);
  const required = bowlersRequired(state.coach);
  const picks = state.picks;
  // The captain (2026-11-05, Yash): one of the eleven's captains, the most experienced until the
  // user picks another; with no captain in the eleven, nobody until the user marks one.
  const choices = captainChoices(picks, captaincy);
  const anyCaptains = choices.some((p) => captaincy.matches.has(p.id));
  const captainId = captainFor(picks, state.captainId, captaincy);
  const problems = [...lineupProblems(picks, required), ...(captainId ? [] : ["No captain: nobody in the eleven has captained, so mark one"])];
  const weights = SLOTS.map((s) => slotWeights(editions, state.identity?.editionId ?? "", s.index + 1));
  // Each man's batting number at his slot in this World Cup under the coach, as the draft showed it.
  const pickFits = usePicksFit(picks, state.identity?.editionId ?? "", state.coach, editions);
  const here = SLOTS.map((s) => {
    const p = picks[s.index];
    return p ? { bat: pickFits?.get(p.id)?.atSlot[s.index] ?? (p.batShown ? batInSlot(p, weights[s.index]!) : null), bowl: pickFits?.get(p.id)?.bowling?.final ?? null } : null;
  });
  const canMove = state.movesLeft > 0;
  const swap = (b: number) => { if (moving !== null) onSwap(moving, b); setMoving(null); };
  // On a desktop the captain, the moves and Play sit in a column beside the sheet, so the whole
  // lineup fits one screen (2026-11-03, Yash: he had to scroll past the sheet to begin).
  return (
    <section className="card lineup-screen">
      <div className="lineup-main">
      <TeamSheet
        side={state.identity?.team ?? ""}
        edition={state.identity?.editionId ?? ""}
        coach={state.coach?.coachName ?? null}
        captainId={captainId}
        keeperId={designatedKeeper(picks)?.id ?? null}
        rows={SLOTS.map((s) => {
          const p = picks[s.index] ?? null;
          const w = weights[s.index]!;
          const action = !p || !canMove ? <span className="sheet-slot-note" title={describeWeights(w)} />
            : moving === null ? <button type="button" className="sheet-move" aria-label={`Move ${p.name}`} onClick={() => setMoving(s.index)}>Move</button>
            : moving === s.index ? <button type="button" className="sheet-move on" aria-label={`Keep ${p.name} at ${s.label}`} onClick={() => setMoving(null)}>Cancel</button>
            : <button type="button" className="sheet-place" aria-label={`Swap ${picks[moving]?.name} with ${p.name}`} onClick={() => swap(s.index)}>Swap</button>;
          return {
            slot: s,
            player: p,
            batHere: here[s.index]?.bat ?? null,
            bowlHere: here[s.index]?.bowl ?? null,
            keeps: !!p && designatedKeeper(picks)?.id === p.id,
            open: moving !== null && moving !== s.index,
            action,
          };
        })}
        footer={<>Keeper <b>{designatedKeeper(picks)?.name ?? "–"}</b> · bowlers <b>{bowlerCount(picks)}</b>/{required} · Bat is each man's number at that position</>}
      />
      </div>
      <aside className="lineup-side">
        <p className="eyebrow">Lineup</p>
        <h2 className="lineup-title">{state.identity?.team} {state.identity?.editionId}</h2>
        <p className="small muted">Coached by {state.coach?.coachName ?? "nobody"}</p>
        <div className="strip lineup-strip">
          <span className="strip-item"><span className="rt-k">Squad rating</span><Digits n={pickFits ? squadRatingHere(here) : squadRating(picks)} /></span>
          <span className="strip-item"><span className="rt-k">Bowlers</span><Digits n={bowlerCount(picks)} /><span className="strip-of">/{required}</span></span>
        </div>
        <section className="lineup-box">
          <span className="strip-item"><span className="rt-k">Line-up moves left</span><Digits n={state.movesLeft} /><span className="strip-of">/{BUDGET.lineupMoves}</span></span>
          <p className="small muted">{canMove ? (moving === null ? "Tap Move on a player, then Swap on another: they trade places for one move. Moves left carry into the tournament, before any match." : `Moving ${picks[moving]?.name}: tap Swap on the player to trade places with.`) : "No moves left: the order stands."}</p>
        </section>
        <div className="lineup-box lineup-captain">
          <label>
            <span className="rt-k">Captain</span>
            <select value={captainId ?? ""} onChange={(e) => onCaptain(e.target.value || null)}>
              {!captainId && <option value="">Mark a captain</option>}
              {choices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {!anyCaptains && <p className="small muted">Nobody in this eleven has captained: any of them can lead.</p>}
          {/* What he brings, as the engine plays it: how often his side holds a finisher back after a collapse. */}
          {captainId && <span className="strip-item"><span className="rt-k">Holds a finisher back after a collapse</span><Digits n={Math.round(100 * holdShare(captainId, captaincy))} /><span className="strip-of">%</span></span>}
        </div>
        {problems.length > 0 && <ul className="problems">{problems.map((x) => <li key={x}>{x}</li>)}</ul>}
        <button type="button" className="primary lineup-play" disabled={problems.length > 0} onClick={() => { if (state.captainId !== captainId) onCaptain(captainId); onSimulate(captainId); }}>Play the World Cup</button>
      </aside>
    </section>
  );
}
