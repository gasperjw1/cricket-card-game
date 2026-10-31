import { useState, useEffect, useCallback } from "react";
import { makeApi } from "./lib/api";
import { connectPlaySocket } from "./socket";
import AuthScreen from "./screens/AuthScreen";
import HomeScreen from "./screens/HomeScreen";
import RoomScreen from "./screens/RoomScreen";
import StatsScreen from "./screens/StatsScreen";
import WildReignScreen from "./games/WildReignScreen";

const CREAM = "#F7F5F2";
const INK = "#1F2430";
const MUTED = "#6B7280";
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("play-token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [notice, setNotice] = useState("");
  const [socket, setSocket] = useState(null);
  const [view, setView] = useState("home"); // "home" | "stats" — only relevant outside a room

  const api = useCallback(makeApi(token), [token]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api("auth/me")
      .then(({ user }) => setUser(user))
      .catch(() => {
        localStorage.removeItem("play-token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Connect the /play socket once authenticated; disconnect on logout/unmount.
  useEffect(() => {
    if (!token || !user) return;

    const s = connectPlaySocket(token);
    s.on("room:state", (state) => setRoom(state));
    s.on("room:closed", ({ reason }) => {
      setRoom(null);
      setGameState(null);
      setNotice(reason);
    });
    s.on("wildreign:state", (state) => setGameState(state));
    s.on("room:notice", ({ text }) => setNotice(text));
    s.on("connect", () => setSocket(s));

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [token, user]);

  function handleAuthed(u, t) {
    localStorage.setItem("play-token", t);
    setUser(u);
    setToken(t);
  }

  function logout() {
    api("auth/logout", {}).catch(() => {});
    localStorage.removeItem("play-token");
    setToken(null);
    setUser(null);
    setRoom(null);
  }

  function handleLeftRoom() {
    setRoom(null);
    setGameState(null);
  }

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FONT, color: MUTED,
      }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthed={handleAuthed} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: FONT, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: INK }}>🎲 Game Night</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!room && (
            <button onClick={() => setView(v => v === "home" ? "stats" : "home")} style={{
              background: "none", border: "1px solid #D1D5DB", borderRadius: 6,
              padding: "6px 12px", cursor: "pointer", fontSize: 13, color: "#374151", fontFamily: FONT,
            }}>
              {view === "home" ? "Stats" : "Home"}
            </button>
          )}
          <span style={{ color: "#374151", fontSize: 14 }}>{user.avatarEmoji} {user.username}</span>
          <button onClick={logout} style={{
            background: "none", border: "1px solid #D1D5DB", borderRadius: 6,
            padding: "6px 12px", cursor: "pointer", fontSize: 13, color: MUTED, fontFamily: FONT,
          }}>
            Log out
          </button>
        </div>
      </div>

      {notice && (
        <div style={{
          background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8,
          padding: "8px 12px", marginBottom: 16, fontSize: 13, color: "#92400E",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          {notice}
          <button onClick={() => setNotice("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#92400E" }}>✕</button>
        </div>
      )}

      {!socket ? (
        <div style={{ color: MUTED }}>Connecting…</div>
      ) : room && room.status === "lobby" ? (
        <RoomScreen socket={socket} me={user} room={room} onLeft={handleLeftRoom} />
      ) : room && room.gameType === "wildreign" ? (
        <WildReignScreen socket={socket} me={user} room={room} gameState={gameState} onLeft={handleLeftRoom} api={api} />
      ) : view === "stats" ? (
        <StatsScreen api={api} onBack={() => setView("home")} />
      ) : (
        <HomeScreen api={api} socket={socket} onRoomJoined={() => {}} />
      )}
    </div>
  );
}
