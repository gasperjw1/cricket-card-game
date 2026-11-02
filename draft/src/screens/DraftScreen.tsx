import { useEffect, useMemo, useState } from "react";
import type { EditionOut, SquadOut, VenueOut } from "../../../wcdraft/src/engine/data.ts";
import { PlayerCard } from "../components/PlayerCard.tsx";
import { PlayerDetail } from "../components/PlayerDetail.tsx";
import { TeamSheet } from "../components/TeamSheet.tsx";
import { VenueBrief, venueCountsFor } from "../components/VenueBrief.tsx";
import { usePicksFit, useSpinFit } from "../game/fit-load.ts";
import { SLOTS, designatedKeeper, eligible, needs, oversCovered, slotsFor } from "../game/rules.ts";
import { batInSlot, describeWeights, slotWeights } from "../game/slots.ts";
import type { PoolPlayer, RunState } from "../game/types.ts";

/**
 * The draft as three panes that scroll inside themselves (decided 2026-11-01): the spun squad on
 * the left, the selected player's detail with the slot chooser in the middle, the team sheet on
 * the right. The header strip, the reroll and the needs line stay put; the page itself does not
 * scroll. Under 900px the squad and the sheet become two tabs and the detail slides up as a sheet.
 * Placement is always the user's choice: nothing is placed until a slot is tapped.
 */
export function DraftScreen({ state, editions, venues, squads, onPlace, onReroll, onLineup }: { state: RunState; editions: EditionOut[]; venues: VenueOut[]; squads: SquadOut[]; onPlace: (p: PoolPlayer, slot: number) => void; onReroll: () => void; onLineup: () => void }) {
  const [selected, setSelected] = useState<PoolPlayer | null>(null);
  const [tab, setTab] = useState<"squad" | "sheet">("squad");
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
  const lockText = locked ? `Your side still needs ${needText} with ${need.open} slot${need.open === 1 ? "" : "s"} left, so only players who bowl${need.keeper ? " or keep" : ""} can be taken now.` : null;
  const keeper = designatedKeeper(state.picks);
  // Each card in this World Cup and under the coach, loaded per spin.
  const fits = useSpinFit(state.spin, editionId, state.coach, editions);
  const pickFits = usePicksFit(state.picks, editionId, state.coach, editions);
  // The batting number at a slot: the engine's own sum when it has loaded, the card's linear shift until then.
  const numberAt = (p: PoolPlayer, slot: number, map: Map<string, { atSlot: (number | null)[] }> | null): number | null =>
    map?.get(p.id)?.atSlot[slot] ?? (p.batShown ? batInSlot(p, weights[slot]!) : null);
  // A new spin clears the selection, and a selected player who has just been placed is gone too.
  useEffect(() => { setSelected(null); }, [state.spin]);
  const place = (p: PoolPlayer, slot: number) => { onPlace(p, slot); setSelected(null); };
  const selectedLocked = selected && !eligible(selected, state.picks) ? lockText : null;

  return (
    <section className={`draft3 ${selected ? "has-detail" : ""} tab-${tab}`}>
      <header className="draft-bar">
        <div className="draft-bar-main">
          <p className="eyebrow">Spin {Math.min(state.spinNumber, 11)} of 11 · {state.identity?.team} {editionId}{state.coach ? ` · coach ${state.coach.coachName}` : ""}</p>
          <h2 className="draft-squad">{state.spin ? <>{state.spin.team} <span className="muted">{state.spin.editionId}</span></> : "Spinning…"}</h2>
        </div>
        <div className="draft-bar-side">
          <span className="small draft-needs">{filled}/11 named · overs {oversCovered(state.picks)}/20{needText ? ` · needs ${needText}` : ""}</span>
          <button type="button" onClick={() => { setSelected(null); onReroll(); }} disabled={state.spinRerolls <= 0}>Reroll squad ({state.spinRerolls} left)</button>
          <div className="draft-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "squad"} className={tab === "squad" ? "on" : ""} onClick={() => setTab("squad")}>Squad</button>
            <button type="button" role="tab" aria-selected={tab === "sheet"} className={tab === "sheet" ? "on" : ""} onClick={() => setTab("sheet")}>Team sheet {filled}/11</button>
          </div>
        </div>
      </header>

      <div className="pane pane-squad" role="tabpanel">
        {state.identity && (
          <details className="brief-box">
            <summary>Grounds and conditions, {editionId}</summary>
            <VenueBrief editionId={editionId} editions={editions} venues={venues} venueCounts={venueCounts} />
          </details>
        )}
        {lockText && <p className="small lock-note">{lockText}</p>}
        {state.spin ? (
          <>
            <p className="small">Tap a player for his full record and to place him. {editionId} shows the card in this World Cup{state.coach ? ` under ${state.coach.coachName}` : ""}.</p>
            <div className="spin-grid">
              {state.spin.players.map((p) => (
                <PlayerCard key={p.id} player={p} fit={fits ? fits.get(p.id) ?? null : null} hereEdition={editionId} selected={selected?.id === p.id} ineligible={!eligible(p, state.picks)} onClick={() => setSelected(selected?.id === p.id ? null : p)} />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className={`pane pane-detail ${selected ? "open" : ""}`} aria-live="polite">
        {selected ? (
          <PlayerDetail
            player={selected}
            fit={fits ? fits.get(selected.id) ?? null : null}
            hereEdition={editionId}
            coach={state.coach}
            slots={open.slots}
            weights={weights}
            natural={open.natural}
            locked={selectedLocked}
            onPlace={(slot) => place(selected, slot)}
            onClose={() => setSelected(null)}
          />
        ) : (
          <div className="pd-empty">
            <p className="eyebrow">Player</p>
            <p className="small">Tap a card to see the record behind it, his numbers in {editionId}, and where he can bat.</p>
            <p className="small muted">Bat and Bowl show the card's number over three bars for powerplay, middle and death. A * marks a thin record or an estimate; the detail says which.</p>
          </div>
        )}
      </div>

      <aside className="pane pane-sheet" role="tabpanel">
        <TeamSheet
          side={state.identity?.team ?? ""}
          edition={editionId}
          coach={state.coach?.coachName ?? null}
          captainId={null}
          keeperId={keeper?.id ?? null}
          rows={SLOTS.map((s) => {
            const p = state.picks[s.index] ?? null;
            const canPlace = !!selected && !selectedLocked && openIds.has(s.index);
            const w = weights[s.index]!;
            const placing = canPlace ? numberAt(selected!, s.index, fits) : null;
            return {
              slot: s,
              player: p,
              batHere: p ? numberAt(p, s.index, pickFits) : null,
              bowlHere: p ? pickFits?.get(p.id)?.bowling?.final ?? null : null,
              open: canPlace,
              action: p ? null : canPlace ? (
                <button type="button" className="sheet-place" title={describeWeights(w)} onClick={() => place(selected!, s.index)}>
                  Place here{placing !== null ? <small> · bat {placing}</small> : null}
                </button>
              ) : null,
            };
          })}
          footer={<>{keeper ? <>Keeper <b>{keeper.name}</b></> : <>No keeper yet</>} · overs covered <b>{oversCovered(state.picks)}</b>/20{needText ? <> · still needs {needText}</> : null}</>}
        >
          {filled === 11 && <button type="button" className="primary sheet-cta" onClick={onLineup}>Review lineup</button>}
        </TeamSheet>
      </aside>
    </section>
  );
}
