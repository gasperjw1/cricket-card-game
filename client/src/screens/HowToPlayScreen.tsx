import type { AnyCard } from "@swipe-sixer/shared";
import { CARDS } from "@swipe-sixer/shared/data";
import { Card } from "../components/Card.tsx";

interface Props {
  onBack: () => void;
}

/** Pull a specific card from the roster by id. Throws at startup if a
 *  referenced card is renamed/dropped — caught by the build, not at runtime. */
function findCard(id: string): AnyCard {
  const all: AnyCard[] = [...CARDS.batsmen, ...CARDS.bowlers, ...CARDS.situations];
  const found = all.find((c) => c.id === id);
  if (!found) throw new Error(`HowToPlayScreen: missing card id "${id}"`);
  return found;
}

const EXAMPLE_ELITE_BAT = findCard("virat-kohli-bat");
const EXAMPLE_GOLD_BOWL = findCard("adil-rashid-bowl");
const EXAMPLE_SILVER_BOWL = findCard("hardik-pandya-bowl");
const EXAMPLE_BRONZE_BOWL = findCard("will-jacks-bowl");
const EXAMPLE_SITUATION = findCard("drs-review");

export default function HowToPlayScreen({ onBack }: Props) {
  return (
    <main>
      <h1>How to Play</h1>
      <p className="tagline">Swipe Sixer — turn-based cricket card game.</p>

      <div className="guide">
        <section>
          <h2>The basics</h2>
          <p>
            Each match is one over per side (6 balls). The innings ends after
            6 balls bowled <em>or</em> 2 wickets — whichever comes first.
            You and your opponent both pick a card every ball: the
            <strong> batter</strong> plays a batsman card, the
            <strong> bowler</strong> plays a bowler card. The cards meet on a
            4×3 grid (line × length) and the bowler's delivery zone is looked
            up against the batter's card to resolve the ball — runs, dot, or
            wicket.
          </p>
          <p>
            Each player draws a deck of 20 cards: 15 player cards (split
            across tiers) and 5 situation cards. You hold 4 cards in hand at
            a time; pick one per ball, draw a replacement after.
          </p>
        </section>

        <section>
          <h2>How a turn plays out</h2>
          <ol>
            <li>
              <strong>Coin toss</strong> at the start. 30 seconds to call
              heads/tails, 30 seconds for the winner to choose to bat or bowl.
            </li>
            <li>
              <strong>Each ball: 30-second pick window.</strong> Both players
              have 30 seconds to pick a card from their hand of 4. If you don't
              pick, the server auto-plays your highest-tier card.
            </li>
            <li>
              <strong>Reveal & resolution.</strong> Both cards flip
              simultaneously. The engine walks through every modifier in order
              — situation cards, line/length shifts, base zone lookup, bowler
              skill chips, wide checks — and shows you a resolution trail
              explaining the result.
            </li>
            <li>
              <strong>15-second post-ball pause.</strong> Time to read the
              trail and see what fired before the next ball's 30-second timer
              starts.
            </li>
            <li>
              <strong>Mid-ball swap picks (15 seconds)</strong> happen when
              certain situation cards trigger — Mankad lets the bowling side
              pick a non-striker to dismiss; Retired Out and Cramps swap
              players. You get 15 seconds to pick from a list.
            </li>
            <li>
              <strong>Innings break</strong> after 6 balls or 2 wickets, then
              the second innings starts with roles swapped. The chasing side
              wins by reaching the target; the bowling side wins by keeping
              the chase short.
            </li>
          </ol>
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

          <h3 className="example-heading">Example cards</h3>
          <div className="example-cards">
            <ExampleCard
              caption="Elite batter — 3 strengths, 1 weakness, 7 resistances."
              card={EXAMPLE_ELITE_BAT}
            />
            <ExampleCard
              caption="Gold bowler — one skill chip (Googly) downgrades any un-resisted outcome."
              card={EXAMPLE_GOLD_BOWL}
            />
            <ExampleCard
              caption="Silver bowler — no skill chip; tier identity is in the lines and fielding."
              card={EXAMPLE_SILVER_BOWL}
            />
            <ExampleCard
              caption="Bronze bowler — minimal data, no skill, no resistances."
              card={EXAMPLE_BRONZE_BOWL}
            />
          </div>
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
            a skill fires on a ball — meaning the batter's card does
            <em> not</em> list that specific skill in its resistances — the
            outcome is downgraded by one band along this ladder:
          </p>
          <p className="callout dim-text" style={{ textAlign: "center" }}>
            6&nbsp;→&nbsp;4&nbsp;&nbsp;→&nbsp;&nbsp;2&nbsp;→&nbsp;1&nbsp;&nbsp;→&nbsp;&nbsp;dot
          </p>
          <p>
            Wickets are not affected by skill chips, and dot balls can't be
            downgraded further. So a Slower-ball that would otherwise have
            been a 6 becomes a 4; a 4 becomes a 2; a 1 becomes a dot.
          </p>
          <p>
            Batters' <strong>resistances</strong> list the skills they
            neutralise. If the batter's card resists the exact skill being
            fired, the chip does nothing on that ball. Elite batters resist
            6–7 of the 8 skills; Bronze batters resist none.
          </p>
          <p className="dim-text">
            <strong>No-stack rule:</strong> Elite bowlers with two skills only
            fire one per ball — the first un-resisted one wins, the other does
            nothing.
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
            Some situation cards force <strong>auto-wides</strong>: the
            batter's Day 5 Pitch + Outside off, Shuffle Across + Leg stump, or
            Deep in the Crease + Short length will all be called wide
            automatically.
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
              <strong>DRS Review</strong> (batting) — if this ball would be a
              wicket, the umpire's decision is overturned and the wicket is
              cancelled. (Future versions will extend DRS to no-ball and wide
              calls too.)
            </li>
            <li>
              <strong>Power Surge</strong> (batting) — upgrade this ball's
              outcome by one run band.
            </li>
            <li>
              <strong>Day 5 Pitch</strong> (bowling) — the deck has cracked.
              The bowler's delivery line shifts <em>one step further off</em>:
              Leg → Middle, Middle → Off, Off → Outside off. If the bowler
              was already on Outside off there's no further line to shift to
              — umpire calls it wide automatically.
            </li>
            <li>
              <strong>Third Umpire Distracted by Biryani</strong> (bowling) —
              cancels any No Ball or wide call on this ball.
            </li>
          </ul>
          <p className="dim-text">
            Full reference: every situation card and its corner-case ruling is
            documented in <code>docs/situation-cards.md</code>.
          </p>

          <h3 className="example-heading">Example situation card</h3>
          <div className="example-cards">
            <ExampleCard
              caption="Play this on a ball you fear is a wicket — it overturns the umpire's decision."
              card={EXAMPLE_SITUATION}
            />
          </div>
        </section>

        <section>
          <h2>Tips for new players</h2>
          <ul>
            <li>
              Read your opponent's batter weaknesses — that's where to bowl.
            </li>
            <li>
              Save Elite cards for high-pressure balls (final ball, last
              wicket in hand).
            </li>
            <li>
              Skill chips only fire when the batter <em>does not</em> resist
              that specific skill. Check the resistance list before assuming
              your Gold/Elite bowler's chip will help.
            </li>
            <li>
              Situation cards often win matches. Don't hoard them past your
              last over.
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

function ExampleCard({ caption, card }: { caption: string; card: AnyCard }) {
  return (
    <figure className="example-card">
      <Card card={card} size="hand" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
