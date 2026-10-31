import { autoMeldHand } from "@swipe-sixer/shared/games/wildreign";
import { MeldsDisplay } from "./Cards";
import { GOLD, FONT_BODY, FONT_DISPLAY, SP } from "./theme";

const BURST = ["🎉", "✨", "🃏", "🎊", "⭐", "✨", "🎉", "🃏", "🎊", "✨", "🏆", "🎉"];

// One-time, table-wide announcement the moment someone goes out. Auto-dismissed
// by the screen after a few seconds; tap anywhere to dismiss sooner.
export function GoOutCelebration({ name, isSelf, onDismiss }) {
  return (
    <div
      role="status"
      onClick={onDismiss}
      style={{
        position: "absolute", inset: 0, zIndex: 110, borderRadius: 16, overflow: "hidden", cursor: "pointer",
        background: "rgba(5,20,10,0.74)", display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {BURST.map((e, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="wr-float-up"
          style={{
            position: "absolute", left: `${8 + (i * 84) / BURST.length}%`, bottom: 40, fontSize: 26,
            animationDelay: `${(i % 4) * 0.12}s`, animationDuration: "2.2s", "--drift": `${((i % 3) - 1) * 24}px`,
          }}
        >
          {e}
        </div>
      ))}
      <div className="wr-celebrate" style={{ textAlign: "center", padding: SP.xl }}>
        <div style={{ fontSize: 56, lineHeight: 1 }}>🏆</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, color: GOLD, fontWeight: 700, marginTop: SP.sm, textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>
          {isSelf ? "You went out!" : `${name} went out!`}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: "rgba(248,243,232,0.7)", marginTop: SP.sm }}>
          Everyone else gets one final turn · tap to dismiss
        </div>
      </div>
    </div>
  );
}

// Persistent for the rest of the round: who went out, whose final turns remain,
// and their laid-down melds — the one hand the server reveals early.
export function WentOutPanel({ name, isSelf, cards, round, finalTurnNames, myFinalTurn, isMyTurn }) {
  const subtitle = myFinalTurn
    ? (isMyTurn ? "This is your final turn." : "You still get one final turn.")
    : finalTurnNames.length > 0
      ? `Final turns left: ${finalTurnNames.join(", ")}`
      : "Scoring the round…";
  const meld = cards && cards.length > 0 ? autoMeldHand(cards, round) : null;
  return (
    <div style={{
      margin: `${SP.sm}px 0`, padding: SP.md, borderRadius: 10,
      background: "rgba(201,168,76,0.1)", border: `1px solid ${GOLD}`,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: SP.sm, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: GOLD, fontWeight: 700 }}>
          🏆 {isSelf ? "You" : name} went out
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: "rgba(248,243,232,0.75)" }}>{subtitle}</div>
      </div>
      {meld && <MeldsDisplay hand={cards} round={round} melds={meld.melds} melded={meld.melded} />}
    </div>
  );
}
