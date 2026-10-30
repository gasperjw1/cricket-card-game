import type { CoachOut } from "../../../wcdraft/src/engine/data.ts";

const intentWord = (z: number) => (z >= 0.6 ? "attacks" : z <= -0.6 ? "holds back" : "balanced");

export function CoachScreen({ panel, rerolls, onReroll, onPick }: { panel: CoachOut[]; rerolls: number; onReroll: () => void; onPick: (c: CoachOut) => void }) {
  return (
    <section className="card">
      <p className="eyebrow">Choose a coach</p>
      <h2>Three philosophies, from how their sides really played</h2>
      <div className="coaches">
        {panel.map((c) => (
          <button type="button" key={`${c.team}-${c.coachName}-${c.from}`} className="coach" onClick={() => onPick(c)}>
            <b>{c.coachName}</b>
            <span className="player-meta">{c.team} {c.from.slice(0, 4)}–{c.to ? c.to.slice(0, 4) : "now"} · World Cups {c.worldCups.join(", ")}</span>
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
