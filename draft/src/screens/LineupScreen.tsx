import type { CaptainOut } from "../../../wcdraft/src/engine/data.ts";
import { PlayerCard } from "../components/PlayerCard.tsx";
import { SLOTS, lineupProblems, oversCovered, squadRating } from "../game/rules.ts";
import type { RunState } from "../game/types.ts";

export function LineupScreen({ state, captains, onSwap, onCaptain, onBack, onSimulate }: { state: RunState; captains: CaptainOut[]; onSwap: (a: number, b: number) => void; onCaptain: (id: string | null) => void; onBack: () => void; onSimulate: () => void }) {
  const problems = lineupProblems(state.picks);
  const rated = (id: string) => captains.filter((c) => c.personId === id).sort((a, b) => b.matches - a.matches)[0];
  const picks = state.picks;
  const defaultCaptain = picks.filter(Boolean).map((p) => ({ p: p!, c: rated(p!.id) })).filter((x) => x.c).sort((a, b) => b.c!.z - a.c!.z)[0]?.p.id ?? null;
  const captainId = state.captainId ?? defaultCaptain;
  return (
    <section className="card">
      <p className="eyebrow">Lineup · squad rating {squadRating(picks)} · overs {oversCovered(picks)}/20</p>
      <h2>{state.identity?.team} {state.identity?.editionId}, coached by {state.coach?.coachName ?? "nobody"}</h2>
      <ol className="slots">
        {SLOTS.map((s) => {
          const p = picks[s.index];
          return (
            <li key={s.index} className="slot filled">
              <span className="slot-label">{s.label}</span>
              {p && <PlayerCard player={p} compact />}
              <span className="moves">
                <button type="button" disabled={s.index === 0} onClick={() => onSwap(s.index, s.index - 1)} aria-label="move up">↑</button>
                <button type="button" disabled={s.index === 10} onClick={() => onSwap(s.index, s.index + 1)} aria-label="move down">↓</button>
              </span>
            </li>
          );
        })}
      </ol>
      <label className="row">
        Captain
        <select value={captainId ?? ""} onChange={(e) => onCaptain(e.target.value || null)}>
          <option value="">No rated captain (average)</option>
          {picks.filter(Boolean).map((p) => {
            const c = rated(p!.id);
            return <option key={p!.id} value={p!.id}>{p!.name}{c ? ` · captained ${c.matches} T20Is, rating ${c.z > 0 ? "+" : ""}${c.z.toFixed(1)}` : ""}</option>;
          })}
        </select>
      </label>
      {problems.length > 0 && <ul className="problems">{problems.map((x) => <li key={x}>{x}</li>)}</ul>}
      <div className="row">
        <button type="button" onClick={onBack}>Back to the draft</button>
        <button type="button" className="primary" disabled={problems.length > 0} onClick={() => { if (!state.captainId && captainId) onCaptain(captainId); onSimulate(); }}>Play the World Cup</button>
      </div>
    </section>
  );
}
