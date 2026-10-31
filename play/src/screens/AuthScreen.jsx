import { useState } from "react";
import { makeApi } from "../lib/api";

const CREAM = "#F7F5F2";
const INK = "#1F2430";
const ACCENT = "#5B6EF5";
const CARD = "#FFFFFF";
const MUTED = "#6B7280";
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8,
  border: "1.5px solid #E5E7EB", fontSize: 14, marginBottom: 10, fontFamily: FONT, outline: "none",
};

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const api = makeApi(null);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const path = mode === "login" ? "auth/login" : "auth/signup";
      const body = mode === "login" ? { email, password } : { email, username, password };
      const { token, user } = await api(path, body);
      onAuthed(user, token);
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = email && password && (mode === "login" || username);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: CREAM, fontFamily: FONT,
    }}>
      <div style={{
        background: CARD, borderRadius: 16, padding: 32, width: "100%", maxWidth: 380,
        boxShadow: "0 12px 40px rgba(0,0,0,.08)",
      }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: INK, marginBottom: 4 }}>🎲 Game Night</div>
        <div style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>
          {mode === "login" ? "Welcome back." : "Create an account to start playing."}
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#F0F0F5", borderRadius: 8, padding: 4 }}>
          {["login", "signup"].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer",
                fontWeight: 600, fontSize: 13, fontFamily: FONT,
                background: mode === m ? "white" : "transparent",
                color: mode === m ? ACCENT : MUTED,
                boxShadow: mode === m ? "0 2px 6px rgba(0,0,0,.08)" : "none",
              }}
            >
              {m === "login" ? "Log In" : "Sign Up"}
            </button>
          ))}
        </div>

        <input
          type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)} style={inputStyle}
        />
        {mode === "signup" && (
          <input
            placeholder="Username" value={username}
            onChange={e => setUsername(e.target.value)} style={inputStyle}
          />
        )}
        <input
          type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && canSubmit && submit()}
          style={inputStyle}
        />

        {error && <p style={{ color: "#DC2626", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}

        <button
          onClick={submit}
          disabled={loading || !canSubmit}
          style={{
            width: "100%", padding: "12px 0", borderRadius: 8, border: "none",
            cursor: loading || !canSubmit ? "default" : "pointer",
            background: ACCENT, color: "white", fontWeight: 700, fontSize: 15, fontFamily: FONT,
            opacity: loading || !canSubmit ? 0.6 : 1,
          }}
        >
          {loading ? "…" : mode === "login" ? "Log In" : "Sign Up"}
        </button>
      </div>
    </div>
  );
}
