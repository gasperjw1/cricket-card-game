import type { Nation } from "@swipe-sixer/shared";

/** Pool of fun cricket-themed bot names. Picked at random per match. */
const BOT_NAMES = [
  "Bot McBowlface",
  "Captain Sixer",
  "The Spin King",
  "Boundary Bot",
  "Yorker Yogi",
  "Sir Slog-a-lot",
  "The Pinch Hitter",
  "Cover Drive",
  "Reverse Sweep Pete",
  "Captain Cover",
] as const;

/** All 18 nations the bot might represent. Random pick per match.
 *  Note: associate nations are included; if the bot picks one, the
 *  innings deck-builder falls back to a random multi-nation deck
 *  (see buildBotDeck in innings.ts). */
const ALL_NATIONS: readonly Nation[] = [
  "India", "Australia", "England", "South Africa", "New Zealand", "Pakistan",
  "Sri Lanka", "West Indies", "Bangladesh", "Zimbabwe", "Afghanistan", "Ireland",
  "Nepal", "Hong Kong", "Scotland", "USA", "Netherlands", "Namibia",
] as const;

/** Standard 2–3 letter cricket abbreviations per nation, used as the
 *  scorebug abbreviation for bots (so it looks like a real cricket
 *  scoreboard, e.g. "AUS", "IND", "WI"). */
const NATION_CODES: Record<Nation, string> = {
  India: "IND",
  Australia: "AUS",
  England: "ENG",
  "South Africa": "SA",
  "New Zealand": "NZ",
  Pakistan: "PAK",
  "Sri Lanka": "SL",
  "West Indies": "WI",
  Bangladesh: "BAN",
  Zimbabwe: "ZIM",
  Afghanistan: "AFG",
  Ireland: "IRE",
  Nepal: "NEP",
  "Hong Kong": "HK",
  Scotland: "SCO",
  USA: "USA",
  Netherlands: "NED",
  Namibia: "NAM",
};

export interface BotIdentity {
  name: string;
  nation: Nation;
  abbreviation: string;
}

export function pickBotIdentity(forcedNation?: Nation): BotIdentity {
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]!;
  const nation = forcedNation
    ?? ALL_NATIONS[Math.floor(Math.random() * ALL_NATIONS.length)]!;
  return { name, nation, abbreviation: NATION_CODES[nation] };
}
