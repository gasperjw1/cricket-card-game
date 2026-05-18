import { useMemo, useState } from "react";
import type {
  AnyCard,
  BatsmanCard,
  BowlerCard,
  SituationCard,
} from "@swipe-sixer/shared";
import { Card } from "../components/Card.tsx";
import { HorizontalScroller } from "../components/HorizontalScroller.tsx";
import {
  draftPoolBattingSituations,
  draftPoolBowlingSituations,
  draftPoolEliteBatters,
  draftPoolEliteBowlers,
  draftPoolGoldBatters,
  draftPoolGoldBowlers,
} from "../lib/career-pack.ts";
import { buildInitialRunDeck } from "../lib/career-deck.ts";
import { getCareer, setDeck, setDraft } from "../lib/career.ts";

interface Props {
  /** Called when draft is complete; CareerHomeScreen takes over. */
  onComplete: () => void;
  /** Called when the player backs out — abandons the run. */
  onCancel: () => void;
}

type RoundKey = "elite-bat" | "elite-bowl" | "gold-bat" | "gold-bowl" | "sits";

interface RoundSpec {
  key: RoundKey;
  title: string;
  blurb: string;
  pickN: number;
  /** Computed lazily when round starts. */
  options: () => AnyCard[];
}

/**
 * 5-round draft for a fresh WC run. Each round shows a grid of options;
 * the player taps to select up to N cards then advances. Picks across
 * rounds are mutually exclusive (no duplicates).
 *
 * Final screen: review the drafted core before locking it in (after
 * which Silver/Bronze auto-fill and the deck enters match flow).
 */
export function DraftScreen({ onComplete, onCancel }: Props) {
  const [roundIdx, setRoundIdx] = useState(0);
  const [picks, setPicks] = useState<Record<RoundKey, string[]>>({
    "elite-bat": [],
    "elite-bowl": [],
    "gold-bat": [],
    "gold-bowl": [],
    sits: [],
  });

  // Roll the draft pools once at mount. Excludes are computed on the
  // fly so later rounds never offer cards already picked.
  const eliteBatPool = useMemo(() => draftPoolEliteBatters(5), []);
  const eliteBowlPool = useMemo(() => draftPoolEliteBowlers(5), []);
  const goldBatPool = useMemo(() => draftPoolGoldBatters(10), []);
  const goldBowlPool = useMemo(() => draftPoolGoldBowlers(10), []);
  const batSitPool = useMemo(() => draftPoolBattingSituations(), []);
  const bowlSitPool = useMemo(() => draftPoolBowlingSituations(), []);

  const rounds: RoundSpec[] = [
    {
      key: "elite-bat",
      title: "Round 1 · Elite batters",
      blurb: "Pick 2 of 5. These are your big-moment hitters.",
      pickN: 2,
      options: () => eliteBatPool,
    },
    {
      key: "elite-bowl",
      title: "Round 2 · Elite bowlers",
      blurb: "Pick 2 of 5. Your breakthrough bowlers in the death overs.",
      pickN: 2,
      options: () => eliteBowlPool,
    },
    {
      key: "gold-bat",
      title: "Round 3 · Gold batters",
      blurb: "Pick 3 of 10. Your mainstay middle order and finishers.",
      pickN: 3,
      options: () => goldBatPool,
    },
    {
      key: "gold-bowl",
      title: "Round 4 · Gold bowlers",
      blurb: "Pick 3 of 10. Strong bowlers across all phases.",
      pickN: 3,
      options: () => goldBowlPool,
    },
    {
      key: "sits",
      title: "Round 5 · Situation cards",
      blurb: "Pick 3 batting + 3 bowling situations to shape your strategy.",
      pickN: 6, // 3 + 3 handled specially below
      options: () => [...batSitPool, ...bowlSitPool],
    },
  ];

  const round = rounds[roundIdx]!;
  const isFinal = roundIdx >= rounds.length;

  if (isFinal) {
    return (
      <ReviewScreen
        picks={picks}
        eliteBatPool={eliteBatPool}
        eliteBowlPool={eliteBowlPool}
        goldBatPool={goldBatPool}
        goldBowlPool={goldBowlPool}
        batSitPool={batSitPool}
        bowlSitPool={bowlSitPool}
        onConfirm={() => {
          // Commit the draft to career state, then build initial deck.
          setDraft({
            batterPicks: [...picks["elite-bat"], ...picks["gold-bat"]],
            bowlerPicks: [...picks["elite-bowl"], ...picks["gold-bowl"]],
            battingSituationPicks: picks.sits.filter((id) =>
              batSitPool.some((s) => s.id === id),
            ),
            bowlingSituationPicks: picks.sits.filter((id) =>
              bowlSitPool.some((s) => s.id === id),
            ),
          });
          const career = getCareer();
          if (career.currentRun?.draft) {
            const initialDeck = buildInitialRunDeck(career.currentRun.format, career.currentRun.draft);
            setDeck(initialDeck);
          }
          onComplete();
        }}
        onBack={() => setRoundIdx(rounds.length - 1)}
      />
    );
  }

  // Situation round splits into two grids; handle separately.
  if (round.key === "sits") {
    return (
      <SituationRound
        battingOptions={batSitPool}
        bowlingOptions={bowlSitPool}
        selected={picks.sits}
        onChange={(ids) => setPicks((p) => ({ ...p, sits: ids }))}
        onNext={() => setRoundIdx(roundIdx + 1)}
        onBack={roundIdx === 0 ? onCancel : () => setRoundIdx(roundIdx - 1)}
        title={round.title}
        blurb={round.blurb}
      />
    );
  }

  return (
    <PlayerRound
      title={round.title}
      blurb={round.blurb}
      options={round.options()}
      pickN={round.pickN}
      selected={picks[round.key]}
      onChange={(ids) => setPicks((p) => ({ ...p, [round.key]: ids }))}
      onNext={() => setRoundIdx(roundIdx + 1)}
      onBack={roundIdx === 0 ? onCancel : () => setRoundIdx(roundIdx - 1)}
      stepLabel={`${roundIdx + 1} of ${rounds.length}`}
    />
  );
}

// ─────────────────────────── Round components ───────────────────────────

function PlayerRound(props: {
  title: string;
  blurb: string;
  options: AnyCard[];
  pickN: number;
  selected: string[];
  onChange: (ids: string[]) => void;
  onNext: () => void;
  onBack: () => void;
  stepLabel: string;
}) {
  const { options, pickN, selected, onChange } = props;
  const canAdvance = selected.length === pickN;

  const toggle = (id: string): void => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else if (selected.length < pickN) {
      onChange([...selected, id]);
    }
    // else: at the cap — ignore (player must deselect first)
  };

  return (
    <main>
      <div className="draft-header">
        <span className="dim-text">{props.stepLabel}</span>
        <h1>{props.title}</h1>
        <p className="dim-text">{props.blurb}</p>
        <p className="draft-counter">
          {selected.length} / {pickN} picked
        </p>
      </div>
      <HorizontalScroller count={options.length} noun="option">
        <div className="draft-grid">
          {options.map((card) => (
            <div
              key={card.id}
              className={`draft-slot ${selected.includes(card.id) ? "selected" : ""}`}
              onClick={() => toggle(card.id)}
            >
              <Card card={card} size="hand" selected={selected.includes(card.id)} />
            </div>
          ))}
        </div>
      </HorizontalScroller>
      <div className="draft-actions">
        <button className="btn ghost" onClick={props.onBack}>
          Back
        </button>
        <button className="btn primary" disabled={!canAdvance} onClick={props.onNext}>
          {canAdvance ? "Next →" : `Pick ${pickN - selected.length} more`}
        </button>
      </div>
    </main>
  );
}

function SituationRound(props: {
  battingOptions: SituationCard[];
  bowlingOptions: SituationCard[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onNext: () => void;
  onBack: () => void;
  title: string;
  blurb: string;
}) {
  const { battingOptions, bowlingOptions, selected, onChange } = props;
  const battingSelected = selected.filter((id) =>
    battingOptions.some((s) => s.id === id),
  );
  const bowlingSelected = selected.filter((id) =>
    bowlingOptions.some((s) => s.id === id),
  );
  const canAdvance = battingSelected.length === 3 && bowlingSelected.length === 3;

  const toggle = (id: string, isBat: boolean): void => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
      return;
    }
    const limit = 3;
    const currentInGroup = isBat ? battingSelected.length : bowlingSelected.length;
    if (currentInGroup < limit) {
      onChange([...selected, id]);
    }
  };

  return (
    <main>
      <div className="draft-header">
        <span className="dim-text">5 of 5</span>
        <h1>{props.title}</h1>
        <p className="dim-text">{props.blurb}</p>
        <p className="draft-counter">
          Batting: {battingSelected.length}/3 · Bowling: {bowlingSelected.length}/3
        </p>
      </div>
      <h3 className="draft-subhead">Batting situations</h3>
      <HorizontalScroller count={battingOptions.length} noun="option">
        <div className="draft-grid">
          {battingOptions.map((card) => (
            <div
              key={card.id}
              className={`draft-slot ${selected.includes(card.id) ? "selected" : ""}`}
              onClick={() => toggle(card.id, true)}
            >
              <Card card={card} size="hand" selected={selected.includes(card.id)} />
            </div>
          ))}
        </div>
      </HorizontalScroller>
      <h3 className="draft-subhead">Bowling situations</h3>
      <HorizontalScroller count={bowlingOptions.length} noun="option">
        <div className="draft-grid">
          {bowlingOptions.map((card) => (
            <div
              key={card.id}
              className={`draft-slot ${selected.includes(card.id) ? "selected" : ""}`}
              onClick={() => toggle(card.id, false)}
            >
              <Card card={card} size="hand" selected={selected.includes(card.id)} />
            </div>
          ))}
        </div>
      </HorizontalScroller>
      <div className="draft-actions">
        <button className="btn ghost" onClick={props.onBack}>
          Back
        </button>
        <button className="btn primary" disabled={!canAdvance} onClick={props.onNext}>
          {canAdvance ? "Review draft →" : "Pick 3 of each"}
        </button>
      </div>
    </main>
  );
}

function ReviewScreen(props: {
  picks: Record<RoundKey, string[]>;
  eliteBatPool: BatsmanCard[];
  eliteBowlPool: BowlerCard[];
  goldBatPool: BatsmanCard[];
  goldBowlPool: BowlerCard[];
  batSitPool: SituationCard[];
  bowlSitPool: SituationCard[];
  onConfirm: () => void;
  onBack: () => void;
}) {
  const pickedCard = (id: string): AnyCard | null => {
    const all: AnyCard[] = [
      ...props.eliteBatPool,
      ...props.eliteBowlPool,
      ...props.goldBatPool,
      ...props.goldBowlPool,
      ...props.batSitPool,
      ...props.bowlSitPool,
    ];
    return all.find((c) => c.id === id) ?? null;
  };

  const section = (title: string, ids: string[]) => (
    <>
      <h3 className="draft-subhead">{title}</h3>
      <HorizontalScroller count={ids.length} noun="card">
        <div className="draft-grid">
          {ids.map((id) => {
            const c = pickedCard(id);
            return c ? (
              <div key={id} className="draft-slot selected">
                <Card card={c} size="hand" />
              </div>
            ) : null;
          })}
        </div>
      </HorizontalScroller>
    </>
  );

  return (
    <main>
      <div className="draft-header">
        <h1>Draft complete</h1>
        <p className="dim-text">
          Silver and Bronze cards will auto-fill the rest of your deck.
          You'll be able to swap cards in/out between matches.
        </p>
      </div>
      {section("Elite batters", props.picks["elite-bat"])}
      {section("Elite bowlers", props.picks["elite-bowl"])}
      {section("Gold batters", props.picks["gold-bat"])}
      {section("Gold bowlers", props.picks["gold-bowl"])}
      {section("Situation cards", props.picks.sits)}
      <div className="draft-actions">
        <button className="btn ghost" onClick={props.onBack}>
          ← Re-pick situations
        </button>
        <button className="btn primary big" onClick={props.onConfirm}>
          Lock in deck → start World Cup
        </button>
      </div>
    </main>
  );
}
