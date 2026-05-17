import { useState } from "react";
import type {
  Adjective,
  AnyCard,
  BatsmanCard,
  BatsmanOutcome,
  BowlerCard,
  FieldingRegion,
  Nation,
  SituationCard,
  Tier,
  Zone,
} from "@swipe-sixer/shared";
import { BatterSilhouette } from "./BatterSilhouette.tsx";
import { CardEffectText } from "./CardEffectText.tsx";
import { Tip } from "./Tip.tsx";
import { ZoneGrid } from "./ZoneGrid.tsx";
import {
  ADJECTIVE_ICONS,
  FIELDING_ICONS,
  LENGTH_ABBREV,
  LINE_ABBREV,
  NATION_FLAG,
  TIER_INFO,
} from "./icons.ts";

/**
 * When set, the card renders in "reveal" mode — only attributes that fired
 * this ball are shown. Computed by the InningsScreen from BallResult after
 * resolution completes.
 */
export interface RevealContext {
  /** Zone matched on the batsman's card (post-modifiers). */
  lookupZone: Zone;
  /**
   * The single adjective that actually fired on this ball (the one that
   * downgraded the outcome). Null if the bowler has no adjective, or if
   * all adjectives were resisted, or if no downgrade applied.
   */
  firedAdjective: Adjective | null;
  /** Fielding region that intercepted the shot, if any. */
  firedFielding: FieldingRegion | null;
}

interface CardProps {
  card: AnyCard;
  /** "hand" = compact, "view" = full-detail (modal). */
  size?: "hand" | "view";
  selected?: boolean;
  faceDown?: boolean;
  /** Click handler. Hand-size cards usually open the viewer; view-size has its own buttons. */
  onClick?: () => void;
  /** When set, filter the card to only show what fired this ball. */
  reveal?: RevealContext;
}

export function Card(props: CardProps) {
  if (props.faceDown) return <FaceDownCard size={props.size ?? "hand"} />;
  switch (props.card.kind) {
    case "batsman":
      return <BatsmanCardView {...props} card={props.card} reveal={props.reveal} />;
    case "bowler":
      return <BowlerCardView {...props} card={props.card} reveal={props.reveal} />;
    case "situation":
      return <SituationCardView {...props} card={props.card} />;
  }
}

// ─────────────────────────── Shared frame ───────────────────────────

function CardFrame(props: {
  tier?: Tier;
  size: "hand" | "view";
  selected?: boolean;
  onClick?: () => void;
  kindLabel: string;
  revealMode?: boolean;
  children: React.ReactNode;
}) {
  const tierColor = props.tier ? TIER_INFO[props.tier].color : undefined;
  const className = [
    "card",
    `card-${props.size}`,
    props.tier ? `tier-${String(props.tier).toLowerCase()}` : "tier-situation",
    props.selected ? "selected" : "",
    props.onClick ? "clickable" : "",
    props.revealMode ? "reveal" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={className}
      onClick={props.onClick}
      role={props.onClick ? "button" : undefined}
      tabIndex={props.onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (props.onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          props.onClick();
        }
      }}
      style={tierColor ? { borderColor: tierColor } : undefined}
    >
      {props.children}
    </div>
  );
}

// ─────────────────────────── Batsman ───────────────────────────

function BatsmanCardView(props: { card: BatsmanCard; size?: "hand" | "view"; selected?: boolean; onClick?: () => void; reveal?: RevealContext }) {
  const size = props.size ?? "hand";
  const { card } = props;
  const reveal = props.reveal;
  // In reveal mode, find which bucket (if any) the lookup zone matched.
  const firedRow = reveal ? findFiredOutcome(card, reveal.lookupZone) : null;

  // Hand-size cards default to the Summary tab (description + silhouette).
  // The grid takes a second tap. View-size shows everything stacked.
  // Reveal mode forces the grid + fired-row to be visible inline.
  return (
    <CardFrame tier={card.tier} size={size} selected={props.selected} onClick={props.onClick} kindLabel="Batsman" revealMode={!!reveal}>
      <Header
        kindLabel="🏏 Batsman"
        kindLabelText="Batsman card — choose this as your mandatory play when you're batting."
        name={card.name}
        nation={card.nation}
        tier={card.tier}
        rightExtra={<BatterSilhouette handedness={card.handedness} size={size === "view" ? 32 : 26} />}
      />
      {reveal ? (
        <>
          <ZoneGrid mode="batter" card={card} highlightZone={reveal.lookupZone} />
          <RevealBatterSection
            card={card}
            lookupZone={reveal.lookupZone}
            firedRow={firedRow}
          />
          <RevealResistances
            list={card.resistances}
            firedAdjective={reveal.firedAdjective}
          />
        </>
      ) : size === "hand" ? (
        <BatsmanHandBody card={card} />
      ) : (
        <>
          {card.description && <div className="card-flavor">{card.description}</div>}
          <ZoneGrid mode="batter" card={card} />
          <Section
            title="Strengths"
            titleTip="Zones where this batter scores boundaries. The first number is runs."
            outcomes={card.strengths}
            size={size}
            emphasis="strong"
          />
          <Section
            title="Neutrals"
            titleTip="Zones where this batter scores 1 or 2."
            outcomes={card.neutrals}
            size={size}
            emphasis="neutral"
          />
          <Section
            title="Weaknesses"
            titleTip="Zones where this batter gets out. Wickets bypass adjective downgrades."
            outcomes={card.weaknesses}
            size={size}
            emphasis="weak"
          />
          <Resistances list={card.resistances} size={size} />
        </>
      )}
    </CardFrame>
  );
}

/** Compact body shown when a batsman is in the hand. Two tabs:
 *   Summary — short description (truncated) + resistance icons + "tap for details"
 *   Shots   — the 3x4 zone grid
 *  Defaults to Summary so the first thing the player sees is who the
 *  card is, not what they score where. */
function BatsmanHandBody({ card }: { card: BatsmanCard }) {
  const [tab, setTab] = useState<"summary" | "shots">("summary");
  return (
    <div className="card-hand-body" onClick={(e) => e.stopPropagation()}>
      <CardTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "summary", label: "Summary" },
          { id: "shots", label: "Shots" },
        ]}
      />
      {tab === "summary" ? (
        <div className="card-tab-pane card-tab-summary">
          {card.description && (
            <p className="card-flavor compact">{firstSentence(card.description)}</p>
          )}
          <Resistances list={card.resistances} size="hand" />
          <span className="card-hand-hint">Tap card for full details</span>
        </div>
      ) : (
        <div className="card-tab-pane card-tab-shots">
          <ZoneGrid mode="batter" card={card} />
        </div>
      )}
    </div>
  );
}

/** In reveal mode, render only the row that fired (if any). */
function RevealBatterSection({
  card,
  lookupZone,
  firedRow,
}: {
  card: BatsmanCard;
  lookupZone: Zone;
  firedRow: { bucket: "strengths" | "neutrals" | "weaknesses"; outcome: BatsmanOutcome } | null;
}) {
  if (!firedRow) {
    return (
      <section className="card-section reveal dot">
        <div className="card-section-title">
          <Tip text="The bowler's effective delivery zone (after any zone modifiers) didn't match a row on this batter's card.">
            No matching zone
          </Tip>
        </div>
        <div className="reveal-zone-row">
          <ZoneBadge zone={lookupZone} />
          <span className="zone-arrow">→</span>
          <span className="shot dim-text">not on this card</span>
        </div>
        <div className="dim-text reveal-zone-hint">
          Bowler's effective delivery (after any zone modifiers).
        </div>
      </section>
    );
  }
  void card;
  const sectionClass =
    firedRow.bucket === "strengths" ? "strong" : firedRow.bucket === "neutrals" ? "neutral" : "weak";
  const sectionLabel =
    firedRow.bucket === "strengths" ? "Strength" : firedRow.bucket === "neutrals" ? "Neutral" : "Weakness";
  const sectionTip =
    firedRow.bucket === "strengths"
      ? "This batter's strength zone fired — runs would have been scored before any downgrades."
      : firedRow.bucket === "neutrals"
        ? "This batter's neutral zone fired — small score before any downgrades."
        : "This batter's weakness zone fired — they're out (unless DRS Review or No Ball saves them).";
  return (
    <section className={`card-section ${sectionClass} reveal fired`}>
      <div className="card-section-title">
        <Tip text={sectionTip}>{sectionLabel} matched</Tip>
      </div>
      <ul>
        <li className="fired-row">
          <ZoneBadge zone={firedRow.outcome.zone} />
          <span className="zone-arrow">→</span>
          {firedRow.outcome.outcome.type === "runs" ? (
            <>
              <span className="shot">{firedRow.outcome.outcome.shot}</span>
              <span className={`runs-pill r-${firedRow.outcome.outcome.value}`}>
                {firedRow.outcome.outcome.value}
              </span>
            </>
          ) : firedRow.outcome.outcome.type === "wicket" ? (
            <>
              <span className="shot">{firedRow.outcome.outcome.mode}</span>
              <span className="wicket-pill">W</span>
            </>
          ) : null}
        </li>
      </ul>
    </section>
  );
}

function findFiredOutcome(
  card: BatsmanCard,
  zone: Zone,
): { bucket: "strengths" | "neutrals" | "weaknesses"; outcome: BatsmanOutcome } | null {
  for (const bucket of ["strengths", "neutrals", "weaknesses"] as const) {
    const found = card[bucket].find(
      (o) => o.zone.line === zone.line && o.zone.length === zone.length,
    );
    if (found) return { bucket, outcome: found };
  }
  return null;
}

function RevealResistances({
  list,
  firedAdjective,
}: {
  list: BatsmanCard["resistances"];
  firedAdjective: Adjective | null;
}) {
  // No resistances at all — nothing to show in reveal mode.
  if (list.length === 0) return null;
  return (
    <div className="card-resistances reveal">
      <Tip text="Batter resistances. The one matching the bowler's firing adjective (if any) is highlighted; others didn't apply this ball.">
        <span className="resist-label">Resists</span>
      </Tip>
      <span className="resist-icons">
        {list.map((adj) => {
          const isFiredMatch = firedAdjective === adj;
          return (
            <Tip
              key={adj}
              text={
                isFiredMatch
                  ? `Resistance to ${adj} blocked the bowler's adjective.`
                  : ADJECTIVE_ICONS[adj].description
              }
            >
              <span className={`adj-icon${isFiredMatch ? "" : " dim"}`}>
                {ADJECTIVE_ICONS[adj].glyph}
              </span>
            </Tip>
          );
        })}
      </span>
    </div>
  );
}

function Section(props: {
  title: string;
  titleTip: string;
  outcomes: BatsmanOutcome[];
  size: "hand" | "view";
  emphasis: "strong" | "neutral" | "weak";
}) {
  if (props.outcomes.length === 0) return null;
  return (
    <section className={`card-section ${props.emphasis}`}>
      <div className="card-section-title">
        <Tip text={props.titleTip}>{props.title}</Tip>
      </div>
      <ul>
        {props.outcomes.map((o, i) => (
          <li key={i}>
            <ZoneBadge zone={o.zone} />
            <span className="zone-arrow">→</span>
            {o.outcome.type === "runs" ? (
              <>
                <span className="shot">{o.outcome.shot}</span>
                <span className={`runs-pill r-${o.outcome.value}`}>{o.outcome.value}</span>
              </>
            ) : o.outcome.type === "wicket" ? (
              <>
                <span className="shot">{o.outcome.mode}</span>
                <Tip text="Wicket — this delivery zone gets the batter out.">
                  <span className="wicket-pill">W</span>
                </Tip>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Resistances(props: { list: BatsmanCard["resistances"]; size: "hand" | "view" }) {
  if (props.list.length === 0) {
    return (
      <div className="card-resistances empty">
        {props.size === "view" && (
          <Tip text="This batter has no resistances — every adjective downgrades their outcomes.">
            <span className="dim-text">No resistances</span>
          </Tip>
        )}
      </div>
    );
  }
  return (
    <div className="card-resistances">
      <Tip text="Resistances cancel a bowler's adjective downgrade. If the bowler's adjective matches one of these icons, the outcome is not downgraded.">
        <span className="resist-label">Resists</span>
      </Tip>
      <span className="resist-icons">
        {props.list.map((adj) => (
          <Tip key={adj} text={ADJECTIVE_ICONS[adj].description}>
            <span className="adj-icon">{ADJECTIVE_ICONS[adj].glyph}</span>
          </Tip>
        ))}
      </span>
    </div>
  );
}

// ─────────────────────────── Bowler ───────────────────────────

function BowlerCardView(props: { card: BowlerCard; size?: "hand" | "view"; selected?: boolean; onClick?: () => void; reveal?: RevealContext }) {
  const size = props.size ?? "hand";
  const { card, reveal } = props;
  return (
    <CardFrame tier={card.tier} size={size} selected={props.selected} onClick={props.onClick} kindLabel="Bowler" revealMode={!!reveal}>
      <Header
        kindLabel="🎯 Bowler"
        kindLabelText="Bowler card — choose this as your mandatory play when you're bowling."
        name={card.name}
        nation={card.nation}
        tier={card.tier}
      />
      {reveal ? (
        <>
          <ZoneGrid mode="bowler" card={card} />
          <BowlerSkillsRow card={card} reveal={reveal} />
          <BowlerFieldingRow card={card} reveal={reveal} />
        </>
      ) : size === "hand" ? (
        <BowlerHandBody card={card} />
      ) : (
        <>
          {card.description && <div className="card-flavor">{card.description}</div>}
          <ZoneGrid mode="bowler" card={card} />
          <BowlerSkillsRow card={card} />
          <BowlerFieldingRow card={card} />
        </>
      )}
    </CardFrame>
  );
}

/** Compact hand body for bowler cards. Same tab pattern as batters. */
function BowlerHandBody({ card }: { card: BowlerCard }) {
  const [tab, setTab] = useState<"summary" | "delivery">("summary");
  return (
    <div className="card-hand-body" onClick={(e) => e.stopPropagation()}>
      <CardTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "summary", label: "Summary" },
          { id: "delivery", label: "Delivery" },
        ]}
      />
      {tab === "summary" ? (
        <div className="card-tab-pane card-tab-summary">
          {card.description && (
            <p className="card-flavor compact">{firstSentence(card.description)}</p>
          )}
          <BowlerSkillsRow card={card} />
          <span className="card-hand-hint">Tap card for full details</span>
        </div>
      ) : (
        <div className="card-tab-pane card-tab-shots">
          <ZoneGrid mode="bowler" card={card} />
          <BowlerFieldingRow card={card} />
        </div>
      )}
    </div>
  );
}

function BowlerSkillsRow({ card, reveal }: { card: BowlerCard; reveal?: RevealContext }) {
  if (card.adjectives.length === 0) {
    return (
      <div className="adjective-row">
        <Tip text="No skill — this bowler doesn't apply a quality downgrade.">
          <span className="dim-text">no skill</span>
        </Tip>
      </div>
    );
  }
  return (
    <div className="adjective-row">
      {card.adjectives.map((adj) => {
        const fired = reveal?.firedAdjective === adj;
        const inReveal = !!reveal;
        const blocked = inReveal && !fired;
        return (
          <Tip
            key={adj}
            text={
              fired
                ? `${adj} fired — outcome was downgraded one tier.`
                : blocked
                  ? `${adj} did not fire (resisted by the batter, or not the firing adjective per the no-stack rule).`
                  : ADJECTIVE_ICONS[adj].description
            }
          >
            <span
              className={`adj-chip${fired ? " fired" : ""}${blocked ? " blocked" : ""}`}
            >
              <span className="adj-icon">{ADJECTIVE_ICONS[adj].glyph}</span>
              <span>{adj}</span>
            </span>
          </Tip>
        );
      })}
    </div>
  );
}

function BowlerFieldingRow({ card, reveal }: { card: BowlerCard; reveal?: RevealContext }) {
  return (
    <div className="fielding-row">
      {card.fielding.map((region) => {
        const fired = reveal?.firedFielding === region;
        const dim = reveal && !fired;
        return (
          <Tip
            key={region}
            text={
              fired
                ? `${region} intercepted the shot — outcome downgraded one tier.`
                : FIELDING_ICONS[region].description
            }
          >
            <span className={`field-chip${fired ? " fired" : ""}${dim ? " dim" : ""}`}>
              <span className="adj-icon">{FIELDING_ICONS[region].glyph}</span>
              <span>{region}</span>
            </span>
          </Tip>
        );
      })}
    </div>
  );
}

// ─────────────────────────── Situation ───────────────────────────

function SituationCardView(props: { card: SituationCard; size?: "hand" | "view"; selected?: boolean; onClick?: () => void }) {
  const size = props.size ?? "hand";
  const { card } = props;
  return (
    <CardFrame size={size} selected={props.selected} onClick={props.onClick} kindLabel="Situation">
      <header className="card-header">
        <div className="card-header-row">
          <Tip text="Situation card — optional second play each ball, alongside your batsman or bowler. One-time use.">
            <span className="kind-label">⚡ Situation</span>
          </Tip>
          <span className={`deck-pill ${card.deck}`}>{card.deck}</span>
        </div>
        <div className="card-name">{card.name}</div>
      </header>
      {card.flavor && <div className="card-flavor">"{card.flavor}"</div>}
      {size === "hand" ? (
        // Hand: one-line summary. The full rule text only appears in
        // the modal viewer — saves a lot of vertical space when 3-4
        // situation cards are in hand at once.
        <>
          <div className="card-effect compact">
            {firstSentence(card.description)}
          </div>
          <span className="card-hand-hint">Tap card for full effect text</span>
        </>
      ) : (
        <div className={`card-effect ${size}`}>
          <CardEffectText text={card.description} />
        </div>
      )}
    </CardFrame>
  );
}

/** Pull the first sentence out of a (possibly markdown-flavored)
 *  description, lightly cleaned. Used for the compact hand-size view
 *  on both player cards and situation cards. */
function firstSentence(text: string): string {
  // Trim markdown bullets/emphasis off the front, then take everything
  // up to the first sentence-ending `.` or hard line break.
  const cleaned = text.replace(/\*\*/g, "").replace(/^\s+/, "");
  const firstLineBreak = cleaned.indexOf("\n");
  const lineCandidate =
    firstLineBreak === -1 ? cleaned : cleaned.slice(0, firstLineBreak);
  const sentenceMatch = lineCandidate.match(/^[^.!?]+[.!?]/);
  const result = (sentenceMatch ? sentenceMatch[0] : lineCandidate).trim();
  // Strip trailing `:` (often left over from "this ball:" → bullet list).
  return result.replace(/[:]$/, ".");
}

/** Lightweight segmented tab control used inside hand-size cards. */
function CardTabs<T extends string>(props: {
  active: T;
  onChange: (id: T) => void;
  tabs: { id: T; label: string }[];
}) {
  return (
    <div className="card-tabs" role="tablist" onClick={(e) => e.stopPropagation()}>
      {props.tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={props.active === t.id}
          className={`card-tab ${props.active === t.id ? "active" : ""}`}
          onClick={(e) => {
            // Don't bubble into the card's onClick (which opens the modal).
            e.stopPropagation();
            props.onChange(t.id);
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────── Header & shared bits ───────────────────────────

function Header(props: {
  kindLabel: string;
  kindLabelText: string;
  name: string;
  nation: Nation;
  tier: Tier;
  /** Optional element pinned to the right of the name row — used for the
   *  batter silhouette so the handedness chip lives in the header. */
  rightExtra?: React.ReactNode;
}) {
  return (
    <header className="card-header">
      <div className="card-header-row">
        <Tip text={props.kindLabelText}>
          <span className="kind-label">{props.kindLabel}</span>
        </Tip>
        <Tip text={TIER_INFO[props.tier].description}>
          <span className="tier-pill" style={{ background: TIER_INFO[props.tier].color }}>
            {props.tier}
          </span>
        </Tip>
      </div>
      <div className="card-name-row">
        <Tip text={props.nation}>
          <span className="nation-flag">{NATION_FLAG[props.nation]}</span>
        </Tip>
        <span className="card-name">{props.name}</span>
        {props.rightExtra && <span className="card-header-right">{props.rightExtra}</span>}
      </div>
    </header>
  );
}

function ZoneBadge({ zone, large }: { zone: Zone; large?: boolean }) {
  return (
    <Tip text={`${zone.length} ${zone.line}`}>
      <span className={`zone-badge${large ? " large" : ""}`}>
        <span className="zone-length">{LENGTH_ABBREV[zone.length]}</span>
        <span className="zone-line">{LINE_ABBREV[zone.line]}</span>
      </span>
    </Tip>
  );
}

// ─────────────────────────── Face-down (opponent) ───────────────────────────

function FaceDownCard({ size }: { size: "hand" | "view" }) {
  return (
    <div className={`card card-${size} face-down`}>
      <div className="face-down-content">
        <span className="face-down-emblem">🏏</span>
      </div>
    </div>
  );
}
