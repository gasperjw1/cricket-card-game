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
      // If a wide or no-ball was called, overlay the umpire signal
      // image alongside the bowler emoji.
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
            fallbackEmoji={story.isWicket ? "💥" : "🏏"}
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
          <span className="story-emoji" role="img" aria-label="DRS review">
            🤔
          </span>
          <div className="story-caption">
            DRS Review — batter signals a T → 3rd umpire → <strong>Not out!</strong>
          </div>
        </div>
      );

    case "biryani":
      return (
        <div className="story-biryani">
          <span className="story-emoji" role="img" aria-label="Biryani umpire">
            🍛
          </span>
          <div className="story-caption">
            Third umpire distracted by biryani — call cancelled, dot ball
          </div>
        </div>
      );
  }
}

/** Pick the right image for the batter stage. For wickets we show the
 *  dismissal image; for runs we show the shot image. */
function batterImageSrc(result: BallResult, story: StoryState): string {
  const o = result.finalOutcome;
  if (story.isWicket && o.type === "wicket") {
    return DISMISSAL_IMAGES[o.dismissalCategory];
  }
  if (o.type === "runs") {
    return SHOT_IMAGES[o.shotCategory];
  }
  return SHOT_IMAGES.defend;  // dot ball → defensive
}

/** Result-stage image: for boundaries show the umpire signal (six/four
 *  via wide-arm signals); for wickets show "out" finger. Smaller
 *  outcomes (1, 2) and dots fall back to emoji. */
function resultImageSrc(result: BallResult, story: StoryState): string {
  const o = result.finalOutcome;
  if (story.isWicket && o.type === "wicket") return SIGNAL_IMAGES.out;
  if (o.type === "runs" && o.value === 6) return SIGNAL_IMAGES.six;
  // For 1, 2, 4, dot — no signal image yet. Fall through to emoji.
  return SHOT_IMAGES.defend;  // unused when emoji fallback fires; placeholder src
}

function batterCaption(result: BallResult, story: StoryState): string {
  const o = result.finalOutcome;
  if (story.isWicket && o.type === "wicket") {
    return `Out — ${o.mode}`;
  }
  if (o.type === "runs") {
    return o.shot;
  }
  return "Beaten — dot ball";
}

function resultEmoji(result: BallResult, story: StoryState): string {
  const o = result.finalOutcome;
  if (story.isWicket && o.type === "wicket") {
    switch (o.dismissalCategory) {
      case "bowled": return "🎯";
      case "lbw": return "🦵";
      case "stumped": return "🧤";
      case "runout": return "🏃";
      default: return "🤲";  // catches
    }
  }
  if (o.type === "runs") {
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
  if (story.isWicket && o.type === "wicket") {
    return `WICKET — ${o.dismissalCategory.replace("-", " ")}`;
  }
  if (o.type === "runs") return `${o.value} run${o.value === 1 ? "" : "s"}`;
  return "Dot ball";
}
