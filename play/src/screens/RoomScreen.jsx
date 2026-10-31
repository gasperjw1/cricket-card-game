import { useState } from "react";

const INK = "#1F2430";
const MUTED = "#6B7280";
const ACCENT = "#5B6EF5";
const GREEN = "#16A34A";
const CARD = "#FFFFFF";
const BORDER = "#E5E7EB";
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const buttonStyle = {
  padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
  fontWeight: 700, fontSize: 14, fontFamily: FONT,
};

export default function RoomScreen({ socket, me, room, onLeft }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const myPlayer = room.players.find(p => p.userId === me.id);
  const isHost = room.hostUserId === me.id;
  const iAmReady = myPlayer?.ready ?? false;

  function toggleReady() {
    socket.emit(iAmReady ? "room:unready" : "room:ready", {});
  }

  function startGame() {
    setBusy(true);
    setError("");
    socket.emit("room:start", {}, (res) => {
      setBusy(false);
      if (!res.ok) setError(res.reason);
    });
  }

  function leaveRoom() {
    socket.emit("room:leave", {});
    onLeft();
  }

  const canStart = room.players.length >= room.minPlayers &&
    room.players.every(p => p.userId === room.hostUserId || p.ready);

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{
        background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 24, marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Room Code
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: INK, letterSpacing: 6, fontFamily: FONT }}>
          {room.code}
        </div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
          {room.gameType === "wildreign" ? "Wild Reign" : room.gameType} · Waiting to start
        </div>
      </div>

      <div style={{
        background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 16,
      }}>
        <div style={{ fontWeight: 800, color: INK, marginBottom: 12, fontSize: 14 }}>
          Players ({room.players.length}/{room.maxPlayers})
        </div>
        {room.players.map(p => (
          <div key={p.userId} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0",
          }}>
            <span style={{ fontSize: 14, color: p.connected ? INK : MUTED }}>
              {p.avatarEmoji} {p.username}
              {p.isHost && <span style={{ color: ACCENT, fontSize: 11, marginLeft: 6, fontWeight: 700 }}>HOST</span>}
              {!p.connected && <span style={{ color: MUTED, fontSize: 11, marginLeft: 6 }}>(away)</span>}
            </span>
            {!p.isHost && (
              <span style={{ fontSize: 12, fontWeight: 700, color: p.ready ? GREEN : MUTED }}>
                {p.ready ? "Ready" : "Not ready"}
              </span>
            )}
          </div>
        ))}
        {room.players.length < room.minPlayers && (
          <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
            Needs at least {room.minPlayers} players to start.
          </div>
        )}
      </div>

      {error && <p style={{ color: "#DC2626", fontSize: 13 }}>{error}</p>}

      <div style={{ display: "flex", gap: 10 }}>
        {!isHost && (
          <button
            onClick={toggleReady}
            style={{ ...buttonStyle, background: iAmReady ? "#F0F0F5" : ACCENT, color: iAmReady ? MUTED : "white" }}
          >
            {iAmReady ? "Not Ready" : "I'm Ready"}
          </button>
        )}
        {isHost && (
          <button
            onClick={startGame}
            disabled={busy || !canStart}
            style={{ ...buttonStyle, background: ACCENT, color: "white", opacity: busy || !canStart ? 0.5 : 1 }}
          >
            Start Game
          </button>
        )}
        <button onClick={leaveRoom} style={{ ...buttonStyle, background: "none", border: `1px solid ${BORDER}`, color: MUTED }}>
          Leave
        </button>
      </div>
    </div>
  );
}
