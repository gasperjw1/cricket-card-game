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
const EXAMPLE_BRONZE_BOWL = findCard("will-jacks-bowl");
const EXAMPLE_SITUATION = findCard("drs-review");
const EXAMPLE_BIRYANI = findCard("biryani");

export default function HowToPlayScreen({ onBack }: Props) {
  return (
    <main className="how-to-play">
      <h1>How to Play</h1>
      <p className="tagline">Swipe Sixer — turn-based cricket card game.</p>

      <nav className="guide-toc">
        <a href="#basics">Basics</a>
        <a href="#turn">A ball, step by step</a>
        <a href="#tiers">Card tiers</a>
        <a href="#zones">Zones &amp; lookup</a>
        <a href="#roles">Roles &amp; phases</a>
        <a href="#perks">Engine perks</a>
        <a href="#skills">Bowler skills</a>
        <a href="#extras">Wides &amp; no-balls</a>
        <a href="#situations">Situation cards</a>
        <a href="#formats">Formats (T1 / T3)</a>
        <a href="#career">World Cup career mode</a>
        <a href="#tips">Tips</a>
      </nav>

      <div className="guide">
        <section id="basics">
          <h2>The basics</h2>
          <p>
            Two players each play a card every ball. The <strong>batter</strong>{" "}
            plays a batsman card; the <strong>bowler</strong> plays a bowler card.
            The bowler's delivery zone (line × length) is looked up against the
            batter's card to resolve the ball — runs, dot, or wicket.
          </p>
          <p>
            Each player draws cards from their own deck. The deck size depends
            on the match format (see <a href="#formats">Formats</a> below). You
            hold 4 cards in hand at a time; play one per ball, draw a
            replacement.
          </p>
        </section>

        <section id="turn">
          <h2>A ball, step by step</h2>
          <ol>
            <li>
              <strong>Coin toss</strong> at the start. 30 seconds to call
              heads/tails, 30 seconds for the winner to choose bat or bowl.
            </li>
            <li>
              <strong>30-second pick window</strong> each ball. Tap a card in
              your hand and either <strong>Use this batsman</strong> /{" "}
              <strong>Add this situation</strong> button below it, or open the
              card for full details first. If you don't pick, the server
              auto-plays your highest-tier valid card.
            </li>
            <li>
              <strong>Reveal &amp; resolution.</strong> Cards flip simultaneously.
              A short story sequence (pitch → bowler → batter → result) plays
              before showing the full resolution trail of every modifier that
              fired — situation cards, line/length shifts, base lookup, skills,
              fielding, wides, perks. A loud red banner appears if your
              situation card was cancelled (Biryani / Old School).
            </li>
            <li>
              <strong>10-second post-ball pause.</strong> Read the trail, see
              what happened, then the next ball begins.
            </li>
            <li>
              <strong>Mid-ball swap picks</strong> (15s) when Mankad, Retired
              Out, or Cramps fires. The affected player picks a replacement
              from a list.
            </li>
            <li>
              <strong>Innings break</strong> when the over count or wicket cap
              is reached. Second innings starts with roles swapped — the
              chasing side wins by reaching the target, the bowling side wins
              by keeping the chase short.
            </li>
          </ol>
        </section>

        <section id="tiers">
          <h2>Card tiers</h2>
          <p>Every player card belongs to one of four tiers:</p>
          <ul className="tier-list">
            <li>
              <span className="tier elite">Elite</span> — legends. Batters: 3
              strengths, 1 weakness, 6–7 resistances. Bowlers carry two skills.
            </li>
            <li>
              <span className="tier gold">Gold</span> — world-class. Batters
              mostly 2/2/2 split, 4–5 resistances. Bowlers carry one skill.
            </li>
            <li>
              <span className="tier silver">Silver</span> — international
              regulars. Batters 2 strengths, 3 weaknesses, 2–3 resistances.
              Bowlers no special skill.
            </li>
            <li>
              <span className="tier bronze">Bronze</span> — squad fillers.
              Mostly neutral and weakness zones, no resistances.
            </li>
          </ul>

          <h3 className="example-heading">Example cards</h3>
          <div className="example-cards">
            <ExampleCard
              caption="Elite batter — green zone-grid cells = boundaries, faint = dot, red = wicket. RH chip + silhouette show handedness; TOP role chip means built for the Powerplay phase."
              card={EXAMPLE_ELITE_BAT}
            />
            <ExampleCard
              caption="Gold bowler — one skill chip (Googly) downgrades any un-resisted outcome by one tier."
              card={EXAMPLE_GOLD_BOWL}
            />
            <ExampleCard
              caption="Bronze bowler — minimal data, no skill, no resistances. Tier identity is in the line + fielding."
              card={EXAMPLE_BRONZE_BOWL}
            />
          </div>
        </section>

        <section id="zones">
          <h2>Zones — how a ball resolves</h2>
          <p>
            Bowlers deliver to a <strong>line</strong> (Outside off, Off stump,
            Middle stump, Leg stump) at a <strong>length</strong> (Short, Good
            length, Full). That zone is looked up on the batter's card:
          </p>
          <ul>
            <li><strong>Strength zone</strong> — boundary or 6.</li>
            <li><strong>Neutral zone</strong> — 1 or 2 runs.</li>
            <li><strong>Weakness zone</strong> — wicket.</li>
            <li><strong>Unlisted zone</strong> — dot ball (default).</li>
          </ul>
          <p className="dim-text">
            The 3×4 grid on every batter card visualises this. Cells are
            colour-coded: green 6, blue 4, mid-gray 1/2, red W, faint dot. For
            left-handers the columns are mirrored so leg stump stays on the
            batter's left from their perspective.
          </p>
        </section>

        <section id="roles">
          <h2>Roles &amp; phases (v4)</h2>
          <p>
            Every player card has a <strong>role</strong> that maps to a
            <strong> phase</strong> of the innings. The scorebug shows the
            current phase; in-phase cards in your hand light up with a green ✦.
          </p>
          <ul>
            <li>
              <strong>Top Order</strong> batter / <strong>Powerplay</strong>{" "}
              bowler — built for the early balls.
            </li>
            <li>
              <strong>Middle Order</strong> batter / <strong>Middle Overs</strong>{" "}
              bowler — the consolidation phase.
            </li>
            <li>
              <strong>Finisher</strong> batter / <strong>Death Overs</strong>{" "}
              bowler — built for the back end.
            </li>
          </ul>
          <p>
            When a card's role matches the current phase, it gets bonuses (see
            below). When mismatched, small penalties. The visual ✦ in the role
            chip is your at-a-glance cue.
          </p>
        </section>

        <section id="perks">
          <h2>Engine perks</h2>
          <p>
            Every ball, after the base lookup + skill + fielding + situation
            cards have all resolved, a series of probabilistic effects fire:
          </p>
          <h3 className="example-heading">In your favour</h3>
          <ul>
            <li>
              <strong>Batter in-phase upgrade (10%)</strong> — when your batter's
              role matches the phase, a scoring shot ticks up one tier (1→2,
              2→4, 4→6).
            </li>
            <li>
              <strong>Bowler in-phase wicket (10%)</strong> — when your bowler's
              role matches the phase, a dot has a 10% chance to become a wicket
              (yorker, new-ball nip, slower-ball deception).
            </li>
            <li>
              <strong>Wicket save (30% total)</strong> — any wicket has a 15%
              chance to become 2 byes/leg-byes and another 15% chance to become
              4 — with a dismissal-typed narrative ("LBW down leg → leg byes",
              "edge fell through gloves → byes", etc.).
            </li>
            <li>
              <strong>Inside edge (5%)</strong> — a bowled wicket has a 5%
              chance to trickle past the stumps off the inside edge for 1–4 runs.
            </li>
            <li>
              <strong>Misfield (5%)</strong> — boundary swap: 4 becomes 6 (or
              vice versa) when a fielder fumbles on the rope.
            </li>
          </ul>
          <h3 className="example-heading">Against you</h3>
          <ul>
            <li>
              <strong>Batter out-of-phase dot (25%)</strong> — when your
              batter's role doesn't match the phase, a scoring shot has a 25%
              chance to fizzle to a dot.
            </li>
            <li>
              <strong>Bowler out-of-phase wide bump (+20%)</strong> — when your
              bowler is out of phase and delivers to leg / outside-off, the
              wide chance jumps by 20%.
            </li>
            <li>
              <strong>Run-out (10%)</strong> — a 1 or 2 has a 10% chance to
              become a run-out wicket. Direct hits going for the second run.
            </li>
          </ul>
        </section>

        <section id="skills">
          <h2>Bowler skills</h2>
          <p>
            Gold and Elite bowlers carry skill chips: Swing, Seam, Cutter,
            Slower, Googly, Carrom, Topspin, Drift. When a skill fires —
            meaning the batter's card does <em>not</em> list it in their
            resistances — the outcome is downgraded one band:
          </p>
          <p className="callout dim-text" style={{ textAlign: "center" }}>
            6 → 4 → 2 → 1 → dot
          </p>
          <p>
            Wickets aren't affected, dots can't go lower.{" "}
            <strong>No-stack rule:</strong> Elites with two skills only fire
            one per ball.
          </p>
          <p>
            Batters' <strong>resistances</strong> (the chips next to "Resists"
            on their card) list the skills they neutralise. Elite batters
            resist 6–7 of the 8 skills; Bronze batters resist none.
          </p>
        </section>

        <section id="extras">
          <h2>Wides &amp; no-balls (rebowl rule)</h2>
          <p>
            Bowlers on the <strong>Outside off</strong> line risk being called
            wide — Bronze 40% / Silver 25% / Gold 15% / Elite 5% — when the
            outcome would be a dot. Some situation cards force auto-wides
            (Shuffle Across + Leg, Day 5 Pitch + Outside off, Deep in the
            Crease + Short).
          </p>
          <p>
            The <strong>No Ball</strong> card cancels any wicket on the ball,
            adds +1 run, and re-bowls. Cancellable by Biryani.
          </p>
          <p className="callout">
            <strong>Rebowl rule:</strong> when a delivery is rebowled (no-ball
            or wide), <strong>both mandatory cards return to the bottom of
            their decks</strong>. The bowler didn't deliver a legal ball and
            the batter didn't get to face one. Situation cards still get
            consumed.
          </p>
        </section>

        <section id="situations">
          <h2>Situation cards</h2>
          <p>
            Decks include situation cards alongside player cards. Per ball
            you may play <strong>one</strong> situation card on top of your
            mandatory batsman/bowler. Highlights:
          </p>
          <ul>
            <li>
              <strong>DRS Review</strong> (batting) — overturn a wicket to a
              dot.
            </li>
            <li>
              <strong>Power Surge</strong> (batting) — upgrade the ball one tier
              (dot → 1, 1 → 2, 2 → 4, 4 → 6). Doesn't save against weaknesses.
            </li>
            <li>
              <strong>Mankad / Retired Out / Cramps</strong> — forces the
              affected player to swap their played card mid-resolution. Burns
              two cards in one ball.
            </li>
            <li>
              <strong>Day 5 Pitch</strong> (bowling) — shifts the delivery line
              one step further off. On Outside off it short-circuits to an
              auto-wide.
            </li>
            <li>
              <strong>Old School Cricket Only</strong> (either side) — cancels
              the opponent's situation card entirely.
            </li>
            <li>
              <strong>Third Umpire Distracted by Biryani</strong> (bowling) —
              counters No Ball and wide calls.
            </li>
          </ul>
          <p className="dim-text">
            Full reference + all 16 cards: <code>docs/situation-cards.md</code>.
          </p>

          <h3 className="example-heading">Example situation cards</h3>
          <div className="example-cards">
            <ExampleCard
              caption="DRS Review — wicket insurance for your top batter."
              card={EXAMPLE_SITUATION}
            />
            <ExampleCard
              caption="Biryani — the counter. Cancels your opponent's No Ball, wide call, or zone-shift wide trigger."
              card={EXAMPLE_BIRYANI}
            />
          </div>
        </section>

        <section id="formats">
          <h2>Formats: T1 and T3</h2>
          <p>
            Two formats are live; T5 is planned for after the roster grows.
          </p>
          <ul>
            <li>
              <strong>T1</strong> — 1 over per side (6 balls / 2 wickets).
              ~3-minute matches. Deck of 20 (15 player + 5 sit). Phases:
              Powerplay (1-2) · Middle (3-4) · Death (5-6).
            </li>
            <li>
              <strong>T3</strong> — 3 overs per side (18 balls / 5 wickets).
              ~10-minute matches. Deck of 30 (24 player + 6 sit). Phases: each
              over is one phase.
            </li>
          </ul>
          <p className="dim-text">
            T3 has more room for an arc — partnerships, comeback wickets, a
            late finisher push. World Cup career mode is locked to T3.
          </p>
        </section>

        <section id="career">
          <h2>World Cup career mode</h2>
          <p>
            Tap <strong>🏆 World Cup</strong> on the home screen to start a run.
            Each run is its own ephemeral tournament — your draft, deck, and
            inventory are reset every time.
          </p>
          <ol>
            <li>
              <strong>Draft</strong> — 5 rounds. Pick 2 of 5 Elite batters,
              2 of 5 Elite bowlers, 3 of 10 Gold batters, 3 of 10 Gold bowlers,
              then 3 batting + 3 bowling situation cards. Silver and Bronze
              auto-fill from the global pool.
            </li>
            <li>
              <strong>Ladder</strong> — 5 group-stage opponents (Gully &amp;
              Domestic difficulty), then a semi-final, then a final
              (International). The semi and final opponents stay hidden as{" "}
              <em>???</em> until you reach them.
            </li>
            <li>
              <strong>Group stage</strong> — play all 5 group matches. Need 3
              wins to advance. Lose your 3rd group match without 3 wins → run
              over.
            </li>
            <li>
              <strong>Per-win pack</strong> — every group / semi win, open a
              6-card pack (random Silver-heavy, with chances for Gold + Elite +
              the occasional situation card). Pick 2 → they go into your{" "}
              <strong>run inventory</strong>.
            </li>
            <li>
              <strong>Deck management</strong> — between matches, tap{" "}
              <strong>📋 Manage Deck</strong>. Swap cards from the inventory
              into your active deck (or vice versa). Long names truncate;
              same-kind swaps only.
            </li>
            <li>
              <strong>Knockouts</strong> — sudden death. Lose the semi → run
              over. Lose the final → run over (no trophy).
            </li>
            <li>
              <strong>Trophy pack</strong> — win the final, open a special pack
              (1 guaranteed Elite + 2 Gold + 2 Silver + 1 situation). Pick 2 →
              they go into your <strong>permanent collection</strong>, which
              persists across runs.
            </li>
          </ol>
          <p className="dim-text">
            Abandon-run is available any time from the career hub. Your run
            inventory is discarded; the permanent collection is untouched.
          </p>
        </section>

        <section id="tips">
          <h2>Tips for new players</h2>
          <ul>
            <li>
              Read your opponent's batter weaknesses (red zones on the grid)
              — that's where to bowl.
            </li>
            <li>
              Match your card's role chip to the phase pill in the scorebug.
              In-phase cards (green ✦) get bonuses; out-of-phase cards risk
              penalties.
            </li>
            <li>
              Save Elite cards for high-pressure balls (final ball, last
              wicket in hand, chasing in the death overs).
            </li>
            <li>
              Skill chips only fire when the batter <em>doesn't</em> resist
              that specific skill. Check the resistance row before relying on
              your Gold/Elite chip.
            </li>
            <li>
              Situation cards often win matches. Don't hoard them past your
              last over.
            </li>
            <li>
              In career mode, the per-win pack is the loop — every win expands
              your options. Swap aggressively in deck management.
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
