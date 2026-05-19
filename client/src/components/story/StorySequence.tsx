import type { BallResult } from "@swipe-sixer/shared";
import { commentaryFor, type CommentaryContext } from "../../lib/commentary.ts";
import { getSettings } from "../../lib/settings.ts";
import {
  BOWLER_IMAGES,
  DISMISSAL_IMAGES,
  PITCH_IMAGES,
  SHOT_IMAGES,
  SIGNAL_IMAGES,
  bowlerArchetype,
} from "./imageMap.ts";
import { StoryImage } from "./StoryImage.tsx";
import type { StoryStage, StoryState } from "./useStorySequence.ts";

interface Props {
  result: BallResult;
  story: StoryState;
  /** Match context for the commentary engine (innings, score, target). */
  commentaryCtx: CommentaryContext;
}

/** Renders the storytelling pre-roll. Each stage shows a StoryImage
 *  (real WebP if present in client/public/story/, emoji fallback if
 *  not) plus a caption. Phase 1 ships with all-emoji fallbacks; Phase
 *  2 adds the real images and they appear with no further code change.
 */
export function StorySequence({ result, story, commentaryCtx }: Props) {
  const stage = story.plan[story.currentIndex];
  if (!stage) return null;

  return (
    <div className="story-stage" key={story.currentIndex}>
      <StagePanel
        stage={stage}
        result={result}
        story={story}
        commentaryCtx={commentaryCtx}
      />
    </div>
  );
}

function StagePanel({
  stage,
  result,
  story,
  commentaryCtx,
}: {
  stage: StoryStage;
  result: BallResult;
  story: StoryState;
  commentaryCtx: CommentaryContext;
}) {
  switch (stage) {
    case "pitch":
      return (
        <div className="story-pitch">
          <StoryImage
            src={story.isDay5 ? PITCH_IMAGES["day-5"] : PITCH_IMAGES.regular}
            fallbackEmoji={story.isDay5 ? "🏜️" : "🟫"}
            alt={story.isDay5 ? "Day 5 cracked pitch" : "Regular pitch"}
          />
          <div className="story-caption">
            {story.isDay5 ? "Day 5 pitch — cracked surface" : "Pitch is clean"}
          </div>
        </div>
      );

    case "bowler": {
      // Bowling side's mandatoryCard is always a BowlerCard at runtime, but
      // the union type is BatsmanCard | BowlerCard. Narrow defensively.
      const bowlerCard = result.bowlingSelection.mandatoryCard;
      const archetype =
        bowlerCard.kind === "bowler" ? bowlerArchetype(bowlerCard) : "pace-rh";
      // If a wide or no-ball was called, show the umpire signal instead of
      // the bowler (signal is the dominant visual moment for that delivery).
      const signalSrc = story.hasNoBall
        ? SIGNAL_IMAGES["no-ball"]
        : story.hasWide
          ? SIGNAL_IMAGES.wide
          : null;
      return (
        <div className="story-bowler">
          <StoryImage
            src={signalSrc ?? BOWLER_IMAGES[archetype]}
            fallbackEmoji={story.hasNoBall ? "🚫" : story.hasWide ? "↔️" : "🤾"}
            alt={
              story.hasNoBall
                ? "Umpire signals no-ball"
                : story.hasWide
                  ? "Umpire signals wide"
                  : `Bowler delivery (${archetype})`
            }
          />
          <div className="story-caption">
            {story.hasNoBall && story.hasWide
              ? "🚫 No ball + wide!"
              : story.hasNoBall
                ? "🚫 No ball — foot over the line"
                : story.hasWide
                  ? "↔️ Wide — outside the batter's reach"
                  : "Bowler delivers"}
          </div>
        </div>
      );
    }

    case "batter":
      return (
        <div className="story-batter">
          <StoryImage
            src={batterImageSrc(result, story)}
            fallbackEmoji={batterFallbackEmoji(result, story)}
            alt={batterCaption(result, story)}
          />
          <div className="story-caption">{batterCaption(result, story)}</div>
        </div>
      );

    case "result": {
      const commentary = commentaryFor(
        result,
        commentaryCtx,
        getSettings().commentaryStyle,
      );
      return (
        <div className="story-result">
          <StoryImage
            src={resultImageSrc(result, story)}
            fallbackEmoji={resultEmoji(result, story)}
            alt={resultCaption(result, story)}
          />
          <div className="story-caption">{resultCaption(result, story)}</div>
          {commentary && (
            <div className="story-commentary">"{commentary}"</div>
          )}
        </div>
      );
    }

    case "drs":
      return (
        <div className="story-drs">
          <StoryImage
            src={SIGNAL_IMAGES.drs}
            fallbackEmoji="🤔"
            alt="Batter raises the T — DRS review"
          />
          <div className="story-caption">
            DRS Review — batter signals a T → 3rd umpire → <strong>Not out!</strong>
          </div>
        </div>
      );

    case "biryani":
      return (
        <div className="story-biryani">
          <StoryImage
            src={SIGNAL_IMAGES.biryani}
            fallbackEmoji="🍛"
            alt="Third umpire distracted by biryani — call cancelled"
          />
          <div className="story-caption">
            Third umpire distracted by biryani — call cancelled, dot ball
          </div>
        </div>
      );
  }
}

/** Pick the right image for the batter stage.
 *  Priority order: lucky escape → wicket dismissal → shot image → defend dot. */
function batterImageSrc(result: BallResult, story: StoryState): string {
  const o = result.finalOutcome;
  // Lucky escape: nearly dismissed — show the near-miss image rather than
  // the shot, since the dramatic moment is the bail wobble / spilled catch.
  if (story.hasLuckyEscape) return SIGNAL_IMAGES["lucky-escape"];
  // Run-out: the ball was hit normally (show shot); the wicket fell while
  // running — that's the result stage's job (runout dismissal image).
  if (story.isRunOut && o.type === "runs") return SHOT_IMAGES[o.shotCategory];
  // Standard wicket: show the dismissal type at contact.
  if (story.isWicket && o.type === "wicket") return DISMISSAL_IMAGES[o.dismissalCategory];
  // Runs (including power-surge upgrades): show the shot played.
  if (o.type === "runs") return SHOT_IMAGES[o.shotCategory];
  // Dot ball — defender crouching, shoulder arms, no contact.
  return SHOT_IMAGES.defend;
}

function batterFallbackEmoji(result: BallResult, story: StoryState): string {
  if (story.hasLuckyEscape) return "🍀";
  if (story.isWicket) return "💥";
  if (story.isRunOut) return "🏃";
  return "🏏";
}

/** Result-stage image: umpire signals for boundaries / wickets; lucky
 *  escape aftermath; run-out; Power Surge six. Falls back to emoji for
 *  1-run and 2-run outcomes (no umpire signal for those). */
function resultImageSrc(result: BallResult, story: StoryState): string {
  const o = result.finalOutcome;
  // Run-out: scramble + direct hit — the dismissal image covers this.
  if (story.isRunOut) return DISMISSAL_IMAGES["runout"];
  // Standard wicket — umpire raises the finger.
  if (story.isWicket && o.type === "wicket") return SIGNAL_IMAGES.out;
  // Lucky escape — the aftermath: bails on, catch grassed, finger stays down.
  if (story.hasLuckyEscape) return SIGNAL_IMAGES["lucky-escape"];
  // Boundaries — umpire signals (Power Surge may have pushed 4→6 here).
  if (o.type === "runs" && o.value === 6) return SIGNAL_IMAGES.six;
  if (o.type === "runs" && o.value === 4) return SIGNAL_IMAGES.four;
  // 1-run, 2-run, dot — no standard umpire signal; emoji fallback fires.
  return SHOT_IMAGES.defend;
}

function batterCaption(result: BallResult, story: StoryState): string {
  const o = result.finalOutcome;
  if (story.hasLuckyEscape) return "Near miss!";
  if (story.isRunOut && o.type === "runs") return `${o.shot} — running!`;
  if (story.isWicket && o.type === "wicket") return `Out — ${o.mode}`;
  if (o.type === "runs") return o.shot;
  return "Beaten — dot ball";
}

function resultEmoji(result: BallResult, story: StoryState): string {
  const o = result.finalOutcome;
  if (story.isRunOut) return "🏃";
  if (story.hasLuckyEscape) return "🍀";
  if (story.isWicket && o.type === "wicket") {
    switch (o.dismissalCategory) {
      case "bowled":  return "🎯";
      case "lbw":     return "🦵";
      case "stumped": return "🧤";
      case "runout":  return "🏃";
      default:        return "🤲";  // catches
    }
  }
  if (o.type === "runs") {
    if (story.hasPowerSurge && o.value === 6) return "⚡6️⃣";
    switch (o.value) {
      case 6: return "6️⃣";
      case 4: return "4️⃣";
      case 2: return "2️⃣";
      case 1: return "1️⃣";
      default: return "•";
    }
  }
  return "•";
}

function resultCaption(result: BallResult, story: StoryState): string {
  const o = result.finalOutcome;
  // Run-out: runs scored, but a wicket also fell.
  if (story.isRunOut && o.type === "runs") {
    return `RUN OUT — ${o.value} run${o.value === 1 ? "" : "s"}`;
  }
  if (story.isWicket && o.type === "wicket") {
    return `WICKET — ${o.dismissalCategory.replace(/-/g, " ")}`;
  }
  if (o.type === "runs") {
    const surge = story.hasPowerSurge ? " ⚡ Power Surge!" : "";
    return `${o.value} run${o.value === 1 ? "" : "s"}${surge}`;
  }
  // Lucky escape with byes — show the escape label from the resolution trail.
  if (story.hasLuckyEscape) {
    const escapeStep = result.resolutionSteps.find(
      (s) => s.kind === "lucky-escape" && s.applied,
    );
    return escapeStep?.label ?? "Lucky escape!";
  }
  return "Dot ball";
}
