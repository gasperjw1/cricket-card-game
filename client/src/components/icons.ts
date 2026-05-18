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
    description: "Swing — the ball curves through the air (out-swing, in-swing, or reverse swing on an old ball).",
  },
  Seam: {
    glyph: "〰️",
    description: "Seam — the ball deviates off the pitch on landing.",
  },
  Cutter: {
    glyph: "✂️",
    description: "Cutter — slower delivery with sharp deviation off the pitch.",
  },
  Slower: {
    glyph: "🐢",
    description: "Slower ball — drop in pace that fools the batter into mistiming the shot.",
  },
  Googly: {
    glyph: "🪄",
    description: "Googly — disguised wrong'un from a leg-spinner, turns the opposite direction.",
  },
  Carrom: {
    glyph: "🥏",
    description: "Carrom ball — flicked from the fingers, a finger-spinner's wrong'un.",
  },
  Topspin: {
    glyph: "🌪️",
    description: "Top-spin — the ball dips, kicks up, and skids on with extra bounce.",
  },
  Drift: {
    glyph: "🍃",
    description: "Drift — late swerve in the air for a spinner before pitching.",
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
    description:
      "Elite — top tier. Batters: 3 strengths, 2 neutrals, 1 weakness, ~7 of 8 adjective resistances. Bowlers carry 2 skills (no-stack rule).",
  },
  Gold: {
    color: "#d4a72c",
    description:
      "Gold — world-class. Batters: 2 strengths, 2 neutrals, 2 weaknesses, ~4-5 resistances. Bowlers carry 1 skill.",
  },
  Silver: {
    color: "#c0c5cd",
    description:
      "Silver — international regulars. Batters: 2 strengths, 1 neutral, 3 weaknesses, ~2-3 resistances. Bowlers have no skill.",
  },
  Bronze: {
    color: "#cd7f32",
    description:
      "Bronze — squad fillers. Batters: 1 strength, 2 neutrals, 3 weaknesses, no resistances. Bowlers have no skill.",
  },
};

export const LINE_ABBREV: Record<Line, string> = {
  "Leg stump": "Leg",
  "Middle stump": "Mid",
  "Off stump": "Off",
  "Outside off": "OutOff",
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
  Nepal: "🇳🇵",
  "Hong Kong": "🇭🇰",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  USA: "🇺🇸",
  Netherlands: "🇳🇱",
  Namibia: "🇳🇦",
};

/** Primary team color per nation — used to tint the scorebug strip
 *  and other small accents. Picked from each nation's traditional ODI/T20
 *  jersey palette. The shades are dark-mode-friendly (mid-saturation,
 *  legible white text on top). */
export const NATION_COLOR: Record<Nation, string> = {
  India: "#1e60a8",          // navy blue (ODI jersey)
  Australia: "#ffcd33",       // baggy gold
  England: "#1e3a8a",         // royal blue
  "South Africa": "#1d8a3a",  // protea green
  "New Zealand": "#111111",   // black caps
  Pakistan: "#0f5a2e",        // dark green
  "Sri Lanka": "#1e3a8a",     // dark blue (with yellow trim)
  "West Indies": "#7a1426",   // maroon
  Bangladesh: "#0a703a",      // dark green
  Zimbabwe: "#c7942c",        // gold/yellow
  Afghanistan: "#1a5fb4",     // blue
  Ireland: "#1a8745",         // shamrock green
  // Associates — generic blue/gray; rarely shown in WC matches anyway.
  Nepal: "#ad1f2e",
  "Hong Kong": "#b71c1c",
  Scotland: "#2563eb",
  USA: "#1a4d9c",
  Netherlands: "#ef6c00",
  Namibia: "#2a6b34",
};
