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

/** Sections + their TOC labels, in render order. Lets us define the TOC
 *  and the sections in one place. */
const TOC: { id: string; label: string; group: "core" | "cards" | "mechanics" | "modes" }[] = [
  { id: "basics", label: "Basics", group: "core" },
  { id: "turn", label: "A ball, step by step", group: "core" },
  { id: "tiers", label: "Card tiers", group: "cards" },
  { id: "zones", label: "Zones & lookup", group: "cards" },
  { id: "roles", label: "Roles & phases", group: "cards" },
  { id: "skills", label: "Bowler skills", group: "cards" },
  { id: "perks", label: "Engine perks", group: "mechanics" },
  { id: "extras", label: "Wides & no-balls", group: "mechanics" },
  { id: "situations", label: "Situation cards", group: "mechanics" },
  { id: "formats", label: "Formats", group: "modes" },
  { id: "career", label: "World Cup career", group: "modes" },
  { id: "tips", label: "Tips", group: "modes" },
];

const GROUP_LABELS: Record<string, string> = {
  core: "Getting started",
  cards: "Cards",
  mechanics: "Engine mechanics",
  modes: "Modes & tips",
};

export default function HowToPlayScreen({ onBack }: Props) {
  return (
    <main className="how-to-play">
      <header className="how-to-play-header">
        <button type="button" className="btn ghost how-to-play-back-top" onClick={onBack}>
          ← Home
        </button>
        <h1>How to Play</h1>
        <p className="tagline">Swipe Sixer — turn-based cricket card game.</p>
      </header>

      <div className="how-to-play-shell">
        <TableOfContents onBack={onBack} />
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
                strengths, 2 neutrals, 1 weakness, 6–7 resistances (of 8 adjectives).
                Bowlers carry 2 skills.
              </li>
              <li>
                <span className="tier gold">Gold</span> — world-class. Batters
                mostly 2 strengths / 2 neutrals / 2 weaknesses, 4–5 resistances.
                Bowlers carry 1 skill.
              </li>
              <li>
                <span className="tier silver">Silver</span> — international
                regulars. Batters 2 strengths, 1 neutral, 3 weaknesses, 2–3
                resistances. Bowlers no special skill.
              </li>
              <li>
                <span className="tier bronze">Bronze</span> — squad fillers.
                1 strength, 2 neutrals, 3 weaknesses, no resistances.
              </li>
            </ul>

            <h3 className="example-heading">Example cards</h3>
            <div className="example-cards">
              <ExampleCard
                caption="Elite batter — green zone-grid cells = boundaries, faint = dot, red = wicket. RH/LH chip + silhouette show handedness. TOP role chip means built for the Powerplay phase."
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
              colour-coded: green 6, blue 4, mid-gray 1/2, red W, faint dot.
              For left-handers the columns are mirrored so leg stump stays on
              the batter's left from their perspective.
            </p>
          </section>

          <section id="roles">
            <h2>Roles &amp; phases</h2>
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
              When a card's role matches the current phase, it gets bonuses
              (see <a href="#perks">Engine perks</a>). When mismatched, small
              penalties. The visual ✦ in the role chip is your at-a-glance cue.
            </p>
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

          <section id="perks">
            <h2>Engine perks</h2>
            <p>
              Every ball, after the base lookup + skill + fielding + situation
              cards have all resolved, a series of probabilistic effects fire:
            </p>
            <div className="perks-grid">
              <div>
                <h3 className="example-heading">In your favour</h3>
                <ul>
                  <li>
                    <strong>Batter in-phase upgrade (10%)</strong> — when your batter's
                    role matches the phase, a scoring shot ticks up one tier
                    (1→2, 2→4, 4→6).
                  </li>
                  <li>
                    <strong>Bowler in-phase wicket (10%)</strong> — when your bowler's
                    role matches the phase, a dot has a 10% chance to become a wicket
                    (yorker, new-ball nip, slower-ball deception).
                  </li>
                  <li>
                    <strong>Wicket save (30% total)</strong> — most wickets have a 15%
                    chance to become 2 byes/leg-byes and another 15% chance to become
                    4 — with a dismissal-typed narrative ("LBW down leg → leg byes",
                    "edge fell through gloves → byes"). The scorebug shows these as a
                    green or amber "2b" / "4lb" circle distinct from a plain dot.
                    <strong> Run-outs are exempt</strong> — once you're run out, you stay
                    run out.
                  </li>
                  <li>
                    <strong>Inside edge (5%)</strong> — a bowled-mode wicket has a 5%
                    chance to trickle past the stumps off the inside edge for 1–4 runs.
                  </li>
                  <li>
                    <strong>Misfield (5%)</strong> — boundary swap: 4 becomes 6 (or
                    vice versa) when a fielder fumbles on the rope.
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="example-heading">Against you</h3>
                <ul>
                  <li>
                    <strong>Batter out-of-phase dot (25%)</strong> — when your batter's
                    role doesn't match the phase, a scoring shot has a 25% chance to
                    fizzle to a dot.
                  </li>
                  <li>
                    <strong>Bowler out-of-phase wide bump (+20%)</strong> — when your
                    bowler is out of phase and delivers to leg / outside-off, the wide
                    chance jumps by 20%.
                  </li>
                  <li>
                    <strong>Run-out (10%)</strong> — a 1 or 2 has a 10% chance to
                    become a run-out wicket. Direct hits going for the second run.
                  </li>
                </ul>
              </div>
            </div>
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
                <strong>DRS Review</strong> (batting) — overturn a wicket to a dot.
              </li>
              <li>
                <strong>Power Surge</strong> (batting) — upgrade the ball one tier
                (dot → 1, 1 → 2, 2 → 4, 4 → 6). Doesn't save against weaknesses.
              </li>
              <li>
                <strong>Mankad / Retired Out / Cramps</strong> — forces the
                affected player to swap their played card mid-resolution.
                Consumes two cards in one ball.
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
            <p>Two formats are live; T5 is planned for after the roster grows.</p>
            <ul>
              <li>
                <strong>T1</strong> — 1 over per side (6 balls / 2 wickets).
                ~3-minute matches. Deck of 20 (15 player + 5 sit). Phases:
                Powerplay (1–2) · Middle (3–4) · Death (5–6).
              </li>
              <li>
                <strong>T3</strong> — 3 overs per side (18 balls / 5 wickets).
                ~10-minute matches. Deck of 30 (24 player + 6 sit). Phases: each
                over is one phase. World Cup mode is locked to T3.
              </li>
            </ul>
            <p className="dim-text">
              T3 has more room for an arc — partnerships, comeback wickets, a
              late finisher push.
            </p>
          </section>

          <section id="career">
            <h2>World Cup career mode</h2>
            <p>
              Tap <strong>🏆 World Cup</strong> on the home screen. Career mode
              is a series of self-contained tournament runs. Each run has its
              own draft, deck, and inventory — losing the run resets everything
              <em> except</em> the cards you've won from trophy packs, which
              persist across runs in your permanent collection.
            </p>

            <h3 className="example-heading">Pick a tournament</h3>
            <p>
              Three variants when starting a run. Each has its own ladder shape
              and themed accent colour on the career hub:
            </p>
            <ul>
              <li>
                🌍 <strong>T20 World Cup</strong> — 12-nation pool, 5 group
                matches (3 wins to advance), semi, final. 7 matches total.
              </li>
              <li>
                🌏 <strong>Asia Cup</strong> — subcontinent only (5 nations),
                4 group matches, semi, final. 6 matches total.
              </li>
              <li>
                🏆 <strong>Champions Trophy</strong> — top 8 nations, pure
                knockouts: quarter-final → semi → final. Just 3 matches and
                every one is sudden death.
              </li>
            </ul>

            <h3 className="example-heading">Pick a difficulty</h3>
            <ul>
              <li>
                <strong>Casual</strong> — every bot plays at Gully level. Good
                for new players or quick wins.
              </li>
              <li>
                <strong>Realistic</strong> — ramp from Gully → Domestic →
                International across the bracket. Group matches easier, finals
                tougher.
              </li>
              <li>
                <strong>Legend</strong> — every opponent plays at International
                level. Brutal — only for veterans. Trophies earned on Legend
                unlock the underdog headline in the newspaper recap.
              </li>
            </ul>
            <p className="dim-text">
              Difficulty per match is hidden during the run — you picked your
              mode at run-start, so the ladder only shows opponents + stage
              (no "Gully/Domestic/International" sticker per match).
            </p>

            <h3 className="example-heading">Draft your deck</h3>
            <p>
              5 rounds: pick 2 of 5 Elite batters, 2 of 5 Elite bowlers, 3 of
              10 Gold batters, 3 of 10 Gold bowlers, then 3 batting + 3 bowling
              situation cards. Silver and Bronze auto-fill from the global pool
              so you always have a viable deck.
            </p>

            <h3 className="example-heading">Pre-match teaser</h3>
            <p>
              When you tap "Play match", a pre-match overlay appears with both
              flags, the stage ("Group Match 3 of 5" / "★ THE FINAL ★"), and
              the stadium — Lord's for England matches, Eden Gardens for India,
              the Gabba for Australia, etc. Tap to start, or auto-advances
              after 3.5s.
            </p>

            <h3 className="example-heading">Hidden knockout opponents</h3>
            <p>
              The semi-final and final opponents stay as <em>???</em> on the
              ladder until you actually reach those stages. Preserves the
              tournament suspense.
            </p>

            <h3 className="example-heading">Per-win packs &amp; deck management</h3>
            <p>
              Every group / semi win opens a 6-card pack (random Silver-heavy,
              with chances for Gold + Elite + the occasional situation card).
              Tap each card to flip-reveal one at a time. Pick 2 to add to your
              <strong> run inventory</strong>.
            </p>
            <p>
              Between matches, tap <strong>📋 Manage Deck</strong>. Tap any card
              on either side — eligible swap targets on the other side glow
              green. Same-kind only (batsman ↔ batsman, bowler ↔ bowler,
              batting sit ↔ batting sit).
            </p>

            <h3 className="example-heading">Trophy pack &amp; permanent collection</h3>
            <p>
              Win the final to open a <strong>trophy pack</strong> — themed
              with a soft glow in the tournament's accent colour. Special
              composition: 1 guaranteed Elite + 2 Gold + 2 Silver + 1 situation.
              Picked cards go to your <strong>permanent collection</strong>,
              which survives all future runs.
            </p>

            <h3 className="example-heading">Newspaper recap</h3>
            <p>
              At run end, a stylized newspaper front page summarises the
              tournament with a tone-keyed headline (
              <em>"INVINCIBLE!"</em> for unbeaten runs,{" "}
              <em>"RISE FROM THE ASHES"</em> for comebacks,{" "}
              <em>"LEGENDS BORN"</em> on Legend mode), match-by-match
              highlights, and a tongue-in-cheek manager's quote.
            </p>

            <h3 className="example-heading">Career stats</h3>
            <p>
              Tap <strong>📊 Career stats</strong> in the career hub footer:
              total trophies, matches played, win rate, longest streak, run
              abandons, plus trophy counts broken down by tournament and
              difficulty.
            </p>

            <p className="dim-text">
              Abandon a run any time from the career hub. Your run inventory is
              discarded; the permanent collection is untouched.
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
              <li>
                Start with the T20 World Cup on Realistic. Once you've won one,
                try the Champions Trophy for a quick high-stakes variant or
                Legend difficulty for a real challenge.
              </li>
            </ul>
          </section>
        </div>
        <QuickReference />
      </div>

      <div className="form-actions" style={{ marginTop: "2rem" }}>
        <button type="button" className="btn primary" onClick={onBack}>
          Back to menu
        </button>
      </div>
    </main>
  );
}

/** Sticky TOC. On desktop renders as a left-column sidebar with section
 *  groups; on mobile collapses to a horizontal pill bar that sticks to
 *  the top of the viewport when scrolling. */
function TableOfContents({ onBack }: { onBack: () => void }) {
  const groups: { key: string; items: typeof TOC }[] = [];
  for (const item of TOC) {
    let g = groups.find((x) => x.key === item.group);
    if (!g) {
      g = { key: item.group, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }

  return (
    <nav className="guide-toc">
      <button
        type="button"
        className="guide-toc-home"
        onClick={onBack}
      >
        ← Home
      </button>
      {groups.map((group) => (
        <div key={group.key} className="guide-toc-group">
          <div className="guide-toc-group-label">{GROUP_LABELS[group.key]}</div>
          {group.items.map((item) => (
            <a key={item.id} href={`#${item.id}`}>
              {item.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
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

/** Right-column "cheat sheet" — small tables of tier shapes, phase
 *  mappings, key engine-perk percentages. Almost all icons + numbers,
 *  minimal prose, so it doesn't overwhelm. Sticky on desktop so the
 *  reference is always visible while reading the long-form copy.
 *  Hidden on mobile (<900px) — the info is all in the inline sections. */
function QuickReference() {
  return (
    <aside className="quick-ref" aria-label="Quick reference">
      <h3 className="quick-ref-heading">Quick reference</h3>

      <div className="quick-ref-card">
        <div className="quick-ref-card-title">Batter tier shape</div>
        <table className="quick-ref-table">
          <thead>
            <tr><th></th><th>S</th><th>N</th><th>W</th><th>R</th></tr>
          </thead>
          <tbody>
            <tr><td><span className="tier elite">Elite</span></td><td>3</td><td>2</td><td>1</td><td>6–7</td></tr>
            <tr><td><span className="tier gold">Gold</span></td><td>2</td><td>2</td><td>2</td><td>4–5</td></tr>
            <tr><td><span className="tier silver">Silver</span></td><td>2</td><td>1</td><td>3</td><td>2–3</td></tr>
            <tr><td><span className="tier bronze">Bronze</span></td><td>1</td><td>2</td><td>3</td><td>0</td></tr>
          </tbody>
        </table>
        <div className="quick-ref-legend">
          S strengths · N neutrals · W weaknesses · R resistances (of 8)
        </div>
      </div>

      <div className="quick-ref-card">
        <div className="quick-ref-card-title">Bowler tier shape</div>
        <table className="quick-ref-table">
          <thead>
            <tr><th></th><th>Skills</th><th>Fielding</th></tr>
          </thead>
          <tbody>
            <tr><td><span className="tier elite">Elite</span></td><td>2 (no-stack)</td><td>1–3</td></tr>
            <tr><td><span className="tier gold">Gold</span></td><td>1</td><td>1–2</td></tr>
            <tr><td><span className="tier silver">Silver</span></td><td>0</td><td>1–2</td></tr>
            <tr><td><span className="tier bronze">Bronze</span></td><td>0</td><td>1–2</td></tr>
          </tbody>
        </table>
      </div>

      <div className="quick-ref-card">
        <div className="quick-ref-card-title">Phases per format</div>
        <table className="quick-ref-table">
          <thead>
            <tr><th></th><th>PP</th><th>Middle</th><th>Death</th></tr>
          </thead>
          <tbody>
            <tr><td>T1 (6b)</td><td>1–2</td><td>3–4</td><td>5–6</td></tr>
            <tr><td>T3 (18b)</td><td>1–6</td><td>7–12</td><td>13–18</td></tr>
          </tbody>
        </table>
      </div>

      <div className="quick-ref-card">
        <div className="quick-ref-card-title">Engine perks (%)</div>
        <ul className="quick-ref-list">
          <li><span className="quick-ref-pct good">+10%</span> Batter in-phase upgrade</li>
          <li><span className="quick-ref-pct good">+10%</span> Bowler in-phase wicket</li>
          <li><span className="quick-ref-pct good">+30%</span> Wicket → byes (no run-outs)</li>
          <li><span className="quick-ref-pct good">+5%</span> Inside edge past stumps</li>
          <li><span className="quick-ref-pct good">+5%</span> Misfield (4↔6)</li>
          <li><span className="quick-ref-pct bad">−25%</span> Batter OOP scoring → dot</li>
          <li><span className="quick-ref-pct bad">+20%</span> Bowler OOP wide bump</li>
          <li><span className="quick-ref-pct bad">+10%</span> Run-out on neutral</li>
        </ul>
      </div>

      <div className="quick-ref-card">
        <div className="quick-ref-card-title">Tournaments</div>
        <ul className="quick-ref-list compact">
          <li>🌍 <strong>WC</strong> · 12 nations · 5G+SF+F = 7</li>
          <li>🌏 <strong>Asia Cup</strong> · 5 nations · 4G+SF+F = 6</li>
          <li>🏆 <strong>Champions</strong> · 8 nations · QF+SF+F = 3</li>
        </ul>
      </div>
    </aside>
  );
}
