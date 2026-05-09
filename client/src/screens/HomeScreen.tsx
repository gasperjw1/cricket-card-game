import { useState } from "react";
import type { MatchClient } from "../state.ts";
import { HowToPlayScreen } from "./HowToPlayScreen.tsx";

interface Props {
  client: MatchClient;
}

type Mode = "menu" | "create" | "join" | "how-to-play";

/** Derive a default 4-char abbreviation from a display name. */
function defaultAbbrFromName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

export function HomeScreen({ client }: Props) {
  const [mode, setMode] = useState<Mode>("menu");
  const [displayName, setDisplayName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  /** Has the user manually edited the abbreviation? If false, it auto-fills from displayName. */
  const [abbrTouched, setAbbrTouched] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const effectiveAbbr = abbrTouched ? abbreviation : defaultAbbrFromName(displayName);
  const abbrValid = effectiveAbbr.length >= 2 && effectiveAbbr.length <= 4;

  const canCreate =
    displayName.trim().length > 0 && abbrValid && client.connected && !submitting;
  const canJoin =
    displayName.trim().length > 0 &&
    abbrValid &&
    inviteCode.trim().length === 6 &&
    client.connected &&
    !submitting;

  const handleNameChange = (value: string): void => {
    setDisplayName(value);
    if (!abbrTouched) {
      // Auto-suggestion follows the name until the user explicitly edits.
      setAbbreviation(defaultAbbrFromName(value));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setSubmitting(true);
    await client.createMatch(displayName, effectiveAbbr);
    setSubmitting(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canJoin) return;
    setSubmitting(true);
    await client.joinMatch(inviteCode, displayName, effectiveAbbr);
    setSubmitting(false);
  };

  if (mode === "how-to-play") {
    return <HowToPlayScreen onBack={() => setMode("menu")} />;
  }

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
          <button
            className="btn ghost"
            onClick={() => setMode("how-to-play")}
          >
            How to play
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
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Yash"
            />
          </label>
          <label>
            Team abbreviation
            <input
              type="text"
              value={effectiveAbbr}
              maxLength={4}
              onChange={(e) => {
                setAbbrTouched(true);
                setAbbreviation(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                );
              }}
              placeholder="2–4 chars"
              style={{ textTransform: "uppercase", letterSpacing: "0.2em" }}
            />
            <small className="dim-text">
              Shown in the scorebug (e.g. ENG, SL-A, KOLI). Auto-fills from your name.
            </small>
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
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Friend"
            />
          </label>
          <label>
            Team abbreviation
            <input
              type="text"
              value={effectiveAbbr}
              maxLength={4}
              onChange={(e) => {
                setAbbrTouched(true);
                setAbbreviation(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                );
              }}
              placeholder="2–4 chars"
              style={{ textTransform: "uppercase", letterSpacing: "0.2em" }}
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
