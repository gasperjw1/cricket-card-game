import { useEffect, useMemo, useState } from "react";
import type { EditionOut, SquadOut, VenueOut } from "../../../wcdraft/src/engine/data.ts";
import { Digits, PlayerRow, hereNumbers } from "../components/PlayerCard.tsx";
import { PlayerDetail } from "../components/PlayerDetail.tsx";
import { TeamSheet } from "../components/TeamSheet.tsx";
import { VenueBrief, venueCountsFor } from "../components/VenueBrief.tsx";
import { usePicksFit, useSpinFit } from "../game/fit-load.ts";
import { SLOTS, designatedKeeper, eligible, needs, oversCovered, slotsFor } from "../game/rules.ts";
import { batInSlot, describeWeights, slotWeights } from "../game/slots.ts";
import type { PoolPlayer, RunState } from "../game/types.ts";

type Filter = "all" | "bat" | "bowl" | "keep";
type Sort = "best" | "bat" | "bowl";
const FILTERS: [Filter, string][] = [["all", "All"], ["bat", "Batters"], ["bowl", "Bowlers"], ["keep", "Keepers"]];

/**
 * The draft (redesigned 2026-11-03, after Era Ball and 82-0): the spun squad as a list of compact
 * rows on the left, the team sheet on the right. Tapping a row opens the player's full card over
 * the list, with the slots he fits first; the sheet's open slots light up too, so he can be placed
 * from either. Under 900px the squad and the sheet are two tabs and the card rises as a sheet.
 * Placement is always the user's choice: nothing is placed until a slot is tapped.
 */
export function DraftScreen({ state, editions, venues, squads, onPlace, onReroll, onLineup }: { state: RunState; editions: EditionOut[]; venues: VenueOut[]; squads: SquadOut[]; onPlace: (p: PoolPlayer, slot: number) => void; onReroll: () => void; onLineup: () => void }) {
  const [selected, setSelected] = useState<PoolPlayer | null>(null);
  const [tab, setTab] = useState<"squad" | "sheet">("squad");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("best");
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
  // A new spin clears the selection and the list's filter.
  useEffect(() => { setSelected(null); setFilter("all"); }, [state.spin]);
  // Escape closes the card.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);
  const place = (p: PoolPlayer, slot: number) => { onPlace(p, slot); setSelected(null); };
  const selectedLocked = selected && !eligible(selected, state.picks) ? lockText : null;

  const listed = useMemo(() => {
    const players = (state.spin?.players ?? []).filter((p) => filter === "all" || (filter === "bat" && p.batShown) || (filter === "bowl" && p.bowlShown) || (filter === "keep" && p.keeper));
    if (sort === "best") return players;
    // By the numbers the tiles show: his batting or bowling in this World Cup.
    const key = (p: PoolPlayer) => { const n = hereNumbers(p, fits?.get(p.id)); return (sort === "bat" ? n.bat : n.bowl) ?? -1; };
    return [...players].sort((a, b) => key(b) - key(a));
  }, [state.spin, filter, sort, fits]);

  return (
    <section className={`draft3 ${selected ? "has-detail" : ""} tab-${tab}`}>
      <header className="draft-bar">
        {/* The board's frame: the side, the clock, the spin (2026-11-03, after the Adelaide Oval board). */}
        <div className="frame-band">
          <span>{state.identity?.team} {editionId}{state.coach ? ` · coach ${state.coach.coachName}` : ""}</span>
          <span className="frame-clock" aria-hidden="true" />
          <span>Spin {Math.min(state.spinNumber, 11)} of 11</span>
        </div>
        <div className="draft-bar-main">
          <h2 className="draft-squad">{state.spin ? <>{state.spin.team} <span className="muted">{state.spin.editionId}</span></> : "Spinning…"}</h2>
          {/* A stand-in squad never played that World Cup: it is Afghanistan's slot, built from the side's T20Is around then (2026-11-03: it spun with nothing saying so). */}
          {state.spin?.players[0]?.standIn && <p className="small muted draft-standin">Stand-in for Afghanistan, whose records are withheld: {state.spin.team} did not play the {state.spin.editionId} World Cup, so these cards come from their T20Is around then.</p>}
        </div>
        <div className="draft-bar-side">
          <div className="strip" aria-label={`${filled} of 11 named, ${oversCovered(state.picks)} of 20 overs covered${needText ? `, needs ${needText}` : ""}`}>
            <span className="strip-item"><span className="rt-k">Named</span><Digits n={filled} /><span className="strip-of">/11</span></span>
            <span className="strip-item"><span className="rt-k">Overs</span><Digits n={oversCovered(state.picks)} /><span className="strip-of">/20</span></span>
            <span className="strip-item"><span className="rt-k">Bowlers needed</span><Digits n={need.bowlers} /></span>
            <span className="strip-item"><span className="rt-k">Keeper</span><span className={`strip-flag ${need.keeper ? "" : "done"}`}>{need.keeper ? "Needed" : "Named"}</span></span>
          </div>
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
            <div className="list-tools">
              <div className="chips" role="group" aria-label="Show">
                {FILTERS.map(([key, label]) => <button key={key} type="button" className={`chip ${filter === key ? "on" : ""}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
              </div>
              <label className="sort">Sort
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="best">Best</option>
                  <option value="bat">Batting</option>
                  <option value="bowl">Bowling</option>
                </select>
              </label>
            </div>
            <p className="pr-note">Numbers are each man's batting and bowling in the {editionId} World Cup{state.coach ? ` under ${state.coach.coachName}` : ""}. Tap a player for his card.</p>
            <div className="pr-list">
              {listed.map((p) => (
                <PlayerRow key={p.id} player={p} fit={fits ? fits.get(p.id) ?? null : null} selected={selected?.id === p.id} ineligible={!eligible(p, state.picks)} onClick={() => setSelected(selected?.id === p.id ? null : p)} />
              ))}
              {listed.length === 0 && <p className="small muted">Nobody in this squad fits that filter.</p>}
            </div>
          </>
        ) : null}
      </div>

      {selected && (
        <div className="card-layer" role="dialog" aria-modal="true" aria-label={`${selected.name}'s card`}>
          <button type="button" className="card-backdrop" aria-label="Close the card" onClick={() => setSelected(null)} />
          <div className="card-panel">
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
          </div>
        </div>
      )}

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
              keeps: !!p && !!keeper && p.id === keeper.id,
              open: canPlace,
              action: p ? null : canPlace ? (
                <button type="button" className="sheet-place" title={describeWeights(w)} aria-label={`Place ${selected!.name} at ${s.label}${placing !== null ? `, batting ${placing}` : ""}`} onClick={() => place(selected!, s.index)}>
                  Place{placing !== null ? <small> · {placing}</small> : null}
                </button>
              ) : null,
            };
          })}
          footer={keeper ? <>Keeper <b>{keeper.name}</b></> : null}
        >
          {filled === 11 && <button type="button" className="primary sheet-cta" onClick={onLineup}>Review lineup</button>}
        </TeamSheet>
      </aside>
    </section>
  );
}
