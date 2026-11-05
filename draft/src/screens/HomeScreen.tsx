import { useState } from "react";
import { dailyLabel, dailySeed } from "../game/score.ts";
import { BUDGET } from "../game/types.ts";

function randomSeed(): string {
  const words = ["cover", "yorker", "slog", "glance", "ramp", "scoop", "googly", "bouncer", "nurdle", "hoick"];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

const times = (n: number) => (n === 1 ? "One reroll" : `${n} rerolls`);

/**
 * The landing page (2026-11-03, after Era Ball and 82-0): the name large, the two ways to play as
 * the two big buttons (today's shared draft and a fresh one), a seed for replaying or sharing a
 * draft tucked under them, then the four steps of a run and the data credit. Every number on the
 * page comes from the rules it describes.
 */
export function HomeScreen({ ready, editions, squads, onStart }: { ready: boolean; editions: number | null; squads: number | null; onStart: (seed: string) => void }) {
  const [seed, setSeed] = useState(randomSeed);
  const steps: [string, string][] = [
    ["Your side", `A real country at a real World Cup: its fixtures, grounds and rules are yours. ${times(BUDGET.identityRerolls)}.`],
    ["Your coach", `Pick one of ${BUDGET.coachPanel}. Their habits shape how the side bats and what it does at the toss. ${times(BUDGET.coachRerolls)}.`],
    ["Eleven spins", `Each spin is a real squad from any edition. Take one player and give him a batting slot. ${times(BUDGET.spinRerolls)} in all.`],
    ["The tournament", "Name a keeper and five bowlers (six under a six-bowler coach), then every match is played ball by ball against the real elevens."],
  ];
  return (
    <section className="landing">
      <header className="land-hero">
        <p className="eyebrow">Men's T20 World Cup · 2007 to 2026</p>
        <h2 className="land-word">World Cup <span>Draft</span></h2>
        <p className="land-tag">Take over a real side at a real World Cup. Draft eleven players from any edition. Go unbeaten.</p>
      </header>

      <div className="land-modes">
        <button type="button" className="mode mode-daily" disabled={!ready} onClick={() => onStart(dailySeed())} aria-label={`Play today's World Cup, ${dailyLabel()}: the same side and squad spins for everyone`}>
          <span className="mode-k">Daily · {dailyLabel()}</span>
          <b>Today's World Cup</b>
          <span className="mode-sub">The same side and the same spins for everyone today. Your picks are your own.</span>
        </button>
        <button type="button" className="mode" disabled={!ready} onClick={() => onStart(randomSeed())} aria-label="Start a new draft from a random seed">
          <span className="mode-k">Free play</span>
          <b>New draft</b>
          <span className="mode-sub">A fresh side, coach and spins.</span>
        </button>
      </div>
      {!ready && <p className="small land-loading">Loading squads…</p>}

      <details className="land-seed">
        <summary>Play a seed</summary>
        <p className="small">The same seed gives the same side, coach panel and spins, so a friend can draft from yours.</p>
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (ready && seed.trim()) onStart(seed.trim()); }}>
          <input value={seed} onChange={(e) => setSeed(e.target.value)} spellCheck={false} aria-label="Seed" />
          <button type="submit" disabled={!ready || !seed.trim()}>Start</button>
        </form>
      </details>

      <ol className="land-steps">
        {steps.map(([title, text], i) => (
          <li key={title}><span className="land-n">{i + 1}</span><b>{title}</b><span className="small">{text}</span></li>
        ))}
      </ol>

      {editions !== null && squads !== null && <p className="land-facts"><b>{editions}</b> World Cups · <b>{squads}</b> squads to spin from</p>}
      <footer className="land-foot small">
        Ball-by-ball data from <a href="https://cricsheet.org" target="_blank" rel="noreferrer">Cricsheet</a> (ODC-By 1.0). Tiers are role-relative: an Elite finisher is as good at his job as an Elite opener.
        {" · "}<a href="/" className="back-link">Swipe Sixer</a>
      </footer>
    </section>
  );
}
