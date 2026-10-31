import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { FC_SUITS, FC_RANKS, wildRank, isWild, cardPts, autoMeldHand } from "@swipe-sixer/shared/games/wildreign";
import { FELT, FELT_DARK, GOLD, IVORY, FONT_DISPLAY, FONT_BODY, SP } from "./wildreign/theme";
import { PlayingCard, CardBack, MeldsDisplay, CARD_W, CARD_H } from "./wildreign/Cards";
import { useReactions, ReactionBar, GifPicker, FloatingReactions, GifToasts } from "./wildreign/Reactions";
import { GoOutCelebration, WentOutPanel } from "./wildreign/GoOut";
import GButton from "../components/GButton";
import ConfirmDialog from "../components/ConfirmDialog";

const CARD_GAP = SP.sm, NATURAL_STEP = CARD_W + CARD_GAP, MIN_STEP = 26;
const CELEBRATION_MS = 3200;

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
    case "draw": return `${displayName(entry.userId)} drew from the ${entry.source === "discard" ? "discard pile" : "deck"}`;
    case "discard": return `${displayName(entry.userId)} discarded ${cardLabel(entry.card)}`;
    case "goOut": return `${displayName(entry.userId)} went out! 🏆`;
    case "pass": return `${displayName(entry.userId)} continued their turn`;
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

// Absolutely-positioned hand row supporting pointer-drag reordering (mouse + touch,
// via the Pointer Events API) with a lift/scale/glow visual while dragging, and
// tap-to-select still working for cards that are barely moved (<5px). The card
// spacing (`step`) compresses to fit the measured container width instead of
// overflowing into a horizontal scrollbar — mirrors the original game's approach
// of shrinking card overlap on narrow/mobile screens rather than scrolling.
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
    // Capture can throw (NotFoundError) for a pointer the browser doesn't
    // consider active — synthetic/odd events. The window-level pointerup
    // fallback still ends the gesture, so capture is best-effort only.
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* best effort */ }
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

// Every seated player (self included), highlighted gold when it's their turn —
// the self-highlight is the fix for "no visual cue that it's your turn." The
// player who went out gets a trophy marker for the rest of the round.
function PlayersRow({ players, gameState, myId }) {
  return (
    <div style={{ display: "flex", gap: SP.sm, flexWrap: "wrap", justifyContent: "center", margin: `${SP.sm}px 0` }}>
      {players.map(p => {
        const isSelf = p.userId === myId;
        const isTurn = gameState.turnUserId === p.userId;
        const isOut = gameState.wentOutUserId === p.userId;
        const owesFinal = gameState.owesFinalTurn?.includes(p.userId);
        const lit = isTurn || isOut;
        return (
          <div key={p.userId} style={{
            padding: "6px 10px", borderRadius: 8, minWidth: 76, textAlign: "center",
            background: lit ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.04)",
            border: lit ? `1px solid ${GOLD}` : "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ fontSize: 12, color: IVORY, fontFamily: FONT_BODY, whiteSpace: "nowrap" }}>
              {p.avatarEmoji} {p.username}{isSelf ? " (You)" : ""}
            </div>
            {isOut && <div style={{ fontSize: 9, color: GOLD, fontWeight: 700, marginTop: 2 }}>🏆 OUT</div>}
            {!isOut && isTurn && <div style={{ fontSize: 9, color: GOLD, fontWeight: 700, marginTop: 2 }}>{owesFinal ? "FINAL TURN" : isSelf ? "YOUR TURN" : "THEIR TURN"}</div>}
          </div>
        );
      })}
    </div>
  );
}

function ScoreBar({ players, gameState }) {
  return (
    <div style={{ display: "flex", gap: SP.lg, flexWrap: "wrap", justifyContent: "center", alignItems: "center", padding: "6px 2px" }}>
      {players.map(p => (
        <div key={p.userId} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "rgba(248,243,232,0.5)", fontFamily: FONT_BODY, whiteSpace: "nowrap" }}>{p.username}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: IVORY, fontFamily: FONT_DISPLAY }}>{gameState.scores[p.userId] ?? 0}</div>
        </div>
      ))}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "rgba(201,168,76,0.6)", letterSpacing: 1.5, fontFamily: FONT_BODY, textTransform: "uppercase" }}>
          Round {gameState.round}/11
        </div>
        <div style={{ fontSize: 12, color: GOLD, fontFamily: FONT_BODY, fontWeight: 700, marginTop: 2 }}>
          {wildRank(gameState.round)}s Wild
        </div>
      </div>
    </div>
  );
}

function RoundScoresTable({ roundScores, players }) {
  if (!roundScores || roundScores.length === 0) {
    return (
      <div style={{ marginTop: SP.lg, textAlign: "center", color: "rgba(248,243,232,0.4)", fontFamily: FONT_BODY, fontSize: 12 }}>
        No rounds completed yet.
      </div>
    );
  }
  const cols = `50px repeat(${players.length}, 1fr)`;
  return (
    <div style={{ marginTop: SP.lg, overflowX: "auto" }}>
      <div style={{
        display: "grid", gridTemplateColumns: cols, padding: "6px 4px", minWidth: 260,
        borderBottom: "1px solid rgba(201,168,76,0.2)", fontSize: 10, color: "rgba(201,168,76,0.6)",
        fontFamily: FONT_BODY, textTransform: "uppercase", letterSpacing: 0.5,
      }}>
        <span>Rd</span>
        {players.map(p => <span key={p.userId} style={{ textAlign: "center" }}>{p.username}</span>)}
      </div>
      {roundScores.map(r => (
        <div key={r.round} style={{
          display: "grid", gridTemplateColumns: cols, padding: "5px 4px", fontSize: 13, minWidth: 260,
          color: IVORY, fontFamily: FONT_BODY, borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          <span>{r.round}</span>
          {players.map(p => <span key={p.userId} style={{ textAlign: "center" }}>{r.scores[p.userId] ?? 0}</span>)}
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

// The felt panel. `position: relative` so reactions, toasts, the celebration
// and the confirm dialog can overlay it with `position: absolute; inset: 0`.
function WildReignShell({ children, onBack, rightAction }) {
  return (
    <div style={{ width: "100%", maxWidth: 860, margin: "0 auto" }}>
      <div style={{
        position: "relative",
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
          }}>← Home</button>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, color: GOLD }}>Wild Reign</div>
          <div style={{ minWidth: 100, textAlign: "right", display: "flex", gap: SP.sm, justifyContent: "flex-end" }}>{rightAction}</div>
        </div>
        {children}
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

// ─── Main screen ────────────────────────────────────────────────────────────
export default function WildReignScreen({ socket, me, room, gameState, onLeft, api }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [pendingDraw, setPendingDraw] = useState(null); // "deck" | "discard" | null — arm-then-confirm draw
  const [showScores, setShowScores] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [handOrder, setHandOrder] = useState([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifsAvailable, setGifsAvailable] = useState(true); // flips false on the proxy's 503 (no key configured)
  const [celebrate, setCelebrate] = useState(null); // { userId } while the go-out overlay is up

  const players = room.players;
  const usernameFor = (uid) => players.find(p => p.userId === uid)?.username ?? "Someone";
  const displayName = (uid) => uid === me.id ? "You" : usernameFor(uid);

  const { reactions, send: sendReaction, cooldown: reactCooldown, hint: reactHint } = useReactions(socket, room.roomId);

  const handKey = gameState?.myHand?.map(c => c.id).sort((a, b) => a - b).join(",") ?? "";
  useEffect(() => { setSelectedId(null); setPendingDraw(null); }, [handKey]);

  // Keep the player's own drag-arranged order; new cards (freshly drawn, or a
  // brand-new deal) are appended at the end in suit/rank order, never reshuffling
  // cards the player has already arranged.
  useEffect(() => {
    if (!gameState?.myHand) return;
    setHandOrder(prev => {
      const idSet = new Set(gameState.myHand.map(c => c.id));
      const kept = prev.filter(id => idSet.has(id));
      const keptSet = new Set(kept);
      const freshCards = gameState.myHand.filter(c => !keptSet.has(c.id));
      return [...kept, ...sortedHand(freshCards).map(c => c.id)];
    });
  }, [handKey]);

  // Fire the go-out celebration exactly once, on the `null → userId` transition
  // of a state we've actually seen. `undefined` means "no state yet", so a tab
  // that reloads mid-final-turns (first state already has wentOutUserId set)
  // gets the persistent panel but not a stale celebration.
  const prevWentOutRef = useRef(undefined);
  const celebrateTimerRef = useRef(null);
  useEffect(() => {
    if (!gameState) return;
    const cur = gameState.wentOutUserId ?? null;
    const prev = prevWentOutRef.current;
    prevWentOutRef.current = cur;
    if (prev === null && cur) {
      setCelebrate({ userId: cur });
      clearTimeout(celebrateTimerRef.current);
      celebrateTimerRef.current = setTimeout(() => setCelebrate(null), CELEBRATION_MS);
    }
  }, [gameState]);
  useEffect(() => () => clearTimeout(celebrateTimerRef.current), []);

  function emit(event, payload = {}) {
    setBusy(true);
    setErr("");
    socket.emit(event, { roomId: room.roomId, ...payload }, (res) => {
      setBusy(false);
      if (res && !res.ok) setErr(res.reason);
    });
  }

  const draw = (source) => emit("wildreign:draw", { source });
  function armOrDraw(source) {
    if (pendingDraw === source) {
      setPendingDraw(null);
      draw(source);
    } else {
      setPendingDraw(source);
    }
  }
  const discard    = () => emit("wildreign:discard", { cardId: selectedId });
  const goOut      = () => emit("wildreign:go-out");
  const passGoOut  = () => emit("wildreign:pass-go-out");
  const nextRd     = () => emit("wildreign:ready-next-round");
  const abandon    = () => emit("wildreign:abandon");

  // Game ended early (someone abandoned) or the whole match wrapped up and
  // the room is no longer active — either way, nothing left to play here.
  if (room.status !== "active") {
    return (
      <WildReignShell onBack={onLeft}>
        <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(248,243,232,0.6)", fontFamily: FONT_BODY }}>
          {room.status === "abandoned" ? "This game was ended early." : "This game has ended."}
        </div>
        <div style={{ textAlign: "center" }}>
          <GButton variant="gold" onClick={onLeft}>Back to Home</GButton>
        </div>
      </WildReignShell>
    );
  }

  if (!gameState) {
    return (
      <WildReignShell onBack={onLeft}>
        <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(248,243,232,0.5)", fontFamily: FONT_BODY }}>
          Loading table…
        </div>
      </WildReignShell>
    );
  }

  const myTurn = gameState.turnUserId === me.id;
  const headerToggles = (
    <>
      <HeaderToggle active={showLog} label="Log" onClick={() => setShowLog(s => !s)} />
      <HeaderToggle active={showScores} label="Scores" onClick={() => setShowScores(s => !s)} />
    </>
  );

  // Overlays live inside the shell (which is position: relative) and are
  // shared by every phase — reactions during the score screen are half the fun.
  const overlays = (
    <>
      <FloatingReactions reactions={reactions} players={players} />
      <GifToasts reactions={reactions} />
      {celebrate && (
        <GoOutCelebration
          name={usernameFor(celebrate.userId)}
          isSelf={celebrate.userId === me.id}
          onDismiss={() => setCelebrate(null)}
        />
      )}
      {confirmEnd && (
        <ConfirmDialog
          title="End the game for everyone?"
          body="This ends the match for all players immediately and can't be undone."
          confirmLabel="End Game for Everyone"
          busy={busy}
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() => { setConfirmEnd(false); abandon(); }}
        />
      )}
    </>
  );

  const reactionUi = (
    <>
      {gifOpen && gifsAvailable && !!api && (
        <GifPicker
          api={api}
          onPick={(g) => { sendReaction("gif", g.url); setGifOpen(false); }}
          onClose={() => setGifOpen(false)}
          onUnavailable={() => { setGifsAvailable(false); setGifOpen(false); }}
        />
      )}
      <ReactionBar
        onSend={sendReaction}
        cooldown={reactCooldown}
        hint={reactHint}
        gifsAvailable={gifsAvailable && !!api}
        gifOpen={gifOpen}
        onToggleGifs={() => setGifOpen(o => !o)}
      />
    </>
  );

  const wentOut = gameState.wentOutUserId;
  const wentOutPanel = wentOut ? (
    <WentOutPanel
      name={usernameFor(wentOut)}
      isSelf={wentOut === me.id}
      cards={wentOut === me.id ? gameState.myHand : gameState.hands?.[wentOut]?.cards}
      round={gameState.round}
      finalTurnNames={(gameState.owesFinalTurn ?? []).map(usernameFor)}
      myFinalTurn={(gameState.owesFinalTurn ?? []).includes(me.id)}
      isMyTurn={myTurn}
    />
  ) : null;

  // ── Active round (draw / discard / go-out decision) ──────────────────
  if (gameState.phase === "draw" || gameState.phase === "discard" || gameState.phase === "goOutDecision") {
    const { melds, melded } = autoMeldHand(gameState.myHand, gameState.round);
    let liveDw = 0;
    gameState.myHand.forEach((c, i) => { if (!melded.has(i)) liveDw += cardPts(c, gameState.round); });
    const canSelectDiscard = myTurn && gameState.phase === "discard" && !busy;
    const displayHand = handOrder.map(id => gameState.myHand.find(c => c.id === id)).filter(Boolean);
    const canDrawDeck = myTurn && gameState.phase === "draw" && !busy;
    const canDrawDiscard = canDrawDeck && !!gameState.discardTop;

    return (
      <WildReignShell onBack={onLeft} rightAction={headerToggles}>
        <ScoreBar players={players} gameState={gameState} />
        {showScores && <RoundScoresTable roundScores={gameState.roundScores} players={players} />}
        {showLog && <MoveLog moveLog={gameState.moveLog} displayName={displayName} />}
        {err && <ErrorBanner text={err} />}

        {wentOutPanel}

        <PlayersRow players={players} gameState={gameState} myId={me.id} />

        <div style={{
          textAlign: "center", fontFamily: FONT_BODY, fontSize: 13, margin: `${SP.sm}px 0`,
          color: myTurn ? GOLD : "rgba(248,243,232,0.5)", fontWeight: myTurn ? 700 : 400,
        }}>
          {myTurn ? "Your turn" : `${usernameFor(gameState.turnUserId)}'s turn`}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: SP.xl, alignItems: "center", margin: `${SP.md}px 0` }}>
          <div style={{ textAlign: "center" }}>
            <CardBack
              stacked
              count={gameState.deckCount}
              highlight={pendingDraw === "deck"}
              onClick={canDrawDeck ? () => armOrDraw("deck") : undefined}
              disabled={!canDrawDeck}
            />
            <div style={{ fontSize: 9, color: pendingDraw === "deck" ? GOLD : "rgba(248,243,232,0.4)", marginTop: SP.xs, fontFamily: FONT_BODY, fontWeight: pendingDraw === "deck" ? 700 : 400 }}>
              {pendingDraw === "deck" ? "TAP AGAIN" : "DECK"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            {gameState.discardTop
              ? <PlayingCard
                  card={gameState.discardTop}
                  wild={isWild(gameState.discardTop, gameState.round)}
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
            <span>Your Hand ({gameState.myHand.length})</span>
            {(gameState.phase === "discard" || gameState.phase === "goOutDecision") && myTurn && <span>Deadwood: {liveDw}</span>}
          </div>
          <HandRow
            hand={displayHand}
            round={gameState.round}
            selectedId={selectedId}
            onSelectCard={canSelectDiscard ? setSelectedId : undefined}
            onReorder={setHandOrder}
          />
        </div>

        {myTurn && gameState.phase === "discard" && (
          <div style={{ display: "flex", gap: SP.sm, justifyContent: "center", marginTop: SP.lg }}>
            <GButton disabled={busy || selectedId == null} onClick={discard}>Discard Selected</GButton>
          </div>
        )}

        {myTurn && gameState.phase === "goOutDecision" && (
          <>
            <MeldsDisplay hand={gameState.myHand} round={gameState.round} melds={melds} melded={melded} />
            <div style={{ display: "flex", gap: SP.sm, justifyContent: "center", marginTop: SP.lg }}>
              <GButton disabled={busy} onClick={passGoOut}>Continue</GButton>
              <GButton variant="gold" disabled={busy} onClick={goOut}>Go Out 🏆</GButton>
            </div>
          </>
        )}

        {myTurn && gameState.phase === "draw" && (
          <div style={{ textAlign: "center", color: "rgba(248,243,232,0.5)", fontFamily: FONT_BODY, fontSize: 13, marginTop: SP.lg }}>
            {pendingDraw ? "Tap again to confirm your draw." : "Tap the deck or discard pile to draw."}
          </div>
        )}

        {reactionUi}

        <div style={{ textAlign: "center", marginTop: SP.lg + SP.xs }}>
          <GButton variant="danger" disabled={busy} onClick={() => setConfirmEnd(true)} style={{ padding: "6px 16px", fontSize: 12 }}>
            End Game
          </GButton>
        </div>

        {overlays}
      </WildReignShell>
    );
  }

  // ── Round end ──────────────────────────────────────────────────────────
  if (gameState.phase === "roundEnd") {
    const last = gameState.roundScores[gameState.roundScores.length - 1];
    const lastScores = last?.scores ?? {};
    const minRoundDw = Math.min(...players.map(p => lastScores[p.userId] ?? Infinity));
    const roundWinners = players.filter(p => lastScores[p.userId] === minRoundDw);
    const iReady = gameState.readyNext?.includes(me.id);
    const readyCount = gameState.readyNext?.length ?? 0;

    return (
      <WildReignShell onBack={onLeft} rightAction={headerToggles}>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <div style={{ fontSize: 11, color: "rgba(201,168,76,0.6)", letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT_BODY }}>
            Round {gameState.round} Complete
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: GOLD, margin: "8px 0" }}>
            {roundWinners.length === 1
              ? (roundWinners[0].userId === me.id ? "You won the round!" : `${roundWinners[0].username} won the round`)
              : "Tied round"}
          </div>
        </div>

        <ScoreBar players={players} gameState={gameState} />
        {showScores && <RoundScoresTable roundScores={gameState.roundScores} players={players} />}
        {showLog && <MoveLog moveLog={gameState.moveLog} displayName={displayName} />}

        <div style={{ display: "flex", flexWrap: "wrap", gap: SP.md, marginTop: SP.md }}>
          {players.map(p => {
            const cards = gameState.hands[p.userId]?.cards;
            if (!cards) return null;
            return (
              <div key={p.userId}>
                <div style={{ fontSize: 10, color: "rgba(201,168,76,0.55)", letterSpacing: 1, textTransform: "uppercase", marginBottom: SP.sm, fontFamily: FONT_BODY }}>
                  {p.username}'s hand — {lastScores[p.userId] ?? 0} pts
                </div>
                <div style={{ display: "flex", gap: SP.xs, flexWrap: "wrap" }}>
                  {cards.map(c => <PlayingCard key={c.id} card={c} wild={isWild(c, gameState.round)} size="sm" />)}
                </div>
              </div>
            );
          })}
        </div>

        {err && <ErrorBanner text={err} />}

        <div style={{ textAlign: "center", marginTop: SP.lg + SP.xs }}>
          <div style={{ color: "rgba(248,243,232,0.6)", fontFamily: FONT_BODY, fontSize: 13, marginBottom: SP.sm }}>
            {readyCount}/{players.length} ready for the next round
          </div>
          <GButton variant="gold" disabled={busy || iReady} onClick={nextRd}>
            Ready for Next Round
          </GButton>
        </div>

        {reactionUi}
        {overlays}
      </WildReignShell>
    );
  }

  // ── Game end ───────────────────────────────────────────────────────────
  if (gameState.phase === "gameEnd") {
    const minScore = Math.min(...players.map(p => gameState.scores[p.userId] ?? Infinity));
    const winners = players.filter(p => gameState.scores[p.userId] === minScore);
    const iWon = winners.length === 1 && winners[0].userId === me.id;
    const tie = winners.length > 1;

    return (
      <WildReignShell onBack={onLeft}>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <div style={{ fontSize: 40 }}>{tie ? "🤝" : iWon ? "🏆" : "🌙"}</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, color: GOLD, margin: "10px 0" }}>
            {tie ? "It's a Tie!" : iWon ? "You Won the Match!" : `${winners[0]?.username ?? "Someone"} Won the Match`}
          </div>
        </div>

        <ScoreBar players={players} gameState={gameState} />
        <RoundScoresTable roundScores={gameState.roundScores} players={players} />

        {reactionUi}

        <div style={{ textAlign: "center", marginTop: SP.lg + SP.xs }}>
          <GButton variant="gold" onClick={onLeft}>Back to Home</GButton>
        </div>

        {overlays}
      </WildReignShell>
    );
  }

  return null;
}
