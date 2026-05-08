import type {
  AnyCard,
  BatsmanCard,
  BatsmanOutcome,
  BowlerCard,
  Nation,
  SituationCard,
  Tier,
  Zone,
} from "@swipe-sixer/shared";
import { Tip } from "./Tip.tsx";
import {
  ADJECTIVE_ICONS,
  FIELDING_ICONS,
  LENGTH_ABBREV,
  LINE_ABBREV,
  NATION_FLAG,
  TIER_INFO,
} from "./icons.ts";

interface CardProps {
  card: AnyCard;
  /** "hand" = compact, "view" = full-detail (modal). */
  size?: "hand" | "view";
  selected?: boolean;
  faceDown?: boolean;
  /** Click handler. Hand-size cards usually open the viewer; view-size has its own buttons. */
  onClick?: () => void;
}

export function Card(props: CardProps) {
  if (props.faceDown) return <FaceDownCard size={props.size ?? "hand"} />;
  switch (props.card.kind) {
    case "batsman":
      return <BatsmanCardView {...props} card={props.card} />;
    case "bowler":
      return <BowlerCardView {...props} card={props.card} />;
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
  children: React.ReactNode;
}) {
  const tierColor = props.tier ? TIER_INFO[props.tier].color : undefined;
  const className = [
    "card",
    `card-${props.size}`,
    props.tier ? `tier-${String(props.tier).toLowerCase()}` : "tier-situation",
    props.selected ? "selected" : "",
    props.onClick ? "clickable" : "",
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

function BatsmanCardView(props: { card: BatsmanCard; size?: "hand" | "view"; selected?: boolean; onClick?: () => void }) {
  const size = props.size ?? "hand";
  const { card } = props;
  return (
    <CardFrame tier={card.tier} size={size} selected={props.selected} onClick={props.onClick} kindLabel="Batsman">
      <Header
        kindLabel="🏏 Batsman"
        kindLabelText="Batsman card — choose this as your mandatory play when you're batting."
        name={card.name}
        nation={card.nation}
        tier={card.tier}
      />
      {size === "view" && card.description && (
        <div className="card-flavor">{card.description}</div>
      )}
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
    </CardFrame>
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

function BowlerCardView(props: { card: BowlerCard; size?: "hand" | "view"; selected?: boolean; onClick?: () => void }) {
  const size = props.size ?? "hand";
  const { card } = props;
  return (
    <CardFrame tier={card.tier} size={size} selected={props.selected} onClick={props.onClick} kindLabel="Bowler">
      <Header
        kindLabel="🎯 Bowler"
        kindLabelText="Bowler card — choose this as your mandatory play when you're bowling."
        name={card.name}
        nation={card.nation}
        tier={card.tier}
      />
      {size === "view" && card.description && (
        <div className="card-flavor">{card.description}</div>
      )}
      <section className="card-section">
        <div className="card-section-title">
          <Tip text="The line and length this bowler attacks every ball.">Delivery</Tip>
        </div>
        <div className="delivery-zone">
          <ZoneBadge zone={card.delivery} large />
        </div>
      </section>
      <section className="card-section">
        <div className="card-section-title">
          <Tip text="The bowler's signature trait. If played against a non-resistant batter, every outcome is downgraded one tier.">
            Adjective
          </Tip>
        </div>
        <div className="adjective-row">
          {card.adjective ? (
            <Tip text={ADJECTIVE_ICONS[card.adjective].description}>
              <span className="adj-chip">
                <span className="adj-icon">{ADJECTIVE_ICONS[card.adjective].glyph}</span>
                <span>{card.adjective}</span>
              </span>
            </Tip>
          ) : (
            <Tip text="No adjective — this bowler doesn't apply a quality downgrade.">
              <span className="dim-text">none</span>
            </Tip>
          )}
        </div>
      </section>
      <section className="card-section">
        <div className="card-section-title">
          <Tip text="Fielding regions covered. If a shot lands here, the outcome is downgraded one tier.">
            Fielding
          </Tip>
        </div>
        <div className="fielding-row">
          {card.fielding.map((region) => (
            <Tip key={region} text={FIELDING_ICONS[region].description}>
              <span className="field-chip">
                <span className="adj-icon">{FIELDING_ICONS[region].glyph}</span>
                <span>{region}</span>
              </span>
            </Tip>
          ))}
        </div>
      </section>
    </CardFrame>
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
      <div className={`card-effect ${size}`}>{card.description}</div>
    </CardFrame>
  );
}

// ─────────────────────────── Header & shared bits ───────────────────────────

function Header(props: {
  kindLabel: string;
  kindLabelText: string;
  name: string;
  nation: Nation;
  tier: Tier;
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
