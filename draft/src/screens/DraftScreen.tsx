import { useState } from "react";
import { PlayerCard } from "../components/PlayerCard.tsx";
import { SLOTS, keeperCovered, oversCovered, slotsFor } from "../game/rules.ts";
import type { PoolPlayer, RunState } from "../game/types.ts";

export function DraftScreen({ state, onPlace, onReroll, onLineup }: { state: RunState; onPlace: (p: PoolPlayer, slot: number) => void; onReroll: () => void; onLineup: () => void }) {
  const [selected, setSelected] = useState<PoolPlayer | null>(null);
  const filled = state.picks.filter(Boolean).length;
  const open = selected ? slotsFor(selected, state.picks) : { slots: [], natural: true };
  const openIds = new Set(open.slots.map((s) => s.index));
  return (
    <section className="draft">
      <div className="card">
        <p className="eyebrow">Spin {Math.min(state.spinNumber, 11)} of 11 · {state.identity?.team} {state.identity?.editionId}{state.coach ? ` · coach ${state.coach.coachName}` : ""}</p>
        {state.spin ? (
          <>
            <h2>{state.spin.team} · {state.spin.editionId}</h2>
            <p className="small">Take one player into a slot. {selected ? (open.natural ? "Highlighted slots fit him." : "No natural slot left; he can fill any open one.") : "Tap a player first."}</p>
            <div className="spin-grid">
              {state.spin.players.map((p) => <PlayerCard key={p.id} player={p} selected={selected?.id === p.id} onClick={() => setSelected(selected?.id === p.id ? null : p)} />)}
            </div>
            <div className="row">
              <button type="button" onClick={() => { setSelected(null); onReroll(); }} disabled={state.spinRerolls <= 0}>Reroll squad ({state.spinRerolls} left)</button>
            </div>
          </>
        ) : <h2>Spinning…</h2>}
      </div>
      <aside className="card lineup">
        <h3>Your XI <span className="small">{filled}/11 · keeper {keeperCovered(state.picks) ? "✓" : "–"} · overs {oversCovered(state.picks)}/20</span></h3>
        <ol className="slots">
          {SLOTS.map((s) => {
            const p = state.picks[s.index];
            const canPlace = !!selected && openIds.has(s.index);
            return (
              <li key={s.index} className={`slot ${canPlace ? "open" : ""} ${p ? "filled" : ""}`}>
                <span className="slot-label">{s.label}</span>
                {p ? <PlayerCard player={p} compact /> : <button type="button" disabled={!canPlace} onClick={() => { if (selected) { onPlace(selected, s.index); setSelected(null); } }}>{canPlace ? "Place here" : "—"}</button>}
              </li>
            );
          })}
        </ol>
        {filled === 11 && <button type="button" className="primary" onClick={onLineup}>Review lineup</button>}
      </aside>
    </section>
  );
}
