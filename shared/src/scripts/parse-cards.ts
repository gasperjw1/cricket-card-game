/**
 * Parses docs/card-roster.md and docs/situation-cards.md into typed JSON.
 *
 * Output: shared/src/data/cards.json
 *
 * Run via:  npm run parse-cards
 *
 * The parser is deliberately strict — it throws on any line it can't parse so
 * format drift in the markdown is caught immediately.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Adjective,
  BatsmanCard,
  BatsmanOutcome,
  BowlerCard,
  CardRoster,
  FieldingRegion,
  Length,
  Line,
  Nation,
  OutcomeKind,
  RunValue,
  SituationCard,
  SituationDeck,
  SituationEffectId,
  Tier,
  Zone,
} from "../types/cards.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROSTER_PATH = resolve(__dirname, "../../../docs/card-roster.md");
const SITUATION_PATH = resolve(__dirname, "../../../docs/situation-cards.md");
const OUTPUT_PATH = resolve(__dirname, "../data/cards.json");

const TIERS: Record<string, Tier> = {
  ELITE: "Elite",
  GOLD: "Gold",
  SILVER: "Silver",
  BRONZE: "Bronze",
};

// Order matters: longer/more specific phrases first so substring matching
// doesn't claim the wrong line. "Outside off" comes before "Off stump"
// because the latter is a substring of "off" but we match on the full
// phrase ordering anyway.
const LINES: Line[] = [
  "Outside off",
  "Off stump",
  "Middle stump",
  "Leg stump",
];

const LENGTHS: Length[] = ["Good length", "Short", "Full"];

const ADJECTIVES: Adjective[] = [
  "Swing",
  "Seam",
  "Cutter",
  "Slower",
  "Googly",
  "Carrom",
  "Topspin",
  "Drift",
];

/**
 * Legacy adjective names (pre-rebalance) that may still appear in the
 * markdown source. Mapped to either a current adjective (Reverse → Swing)
 * or null (Pace, Spin — generic kinds were removed; bowlers using these
 * end up adjective-less, with Phase 2 to manually reassign Gold/Elite
 * bowlers a specific variation).
 */
const LEGACY_ADJECTIVE_MAP: Record<string, Adjective | null> = {
  Reverse: "Swing",
  Pace: null,
  Spin: null,
};

const NATION_BY_HEADER: Record<string, Nation> = {
  INDIA: "India",
  AUSTRALIA: "Australia",
  ENGLAND: "England",
  "SOUTH AFRICA": "South Africa",
  "NEW ZEALAND": "New Zealand",
  PAKISTAN: "Pakistan",
  "SRI LANKA": "Sri Lanka",
  "WEST INDIES": "West Indies",
  BANGLADESH: "Bangladesh",
  ZIMBABWE: "Zimbabwe",
  AFGHANISTAN: "Afghanistan",
  IRELAND: "Ireland",
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Legacy line names from the pre-rebalance grid. Both 5th stump and Wide
 * outside off collapse to the unified "Outside off" line.
 */
const LEGACY_LINE_MAP: Record<string, Line> = {
  "5th stump": "Outside off",
  "wide outside off": "Outside off",
};

function parseZone(raw: string): Zone {
  const lower = raw.toLowerCase().trim();
  let line: Line | null = null;
  let zoneRest = lower;

  // Check legacy names first — longer phrases match before "off stump" etc.
  for (const legacy of Object.keys(LEGACY_LINE_MAP)) {
    const idx = lower.indexOf(legacy);
    if (idx >= 0) {
      line = LEGACY_LINE_MAP[legacy]!;
      zoneRest = (lower.slice(0, idx) + lower.slice(idx + legacy.length)).trim();
      break;
    }
  }

  if (!line) {
    for (const l of LINES) {
      const idx = lower.indexOf(l.toLowerCase());
      if (idx >= 0) {
        line = l;
        zoneRest = (lower.slice(0, idx) + lower.slice(idx + l.length)).trim();
        break;
      }
    }
  }

  let length: Length | null = null;
  for (const ln of LENGTHS) {
    if (zoneRest.includes(ln.toLowerCase())) {
      length = ln;
      break;
    }
  }

  if (!line || !length) {
    throw new Error(`Could not parse zone: "${raw}"`);
  }
  return { line, length };
}

function parseOutcomeText(text: string, isWicket: boolean): OutcomeKind {
  const trimmed = text.trim();
  if (isWicket) {
    return { type: "wicket", mode: trimmed };
  }
  const runsMatch = trimmed.match(/^(.*?)\s+for\s+(\d+)\s*$/i);
  if (!runsMatch) {
    throw new Error(`Could not parse runs outcome: "${text}"`);
  }
  const runs = parseInt(runsMatch[2]!, 10);
  if (![0, 1, 2, 4, 6].includes(runs)) {
    throw new Error(`Invalid run value ${runs} in "${text}"`);
  }
  return {
    type: "runs",
    value: runs as RunValue,
    shot: runsMatch[1]!.trim(),
  };
}

function parseOutcomeBullet(line: string, isWicket: boolean): BatsmanOutcome {
  const arrowIdx = line.indexOf("→");
  if (arrowIdx < 0) throw new Error(`Missing arrow in "${line}"`);
  const zoneStr = line.slice(0, arrowIdx).trim();
  const outcomeStr = line.slice(arrowIdx + 1).trim();
  return {
    zone: parseZone(zoneStr),
    outcome: parseOutcomeText(outcomeStr, isWicket),
  };
}

function parseOutcomeList(rawList: string, isWicket: boolean): BatsmanOutcome[] {
  const parts = rawList.split("|").map((p) => p.trim()).filter(Boolean);
  return parts.map((p) => parseOutcomeBullet(p, isWicket));
}

/**
 * Parse a single adjective name, with legacy migration.
 * - Returns null for legacy `Pace` and `Spin` (generic kinds removed in
 *   v1.1; dropped from data — Phase 2 reassigns Gold/Elite bowlers
 *   specific variations).
 * - Returns `Swing` for legacy `Reverse` (folded into Swing).
 * - Throws on truly unknown adjective names.
 */
function parseAdjective(raw: string): Adjective | null {
  const stripped = raw.replace(/\(.*?\)/g, "").trim();
  const match = ADJECTIVES.find(
    (a) => a.toLowerCase() === stripped.toLowerCase(),
  );
  if (match) return match;
  // Legacy migration: case-insensitive match against legacy keys.
  const legacyKey = Object.keys(LEGACY_ADJECTIVE_MAP).find(
    (k) => k.toLowerCase() === stripped.toLowerCase(),
  );
  if (legacyKey) return LEGACY_ADJECTIVE_MAP[legacyKey] ?? null;
  throw new Error(`Unknown adjective: "${raw}"`);
}

/**
 * Parse a comma-separated list of adjectives. Legacy entries are mapped or
 * dropped. Resulting array is deduplicated. Empty array means no adjective.
 *
 * Parenthetical clarifications (e.g. "Swing (inswing, left-arm)") are
 * stripped BEFORE splitting on commas so we don't fragment them.
 */
function parseAdjectiveList(raw: string): Adjective[] {
  const cleaned = raw.replace(/\([^)]*\)/g, "").trim();
  const parts = cleaned.split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);
  const out: Adjective[] = [];
  for (const part of parts) {
    const adj = parseAdjective(part);
    if (adj && !out.includes(adj)) out.push(adj);
  }
  return out;
}

function parseFielding(raw: string): FieldingRegion[] {
  const parts = raw.split(/[+,]/).map((p) => p.trim());
  const result: FieldingRegion[] = [];
  for (const p of parts) {
    const norm = normalizeFieldingRegion(p);
    if (norm) result.push(norm);
  }
  if (result.length === 0) {
    throw new Error(`Unrecognized fielding: "${raw}"`);
  }
  return result;
}

function normalizeFieldingRegion(raw: string): FieldingRegion | null {
  const lower = raw.toLowerCase();
  // Order matters: more-specific phrases first so "Silly point" doesn't
  // match the generic "point" check (which would map to Gully/Point).
  if (lower.includes("slip cordon") || lower === "slip" || lower === "slips")
    return "Slip cordon";
  if (lower.includes("short leg") || lower.includes("silly point"))
    return "Short leg/Silly point";
  if (lower.includes("fine leg") || lower.includes("leg slip"))
    return "Fine leg/Leg slip";
  if (lower.includes("gully") || lower.includes("point"))
    return "Gully/Point";
  if (lower.includes("cover")) return "Cover";
  if (lower.includes("mid-wicket") || lower.includes("midwicket"))
    return "Mid-wicket";
  return null;
}

interface CardSection {
  nation: Nation;
  mode: "batsmen" | "bowlers";
  cards: string[][]; // each card = list of its lines (excluding the H3 header)
  headers: string[]; // matching H3 line for each card
}

function splitRosterIntoSections(md: string): CardSection[] {
  const sections: CardSection[] = [];
  const lines = md.split("\n");

  let nation: Nation | null = null;
  let mode: "batsmen" | "bowlers" | null = null;
  let current: CardSection | null = null;
  let currentCardLines: string[] | null = null;
  let currentCardHeader: string | null = null;

  const flushCard = () => {
    if (current && currentCardHeader && currentCardLines) {
      current.headers.push(currentCardHeader);
      current.cards.push(currentCardLines);
    }
    currentCardHeader = null;
    currentCardLines = null;
  };

  const flushSection = () => {
    flushCard();
    if (current) sections.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith("# ")) {
      // H1 — could be nation marker for non-India sections, or stop marker.
      const stripped = line.replace(/^#\s+/, "").trim();
      if (/TOTAL CARD COUNT/i.test(stripped)) {
        flushSection();
        break;
      }
      // try to extract nation from emoji + name
      const nationCandidate = stripped
        .replace(/[^A-Za-z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
      if (NATION_BY_HEADER[nationCandidate]) {
        flushSection();
        nation = NATION_BY_HEADER[nationCandidate];
        mode = null;
      }
      continue;
    }

    if (line.startsWith("## ")) {
      const stripped = line.replace(/^##\s+/, "").trim();
      // INDIA section: "## 🇮🇳 INDIA — BATSMEN" or BOWLERS
      const indiaMatch = stripped.match(/INDIA\s+—\s+(BATSMEN|BOWLERS)/i);
      const plainMatch = stripped.match(/^(BATSMEN|BOWLERS)\s*$/i);
      let newMode: "batsmen" | "bowlers" | null = null;
      if (indiaMatch) {
        nation = "India";
        newMode = indiaMatch[1]!.toUpperCase() === "BATSMEN" ? "batsmen" : "bowlers";
      } else if (plainMatch) {
        newMode = plainMatch[1]!.toUpperCase() === "BATSMEN" ? "batsmen" : "bowlers";
      }
      if (newMode && nation) {
        flushSection();
        mode = newMode;
        current = { nation, mode, cards: [], headers: [] };
      } else {
        // Non-card H2 (e.g. "Weakness Distribution", "Bowler vs Weakness Matchup Map")
        // closes any in-progress card section so stray H3s don't leak in.
        flushSection();
        mode = null;
      }
      continue;
    }

    if (line.startsWith("### ")) {
      // New card
      flushCard();
      currentCardHeader = line;
      currentCardLines = [];
      continue;
    }

    if (currentCardLines) {
      currentCardLines.push(line);
    }
  }
  flushSection();
  return sections;
}

function parseTierAndName(header: string): { tier: Tier; name: string } {
  // "### ELITE — Virat Kohli"
  const m = header.match(/^###\s+(ELITE|GOLD|SILVER|BRONZE)\s+—\s+(.+)$/);
  if (!m) throw new Error(`Could not parse card header: "${header}"`);
  const tier = TIERS[m[1]!.toUpperCase()];
  if (!tier) throw new Error(`Unknown tier in header: "${header}"`);
  return { tier, name: m[2]!.trim() };
}

function extractDescription(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(/^\*(.+)\*$/);
    if (m) return m[1]!.trim();
  }
  return "";
}

function parseBatsman(
  header: string,
  body: string[],
  nation: Nation,
): BatsmanCard {
  const { tier, name } = parseTierAndName(header);
  const description = extractDescription(body);

  const strengths: BatsmanOutcome[] = [];
  const neutrals: BatsmanOutcome[] = [];
  const weaknesses: BatsmanOutcome[] = [];
  let resistances: Adjective[] = [];

  // Mode A: compact — `- **Strengths:** outcome | outcome`
  // Mode B: India — `- **Strengths:**` then indented `  - outcome`
  let currentSection: "strengths" | "neutrals" | "weaknesses" | null = null;

  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;

    const compactMatch = line.match(
      /^-\s+\*\*(Strengths|Neutrals|Weaknesses|Resistances):\*\*\s*(.+)?$/,
    );
    if (compactMatch) {
      const sectionName = compactMatch[1]!.toLowerCase();
      const inline = compactMatch[2]?.trim() ?? "";
      if (sectionName === "resistances") {
        currentSection = null;
        if (inline) {
          resistances = inline
            .split(/[,]/)
            .map((s) => s.trim())
            .filter((s) => s && s.toLowerCase() !== "none")
            .map(parseAdjective)
            .filter((a): a is Adjective => a !== null);
        }
        continue;
      }
      currentSection = sectionName as "strengths" | "neutrals" | "weaknesses";
      const isWicket = currentSection === "weaknesses";
      if (inline) {
        const list = parseOutcomeList(inline, isWicket);
        getBucket(currentSection, strengths, neutrals, weaknesses).push(...list);
      }
      continue;
    }

    // Indented bullet "  - outcome"
    const indentedMatch = line.match(/^-\s+(.+)$/);
    if (indentedMatch && currentSection) {
      const isWicket = currentSection === "weaknesses";
      const outcome = parseOutcomeBullet(indentedMatch[1]!, isWicket);
      getBucket(currentSection, strengths, neutrals, weaknesses).push(outcome);
    }
  }

  return {
    id: `${slug(name)}-bat`,
    kind: "batsman",
    name,
    nation,
    tier,
    description,
    strengths,
    neutrals,
    weaknesses,
    resistances,
  };
}

function getBucket(
  section: "strengths" | "neutrals" | "weaknesses",
  s: BatsmanOutcome[],
  n: BatsmanOutcome[],
  w: BatsmanOutcome[],
): BatsmanOutcome[] {
  return section === "strengths" ? s : section === "neutrals" ? n : w;
}

function parseBowler(
  header: string,
  body: string[],
  nation: Nation,
): BowlerCard {
  const { tier, name } = parseTierAndName(header);
  const description = extractDescription(body);

  let delivery: Zone | null = null;
  let adjectives: Adjective[] = [];
  let fielding: FieldingRegion[] = [];

  for (const raw of body) {
    const line = raw.trim();
    if (!line.startsWith("- ")) continue;

    // Compact: `- **Delivery:** X | **Adjective:** Y, Z | **Fielding:** ...`
    // Multi-line: each `- **Field:** X` on its own line
    // `Adjective:` accepts comma-separated values (Elite bowlers can have 2).
    const fields = line.replace(/^-\s+/, "").split(/\s*\|\s*/);
    for (const field of fields) {
      const m = field.match(/^\*\*(Delivery|Adjective|Adjectives|Fielding):\*\*\s*(.+)$/);
      if (!m) continue;
      const key = m[1]!.toLowerCase();
      const value = m[2]!.trim();
      if (key === "delivery") delivery = parseZone(value);
      else if (key === "adjective" || key === "adjectives") {
        adjectives = parseAdjectiveList(value);
      } else if (key === "fielding") fielding = parseFielding(value);
    }
  }

  if (!delivery) {
    throw new Error(`Bowler missing Delivery: "${header}"`);
  }
  if (fielding.length === 0) {
    throw new Error(`Bowler missing Fielding: "${header}"`);
  }

  // v1.1 rebalance: Bronze and Silver bowlers carry no adjective. Strip
  // any adjective we parsed from legacy data for these tiers so the
  // generated JSON matches the new tier rules.
  if (tier === "Bronze" || tier === "Silver") {
    adjectives = [];
  }

  return {
    id: `${slug(name)}-bowl`,
    kind: "bowler",
    name,
    nation,
    tier,
    description,
    delivery,
    adjectives,
    fielding,
  };
}

function parseRoster(md: string): { batsmen: BatsmanCard[]; bowlers: BowlerCard[] } {
  const sections = splitRosterIntoSections(md);
  const batsmen: BatsmanCard[] = [];
  const bowlers: BowlerCard[] = [];

  for (const section of sections) {
    for (let i = 0; i < section.cards.length; i++) {
      const header = section.headers[i]!;
      const body = section.cards[i]!;
      try {
        if (section.mode === "batsmen") {
          batsmen.push(parseBatsman(header, body, section.nation));
        } else {
          bowlers.push(parseBowler(header, body, section.nation));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(
          `[${section.nation} ${section.mode}] ${header}: ${message}`,
        );
      }
    }
  }

  return { batsmen, bowlers };
}

// ───── Situation cards ─────

const SITUATION_NAME_TO_ID: Record<string, SituationEffectId> = {
  "DRS Review": "drs-review",
  "Power Surge": "power-surge",
  "Retired Out": "retired-out",
  "Switch Hit": "switch-hit",
  "Trot Down": "trot-down",
  "No Ball": "no-ball",
  "Shuffle Across": "shuffle-across",
  "Deep in the Crease": "deep-in-crease",
  Mankad: "mankad",
  "Review Appeal": "review-appeal",
  Cramps: "cramps",
  "Invariable Bounce": "invariable-bounce",
  "Day 5 Pitch": "day-5-pitch",
  "Third Umpire Distracted by Biryani": "biryani",
};

function parseSituationCards(md: string): SituationCard[] {
  const cards: SituationCard[] = [];
  const lines = md.split("\n");

  let deck: SituationDeck | null = null;
  let currentName: string | null = null;
  let currentBody: string[] = [];

  const flush = () => {
    if (!currentName || !deck) {
      currentName = null;
      currentBody = [];
      return;
    }
    const name = currentName;
    const body = currentBody.join("\n").trim();
    const flavor = (body.match(/^\*"(.+?)"\*/m)?.[1] ?? "").trim();
    // description = body minus flavor line, until first horizontal rule or end
    const description = body
      .replace(/^\*".+?"\*/m, "")
      .replace(/^\*\*When to play:\*\*[\s\S]*$/m, "")
      .trim();

    const isOldSchool = /Old School Cricket Only/i.test(name);
    let id: SituationEffectId;
    if (isOldSchool) {
      id = deck === "batting" ? "old-school-batting" : "old-school-bowling";
    } else {
      const lookup = SITUATION_NAME_TO_ID[name];
      if (!lookup) {
        throw new Error(`Unknown situation card name: "${name}"`);
      }
      id = lookup;
    }

    cards.push({
      id,
      kind: "situation",
      name: isOldSchool ? "Old School Cricket Only" : name,
      flavor,
      description,
      deck,
    });
    currentName = null;
    currentBody = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^##\s+BATTING SITUATION CARDS/i.test(line)) {
      flush();
      deck = "batting";
      continue;
    }
    if (/^##\s+BOWLING SITUATION CARDS/i.test(line)) {
      flush();
      deck = "bowling";
      continue;
    }
    if (/^##\s+Summary Table/i.test(line)) {
      flush();
      break;
    }
    const h3 = line.match(/^###\s+\d+\.\s+(.+?)(\s+\*\(.+\)\*)?\s*$/);
    if (h3) {
      flush();
      currentName = h3[1]!.trim();
      continue;
    }
    if (currentName !== null) {
      currentBody.push(line);
    }
  }
  flush();
  return cards;
}

function main(): void {
  const rosterMd = readFileSync(ROSTER_PATH, "utf8");
  const situationsMd = readFileSync(SITUATION_PATH, "utf8");

  const { batsmen, bowlers } = parseRoster(rosterMd);
  const situations = parseSituationCards(situationsMd);

  // Sanity checks
  const ids = new Set<string>();
  for (const c of [...batsmen, ...bowlers, ...situations]) {
    if (ids.has(c.id)) {
      throw new Error(`Duplicate card id: ${c.id}`);
    }
    ids.add(c.id);
  }

  console.log(`Parsed ${batsmen.length} batsmen, ${bowlers.length} bowlers, ${situations.length} situation cards.`);

  if (batsmen.length !== 132) {
    throw new Error(`Expected 132 batsmen, got ${batsmen.length}`);
  }
  if (bowlers.length !== 132) {
    throw new Error(`Expected 132 bowlers, got ${bowlers.length}`);
  }
  // 8 batting + 6 bowling + 2 Old School variants = 16 entries in v1.1
  // (added Deep in the Crease batting + Third Umpire Distracted by Biryani bowling)
  if (situations.length !== 16) {
    throw new Error(`Expected 16 situation cards (8 batting + 6 bowling + 2 Old School variants), got ${situations.length}`);
  }

  const roster: CardRoster = { batsmen, bowlers, situations };
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(roster, null, 2) + "\n");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main();
