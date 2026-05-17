import type {
  BatsmanCard,
  BatsmanOutcome,
  BowlerCard,
  Handedness,
  Length,
  Line,
  Zone,
} from "@swipe-sixer/shared";
import { Tip } from "./Tip.tsx";

/**
 * Compact 3x4 pitch chart — rows are lengths (Short / Good / Full) and
 * columns are lines. Column order flips for left-handers so the
 * batter's leg side stays on the same physical side they'd see it from
 * the crease (left for righties, right for lefties).
 *
 * Two modes:
 *  - "batter": each cell is colored by the outcome the batter scores in
 *    that zone (6 / 4 / single / dot / wicket). Zones not on the card
 *    default to dot (matches engine's lookupOutcome behavior).
 *  - "bowler": only the bowler's delivery zone is filled; everything
 *    else dims so you instantly see *where they pitch it*.
 */

const ROWS: Length[] = ["Short", "Good length", "Full"];
const ROW_ABBREV: Record<Length, string> = {
  Short: "Sh",
  "Good length": "Gd",
  Full: "Fu",
};

/** Cricket-natural column order: leg side on the left (right-hander),
 *  outside off on the right. Lefties get the mirror. */
const COLS_RH: Line[] = ["Leg stump", "Middle stump", "Off stump", "Outside off"];
const COLS_LH: Line[] = ["Outside off", "Off stump", "Middle stump", "Leg stump"];
const COL_ABBREV: Record<Line, string> = {
  "Leg stump": "Leg",
  "Middle stump": "Mid",
  "Off stump": "Off",
  "Outside off": "Wide",
};

interface BatterProps {
  mode: "batter";
  card: BatsmanCard;
  /** Highlight a single zone (e.g. the bowler's delivery during reveal). */
  highlightZone?: Zone | null;
}

interface BowlerProps {
  mode: "bowler";
  card: BowlerCard;
  /** Reference handedness for the column order. Bowlers don't have a
   *  natural side, but the grid still needs an orientation; default RH
   *  matches the most common batter type. Pass "left" only when known. */
  perspective?: Handedness;
}

export function ZoneGrid(props: BatterProps | BowlerProps) {
  const handedness: Handedness =
    props.mode === "batter"
      ? props.card.handedness ?? "right"
      : props.perspective ?? "right";
  const cols = handedness === "left" ? COLS_LH : COLS_RH;

  return (
    <div className="zone-grid" data-handedness={handedness}>
      <div className="zone-grid-inner">
        {/* Row of column labels above the grid */}
        <div className="zone-grid-col-labels" aria-hidden="true">
          <span className="zone-grid-row-label-spacer" />
          {cols.map((line) => (
            <span key={line} className="zone-grid-col-label">
              {COL_ABBREV[line]}
            </span>
          ))}
        </div>
        {ROWS.map((length) => (
          <div key={length} className="zone-grid-row">
            <span className="zone-grid-row-label">{ROW_ABBREV[length]}</span>
            {cols.map((line) => (
              <ZoneCell
                key={`${length}-${line}`}
                zone={{ line, length }}
                {...props}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ZoneCell(
  props: (BatterProps | BowlerProps) & { zone: Zone },
) {
  if (props.mode === "batter") {
    return <BatterZoneCell card={props.card} zone={props.zone} highlightZone={props.highlightZone} />;
  }
  return <BowlerZoneCell card={props.card} zone={props.zone} />;
}

function BatterZoneCell({
  card,
  zone,
  highlightZone,
}: {
  card: BatsmanCard;
  zone: Zone;
  highlightZone?: Zone | null;
}) {
  const hit = findOutcome(card, zone);
  const isHighlighted =
    !!highlightZone &&
    highlightZone.line === zone.line &&
    highlightZone.length === zone.length;
  let cls = "zone-cell";
  let label = "";
  let tip = `${zone.length}, ${zone.line}: dot ball.`;
  if (hit) {
    if (hit.bucket === "weaknesses") {
      cls += " wicket";
      label = "W";
      tip = `${zone.length}, ${zone.line}: WICKET (${hit.outcome.outcome.type === "wicket" ? hit.outcome.outcome.mode : "out"}).`;
    } else if (hit.outcome.outcome.type === "runs") {
      const v = hit.outcome.outcome.value;
      cls += ` r-${v}`;
      label = String(v);
      tip = `${zone.length}, ${zone.line}: ${v} run${v === 1 ? "" : "s"} (${hit.outcome.outcome.shot}).`;
    }
  } else {
    cls += " dot";
    label = "·";
  }
  if (isHighlighted) cls += " highlighted";
  return (
    <Tip text={tip}>
      <span className={cls} aria-label={tip}>
        {label}
      </span>
    </Tip>
  );
}

function BowlerZoneCell({ card, zone }: { card: BowlerCard; zone: Zone }) {
  const isDelivery =
    card.delivery.line === zone.line && card.delivery.length === zone.length;
  const cls = isDelivery ? "zone-cell delivery" : "zone-cell empty";
  const label = isDelivery ? "●" : "·";
  const tip = isDelivery
    ? `${card.name} attacks ${zone.length}, ${zone.line}.`
    : `${zone.length}, ${zone.line}.`;
  return (
    <Tip text={tip}>
      <span className={cls} aria-label={tip}>
        {label}
      </span>
    </Tip>
  );
}

function findOutcome(
  card: BatsmanCard,
  zone: Zone,
): { bucket: "strengths" | "neutrals" | "weaknesses"; outcome: BatsmanOutcome } | null {
  for (const bucket of ["strengths", "neutrals", "weaknesses"] as const) {
    const o = card[bucket].find(
      (x) => x.zone.line === zone.line && x.zone.length === zone.length,
    );
    if (o) return { bucket, outcome: o };
  }
  return null;
}
