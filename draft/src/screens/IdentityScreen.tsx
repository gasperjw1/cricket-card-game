import type { EditionOut, SquadOut, VenueOut } from "../../../wcdraft/src/engine/data.ts";
import { VenueBrief, venueCountsFor } from "../components/VenueBrief.tsx";
import type { Identity } from "../game/types.ts";

export function IdentityScreen({ identity, editions, venues, squads, rerolls, onReroll, onConfirm }: { identity: Identity | null; editions: EditionOut[]; venues: VenueOut[]; squads: SquadOut[]; rerolls: number; onReroll: () => void; onConfirm: () => void }) {
  if (!identity) return <section className="card"><h2>Spinning…</h2></section>;
  const edition = editions.find((e) => e.id === identity.editionId);
  const squad = squads.find((s) => s.team === identity.team);
  const real = squad?.matches.filter((m) => m.winner !== undefined) ?? [];
  const wins = real.filter((m) => m.winner === identity.team).length;
  return (
    <section className="card">
      <p className="eyebrow">Your identity</p>
      <h2>{identity.team} · {identity.editionId}</h2>
      <p>{edition?.format ?? ""}{edition?.hosts?.length ? ` · hosted in ${edition.hosts.join(" and ")}` : ""}</p>
      {identity.standIn ? (
        <p className="note">Stand-in: Afghanistan's data is withheld, so {identity.team} takes Afghanistan's slot and fixtures in this edition ({edition?.standIn?.reason ?? ""}).</p>
      ) : (
        <p className="note">Real record: {wins}–{real.length - wins} in {real.length} matches. Your drafted XI plays the same fixtures at the same grounds; the rest of the field plays its real elevens.</p>
      )}
      <h3>Grounds and conditions</h3>
      <VenueBrief editionId={identity.editionId} editions={editions} venues={venues} venueCounts={venueCountsFor(identity.team, squads, edition)} />
      <div className="row">
        <button type="button" onClick={onReroll} disabled={rerolls <= 0}>Reroll ({rerolls} left)</button>
        <button type="button" className="primary" onClick={onConfirm}>Take it</button>
      </div>
    </section>
  );
}
