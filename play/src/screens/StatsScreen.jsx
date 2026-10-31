import { useState, useEffect, useCallback } from "react";

const INK = "#1F2430";
const MUTED = "#6B7280";
const ACCENT = "#5B6EF5";
const CARD = "#FFFFFF";
const BORDER = "#E5E7EB";
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const GAME_LABELS = { wildreign: "Wild Reign" };

const cardStyle = {
  background: CARD, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`,
};

export default function StatsScreen({ api, onBack }) {
  const [stats, setStats] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [h2h, setH2h] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api("stats/me"), api("friends")])
      .then(([statsRes, friendsRes]) => {
        setStats(statsRes.stats);
        setFriends(friendsRes.friends);
      })
      .finally(() => setLoading(false));
  }, [api]);

  const loadHeadToHead = useCallback(async (friend) => {
    setSelectedFriend(friend);
    setH2h(null);
    const res = await api(`stats/head-to-head?userId=${friend.userId}&gameType=wildreign`);
    setH2h(res);
  }, [api]);

  return (
    <div style={{ maxWidth: 640 }}>
      <button onClick={onBack} style={{
        background: "none", border: "none", cursor: "pointer", color: MUTED,
        fontFamily: FONT, fontSize: 13, marginBottom: 16, padding: 0,
      }}>
        ← Back
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 800, color: INK, marginBottom: 12, fontSize: 15 }}>Your Stats</div>
          {loading && <p style={{ color: MUTED, fontSize: 13 }}>Loading…</p>}
          {!loading && stats.length === 0 && (
            <p style={{ color: MUTED, fontSize: 13 }}>No games played yet.</p>
          )}
          {stats.map(s => (
            <div key={s.gameType} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, color: INK, fontSize: 14, marginBottom: 6 }}>
                {GAME_LABELS[s.gameType] ?? s.gameType}
              </div>
              <div style={{ display: "flex", gap: 20, fontSize: 13, color: "#374151" }}>
                <span>Played: <strong>{s.gamesPlayed}</strong></span>
                <span>Wins: <strong style={{ color: "#16A34A" }}>{s.wins}</strong></span>
                <span>Losses: <strong>{s.losses}</strong></span>
                {s.bestScore != null && <span>Best score: <strong>{s.bestScore}</strong></span>}
              </div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, color: INK, marginBottom: 12, fontSize: 15 }}>Head-to-Head</div>
          {friends.length === 0 && (
            <p style={{ color: MUTED, fontSize: 13 }}>Add friends to compare records.</p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {friends.map(f => (
              <button
                key={f.userId}
                onClick={() => loadHeadToHead(f)}
                style={{
                  padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontFamily: FONT, fontSize: 13,
                  border: selectedFriend?.userId === f.userId ? `1.5px solid ${ACCENT}` : `1px solid ${BORDER}`,
                  background: selectedFriend?.userId === f.userId ? "#EEF0FE" : "white",
                  color: selectedFriend?.userId === f.userId ? ACCENT : "#374151",
                }}
              >
                {f.avatarEmoji} {f.username}
              </button>
            ))}
          </div>

          {selectedFriend && !h2h && <p style={{ color: MUTED, fontSize: 13 }}>Loading…</p>}
          {selectedFriend && h2h && (
            h2h.gamesTogether === 0 ? (
              <p style={{ color: MUTED, fontSize: 13 }}>No Wild Reign matches with {selectedFriend.username} yet.</p>
            ) : (
              <div style={{ fontSize: 13, color: "#374151" }}>
                <div style={{ marginBottom: 6 }}>
                  {h2h.gamesTogether} match{h2h.gamesTogether === 1 ? "" : "es"} together
                </div>
                <div>You: <strong style={{ color: "#16A34A" }}>{h2h.myWins}</strong></div>
                <div>{selectedFriend.username}: <strong>{h2h.theirWins}</strong></div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
