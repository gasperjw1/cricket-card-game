import type {
  Adjective,
  FieldingRegion,
  Length,
  Line,
  Nation,
  Tier,
} from "@swipe-sixer/shared";

/**
 * Single source of truth for icon glyphs (emoji placeholders for v1) +
 * plain-English explanations for tooltips. Every adjective, fielding region,
 * tier, line, length, and nation has an entry here so the UI can render
 * either the icon or the description from one lookup.
 */

export interface IconInfo {
  glyph: string;
  /** Plain-English explanation shown in hover tooltip. */
  description: string;
}

export const ADJECTIVE_ICONS: Record<Adjective, IconInfo> = {
  Swing: {
    glyph: "🌬️",
    description: "Swing — the ball curves through the air. Rare batters are resistant.",
  },
  Seam: {
    glyph: "〰️",
    description: "Seam — the ball deviates off the pitch on landing.",
  },
  Cutter: {
    glyph: "✂️",
    description: "Cutter — slower delivery with sharp deviation off the pitch.",
  },
  Spin: {
    glyph: "🌀",
    description: "Spin — slow bowling with turn off the pitch (offspin, legspin, wrist spin).",
  },
  Pace: {
    glyph: "⚡",
    description: "Pace — extreme speed. Hurries the batter onto the back foot.",
  },
  Reverse: {
    glyph: "↩️",
    description: "Reverse — old-ball reverse swing, swings the opposite direction.",
  },
};

export const FIELDING_ICONS: Record<FieldingRegion, IconInfo> = {
  "Slip cordon": {
    glyph: "🥅",
    description: "Slip cordon — fielders behind the batter on the off side. Catches edges.",
  },
  "Gully/Point": {
    glyph: "👁️",
    description: "Gully / Point — square of the wicket on the off side. Cuts square drives.",
  },
  Cover: {
    glyph: "🛡️",
    description: "Cover — in front of square on the off side. Cuts cover drives.",
  },
  "Mid-wicket": {
    glyph: "⚔️",
    description: "Mid-wicket — square of the wicket on the leg side. Cuts pulls and flicks.",
  },
  "Fine leg/Leg slip": {
    glyph: "🦵",
    description: "Fine leg / Leg slip — behind the batter on the leg side. Cuts glances and scoops.",
  },
  "Short leg/Silly point": {
    glyph: "🪤",
    description: "Short leg / Silly point — close in. Cuts bat-pad catches.",
  },
};

export const TIER_INFO: Record<Tier, { color: string; description: string }> = {
  Elite: {
    color: "#f5d76e",
    description: "Elite — top tier. 3 strengths, 2 neutrals, 1 weakness, 2 resistances.",
  },
  Gold: {
    color: "#d4a72c",
    description: "Gold — 3 strengths, 2 neutrals, 1 weakness, 1 resistance.",
  },
  Silver: {
    color: "#c0c5cd",
    description: "Silver — 2 strengths, 2 neutrals, 2 weaknesses, no resistances.",
  },
  Bronze: {
    color: "#cd7f32",
    description: "Bronze — 1 strength, 2 neutrals, 3 weaknesses, no resistances.",
  },
};

export const LINE_ABBREV: Record<Line, string> = {
  "Leg stump": "Leg",
  "Middle stump": "Mid",
  "Off stump": "Off",
  "5th stump": "5th",
  "Wide outside off": "Wide",
};

export const LENGTH_ABBREV: Record<Length, string> = {
  Short: "Short",
  "Good length": "Good",
  Full: "Full",
};

export const NATION_FLAG: Record<Nation, string> = {
  India: "🇮🇳",
  Australia: "🇦🇺",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "South Africa": "🇿🇦",
  "New Zealand": "🇳🇿",
  Pakistan: "🇵🇰",
  "Sri Lanka": "🇱🇰",
  "West Indies": "🌴",
  Bangladesh: "🇧🇩",
  Zimbabwe: "🇿🇼",
  Afghanistan: "🇦🇫",
  Ireland: "🇮🇪",
};
