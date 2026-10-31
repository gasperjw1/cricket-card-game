import { useCallback, useEffect, useRef, useState } from "react";
import { REACTION_EMOJIS } from "@swipe-sixer/shared/play/reactions";
import { FELT_DARK, GOLD, IVORY, FONT_BODY, SP } from "./theme";

// Ephemeral table reactions: emoji bursts and GIF toasts broadcast by the
// server as `room:reaction`. Nothing here is persisted or replayed — a late
// joiner simply misses what already floated by, which is the point.

const EMOJI_TTL_MS = 2600;
const GIF_TTL_MS = 6000;
const MAX_LIVE = 30;
const SEND_COOLDOWN_MS = 1200; // gentler than the server's 5-per-10s window

export function useReactions(socket, roomId) {
  const [reactions, setReactions] = useState([]);
  const [cooldown, setCooldown] = useState(false);
  const [hint, setHint] = useState("");
  const timers = useRef(new Set());

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const onReaction = (r) => {
      setReactions(prev => [...prev, r].slice(-MAX_LIVE));
      later(() => setReactions(prev => prev.filter(x => x.id !== r.id)), r.kind === "gif" ? GIF_TTL_MS : EMOJI_TTL_MS);
    };
    socket.on("room:reaction", onReaction);
    return () => { socket.off("room:reaction", onReaction); };
  }, [socket, later]);

  // Every pending expiry/cooldown timer dies with the table.
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  // Deliberately NOT the screen's `emit()` helper: that one flips the shared
  // `busy` flag (disabling draw/discard mid-turn) and routes failures into the
  // game's error banner. Reactions get their own quiet path.
  const send = useCallback((kind, value) => {
    if (cooldown || !socket) return;
    setCooldown(true);
    setHint("");
    later(() => setCooldown(false), SEND_COOLDOWN_MS);
    socket.emit("room:reaction", { roomId, kind, value }, (res) => {
      if (res && !res.ok) {
        setHint(res.reason);
        later(() => setHint(""), 2500);
      }
    });
  }, [socket, roomId, cooldown, later]);

  return { reactions, send, cooldown, hint };
}

export function ReactionBar({ onSend, cooldown, hint, gifsAvailable, gifOpen, onToggleGifs }) {
  return (
    <div style={{ marginTop: SP.lg }}>
      <div style={{ display: "flex", gap: SP.xs, justifyContent: "center", flexWrap: "wrap" }}>
        {REACTION_EMOJIS.map(e => (
          <button
            key={e}
            onClick={() => onSend("emoji", e)}
            disabled={cooldown}
            aria-label={`React ${e}`}
            style={{
              width: 36, height: 36, borderRadius: 18, border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.06)", fontSize: 18, lineHeight: 1,
              cursor: cooldown ? "default" : "pointer", opacity: cooldown ? 0.5 : 1, transition: "opacity .15s",
            }}
          >
            {e}
          </button>
        ))}
        {gifsAvailable && (
          <button
            onClick={onToggleGifs}
            aria-expanded={gifOpen}
            style={{
              height: 36, padding: "0 12px", borderRadius: 18,
              border: `1px solid ${gifOpen ? GOLD : "rgba(255,255,255,0.1)"}`,
              background: gifOpen ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.06)",
              color: gifOpen ? GOLD : IVORY, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}
          >
            GIF
          </button>
        )}
      </div>
      <div style={{ minHeight: 14, textAlign: "center", fontSize: 10, color: GOLD, fontFamily: FONT_BODY, marginTop: 3 }}>
        {hint}
      </div>
    </div>
  );
}

export function GifPicker({ api, onPick, onClose, onUnavailable }) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  // Callbacks via refs so a fresh inline arrow from the parent doesn't re-run
  // the fetch effect (and re-hit the proxy) on every render.
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const t = setTimeout(async () => {
      try {
        const res = await api(`gifs/search?q=${encodeURIComponent(q.trim())}&limit=12`);
        if (!cancelled) setGifs(res.gifs ?? []);
      } catch (e) {
        if (cancelled) return;
        if (e?.message === "gifs_unavailable") { onUnavailableRef.current?.(); return; }
        setError("Couldn't load GIFs right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, q ? 350 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, api]);

  return (
    <div className="wr-pop-in" style={{
      marginTop: SP.sm, background: FELT_DARK, border: "1px solid rgba(201,168,76,0.3)",
      borderRadius: 10, padding: SP.sm,
    }}>
      <div style={{ display: "flex", gap: SP.sm, alignItems: "center" }}>
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search GIFs…"
          aria-label="Search GIFs"
          style={{
            flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 8, fontSize: 14, fontFamily: FONT_BODY,
            border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: IVORY, outline: "none",
          }}
        />
        <button onClick={onClose} aria-label="Close GIF picker" style={{
          background: "none", border: "none", cursor: "pointer", color: "rgba(248,243,232,0.6)", fontSize: 16, padding: 4,
        }}>✕</button>
      </div>
      {error && <div style={{ color: "#f87171", fontFamily: FONT_BODY, fontSize: 12, marginTop: SP.sm }}>{error}</div>}
      <div className="wr-gif-grid" style={{ display: "grid", gap: SP.xs, marginTop: SP.sm, maxHeight: 220, overflowY: "auto" }}>
        {gifs.map(g => (
          <button key={g.id} onClick={() => onPick(g)} aria-label="Send this GIF" style={{
            padding: 0, border: "none", background: "rgba(255,255,255,0.04)", cursor: "pointer",
            borderRadius: 6, overflow: "hidden", aspectRatio: "1 / 1",
          }}>
            <img src={g.previewUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: SP.xs, fontSize: 9, color: "rgba(248,243,232,0.4)", fontFamily: FONT_BODY }}>
        <span>{loading ? "Loading…" : (!error && gifs.length === 0 ? "No GIFs found." : "")}</span>
        <span>Powered by Tenor</span>
      </div>
    </div>
  );
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Emoji reactions float up from the sender's "lane" — a horizontal position
// derived from their seat, so you can tell who reacted without reading the
// tiny name label. Pointer-events off so it never blocks the table.
export function FloatingReactions({ reactions, players }) {
  const emojis = reactions.filter(r => r.kind === "emoji");
  if (emojis.length === 0) return null;
  const n = Math.max(players.length, 1);
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", borderRadius: 16, zIndex: 60 }}>
      {emojis.map(r => {
        const idx = Math.max(0, players.findIndex(p => p.userId === r.userId));
        const x = ((idx + 1) / (n + 1)) * 100;
        const drift = (hashStr(r.id) % 41) - 20;
        return (
          <div key={r.id} className="wr-float-up" style={{ position: "absolute", left: `${x}%`, bottom: 96, textAlign: "center", "--drift": `${drift}px` }}>
            <div style={{ fontSize: 34, lineHeight: 1 }}>{r.value}</div>
            <div style={{ fontSize: 9, color: IVORY, fontFamily: FONT_BODY, opacity: 0.85, marginTop: 2, whiteSpace: "nowrap" }}>{r.username}</div>
          </div>
        );
      })}
    </div>
  );
}

// GIFs stack in the bottom-right corner of the felt, newest on top, max 3.
export function GifToasts({ reactions }) {
  const gifs = reactions.filter(r => r.kind === "gif").slice(-3);
  if (gifs.length === 0) return null;
  return (
    <div aria-live="polite" style={{
      position: "absolute", right: SP.md, bottom: SP.md, zIndex: 70, pointerEvents: "none",
      display: "flex", flexDirection: "column-reverse", gap: SP.sm,
    }}>
      {gifs.map(r => (
        <div key={r.id} className="wr-gif-toast" style={{
          background: FELT_DARK, border: `1px solid ${GOLD}`, borderRadius: 10, padding: 4,
          boxShadow: "0 8px 24px rgba(0,0,0,.5)",
        }}>
          <img src={r.value} alt={`GIF from ${r.username}`} style={{ width: "100%", display: "block", borderRadius: 7 }} />
          <div style={{ fontSize: 9, color: IVORY, fontFamily: FONT_BODY, textAlign: "center", padding: "3px 0 1px", opacity: 0.85 }}>
            {r.username}
          </div>
        </div>
      ))}
    </div>
  );
}
