import type {
  Adjective,
  BowlerCard,
  DismissalCategory,
  ShotCategory,
} from "@swipe-sixer/shared";

/** Bowler archetypes — six distinct visual types. The card's adjective
 *  + the player's left/right hand (inferred from name? — see TODO)
 *  determines which one. For now we infer purely from adjective. */
export type BowlerArchetype =
  | "pace-rh"
  | "pace-lh"
  | "off-spin"
  | "leg-spin"
  | "la-orthodox"
  | "la-wrist";

/** Drop a webp file at any of these paths and it will appear in-game.
 *  Missing files render the corresponding emoji placeholder via
 *  StoryImage's onError handler. */

export const PITCH_IMAGES = {
  regular: "/story/pitches/regular.webp",
  "day-5": "/story/pitches/day-5.webp",
} as const;

export const BOWLER_IMAGES: Record<BowlerArchetype, string> = {
  "pace-rh": "/story/bowlers/pace-rh.webp",
  "pace-lh": "/story/bowlers/pace-lh.webp",
  "off-spin": "/story/bowlers/off-spin.webp",
  "leg-spin": "/story/bowlers/leg-spin.webp",
  "la-orthodox": "/story/bowlers/la-orthodox.webp",
  "la-wrist": "/story/bowlers/la-wrist.webp",
};

export const SHOT_IMAGES: Record<ShotCategory, string> = {
  "drive-straight": "/story/shots/drive-straight.webp",
  "drive-cover": "/story/shots/drive-cover.webp",
  "drive-off": "/story/shots/drive-off.webp",
  cut: "/story/shots/cut.webp",
  "late-cut": "/story/shots/late-cut.webp",
  pull: "/story/shots/pull.webp",
  flick: "/story/shots/flick.webp",
  glance: "/story/shots/glance.webp",
  sweep: "/story/shots/sweep.webp",
  "reverse-sweep": "/story/shots/reverse-sweep.webp",
  "loft-straight": "/story/shots/loft-straight.webp",
  "loft-off": "/story/shots/loft-off.webp",
  "loft-leg": "/story/shots/loft-leg.webp",
  slog: "/story/shots/slog.webp",
  ramp: "/story/shots/ramp.webp",
  scoop: "/story/shots/scoop.webp",
  defend: "/story/shots/defend.webp",
  mistime: "/story/shots/mistime.webp",
};

export const DISMISSAL_IMAGES: Record<DismissalCategory, string> = {
  bowled: "/story/dismissals/bowled.webp",
  lbw: "/story/dismissals/lbw.webp",
  "caught-keeper": "/story/dismissals/caught-keeper.webp",
  "caught-slip": "/story/dismissals/caught-slip.webp",
  "caught-cover": "/story/dismissals/caught-cover.webp",
  "caught-midwicket": "/story/dismissals/caught-midwicket.webp",
  "caught-point": "/story/dismissals/caught-point.webp",
  "caught-deep": "/story/dismissals/caught-deep.webp",
  "caught-and-bowled": "/story/dismissals/caught-and-bowled.webp",
  stumped: "/story/dismissals/stumped.webp",
  runout: "/story/dismissals/runout.webp",
};

export const SIGNAL_IMAGES = {
  "no-ball": "/story/signals/no-ball.webp",
  wide: "/story/signals/wide.webp",
  four: "/story/signals/four.webp",
  six: "/story/signals/six.webp",
  out: "/story/signals/out.webp",
  /** TV review — the T-signal raised by the batter calling for DRS. */
  drs: "/story/signals/drs.webp",
  /** Biryani distraction — umpire waving off the call, meal in hand. */
  biryani: "/story/signals/biryani.webp",
  /** Lucky escape — bails wobble or catch spilled; batter survives. */
  "lucky-escape": "/story/signals/lucky-escape.webp",
} as const;

/** Derive a bowler archetype from a BowlerCard. The adjective is the
 *  primary signal; for adjective-less Silver/Bronze bowlers we fall
 *  back to the line/length and length to guess pace vs spin. */
export function bowlerArchetype(card: BowlerCard): BowlerArchetype {
  const adj = card.adjectives[0] as Adjective | undefined;

  // Spin adjectives map directly
  if (adj === "Googly" || adj === "Topspin") return "leg-spin";
  if (adj === "Carrom") return "off-spin";
  if (adj === "Drift") {
    // Drift is most often LA orthodox (Shakib, Maharaj) but could be
    // off-spin too. Default LA orthodox; we accept some inaccuracy.
    return "la-orthodox";
  }

  // Pace adjectives — left/right is harder without an explicit field.
  // Naming heuristic: "Shaheen", "Boult", "Curran" are LH bowlers, but
  // generally we have no canonical signal. Default RH; this can be
  // refined later by adding a `handedness: "L" | "R"` field to BowlerCard.
  if (adj === "Swing" || adj === "Seam" || adj === "Cutter" || adj === "Slower") {
    return "pace-rh";
  }

  // No adjective (Silver/Bronze) — guess from length. Short = pace,
  // Good length = either; Full + Outside off = swing-like. Default pace.
  if (card.delivery.length === "Short") return "pace-rh";
  return "pace-rh";
}

/** All paths combined — used by the preloader. */
export function allStoryImagePaths(): string[] {
  return [
    ...Object.values(PITCH_IMAGES),
    ...Object.values(BOWLER_IMAGES),
    ...Object.values(SHOT_IMAGES),
    ...Object.values(DISMISSAL_IMAGES),
    ...Object.values(SIGNAL_IMAGES),
  ];
}
