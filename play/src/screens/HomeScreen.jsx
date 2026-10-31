import { useState, useEffect, useCallback } from "react";

const INK = "#1F2430";
const MUTED = "#6B7280";
const ACCENT = "#5B6EF5";
const CARD = "#FFFFFF";
const BORDER = "#E5E7EB";
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const GAME_OPTIONS = [{ value: "wildreign", label: "Wild Reign (3-8 players)" }];

const cardStyle = {
  background: CARD, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`,
};
const inputStyle = {
  padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${BORDER}`,
  fontSize: 14, fontFamily: FONT, outline: "none",
};
const buttonStyle = {
  padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer",
  background: ACCENT, color: "white", fontWeight: 700, fontSize: 14, fontFamily: FONT,
};
const ghostButtonStyle = {
  padding: "6px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, cursor: "pointer",
  background: "none", color: MUTED, fontWeight: 600, fontSize: 12, fontFamily: FONT,
};

export default function HomeScreen({ api, socket, onRoomJoined }) {
  const [gameType, setGameType] = useState(GAME_OPTIONS[0].value);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [friendsData, setFriendsData] = useState({ friends: [], incoming: [], outgoing: [] });
  const [friendUsername, setFriendUsername] = useState("");
  const [friendError, setFriendError] = useState("");

  const loadFriends = useCallback(async () => {
    try {
      const data = await api("friends");
      setFriendsData(data);
    } catch {
      // non-fatal — friends panel just stays empty
    }
  }, [api]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  function createRoom() {
    setBusy(true);
    setError("");
    socket.emit("room:create", { gameType }, (res) => {
      setBusy(false);
      if (!res.ok) { setError(res.reason); return; }
      onRoomJoined();
    });
  }

  function joinRoom() {
    if (!joinCode.trim()) return;
    setBusy(true);
    setError("");
    socket.emit("room:join", { code: joinCode.trim() }, (res) => {
      setBusy(false);
      if (!res.ok) { setError(res.reason); return; }
      onRoomJoined();
    });
  }

  async function sendFriendRequest() {
    if (!friendUsername.trim()) return;
    setFriendError("");
    try {
      await api("friends/request", { username: friendUsername.trim() });
      setFriendUsername("");
      loadFriends();
    } catch (e) {
      setFriendError(e.message || "Couldn't send request");
    }
  }

  async function respondToRequest(id, accept) {
    try {
      await api(`friends/${id}/${accept ? "accept" : "decline"}`, {});
      loadFriends();
    } catch {
      // best-effort — list will just look stale until next load
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, maxWidth: 900 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 800, color: INK, marginBottom: 12, fontSize: 15 }}>Create a room</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={gameType} onChange={e => setGameType(e.target.value)} style={inputStyle}>
              {GAME_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
            <button onClick={createRoom} disabled={busy} style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}>
              Create Room
            </button>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, color: INK, marginBottom: 12, fontSize: 15 }}>Join a room</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              placeholder="6-letter code" value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && joinRoom()}
              maxLength={6}
              style={{ ...inputStyle, textTransform: "uppercase", letterSpacing: 2, width: 140 }}
            />
            <button onClick={joinRoom} disabled={busy || !joinCode.trim()} style={{ ...buttonStyle, opacity: busy || !joinCode.trim() ? 0.6 : 1 }}>
              Join Room
            </button>
          </div>
        </div>

        {error && <p style={{ color: "#DC2626", fontSize: 13, margin: 0 }}>{error}</p>}
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 800, color: INK, marginBottom: 12, fontSize: 15 }}>Friends</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            placeholder="Add by username" value={friendUsername}
            onChange={e => setFriendUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendFriendRequest()}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={sendFriendRequest} style={ghostButtonStyle}>Add</button>
        </div>
        {friendError && <p style={{ color: "#DC2626", fontSize: 12, margin: "0 0 12px" }}>{friendError}</p>}

        {friendsData.incoming.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
              Requests
            </div>
            {friendsData.incoming.map(r => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: INK }}>{r.from.avatarEmoji} {r.from.username}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => respondToRequest(r.id, true)} style={{ ...ghostButtonStyle, color: ACCENT }}>Accept</button>
                  <button onClick={() => respondToRequest(r.id, false)} style={ghostButtonStyle}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
          Friends ({friendsData.friends.length})
        </div>
        {friendsData.friends.length === 0 && (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>No friends added yet.</p>
        )}
        {friendsData.friends.map(f => (
          <div key={f.userId} style={{ fontSize: 13, color: INK, marginBottom: 4 }}>
            {f.avatarEmoji} {f.username}
          </div>
        ))}

        {friendsData.outgoing.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
              Sent
            </div>
            {friendsData.outgoing.map(r => (
              <div key={r.id} style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>
                {r.to.avatarEmoji} {r.to.username} — pending
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
