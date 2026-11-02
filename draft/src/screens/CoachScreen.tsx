import { useMemo } from "react";
import type { CoachOut, EditionOut, SquadOut, VenueOut } from "../../../wcdraft/src/engine/data.ts";
import { VenueBrief, venueCountsFor } from "../components/VenueBrief.tsx";
import { intentWord } from "../game/fit.ts";
import type { Identity } from "../game/types.ts";

/**
 * The coach panel, with the World Cup it is for (asked 2026-11-01): the side and year in the
 * heading and the grounds-and-conditions brief above the three coaches, so the choice of tempo
 * is made knowing what the grounds ask for.
 */
export function CoachScreen({ panel, rerolls, identity, editions, venues, squads, onReroll, onPick }: {
  panel: CoachOut[];
  rerolls: number;
  identity: Identity | null;
  editions: EditionOut[];
  venues: VenueOut[];
  squads: SquadOut[];
  onReroll: () => void;
  onPick: (c: CoachOut) => void;
}) {
  const edition = editions.find((e) => e.id === identity?.editionId);
  const venueCounts = useMemo(() => (identity ? venueCountsFor(identity.team, squads, edition) : {}), [identity, squads, edition]);
  return (
    <section className="card">
      <p className="eyebrow">Choose a coach{identity ? ` · ${identity.team} ${identity.editionId}` : ""}</p>
      <h2>{identity ? `Who coaches ${identity.team} at the ${identity.editionId} World Cup?` : "Three philosophies, from how their sides really played"}</h2>
      {identity && (
        <details className="brief-box" open>
          <summary>Grounds and conditions, {identity.editionId}</summary>
          <VenueBrief editionId={identity.editionId} editions={editions} venues={venues} venueCounts={venueCounts} />
        </details>
      )}
      <p className="small">Three philosophies, from how their sides really played. The coach sets the tempo the eleven bats at in each phase; batters whose shape suits it gain a point or two on their cards, and those who run against it lose.</p>
      <div className="coaches">
        {panel.map((c) => (
          <button type="button" key={`${c.team}-${c.coachName}-${c.from}`} className="coach" onClick={() => onPick(c)}>
            <b>{c.coachName}</b>
            <span className="player-meta">{c.team} {c.from ? `${c.from.slice(0, 4)}–${c.to ? c.to.slice(0, 4) : "now"}` : c.to ? `to ${c.to.slice(0, 4)}` : "current"} · World Cups {c.worldCups.join(", ")}</span>
            <span className="tags">{c.tags.length ? c.tags.map((t) => <span className="tag" key={t}>{t}</span>) : <span className="tag muted">era-average</span>}</span>
            <span className="small">Powerplay {intentWord(c.intent.pp)} · middle {intentWord(c.intent.mid)} · death {intentWord(c.intent.death)}</span>
          </button>
        ))}
      </div>
      <div className="row">
        <button type="button" onClick={onReroll} disabled={rerolls <= 0}>New panel ({rerolls} left)</button>
      </div>
    </section>
  );
}
