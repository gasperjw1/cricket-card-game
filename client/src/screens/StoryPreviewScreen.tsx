import { useState } from "react";
import type { BallResult, BowlerCard, BatsmanCard, ShotCategory, DismissalCategory } from "@swipe-sixer/shared";
import { CARDS } from "@swipe-sixer/shared/data";
import { StorySequence } from "../components/story/StorySequence.tsx";
import { useStorySequence } from "../components/story/useStorySequence.ts";

const SHOT_CATEGORIES: ShotCategory[] = [
  "drive-straight", "drive-cover", "drive-off",
  "cut", "late-cut", "pull",
  "flick", "glance",
  "sweep", "reverse-sweep",
  "loft-straight", "loft-off", "loft-leg",
  "slog", "ramp", "scoop",
  "defend", "mistime",
];

const DISMISSAL_CATEGORIES: DismissalCategory[] = [
  "bowled", "lbw",
  "caught-keeper", "caught-slip", "caught-cover",
  "caught-midwicket", "caught-point", "caught-deep",
  "caught-and-bowled", "stumped", "runout",
];

type Variant = {
  label: string;
  outcome: BallResult["finalOutcome"];
  /** Inject specific resolution-step kinds to trigger conditional stages. */
  extraStepKinds?: ("day-5-pitch" | "no-ball" | "wide" | "drs-review" | "biryani")[];
};

/** QA tool: walks through every story-stage variation with hardcoded
 *  inputs so you can audit images as they arrive without playing actual
 *  matches. Open by appending ?preview=story to the URL. */
export function StoryPreviewScreen() {
  const [index, setIndex] = useState(0);

  const variants: Variant[] = [
    // Pitch variants
    { label: "Pitch — Day 5 (cracked)", outcome: { type: "dot" }, extraStepKinds: ["day-5-pitch"] },
    { label: "Pitch — regular", outcome: { type: "dot" } },

    // No-ball / wide / Biryani variants
    { label: "No-ball signal", outcome: { type: "dot" }, extraStepKinds: ["no-ball"] },
    { label: "Wide signal", outcome: { type: "dot" }, extraStepKinds: ["wide"] },
    { label: "Biryani cancelling no-ball", outcome: { type: "dot" }, extraStepKinds: ["no-ball", "biryani"] },

    // DRS variant (post-wicket)
    {
      label: "DRS Review (overturns wicket)",
      outcome: { type: "wicket", mode: "LBW playing across", dismissalCategory: "lbw" },
      extraStepKinds: ["drs-review"],
    },

    // Every shot category
    ...SHOT_CATEGORIES.map((cat) => ({
      label: `Shot — ${cat}`,
      outcome: { type: "runs" as const, value: 4 as const, shot: cat.replace(/-/g, " "), shotCategory: cat },
    })),

    // Every dismissal category
    ...DISMISSAL_CATEGORIES.map((cat) => ({
      label: `Dismissal — ${cat}`,
      outcome: { type: "wicket" as const, mode: cat.replace(/-/g, " "), dismissalCategory: cat },
    })),
  ];

  const current = variants[index]!;
  const result = makeStubResult(current);
  // Re-mount StorySequence on each variant change so the timer restarts.
  return (
    <main>
      <h1>Story preview</h1>
      <p className="dim-text">
        QA tool — walks through every story-stage variation with hardcoded
        inputs. Drop WebP files into <code>client/public/story/</code> and
        they appear here immediately.
      </p>

      <div className="form-actions" style={{ marginBottom: "1rem" }}>
        <button
          className="btn ghost"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          ‹ Previous
        </button>
        <span style={{ alignSelf: "center" }}>
          <strong>{current.label}</strong>
          <span className="dim-text"> ({index + 1}/{variants.length})</span>
        </span>
        <button
          className="btn primary"
          onClick={() => setIndex((i) => Math.min(variants.length - 1, i + 1))}
          disabled={index === variants.length - 1}
        >
          Next ›
        </button>
      </div>

      <PreviewPlayer key={index} result={result} />
    </main>
  );
}

function PreviewPlayer({ result }: { result: BallResult }) {
  const story = useStorySequence(result);
  return (
    <div className="reveal-inner" style={{ background: "#0f1419", padding: 0 }}>
      <StorySequence
        result={result}
        story={story}
        commentaryCtx={{
          inningsNumber: 1,
          ballNumber: result.ballNumber,
          ballsPerInnings: 6,
          runs: 0,
          wickets: 0,
          target: null,
          battingPlayerName: "Preview Batter",
          bowlingPlayerName: "Preview Bowler",
        }}
      />
      {story.isComplete && (
        <p className="dim-text" style={{ textAlign: "center", marginTop: "1rem" }}>
          Sequence complete — click Next ›
        </p>
      )}
    </div>
  );
}

/** Synthesize a minimal BallResult for the preview. Real fields come
 *  from the variant; the rest are stubs that satisfy the type. */
function makeStubResult(variant: Variant): BallResult {
  // Pull a real bowler + batter card from the roster so the bowler-
  // archetype lookup works.
  const bowler = CARDS.bowlers[0]!;
  const batter = CARDS.batsmen[0]!;
  const steps = (variant.extraStepKinds ?? []).map((kind) => ({
    kind,
    label: kind,
    detail: `Preview-injected ${kind}`,
    applied: true,
  }));

  return {
    ballNumber: 1,
    battingSelection: makeStubSel("A", batter),
    bowlingSelection: makeStubSel("B", bowler),
    lookupZone: bowler.delivery,
    finalOutcome: variant.outcome,
    extraRuns: 0,
    extrasNote: null,
    rebowled: false,
    resolutionSteps: steps as unknown as BallResult["resolutionSteps"],
  };
}

function makeStubSel(player: "A" | "B", card: BowlerCard | BatsmanCard) {
  return {
    player,
    mandatoryCard: card as BowlerCard,
    situationCard: null,
  } as BallResult["bowlingSelection"];
}
