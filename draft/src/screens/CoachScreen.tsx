import { useMemo } from "react";
import type { CoachOut, EditionOut, SquadOut, VenueOut } from "../../../wcdraft/src/engine/data.ts";
import { VenueBrief, venueCountsFor } from "../components/VenueBrief.tsx";
import { intentWord } from "../game/fit.ts";
import { fieldShareWith } from "../../../wcdraft/src/engine/model.ts";
import type { Identity } from "../game/types.ts";

/**
 * The coach panel, with the World Cup it is for (asked 2026-11-01): the side and year in the
 * heading and the grounds-and-conditions brief above the three coaches, so the choice of tempo
 * is made knowing what the grounds ask for.
 */

/** What each tag does in the engine (2026-11-03: every tag shown is played). */
const TAG_NOTES: Record<string, string> = {
  "Powerplay aggressor": "His sides score faster than their era in the powerplay; the eleven bats with more intent there.",
  "Powerplay anchor": "His sides score slower than their era in the powerplay; the eleven bats with less intent there.",
  "Death hitter": "His sides score faster than their era at the death; the eleven bats with more intent there.",
  "Death conservative": "His sides score slower than their era at the death; the eleven bats with less intent there.",
  "Deep batting": "His lower orders (No. 6 down) scored more than their own records said; the engine adds that.",
  "Top-heavy": "His lower orders (No. 6 down) scored less than their own records said; the engine takes that off.",
  "Six-bowler rotation": "Brings on extra bowlers more than most; overs spread further when the eleven has the bowlers.",
  "Frontline trust": "Sticks with his main bowlers; a sixth or seventh option bowls less.",
  "Bowl first": "Fields first more often after winning the toss.",
  "Bat first": "Bats first more often after winning the toss.",
};

/** His measured habits beyond tempo, in plain numbers. */
function habits(c: CoachOut, tossFieldPct: number | undefined): string | null {
  if (!c.play) return null;
  const parts: string[] = [];
  // The same share the engine plays (`fieldShareWith`), so the card and the toss agree.
  if (tossFieldPct !== undefined) parts.push(`fields after ${Math.round(100 * fieldShareWith(tossFieldPct / 100, c.play.bowlFirst))}% of toss wins (${Math.round(tossFieldPct)}% at this World Cup)`);
  const rot = c.play.rotation;
  parts.push(Math.abs(rot) < 0.05 ? "uses as many bowlers as most coaches" : `${rot > 0 ? "+" : "−"}${Math.abs(rot).toFixed(1)} bowlers an innings against most coaches`);
  // One decimal: the effects are small, and whole percents made a tagged coach and an untagged one read alike.
  const lo = 100 * c.play.lowerOrder;
  parts.push(Math.abs(lo) < 0.25 ? "No. 6 down bat to their records" : `No. 6 down score ${Math.abs(lo).toFixed(1)}% ${lo > 0 ? "more" : "less"} than their records`);
  return parts.join(" · ");
}
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
        // Closed by default (2026-11-03): the identity screen just showed it in full, and open it
        // pushed the three coaches below the fold on a phone.
        <details className="brief-box">
          <summary>Grounds and conditions, {identity.editionId}</summary>
          <VenueBrief editionId={identity.editionId} editions={editions} venues={venues} venueCounts={venueCounts} />
        </details>
      )}
      <p className="small">Three philosophies, from how their sides really played. The coach sets the tempo the eleven bats at in each phase; batters whose shape suits it gain a point or two on their cards, and those who run against it lose. His habits at the toss, with the ball and down the order go with him too.</p>
      <div className="coaches">
        {panel.map((c) => (
          <button type="button" key={`${c.team}-${c.coachName}-${c.from}`} className="coach" onClick={() => onPick(c)}>
            <b>{c.coachName}</b>
            <span className="player-meta">{c.team} {c.from ? `${c.from.slice(0, 4)}–${c.to ? c.to.slice(0, 4) : "now"}` : c.to ? `to ${c.to.slice(0, 4)}` : "current"} · World Cups {c.worldCups.join(", ")}</span>
            <span className="tags">{c.tags.length ? c.tags.map((t) => <span className="tag" key={t} title={TAG_NOTES[t]}>{t}</span>) : <span className="tag muted">era-average</span>}</span>
            <span className="small">Powerplay {intentWord(c.intent.pp)} · middle {intentWord(c.intent.mid)} · death {intentWord(c.intent.death)}</span>
            {habits(c, edition?.environment.tossFieldPct) && <span className="small muted">{habits(c, edition?.environment.tossFieldPct)}</span>}
          </button>
        ))}
      </div>
      <div className="row">
        <button type="button" onClick={onReroll} disabled={rerolls <= 0}>New panel ({rerolls} left)</button>
      </div>
    </section>
  );
}
