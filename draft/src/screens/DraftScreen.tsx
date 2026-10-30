import { useMemo, useState } from "react";
import type { EditionOut, SquadOut, VenueOut } from "../../../wcdraft/src/engine/data.ts";
import { PlayerCard } from "../components/PlayerCard.tsx";
import { VenueBrief, venueCountsFor } from "../components/VenueBrief.tsx";
import { SLOTS, eligible, keeperCovered, needs, oversCovered, slotsFor } from "../game/rules.ts";
import { batInSlot, describeWeights, slotWeights } from "../game/slots.ts";
import type { PoolPlayer, RunState } from "../game/types.ts";

export function DraftScreen({ state, editions, venues, squads, onPlace, onReroll, onLineup }: { state: RunState; editions: EditionOut[]; venues: VenueOut[]; squads: SquadOut[]; onPlace: (p: PoolPlayer, slot: number) => void; onReroll: () => void; onLineup: () => void }) {
  const [selected, setSelected] = useState<PoolPlayer | null>(null);
  const filled = state.picks.filter(Boolean).length;
  const open = selected ? slotsFor(selected, state.picks) : { slots: [], natural: true };
  const openIds = new Set(open.slots.map((s) => s.index));
  const editionId = state.identity?.editionId ?? "";
  // The overs each batting slot faces in this World Cup; a player's number re-weighted to them.
  const weights = useMemo(() => SLOTS.map((s) => slotWeights(editions, editionId, s.index + 1)), [editions, editionId]);
  const edition = editions.find((e) => e.id === editionId);
  const venueCounts = useMemo(() => (state.identity ? venueCountsFor(state.identity.team, squads, edition) : {}), [state.identity, squads, edition]);
  // Once the open slots are down to what the side still needs, only bowlers and keepers can be taken.
  const need = needs(state.picks);
  const locked = need.open <= need.bowlers + need.keeper && need.open > 0;
  const needText = [need.bowlers ? `${need.bowlers} more bowler${need.bowlers === 1 ? "" : "s"}` : "", need.keeper ? "a keeper" : ""].filter(Boolean).join(" and ");
  return (
    <section className="draft">
      <div className="card">
        <p className="eyebrow">Spin {Math.min(state.spinNumber, 11)} of 11 · {state.identity?.team} {state.identity?.editionId}{state.coach ? ` · coach ${state.coach.coachName}` : ""}</p>
        {state.identity && (
          <details className="brief-box">
            <summary>Grounds and conditions, {state.identity.editionId}</summary>
            <VenueBrief editionId={state.identity.editionId} editions={editions} venues={venues} venueCounts={venueCounts} />
          </details>
        )}
        {state.spin ? (
          <>
            <h2>{state.spin.team} · {state.spin.editionId}</h2>
            {locked && <p className="small lock-note">Your side still needs {needText} with {need.open} slot{need.open === 1 ? "" : "s"} left, so only players who bowl{need.keeper ? " or keep" : ""} can be taken now.</p>}
            <p className="small">Take one player into a slot. {selected ? (open.natural ? "Highlighted slots fit him; each shows his batting number in that slot." : "No natural slot left; he can fill any open one, at the batting number shown.") : "Tap a player first."}</p>
            <div className="spin-grid">
              {state.spin.players.map((p) => <PlayerCard key={p.id} player={p} selected={selected?.id === p.id} ineligible={!eligible(p, state.picks)} onClick={() => setSelected(selected?.id === p.id ? null : p)} />)}
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
            const w = weights[s.index]!;
            const here = p && p.batShown ? batInSlot(p, w) : null;
            return (
              <li key={s.index} className={`slot ${canPlace ? "open" : ""} ${p ? "filled" : ""}`} title={`${s.label} ${describeWeights(w)}`}>
                <span className="slot-label">{s.label}</span>
                {p ? <PlayerCard player={p} compact /> : (
                  <button type="button" disabled={!canPlace} onClick={() => { if (selected) { onPlace(selected, s.index); setSelected(null); } }}>
                    {canPlace ? (selected!.batShown ? <>Place here <small>· bat {batInSlot(selected!, w)}</small></> : "Place here") : "—"}
                  </button>
                )}
                {p && here !== null && here !== p.bat && <span className="inslot" title={`Headline ${p.bat}; ${describeWeights(w)}`}>bat {here} here</span>}
              </li>
            );
          })}
        </ol>
        {filled === 11 && <button type="button" className="primary" onClick={onLineup}>Review lineup</button>}
      </aside>
    </section>
  );
}
