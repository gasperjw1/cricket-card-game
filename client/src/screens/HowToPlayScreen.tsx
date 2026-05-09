interface Props {
  onBack: () => void;
}

export function HowToPlayScreen({ onBack }: Props) {
  return (
    <main>
      <h1>How to Play</h1>
      <p className="tagline">Swipe Sixer — turn-based cricket card game.</p>

      <div className="guide">
        <section>
          <h2>The basics</h2>
          <p>
            Each match is one over per side (or longer formats coming soon). You
            and your opponent both pick a card every ball: the <strong>batter</strong>
            {" "}plays a batsman card, the <strong>bowler</strong> plays a bowler card.
            The cards meet on a 4×3 grid (line × length) and the bowler's
            delivery zone is looked up against the batter's card to resolve the
            ball — runs, dot, or wicket.
          </p>
          <p>
            Each player draws a deck of 20 cards: 15 player cards (split across
            tiers) and 5 situation cards. Situation cards modify the next ball
            in your favour.
          </p>
        </section>

        <section>
          <h2>The four tiers</h2>
          <p>
            Every player card belongs to one of four tiers, reflecting how
            dangerous they are in real T20 cricket:
          </p>
          <ul className="tier-list">
            <li>
              <span className="tier elite">Elite</span> — the legends.
              Batters: 3 strengths, 1 weakness, 6–7 resistances. Bowlers carry
              two skills.
            </li>
            <li>
              <span className="tier gold">Gold</span> — world-class. 2/2/2
              zone split, 4–5 resistances. Bowlers carry one skill.
            </li>
            <li>
              <span className="tier silver">Silver</span> — solid international
              regulars. 2 strengths, 3 weaknesses, 2–3 resistances. Bowlers
              have no special skill.
            </li>
            <li>
              <span className="tier bronze">Bronze</span> — squad fillers and
              specialists. Mostly neutral and weakness zones, no resistances.
            </li>
          </ul>
          <p className="dim-text">
            Each deck contains 2 Elite, 3 Gold, 7 Silver and 3 Bronze player
            cards.
          </p>
        </section>

        <section>
          <h2>Zones — how a ball resolves</h2>
          <p>
            Bowlers deliver to a <strong>line</strong> (Outside off, Off stump,
            Middle stump, Leg stump) at a <strong>length</strong> (Short, Good
            length, Full). That zone is looked up on the batter's card:
          </p>
          <ul>
            <li>
              <strong>Strength</strong> — boundary or 6 (the batter's preferred shot).
            </li>
            <li>
              <strong>Neutral</strong> — 1 or 2 runs.
            </li>
            <li>
              <strong>Weakness</strong> — wicket. The dismissal description on the
              card explains how.
            </li>
          </ul>
        </section>

        <section>
          <h2>Bowler skills (adjectives)</h2>
          <p>
            Gold and Elite bowlers carry one or two <strong>skill chips</strong>:
            Swing, Seam, Cutter, Slower, Googly, Carrom, Topspin, Drift. When
            an un-resisted skill fires on a ball, it <em>downgrades</em> the
            outcome — a 6 becomes a 4, a 4 becomes a dot, runs become wickets.
          </p>
          <p>
            Batters' <strong>resistances</strong> list the skills they neutralise.
            If the batter's card lists "Slower" and the bowler fires Slower,
            the chip does nothing. Elite batters resist 6–7 of the 8 skills.
          </p>
          <p className="dim-text">
            <strong>No-stack rule:</strong> Elite bowlers with two skills only
            fire one per ball — the first un-resisted one wins.
          </p>
        </section>

        <section>
          <h2>Wides and No Balls</h2>
          <p>
            Bowlers attacking the <strong>Outside off</strong> line risk being
            called wide — <strong>Bronze 40% / Silver 25% / Gold 15% / Elite 5%</strong>.
            Wides cost +1 run and are re-bowled.
          </p>
          <p>
            Some situation cards force <strong>auto-wides</strong>: the batter's
            Day 5 Pitch + Outside off, Shuffle Across + Leg stump, or Deep in
            the Crease + Short length will all be called wide automatically.
          </p>
          <p className="callout">
            <strong>Important:</strong> the No Ball card cancels any wicket on
            this ball and re-bowls it — but unlike real cricket, it does
            <em> not</em> grant a free hit on the next delivery.
          </p>
        </section>

        <section>
          <h2>Situation cards</h2>
          <p>
            Each deck has 5 situation cards. Highlights:
          </p>
          <ul>
            <li>
              <strong>DRS Review</strong> (batting) — overturn this ball's wicket
              if the umpire was wrong.
            </li>
            <li>
              <strong>Power Surge</strong> (batting) — upgrade this ball's
              outcome by one run band.
            </li>
            <li>
              <strong>Day 5 Pitch</strong> (bowling) — turn one Outside off
              delivery into an auto-wide-and-bounce nightmare; cracked pitch.
            </li>
            <li>
              <strong>Third Umpire Distracted by Biryani</strong> (bowling) —
              cancels any No Ball or wide call this ball.
            </li>
          </ul>
          <p className="dim-text">
            Full reference: every situation card and its corner-case ruling is
            documented in <code>docs/situation-cards.md</code>.
          </p>
        </section>

        <section>
          <h2>Tips for new players</h2>
          <ul>
            <li>
              Read your opponent's batter weaknesses — that's where to bowl.
            </li>
            <li>
              Save Elite cards for high-pressure balls (death overs, last over).
            </li>
            <li>
              Skill chips only matter against unresisted batters — checking
              resistances tells you which Gold/Elite bowlers will actually fire.
            </li>
            <li>
              Situation cards often win matches. Don't hoard them past the last
              over.
            </li>
          </ul>
        </section>
      </div>

      <div className="form-actions" style={{ marginTop: "2rem" }}>
        <button type="button" className="btn primary" onClick={onBack}>
          Back to menu
        </button>
      </div>
    </main>
  );
}
