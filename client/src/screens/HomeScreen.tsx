import { lazy, Suspense, useState } from "react";
import type { BotDifficulty, MatchFormat } from "@swipe-sixer/shared";
import { MATCH_FORMATS } from "@swipe-sixer/shared";
import { SettingsPanel } from "../components/SettingsPanel.tsx";
import { initSfx } from "../lib/sfx.ts";
import type { MatchClient } from "../state.ts";

// Career mode lazy-loaded — adds ~30KB of UI not needed on the home
// screen unless the player taps "World Cup".
const CareerHomeScreen = lazy(() =>
  import("./CareerHomeScreen.tsx").then((m) => ({ default: m.CareerHomeScreen })),
);

// Lazy-loaded so the ~24KB of card-roster data the guide imports isn't
// in the main bundle — only fetched when the user opens "How to play".
const HowToPlayScreen = lazy(() => import("./HowToPlayScreen.tsx"));

interface Props {
  client: MatchClient;
}

type Mode = "menu" | "vs-cpu" | "create" | "join" | "how-to-play" | "about" | "career";
type SettingsMode = "open" | "closed";

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
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("Domestic");
  const [matchFormat, setMatchFormat] = useState<MatchFormat>("T1");
  const [settings, setSettingsMode] = useState<SettingsMode>("closed");

  // Initialize the audio pool on the user's first interactive tap so iOS
  // Safari's autoplay restriction is satisfied. Safe to call repeatedly.
  const onAnyPrimary = (): void => initSfx();

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
    await client.createMatch(displayName, effectiveAbbr, matchFormat);
    setSubmitting(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canJoin) return;
    setSubmitting(true);
    await client.joinMatch(inviteCode, displayName, effectiveAbbr);
    setSubmitting(false);
  };

  const handleVsCpu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setSubmitting(true);
    await client.createBotMatch(displayName, effectiveAbbr, botDifficulty, matchFormat);
    setSubmitting(false);
  };

  if (mode === "how-to-play") {
    return (
      <Suspense fallback={<main><h1>How to Play</h1><p className="dim-text">Loading…</p></main>}>
        <HowToPlayScreen onBack={() => setMode("menu")} />
      </Suspense>
    );
  }

  if (mode === "career") {
    return (
      <Suspense fallback={<main><h1>🏆 World Cup</h1><p className="dim-text">Loading…</p></main>}>
        <CareerHomeScreen onBack={() => setMode("menu")} />
      </Suspense>
    );
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
            className="btn primary big"
            onClick={() => { onAnyPrimary(); setMode("career"); }}
          >
            🏆 World Cup
          </button>
          <button
            className="btn primary big"
            disabled={!client.connected}
            onClick={() => { onAnyPrimary(); setMode("vs-cpu"); }}
          >
            🤖 Play vs CPU
          </button>
          <div className="online-row">
            <span className="dim-text online-row-label">Online 1v1</span>
            <div className="online-row-buttons">
              <button
                className="btn small"
                disabled={!client.connected}
                onClick={() => { onAnyPrimary(); setMode("create"); }}
              >
                Create
              </button>
              <button
                className="btn small"
                disabled={!client.connected}
                onClick={() => { onAnyPrimary(); setMode("join"); }}
              >
                Join
              </button>
            </div>
          </div>
          <div className="menu-secondary">
            <button
              className="btn ghost small"
              onClick={() => setMode("how-to-play")}
            >
              How to play
            </button>
            <button
              className="btn ghost small"
              onClick={() => { onAnyPrimary(); setSettingsMode("open"); }}
              aria-label="Settings"
            >
              ⚙ Settings
            </button>
            <button
              className="btn ghost small"
              onClick={() => setMode("about")}
            >
              About
            </button>
          </div>
          <p className="home-disclaimer">
            Fan-made cricket card game · not affiliated with the ICC, BCCI,
            any cricket board, or any player.{" "}
            <button
              className="btn link inline"
              onClick={() => setMode("about")}
            >
              Read more
            </button>
          </p>
        </div>
      )}

      {mode === "about" && <AboutModal onClose={() => setMode("menu")} />}

      {settings === "open" && (
        <SettingsPanel onClose={() => setSettingsMode("closed")} />
      )}

      {mode === "vs-cpu" && (
        <form className="form" onSubmit={handleVsCpu}>
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
          </label>
          <fieldset className="difficulty-picker">
            <legend>CPU difficulty</legend>
            {(["Gully", "Domestic", "International"] as const).map((d) => (
              <label key={d} className={botDifficulty === d ? "selected" : ""}>
                <input
                  type="radio"
                  name="difficulty"
                  value={d}
                  checked={botDifficulty === d}
                  onChange={() => setBotDifficulty(d)}
                />
                <strong>{d}</strong>
                <small className="dim-text">{difficultyBlurb(d)}</small>
              </label>
            ))}
          </fieldset>
          <fieldset className="difficulty-picker">
            <legend>Format</legend>
            {(Object.keys(MATCH_FORMATS) as MatchFormat[]).map((f) => {
              const fmt = MATCH_FORMATS[f];
              return (
                <label key={f} className={matchFormat === f ? "selected" : ""}>
                  <input
                    type="radio"
                    name="format"
                    value={f}
                    checked={matchFormat === f}
                    onChange={() => setMatchFormat(f)}
                  />
                  <strong>{fmt.label}</strong>
                  <small className="dim-text">{fmt.blurb}</small>
                </label>
              );
            })}
          </fieldset>
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={() => setMode("menu")}>
              Back
            </button>
            <button type="submit" className="btn primary" disabled={!canCreate}>
              {submitting ? "Starting…" : `Play ${matchFormat} vs ${botDifficulty}`}
            </button>
          </div>
        </form>
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
          <fieldset className="difficulty-picker">
            <legend>Format</legend>
            {(Object.keys(MATCH_FORMATS) as MatchFormat[]).map((f) => {
              const fmt = MATCH_FORMATS[f];
              return (
                <label key={f} className={matchFormat === f ? "selected" : ""}>
                  <input
                    type="radio"
                    name="format-online"
                    value={f}
                    checked={matchFormat === f}
                    onChange={() => setMatchFormat(f)}
                  />
                  <strong>{fmt.label}</strong>
                  <small className="dim-text">{fmt.blurb}</small>
                </label>
              );
            })}
          </fieldset>
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={() => setMode("menu")}>
              Back
            </button>
            <button type="submit" className="btn primary" disabled={!canCreate}>
              {submitting ? "Creating…" : `Create ${matchFormat}`}
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

function difficultyBlurb(d: BotDifficulty): string {
  switch (d) {
    case "Gully": return "Random picks. Cricket on the street.";
    case "Domestic": return "Bowls to your weaknesses, defends carefully.";
    case "International": return "Plus saves Elite cards for pressure balls.";
  }
}

/** Legal / attribution disclaimer modal — fan-made notice covering the
 *  use of real player names. Reachable from the Home menu "About" button. */
function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>About Swipe Sixer</h2>
        <p>
          Swipe Sixer is a fan-made, non-commercial cricket card game built
          by a solo developer for cricket fans.
        </p>
        <h3>Disclaimer</h3>
        <p>
          This game is <strong>not affiliated with, endorsed by, sponsored
          by, or connected to</strong> the International Cricket Council
          (ICC), Board of Control for Cricket in India (BCCI), any other
          national cricket board, any franchise league (IPL, BBL, PSL,
          etc.), or any individual cricketer.
        </p>
        <p>
          Player names are used purely for fan-creation purposes to
          identify real-world cricketing abilities and styles in a
          card-game context. All names, likenesses, logos, and trademarks
          remain the property of their respective owners. No part of this
          project is intended to suggest endorsement or partnership.
        </p>
        <p>
          If you are a rights-holder and would like a player removed,
          please reach out via the GitHub repository linked below.
        </p>
        <h3>Open source</h3>
        <p>
          <a
            href="https://github.com/gasperjw1/cricket-card-game"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/gasperjw1/cricket-card-game
          </a>
        </p>
        <div className="form-actions" style={{ marginTop: "1rem" }}>
          <button className="btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
