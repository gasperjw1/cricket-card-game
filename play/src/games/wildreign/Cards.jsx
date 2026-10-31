import { isWild } from "@swipe-sixer/shared/games/wildreign";
import { GOLD, CARD_INK, FONT_DISPLAY, FONT_BODY, SUIT_COLOR, SP } from "./theme";

export const CARD_W = 54, CARD_H = 76;

// Traditional card face — rank+suit anchored in the top-left corner (mirrored
// bottom-right) rather than centered, so the identifying text stays legible on
// the visible sliver of a card even when heavily overlapped by its neighbors in
// a fanned hand. Matches the original single-player source's card design.
export function PlayingCard({ card, wild, selected, lifted, onClick, size = "md", dim }) {
  const dims = size === "sm" ? { w: 38, h: 54, fs: 12, cf: 22, p: 3 } : { w: CARD_W, h: CARD_H, fs: 15, cf: 30, p: 4 };
  const isJoker = card.rank === "JK";
  const color = wild ? GOLD : (SUIT_COLOR[card.suit] || CARD_INK);
  const raised = selected || lifted;
  const rankText = isJoker ? "JK" : card.rank;
  const suitText = isJoker ? "☆" : card.suit;
  const index = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
      <span style={{ fontSize: dims.fs, fontWeight: 800, color, fontFamily: FONT_DISPLAY }}>{rankText}</span>
      <span style={{ fontSize: dims.fs - 3, color, marginTop: 1 }}>{suitText}</span>
    </div>
  );
  return (
    <div onClick={onClick} style={{
      width: dims.w, height: dims.h, borderRadius: 6, flexShrink: 0, position: "relative",
      background: wild ? "linear-gradient(160deg,#3d2a5c,#241a38)" : "#fdf8ee",
      border: raised ? `2px solid ${GOLD}` : "1px solid rgba(0,0,0,0.3)",
      boxShadow: lifted
        ? "0 0 18px rgba(201,168,76,.65), 0 10px 22px rgba(0,0,0,.5)"
        : selected ? "0 0 0 2px rgba(201,168,76,.35), 0 6px 14px rgba(0,0,0,.45)"
        : "0 2px 6px rgba(0,0,0,.35)",
      cursor: onClick ? "pointer" : "default",
      transform: selected && !lifted ? "translateY(-8px)" : "none",
      transition: lifted ? "none" : "transform .12s, box-shadow .12s",
      userSelect: "none", opacity: dim ? 0.45 : 1, overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <span style={{ fontSize: dims.cf, color, opacity: 0.16, lineHeight: 1 }}>{suitText}</span>
      </div>
      <div style={{ position: "absolute", top: dims.p, left: dims.p + 1 }}>{index}</div>
      <div style={{ position: "absolute", bottom: dims.p, right: dims.p + 1, transform: "rotate(180deg)" }}>{index}</div>
    </div>
  );
}

// `stacked` renders a couple of offset shadow layers behind the front card so the
// draw pile reads as a stack of many cards rather than one flat rectangle.
export function CardBack({ size = "md", count, onClick, disabled, stacked, highlight }) {
  const dims = size === "sm" ? { w: 38, h: 54 } : { w: CARD_W, h: CARD_H };
  const layerStyle = (offset) => ({
    position: "absolute", left: offset, top: -offset, width: dims.w, height: dims.h, borderRadius: 6,
    background: "repeating-linear-gradient(135deg, #163417, #163417 4px, #102712 4px, #102712 8px)",
    border: "1px solid rgba(201,168,76,0.35)", boxShadow: "0 1px 4px rgba(0,0,0,.35)",
  });
  return (
    <div style={{ position: "relative", width: dims.w + (stacked ? 6 : 0), height: dims.h + (stacked ? 6 : 0) }}>
      {stacked && <div style={layerStyle(6)} />}
      {stacked && <div style={layerStyle(3)} />}
      <div onClick={disabled ? undefined : onClick} style={{
        position: stacked ? "absolute" : "static", left: 0, top: stacked ? 6 : 0,
        width: dims.w, height: dims.h, borderRadius: 6, flexShrink: 0,
        background: "repeating-linear-gradient(135deg, #1a3a1a, #1a3a1a 4px, #143014 4px, #143014 8px)",
        border: `1.5px solid ${GOLD}`, cursor: disabled ? "default" : "pointer",
        display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 4,
        opacity: disabled ? 0.4 : 1,
        boxShadow: highlight ? "0 0 14px rgba(201,168,76,0.6)" : "0 2px 8px rgba(0,0,0,.4)",
        transition: "box-shadow .15s",
      }}>
        {count != null && <span style={{ fontSize: 10, color: GOLD, fontFamily: FONT_BODY, fontWeight: 700 }}>{count}</span>}
      </div>
    </div>
  );
}

// Meld groups rendered as bordered chips in a flex-wrap row, so multiple melds
// sit side by side and use the available horizontal space (wrapping naturally
// on narrow/mobile screens) instead of stacking one-per-line.
export function MeldsDisplay({ hand, round, melds, melded }) {
  if (hand.length === 0) return null;
  const leftover = hand.map((c, i) => ({ c, i })).filter(({ i }) => !melded.has(i));
  return (
    <div style={{ marginTop: SP.md, display: "flex", flexWrap: "wrap", gap: SP.sm }}>
      {melds.map((m, mi) => (
        <div key={mi} style={{
          border: "1px solid rgba(74,222,128,0.35)", background: "rgba(74,222,128,0.06)",
          borderRadius: 8, padding: SP.xs,
        }}>
          <div style={{ fontSize: 9, color: "rgba(74,222,128,0.8)", letterSpacing: 1, textTransform: "uppercase", fontFamily: FONT_BODY, marginBottom: 4 }}>
            Meld {mi + 1}
          </div>
          <div style={{ display: "flex", gap: SP.xs }}>
            {m.map(i => <PlayingCard key={i} card={hand[i]} wild={isWild(hand[i], round)} size="sm" />)}
          </div>
        </div>
      ))}
      {leftover.length > 0 && (
        <div style={{
          border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.06)",
          borderRadius: 8, padding: SP.xs,
        }}>
          <div style={{ fontSize: 9, color: "rgba(239,68,68,0.75)", letterSpacing: 1, textTransform: "uppercase", fontFamily: FONT_BODY, marginBottom: 4 }}>
            Deadwood
          </div>
          <div style={{ display: "flex", gap: SP.xs }}>
            {leftover.map(({ c, i }) => <PlayingCard key={i} card={c} wild={isWild(c, round)} size="sm" dim />)}
          </div>
        </div>
      )}
    </div>
  );
}
