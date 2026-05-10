import type { BallResult } from "@swipe-sixer/shared";
import type { StoryStage, StoryState } from "./useStorySequence.ts";

interface Props {
  result: BallResult;
  story: StoryState;
}

/** Renders the storytelling pre-roll: an animated sequence of pitch →
 *  bowler → batter → result → (DRS, Biryani if applicable). Phase 1
 *  uses emoji placeholders so we can validate timing/feel before
 *  sourcing real art (see docs/storytelling.md when it exists). */
export function StorySequence({ result, story }: Props) {
  const stage = story.plan[story.currentIndex];
  if (!stage) return null;

  return (
    <div className="story-stage" key={story.currentIndex}>
      <StagePanel stage={stage} result={result} story={story} />
    </div>
  );
}

function StagePanel({
  stage,
  result,
  story,
}: {
  stage: StoryStage;
  result: BallResult;
  story: StoryState;
}) {
  switch (stage) {
    case "pitch":
      return (
        <div className="story-pitch">
          <div className="story-emoji">{story.isDay5 ? "🏜️" : "🟫"}</div>
          <div className="story-caption">
            {story.isDay5 ? "Day 5 pitch — cracked surface" : "Pitch is clean"}
          </div>
        </div>
      );

    case "bowler":
      return (
        <div className="story-bowler">
          <div className="story-emoji">🤾</div>
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

    case "batter":
      return (
        <div className="story-batter">
          <div className="story-emoji">{story.isWicket ? "💥" : "🏏"}</div>
          <div className="story-caption">
            {batterCaption(result, story)}
          </div>
        </div>
      );

    case "result":
      return (
        <div className="story-result">
          <div className="story-emoji">{resultEmoji(result, story)}</div>
          <div className="story-caption">{resultCaption(result, story)}</div>
        </div>
      );

    case "drs":
      return (
        <div className="story-drs">
          <div className="story-emoji">🤔</div>
          <div className="story-caption">
            DRS Review — batter signals a T → 3rd umpire → <strong>Not out!</strong>
          </div>
        </div>
      );

    case "biryani":
      return (
        <div className="story-biryani">
          <div className="story-emoji">🍛</div>
          <div className="story-caption">
            Third umpire distracted by biryani — call cancelled, dot ball
          </div>
        </div>
      );
  }
}

function batterCaption(result: BallResult, story: StoryState): string {
  const o = result.finalOutcome;
  if (story.isWicket && o.type === "wicket") {
    return `Out — ${o.mode} (${o.dismissalCategory})`;
  }
  if (o.type === "runs") {
    return `${o.shot} (${o.shotCategory})`;
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
