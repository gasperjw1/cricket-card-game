import type { Handedness } from "@swipe-sixer/shared";
import { Tip } from "./Tip.tsx";

/**
 * Minimalist batter-in-stance silhouette. SVG so it scales crisp at any
 * size; mirrored on the X axis for left-handers (the stance physically
 * flips at the crease).
 */
export function BatterSilhouette({
  handedness,
  size = 28,
}: {
  handedness: Handedness | undefined;
  size?: number;
}) {
  const isLeft = handedness === "left";
  const tip = `${isLeft ? "Left" : "Right"}-handed batter (stance shown facing ${isLeft ? "right" : "left"}).`;
  return (
    <Tip text={tip}>
      <span className="batter-silhouette" aria-label={tip}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          style={{ transform: isLeft ? "scaleX(-1)" : undefined }}
        >
          {/* Head */}
          <circle cx="11" cy="6" r="3" fill="currentColor" />
          {/* Helmet bar */}
          <rect x="7.5" y="6" width="7" height="0.8" fill="currentColor" opacity="0.55" />
          {/* Torso */}
          <path
            d="M9 9 L14 9 L15.5 18 L8 18 Z"
            fill="currentColor"
          />
          {/* Front leg (toward bowler) */}
          <path
            d="M10 18 L12 30 L9.5 30 L8 18 Z"
            fill="currentColor"
          />
          {/* Back leg */}
          <path
            d="M13 18 L17 28 L14.5 30 L11.5 18 Z"
            fill="currentColor"
            opacity="0.85"
          />
          {/* Bat */}
          <rect
            x="15"
            y="11"
            width="1.6"
            height="14"
            rx="0.6"
            fill="currentColor"
            transform="rotate(-25 15.8 18)"
          />
          {/* Hands gripping bat */}
          <circle cx="14.8" cy="13.5" r="1.3" fill="currentColor" />
        </svg>
        <span className="batter-silhouette-label">
          {isLeft ? "LH" : "RH"}
        </span>
      </span>
    </Tip>
  );
}
