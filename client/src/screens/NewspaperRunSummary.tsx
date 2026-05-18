import { generateRunSummary } from "../lib/run-summary.ts";
import type { WCRun } from "../lib/career.ts";

interface Props {
  run: WCRun;
  onClose: () => void;
}

/**
 * Newspaper-front-page styled victory recap. Shown after a trophy win
 * (and to a lesser degree on loss/abandon). Renders as a stylized
 * masthead → headline → byline → article paragraphs → highlights box →
 * pull-quote.
 */
export function NewspaperRunSummary({ run, onClose }: Props) {
  const s = generateRunSummary(run);
  return (
    <main className="newspaper">
      <div className="newspaper-paper">
        <header className="newspaper-masthead">
          <div className="newspaper-name">THE DAILY OVER</div>
          <div className="newspaper-tagline">"Every ball matters." · Vol. {Math.max(1, run.history.length)} · {s.editionDate}</div>
        </header>

        <h1 className={`newspaper-headline tone-${s.tone}`}>{s.headline}</h1>
        <p className="newspaper-subheadline">{s.subheadline}</p>

        <div className="newspaper-body">
          <p>{s.finalRecap}</p>
          <p className="newspaper-quote">{s.managerQuote}</p>
        </div>

        <aside className="newspaper-highlights">
          <h3>Tournament highlights</h3>
          <ul>
            {s.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </aside>

        <footer className="newspaper-footer">
          <span className="dim-text">Continued on page 2…</span>
        </footer>
      </div>

      <div className="form-actions" style={{ marginTop: "1.5rem" }}>
        <button className="btn primary big" onClick={onClose}>
          Done
        </button>
      </div>
    </main>
  );
}
