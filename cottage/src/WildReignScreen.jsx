import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { FC_SUITS, FC_RANKS, wildRank, isWild, cardPts, autoMeldHand } from "@swipe-sixer/shared/games/wildreign";

// ─── Design tokens — deliberately distinct from the cottage's cream palette ───
const FELT      = "#0f3d1f";
const FELT_DARK = "#0a2815";
const GOLD      = "#c9a84c";
const IVORY     = "#f8f3e8";
const CARD_INK  = "#20241f";
const FONT_DISPLAY = "'Playfair Display', serif";
const FONT_BODY    = "'Lato', sans-serif";
const SUIT_COLOR = { "♠": CARD_INK, "♥": "#ef4444", "♦": "#3b82f6", "♣": "#22c55e", "★": GOLD, "☆": "#a855f7" };

// Small, consistent spacing scale — replaces the previous ad hoc pixel values.
const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

const CARD_W = 54, CARD_GAP = SP.sm, NATURAL_STEP = CARD_W + CARD_GAP, CARD_H = 76, MIN_STEP = 26;

function other(house) { return house === "left" ? "right" : "left"; }

function sortedHand(hand) {
  return [...hand].sort((a, b) => {
    if (a.rank === "JK" && b.rank === "JK") return 0;
    if (a.rank === "JK") return 1;
    if (b.rank === "JK") return -1;
    const si = FC_SUITS.indexOf(a.suit) - FC_SUITS.indexOf(b.suit);
    return si !== 0 ? si : FC_RANKS.indexOf(a.rank) - FC_RANKS.indexOf(b.rank);
  });
}

function cardLabel(card) {
  if (!card) return "";
  return card.rank === "JK" ? "a Joker" : `${card.rank}${card.suit}`;
}

function describeMove(entry, displayName) {
  switch (entry.type) {
    case "dealt": return `Round ${entry.round} dealt`;
    case "draw": return `${displayName(entry.house)} drew from the ${entry.source === "discard" ? "discard pile" : "deck"}`;
    case "discard": return `${displayName(entry.house)} discarded ${cardLabel(entry.card)}`;
    case "goOut": return `${displayName(entry.house)} went out! 🏆`;
    case "pass": return `${displayName(entry.house)} continued their turn`;
    default: return "";
  }
}

// Tracks a container's rendered width so the hand can compress to fit instead
// of overflowing into a horizontal scrollbar.
function useMeasuredWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// ─── Small UI pieces ────────────────────────────────────────────────────────
function GButton({ children, onClick, disabled, variant = "default", style }) {
  const base = {
    padding: "10px 20px", borderRadius: 8, border: "none", cursor: disabled ? "default" : "pointer",
    fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, letterSpacing: 0.3,
    opacity: disabled ? 0.4 : 1, transition: "opacity .15s",
  };
  const variants = {
    default: { background: "rgba(255,255,255,0.08)", color: IVORY },
    gold:    { background: `linear-gradient(180deg, ${GOLD}, #a07830)`, color: "#1a1207" },
    danger:  { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

function HeaderToggle({ active, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer",
      color: active ? GOLD : "rgba(248,243,232,0.6)", fontFamily: FONT_BODY, fontSize: 13, fontWeight: active ? 700 : 400,
    }}>
      {label}
    </button>
  );
}

// Traditional card face — rank+suit anchored in the top-left corner (mirrored
// bottom-right) rather than centered, so the identifying text stays legible on
// the visible sliver of a card even when heavily overlapped by its neighbors in
// a fanned hand. Matches the original single-player source's card design.
function PlayingCard({ card, wild, selected, lifted, onClick, size = "md", dim }) {
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
function CardBack({ size = "md", count, onClick, disabled, stacked, highlight }) {
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

// Absolutely-positioned hand row supporting pointer-drag reordering (mouse + touch,
// via the Pointer Events API) with a lift/scale/glow visual while dragging, and
// tap-to-select still working for cards that are barely moved (<5px). The card
// spacing (`step`) compresses to fit the measured container width instead of
// overflowing into a horizontal scrollbar.
function HandRow({ hand, round, selectedId, onSelectCard, onReorder }) {
  const [containerRef, containerWidth] = useMeasuredWidth();
  const [dragId, setDragId] = useState(null);
  const [dragDx, setDragDx] = useState(0);
  const [dropIndex, setDropIndex] = useState(null);
  const dragInfoRef = useRef(null);

  const n = hand.length;
  const step = n > 1
    ? (containerWidth > 0 ? Math.min(NATURAL_STEP, Math.max(MIN_STEP, (containerWidth - CARD_W) / (n - 1))) : NATURAL_STEP)
    : NATURAL_STEP;

  function handlePointerDown(id, e) {
    // A previous gesture's pointerup/pointercancel can occasionally be lost
    // (pointer capture edge cases, trackpad jitter, a focus change mid-drag),
    // which would otherwise leave a card stuck showing the "lifted" gold glow
    // forever while selectedId stays null — self-heal on the next touch.
    if (dragInfoRef.current) { dragInfoRef.current = null; setDragId(null); setDragDx(0); setDropIndex(null); }
    const originIndex = hand.findIndex(c => c.id === id);
    dragInfoRef.current = { id, originIndex, startX: e.clientX, startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e) {
    const info = dragInfoRef.current;
    if (!info) return;
    const dx = e.clientX - info.startX;
    const dy = e.clientY - info.startY;
    if (!info.moved && Math.abs(dx) + Math.abs(dy) > 5) {
      info.moved = true;
      setDragId(info.id);
    }
    if (!info.moved) return;
    setDragDx(dx);
    const rawIndex = info.originIndex + Math.round(dx / step);
    setDropIndex(Math.max(0, Math.min(hand.length - 1, rawIndex)));
  }

  function endDrag() {
    const info = dragInfoRef.current;
    dragInfoRef.current = null;
    if (!info) return;
    if (info.moved) {
      if (dropIndex !== null && dropIndex !== info.originIndex) {
        const ids = hand.map(c => c.id);
        const [moved] = ids.splice(info.originIndex, 1);
        ids.splice(dropIndex, 0, moved);
        onReorder?.(ids);
      }
    } else {
      onSelectCard?.(selectedId === info.id ? null : info.id);
    }
    setDragId(null); setDragDx(0); setDropIndex(null);
  }

  // Safety net: if pointer capture ever fails to deliver the release event to
  // the container (browser/OS quirk), a window-level listener still clears the
  // drag state shortly after the physical pointer comes up.
  useEffect(() => {
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  });

  const originIndex = dragId !== null ? hand.findIndex(c => c.id === dragId) : null;

  return (
    <div ref={containerRef} style={{ overflowX: "auto", paddingBottom: SP.xs }}>
      <div
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ position: "relative", height: CARD_H + SP.sm, width: "100%" }}
      >
        {hand.map((c, i) => {
          const isDrag = dragId === c.id;
          let slot = i;
          if (originIndex !== null && !isDrag && dropIndex !== null) {
            if (originIndex < dropIndex && i > originIndex && i <= dropIndex) slot = i - 1;
            else if (originIndex > dropIndex && i >= dropIndex && i < originIndex) slot = i + 1;
          }
          return (
            <div
              key={c.id}
              onPointerDown={(e) => handlePointerDown(c.id, e)}
              style={{
                position: "absolute", left: slot * step, top: SP.sm,
                zIndex: isDrag ? 50 : i,
                transform: isDrag ? `translate(${dragDx}px, -${SP.sm}px) scale(1.06)` : "none",
                transition: isDrag ? "none" : "left .15s ease",
                touchAction: "none", cursor: "grab",
              }}
            >
              <PlayingCard card={c} wild={isWild(c, round)} selected={selectedId === c.id} lifted={isDrag} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Meld groups rendered as bordered chips in a flex-wrap row, so multiple melds
// sit side by side and use the available horizontal space (wrapping naturally
// on narrow/mobile screens) instead of stacking one-per-line.
function MeldsDisplay({ hand, round, melds, melded }) {
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

// Both sides highlighted gold when it's their turn — self-highlight is the fix
// for "no visual cue that it's your turn."
function ScoreBar({ gs, myHouse, myName, partnerName }) {
  const myScore = myHouse === "left" ? gs.leftScore : gs.rightScore;
  const partnerScore = myHouse === "left" ? gs.rightScore : gs.leftScore;
  const myTurn = gs.turnHouse === myHouse;
  const partnerTurn = gs.turnHouse === other(myHouse);
  const cellStyle = (active) => ({
    textAlign: "left", padding: "4px 10px", borderRadius: 8,
    background: active ? "rgba(201,168,76,0.15)" : "transparent",
    border: active ? `1px solid ${GOLD}` : "1px solid transparent",
  });
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 2px" }}>
      <div style={cellStyle(myTurn)}>
        <div style={{ fontSize: 10, color: "rgba(248,243,232,0.5)", fontFamily: FONT_BODY }}>{myName}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: IVORY, fontFamily: FONT_DISPLAY }}>{myScore}</div>
        {myTurn && <div style={{ fontSize: 9, color: GOLD, fontWeight: 700 }}>{gs.wentOut !== null ? "FINAL TURN" : "YOUR TURN"}</div>}
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "rgba(201,168,76,0.6)", letterSpacing: 1.5, fontFamily: FONT_BODY, textTransform: "uppercase" }}>
          Round {gs.round}/11
        </div>
        <div style={{ fontSize: 12, color: GOLD, fontFamily: FONT_BODY, fontWeight: 700, marginTop: 2 }}>
          {wildRank(gs.round)}s Wild
        </div>
      </div>
      <div style={{ ...cellStyle(partnerTurn), textAlign: "right" }}>
        <div style={{ fontSize: 10, color: "rgba(248,243,232,0.5)", fontFamily: FONT_BODY }}>{partnerName}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: IVORY, fontFamily: FONT_DISPLAY }}>{partnerScore}</div>
        {partnerTurn && <div style={{ fontSize: 9, color: GOLD, fontWeight: 700 }}>{gs.wentOut !== null ? "FINAL TURN" : "THEIR TURN"}</div>}
      </div>
    </div>
  );
}

function RoundScoresTable({ roundScores, myHouse, myName, partnerName }) {
  if (!roundScores || roundScores.length === 0) {
    return (
      <div style={{ marginTop: SP.lg, textAlign: "center", color: "rgba(248,243,232,0.4)", fontFamily: FONT_BODY, fontSize: 12 }}>
        No rounds completed yet.
      </div>
    );
  }
  return (
    <div style={{ marginTop: SP.lg }}>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "6px 4px",
        borderBottom: "1px solid rgba(201,168,76,0.2)", fontSize: 10, color: "rgba(201,168,76,0.6)",
        fontFamily: FONT_BODY, textTransform: "uppercase", letterSpacing: 0.5,
      }}>
        <span>Round</span><span style={{ textAlign: "center" }}>{myName}</span><span style={{ textAlign: "right" }}>{partnerName}</span>
      </div>
      {roundScores.map(r => (
        <div key={r.round} style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "5px 4px", fontSize: 13,
          color: IVORY, fontFamily: FONT_BODY, borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          <span>{r.round}</span>
          <span style={{ textAlign: "center" }}>{r[myHouse]}</span>
          <span style={{ textAlign: "right" }}>{r[other(myHouse)]}</span>
        </div>
      ))}
    </div>
  );
}

function MoveLog({ moveLog, displayName }) {
  const recent = (moveLog ?? []).slice(-3).reverse();
  if (recent.length === 0) {
    return (
      <div style={{ marginTop: SP.sm, textAlign: "center", color: "rgba(248,243,232,0.4)", fontFamily: FONT_BODY, fontSize: 12 }}>
        No moves yet.
      </div>
    );
  }
  return (
    <div style={{ marginTop: SP.sm, padding: `${SP.xs}px ${SP.sm}px`, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
      {recent.map((entry, i) => (
        <div key={i} style={{ fontSize: 12, color: "rgba(248,243,232,0.7)", fontFamily: FONT_BODY, padding: "3px 0" }}>
          • {describeMove(entry, displayName)}
        </div>
      ))}
    </div>
  );
}

function WildReignShell({ children, onBack, rightAction }) {
  return (
    <div style={{ width: "100%", maxWidth: 700, margin: "0 auto" }}>
      <div style={{
        background: `linear-gradient(180deg, ${FELT}, ${FELT_DARK})`,
        borderRadius: 16, padding: "18px 18px 22px",
        boxShadow: "0 16px 48px rgba(0,0,0,.35)",
        border: "1px solid rgba(201,168,76,0.25)",
        minHeight: 420,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SP.xs }}>
          <button onClick={onBack} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(248,243,232,0.6)", fontFamily: FONT_BODY, fontSize: 13,
          }}>← Outside</button>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, color: GOLD }}>Wild Reign</div>
          <div style={{ minWidth: 100, textAlign: "right", display: "flex", gap: SP.sm, justifyContent: "flex-end" }}>{rightAction}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function IntroPanel() {
  return (
    <div style={{ textAlign: "center", padding: "14px 8px" }}>
      <div style={{ fontSize: 11, letterSpacing: 3, color: "rgba(201,168,76,0.5)", marginBottom: 6, fontFamily: FONT_BODY, textTransform: "uppercase" }}>
        A Two-Player Card Game
      </div>
      <div style={{ fontSize: 12, color: "rgba(248,243,232,0.6)", lineHeight: 1.7, fontFamily: FONT_BODY, maxWidth: 340, margin: "0 auto" }}>
        11 rounds of rummy-style melding — the wild rank changes every round. Lowest total deadwood after round 11 wins +5 coins.
      </div>
    </div>
  );
}

function ErrorBanner({ text }) {
  return (
    <div style={{
      background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)",
      borderRadius: 8, padding: "8px 12px", marginTop: SP.sm, textAlign: "center",
      color: "#f87171", fontFamily: FONT_BODY, fontSize: 12,
    }}>{text}</div>
  );
}

function StallBanner({ onEnd, busy }) {
  return (
    <div style={{
      background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)",
      borderRadius: 8, padding: "10px 12px", marginTop: SP.sm, textAlign: "center",
    }}>
      <div style={{ color: GOLD, fontFamily: FONT_BODY, fontSize: 12, marginBottom: SP.sm }}>
        It's been quiet for a while…
      </div>
      <GButton variant="danger" disabled={busy} onClick={onEnd} style={{ padding: "6px 16px", fontSize: 12 }}>
        End Game
      </GButton>
    </div>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────
export default function WildReignScreen({ myHouse, global, api, onBack }) {
  const [gs, setGs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [pendingDraw, setPendingDraw] = useState(null); // "deck" | "discard" | null — arm-then-confirm draw
  const [showScores, setShowScores] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [handOrder, setHandOrder] = useState([]);

  const myName = global?.[myHouse]?.name ?? "You";
  const partnerName = global?.[other(myHouse)]?.name ?? "Partner";
  const displayName = (house) => house === myHouse ? "You" : partnerName;

  const fetchState = useCallback(async () => {
    try {
      const s = await api("wildreign/state");
      setGs(s);
    } catch {
      // transient network hiccup — next poll tick will retry
    }
  }, [api]);

  // Polling stops automatically when this screen unmounts (App.jsx switches away).
  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 2000);
    return () => clearInterval(id);
  }, [fetchState]);

  const handKey = gs?.hand?.map(c => c.id).sort((a, b) => a - b).join(",") ?? "";
  useEffect(() => { setSelectedId(null); setPendingDraw(null); }, [handKey]);

  // Keep the player's own drag-arranged order; new cards (freshly drawn, or a
  // brand-new deal) are appended at the end in suit/rank order, never reshuffling
  // cards the player has already arranged.
  useEffect(() => {
    if (!gs?.hand) return;
    setHandOrder(prev => {
      const idSet = new Set(gs.hand.map(c => c.id));
      const kept = prev.filter(id => idSet.has(id));
      const keptSet = new Set(kept);
      const freshCards = gs.hand.filter(c => !keptSet.has(c.id));
      return [...kept, ...sortedHand(freshCards).map(c => c.id)];
    });
  }, [handKey]);

  async function doAction(fn) {
    setBusy(true);
    setErr("");
    try {
      await fn();
      await fetchState();
    } catch (e) {
      setErr(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const ready      = () => doAction(() => api("wildreign/ready", {}));
  const unready    = () => doAction(() => api("wildreign/unready", {}));
  const draw       = (source) => doAction(() => api("wildreign/draw", { source }));
  function armOrDraw(source) {
    if (pendingDraw === source) {
      setPendingDraw(null);
      draw(source);
    } else {
      setPendingDraw(source);
    }
  }
  const discard    = () => doAction(() => api("wildreign/discard", { cardId: selectedId }));
  const goOut      = () => doAction(() => api("wildreign/go-out", {}));
  const passGoOut  = () => doAction(() => api("wildreign/pass-go-out", {}));
  const nextRound  = () => doAction(() => api("wildreign/next-round", {}));
  const abandon    = () => doAction(() => api("wildreign/abandon", {}));

  if (!gs) {
    return (
      <WildReignShell onBack={onBack}>
        <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(248,243,232,0.5)", fontFamily: FONT_BODY }}>
          Loading table…
        </div>
      </WildReignShell>
    );
  }

  const iAmReady = myHouse === "left" ? gs.readyLeft : gs.readyRight;
  const partnerIsReady = myHouse === "left" ? gs.readyRight : gs.readyLeft;
  const headerToggles = (
    <>
      <HeaderToggle active={showLog} label="Log" onClick={() => setShowLog(s => !s)} />
      <HeaderToggle active={showScores} label="Scores" onClick={() => setShowScores(s => !s)} />
    </>
  );

  // ── Waiting to start ──────────────────────────────────────────────────
  if (gs.status === "waiting") {
    return (
      <WildReignShell onBack={onBack}>
        <IntroPanel />
        {err && <ErrorBanner text={err} />}
        <div style={{ textAlign: "center", marginTop: SP.lg }}>
          {partnerIsReady && !iAmReady && (
            <div style={{ color: GOLD, fontFamily: FONT_BODY, fontSize: 13, marginBottom: SP.md }}>
              {partnerName} is ready and waiting for you!
            </div>
          )}
          {iAmReady && !partnerIsReady && (
            <div style={{ color: "rgba(248,243,232,0.6)", fontFamily: FONT_BODY, fontSize: 13, marginBottom: SP.md }}>
              Waiting for {partnerName}…
            </div>
          )}
          {!iAmReady
            ? <GButton variant="gold" disabled={busy} onClick={ready}>Ready to Play</GButton>
            : <GButton disabled={busy} onClick={unready}>Cancel</GButton>}
        </div>
      </WildReignShell>
    );
  }

  // ── Active round (draw / discard / go-out decision) ──────────────────
  if (gs.status === "active") {
    const myTurn = gs.turnHouse === myHouse;
    const { melds, melded } = autoMeldHand(gs.hand, gs.round);
    let liveDw = 0;
    gs.hand.forEach((c, i) => { if (!melded.has(i)) liveDw += cardPts(c, gs.round); });
    const canSelectDiscard = myTurn && gs.phase === "discard" && !busy;
    const displayHand = handOrder.map(id => gs.hand.find(c => c.id === id)).filter(Boolean);
    const canDrawDeck = myTurn && gs.phase === "draw" && !busy;
    const canDrawDiscard = canDrawDeck && !!gs.discardTop;

    return (
      <WildReignShell onBack={onBack} rightAction={headerToggles}>
        <ScoreBar gs={gs} myHouse={myHouse} myName={myName} partnerName={partnerName} />
        {showScores && <RoundScoresTable roundScores={gs.roundScores} myHouse={myHouse} myName={myName} partnerName={partnerName} />}
        {showLog && <MoveLog moveLog={gs.moveLog} displayName={displayName} />}
        {gs.stalled && <StallBanner onEnd={abandon} busy={busy} />}
        {err && <ErrorBanner text={err} />}

        {gs.wentOut === myHouse && (
          <div style={{ textAlign: "center", color: GOLD, fontFamily: FONT_BODY, fontSize: 13, margin: `${SP.sm}px 0` }}>
            You went out! {partnerName} is taking their final turn…
          </div>
        )}
        {gs.wentOut === other(myHouse) && (
          <div style={{ textAlign: "center", color: GOLD, fontFamily: FONT_BODY, fontSize: 13, margin: `${SP.sm}px 0` }}>
            {partnerName} went out — this is your final turn.
          </div>
        )}

        <div style={{
          textAlign: "center", fontFamily: FONT_BODY, fontSize: 13, margin: `${SP.sm}px 0`,
          color: myTurn ? GOLD : "rgba(248,243,232,0.5)", fontWeight: myTurn ? 700 : 400,
        }}>
          {myTurn ? "Your turn" : `${partnerName}'s turn`}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: SP.xl, alignItems: "center", margin: `${SP.md}px 0` }}>
          <div style={{ textAlign: "center" }}>
            <CardBack
              stacked
              count={gs.deckCount}
              highlight={pendingDraw === "deck"}
              onClick={canDrawDeck ? () => armOrDraw("deck") : undefined}
              disabled={!canDrawDeck}
            />
            <div style={{ fontSize: 9, color: pendingDraw === "deck" ? GOLD : "rgba(248,243,232,0.4)", marginTop: SP.xs, fontFamily: FONT_BODY, fontWeight: pendingDraw === "deck" ? 700 : 400 }}>
              {pendingDraw === "deck" ? "TAP AGAIN" : "DECK"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            {gs.discardTop
              ? <PlayingCard
                  card={gs.discardTop}
                  wild={isWild(gs.discardTop, gs.round)}
                  selected={pendingDraw === "discard"}
                  onClick={canDrawDiscard ? () => armOrDraw("discard") : undefined}
                />
              : <CardBack disabled />}
            <div style={{ fontSize: 9, color: pendingDraw === "discard" ? GOLD : "rgba(248,243,232,0.4)", marginTop: SP.xs, fontFamily: FONT_BODY, fontWeight: pendingDraw === "discard" ? 700 : 400 }}>
              {pendingDraw === "discard" ? "TAP AGAIN" : "DISCARD"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: SP.md }}>
          <div style={{
            fontSize: 10, color: "rgba(201,168,76,0.55)", letterSpacing: 1, textTransform: "uppercase",
            marginBottom: SP.sm, fontFamily: FONT_BODY, display: "flex", justifyContent: "space-between",
          }}>
            <span>Your Hand ({gs.hand.length})</span>
            {(gs.phase === "discard" || gs.phase === "goOutDecision") && myTurn && <span>Deadwood: {liveDw}</span>}
          </div>
          <HandRow
            hand={displayHand}
            round={gs.round}
            selectedId={selectedId}
            onSelectCard={canSelectDiscard ? setSelectedId : undefined}
            onReorder={setHandOrder}
          />
        </div>

        {myTurn && gs.phase === "discard" && (
          <div style={{ display: "flex", gap: SP.sm, justifyContent: "center", marginTop: SP.lg }}>
            <GButton disabled={busy || selectedId == null} onClick={discard}>Discard Selected</GButton>
          </div>
        )}

        {myTurn && gs.phase === "goOutDecision" && (
          <>
            <MeldsDisplay hand={gs.hand} round={gs.round} melds={melds} melded={melded} />
            <div style={{ display: "flex", gap: SP.sm, justifyContent: "center", marginTop: SP.lg }}>
              <GButton disabled={busy} onClick={passGoOut}>Continue</GButton>
              <GButton variant="gold" disabled={busy} onClick={goOut}>Go Out 🏆</GButton>
            </div>
          </>
        )}

        {myTurn && gs.phase === "draw" && (
          <div style={{ textAlign: "center", color: "rgba(248,243,232,0.5)", fontFamily: FONT_BODY, fontSize: 13, marginTop: SP.lg }}>
            {pendingDraw ? "Tap again to confirm your draw." : "Tap the deck or discard pile to draw."}
          </div>
        )}
      </WildReignShell>
    );
  }

  // ── Round end ──────────────────────────────────────────────────────────
  if (gs.status === "roundEnd") {
    const last = gs.roundScores[gs.roundScores.length - 1];
    const iReady = myHouse === "left" ? gs.readyNextLeft : gs.readyNextRight;
    const partnerReady = myHouse === "left" ? gs.readyNextRight : gs.readyNextLeft;
    const myRoundDw = last ? last[myHouse] : 0;
    const partnerRoundDw = last ? last[other(myHouse)] : 0;

    return (
      <WildReignShell onBack={onBack} rightAction={headerToggles}>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <div style={{ fontSize: 11, color: "rgba(201,168,76,0.6)", letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT_BODY }}>
            Round {gs.round} Complete
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, color: GOLD, margin: "8px 0" }}>
            {myRoundDw < partnerRoundDw ? "You won the round!" : myRoundDw > partnerRoundDw ? `${partnerName} won the round` : "Tied round"}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 30, margin: "16px 0" }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(248,243,232,0.5)", fontFamily: FONT_BODY }}>{myName}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: IVORY, fontFamily: FONT_DISPLAY }}>{myRoundDw}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "rgba(248,243,232,0.5)", fontFamily: FONT_BODY }}>{partnerName}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: IVORY, fontFamily: FONT_DISPLAY }}>{partnerRoundDw}</div>
            </div>
          </div>
        </div>

        <ScoreBar gs={gs} myHouse={myHouse} myName={myName} partnerName={partnerName} />
        {showScores && <RoundScoresTable roundScores={gs.roundScores} myHouse={myHouse} myName={myName} partnerName={partnerName} />}
        {showLog && <MoveLog moveLog={gs.moveLog} displayName={displayName} />}

        {gs.partnerHand && (
          <div style={{ marginTop: SP.md + SP.xs }}>
            <div style={{ fontSize: 10, color: "rgba(201,168,76,0.55)", letterSpacing: 1, textTransform: "uppercase", marginBottom: SP.sm, fontFamily: FONT_BODY }}>
              {partnerName}'s final hand
            </div>
            <div style={{ display: "flex", gap: SP.xs, flexWrap: "wrap" }}>
              {gs.partnerHand.map(c => <PlayingCard key={c.id} card={c} wild={isWild(c, gs.round)} size="sm" />)}
            </div>
          </div>
        )}

        {gs.stalled && <StallBanner onEnd={abandon} busy={busy} />}
        {err && <ErrorBanner text={err} />}

        <div style={{ textAlign: "center", marginTop: SP.lg + SP.xs }}>
          {partnerReady && !iReady && (
            <div style={{ color: GOLD, fontFamily: FONT_BODY, fontSize: 13, marginBottom: SP.sm }}>
              {partnerName} is ready for the next round!
            </div>
          )}
          {iReady && !partnerReady && (
            <div style={{ color: "rgba(248,243,232,0.6)", fontFamily: FONT_BODY, fontSize: 13, marginBottom: SP.sm }}>
              Waiting for {partnerName}…
            </div>
          )}
          <GButton variant="gold" disabled={busy || iReady} onClick={nextRound}>
            Ready for Next Round
          </GButton>
        </div>
      </WildReignShell>
    );
  }

  // ── Game end ───────────────────────────────────────────────────────────
  if (gs.status === "gameEnd") {
    const iWon = gs.winner === myHouse;
    const tie = gs.winner === "tie";
    return (
      <WildReignShell onBack={onBack}>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <div style={{ fontSize: 40 }}>{tie ? "🤝" : iWon ? "🏆" : "🌙"}</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: GOLD, margin: "10px 0" }}>
            {tie ? "It's a Tie!" : iWon ? "You Won the Match!" : `${partnerName} Won the Match`}
          </div>
          {iWon && (
            <div style={{ color: "rgba(248,243,232,0.7)", fontFamily: FONT_BODY, fontSize: 13 }}>+5 🪙 added to your coins</div>
          )}
        </div>

        <ScoreBar gs={gs} myHouse={myHouse} myName={myName} partnerName={partnerName} />
        <RoundScoresTable roundScores={gs.roundScores} myHouse={myHouse} myName={myName} partnerName={partnerName} />

        {err && <ErrorBanner text={err} />}

        <div style={{ textAlign: "center", marginTop: SP.lg + SP.xs }}>
          <GButton variant="gold" disabled={busy} onClick={abandon}>Play Again</GButton>
        </div>
      </WildReignShell>
    );
  }

  return null;
}
