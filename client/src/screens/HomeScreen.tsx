import { useState } from "react";
import type { MatchClient } from "../state.ts";

interface Props {
  client: MatchClient;
}

type Mode = "menu" | "create" | "join";

export function HomeScreen({ client }: Props) {
  const [mode, setMode] = useState<Mode>("menu");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canCreate = displayName.trim().length > 0 && client.connected && !submitting;
  const canJoin =
    displayName.trim().length > 0 &&
    inviteCode.trim().length === 6 &&
    client.connected &&
    !submitting;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setSubmitting(true);
    await client.createMatch(displayName);
    setSubmitting(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canJoin) return;
    setSubmitting(true);
    await client.joinMatch(inviteCode, displayName);
    setSubmitting(false);
  };

  return (
    <main>
      <h1>Swipe Sixer</h1>
      <p className="tagline">Turn-based cricket card game.</p>

      <span className={`status ${client.connected ? "connected" : "disconnected"}`}>
        {client.connected ? "● Connected" : "○ Connecting…"}
      </span>

      {mode === "menu" && client.errorMessage && (
        <div className="notice" style={{ marginTop: "1.5rem" }}>
          {client.errorMessage}
          <button
            className="btn ghost small"
            onClick={client.clearError}
            style={{ marginLeft: "0.75rem" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {mode === "menu" && (
        <div className="menu">
          <button
            className="btn primary"
            disabled={!client.connected}
            onClick={() => setMode("create")}
          >
            Create match
          </button>
          <button
            className="btn"
            disabled={!client.connected}
            onClick={() => setMode("join")}
          >
            Join match
          </button>
        </div>
      )}

      {mode === "create" && (
        <form className="form" onSubmit={handleCreate}>
          <label>
            Your name
            <input
              type="text"
              autoFocus
              value={displayName}
              maxLength={20}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Yash"
            />
          </label>
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={() => setMode("menu")}>
              Back
            </button>
            <button type="submit" className="btn primary" disabled={!canCreate}>
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {mode === "join" && (
        <form className="form" onSubmit={handleJoin}>
          <label>
            Your name
            <input
              type="text"
              autoFocus
              value={displayName}
              maxLength={20}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Friend"
            />
          </label>
          <label>
            Invite code
            <input
              type="text"
              value={inviteCode}
              maxLength={6}
              onChange={(e) =>
                setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              placeholder="6-character code"
              style={{ textTransform: "uppercase", letterSpacing: "0.3em" }}
            />
          </label>
          {client.errorMessage && (
            <div className="error">{client.errorMessage}</div>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                client.clearError();
                setMode("menu");
              }}
            >
              Back
            </button>
            <button type="submit" className="btn primary" disabled={!canJoin}>
              {submitting ? "Joining…" : "Join"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
