import { useState } from "react";

function randomSeed(): string {
  const words = ["cover", "yorker", "slog", "glance", "ramp", "scoop", "googly", "bouncer", "nurdle", "hoick"];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export function HomeScreen({ ready, onStart }: { ready: boolean; onStart: (seed: string) => void }) {
  const [seed, setSeed] = useState(randomSeed);
  return (
    <section className="card">
      <h2>Draft an XI. Replace a real World Cup side. Go unbeaten.</h2>
      <ol className="rules">
        <li>Spin an <b>identity</b>: a country at a men's T20 World Cup, 2007 to 2026. You inherit its real fixtures, grounds and rules. One reroll.</li>
        <li>Pick a <b>coach</b> from a panel of three. Their philosophy shapes how your side bats. One reroll.</li>
        <li>Eleven <b>squad spins</b>. Each spin is a real squad from any edition; take one player into a batting slot. Two rerolls across the draft. One instance of each person.</li>
        <li>You need a <b>keeper</b> and <b>five bowlers</b>. Then the whole tournament is simulated ball by ball against real elevens.</li>
      </ol>
      <label className="seed-input">
        Seed <input value={seed} onChange={(e) => setSeed(e.target.value)} spellCheck={false} />
      </label>
      <button type="button" className="primary" disabled={!ready || !seed.trim()} onClick={() => onStart(seed.trim())}>{ready ? "Spin an identity" : "Loading squads…"}</button>
      <p className="small">Ratings are evidence-based (Cricsheet ball-by-ball data, ODC-By 1.0). Tiers are role-relative: an Elite finisher is as good at his job as an Elite opener.</p>
    </section>
  );
}
