import type { CaptainOut, EditionOut } from "../../../wcdraft/src/engine/data.ts";
import { TeamSheet } from "../components/TeamSheet.tsx";
import { SLOTS, designatedKeeper, lineupProblems, oversCovered, squadRating } from "../game/rules.ts";
import { batInSlot, describeWeights, slotWeights } from "../game/slots.ts";
import type { RunState } from "../game/types.ts";

// The batting order is the order the eleven was drafted in; no reordering (decided 2026-11-01: the
// slot you place a man in is the decision, and moving him later would soften it).
export function LineupScreen({ state, captains, editions, onCaptain, onBack, onSimulate }: { state: RunState; captains: CaptainOut[]; editions: EditionOut[]; onCaptain: (id: string | null) => void; onBack: () => void; onSimulate: () => void }) {
  const problems = lineupProblems(state.picks);
  const weights = SLOTS.map((s) => slotWeights(editions, state.identity?.editionId ?? "", s.index + 1));
  const rated = (id: string) => captains.filter((c) => c.personId === id).sort((a, b) => b.matches - a.matches)[0];
  const picks = state.picks;
  const defaultCaptain = picks.filter(Boolean).map((p) => ({ p: p!, c: rated(p!.id) })).filter((x) => x.c).sort((a, b) => b.c!.z - a.c!.z)[0]?.p.id ?? null;
  const captainId = state.captainId ?? defaultCaptain;
  return (
    <section className="card">
      <p className="eyebrow">Lineup · squad rating {squadRating(picks)} · overs {oversCovered(picks)}/20</p>
      <h2>{state.identity?.team} {state.identity?.editionId}, coached by {state.coach?.coachName ?? "nobody"}</h2>
      <TeamSheet
        side={state.identity?.team ?? ""}
        edition={state.identity?.editionId ?? ""}
        coach={state.coach?.coachName ?? null}
        captainId={captainId}
        keeperId={designatedKeeper(picks)?.id ?? null}
        rows={SLOTS.map((s) => {
          const p = picks[s.index] ?? null;
          const w = weights[s.index]!;
          return {
            slot: s,
            player: p,
            batHere: p && p.batShown ? batInSlot(p, w) : null,
            action: <span className="sheet-slot-note" title={describeWeights(w)} />,
          };
        })}
        footer={<>Keeper <b>{designatedKeeper(picks)?.name ?? "–"}</b> · overs covered <b>{oversCovered(picks)}</b>/20 · the order is the order you drafted; Bat is each man's number at that position</>}
      />
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
