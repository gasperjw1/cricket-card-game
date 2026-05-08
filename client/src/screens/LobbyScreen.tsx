import { useState } from "react";
import type { MatchClient } from "../state.ts";

interface Props {
  client: MatchClient;
}

export function LobbyScreen({ client }: Props) {
  const [copied, setCopied] = useState(false);
  const { matchState, mySlot } = client;
  if (!matchState || !mySlot) return null;

  const me =
    mySlot === "A" ? matchState.players.A : matchState.players.B;
  const opponent =
    mySlot === "A" ? matchState.players.B : matchState.players.A;
  const bothConnected = matchState.players.B !== null;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(matchState.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — user can still type the code
    }
  };

  return (
    <main>
      <h1>Match Lobby</h1>
      <p className="tagline">
        {bothConnected
          ? "Both players connected — waiting to start."
          : "Share your invite code with a friend."}
      </p>

      <section className="invite-card">
        <div className="invite-label">Invite code</div>
        <div className="invite-code">{matchState.inviteCode}</div>
        <button className="btn ghost small" onClick={copyCode}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </section>

      <section className="players">
        <PlayerRow
          name={me?.displayName ?? "—"}
          slot={mySlot}
          connected={me?.connected ?? false}
          isMe
        />
        {opponent ? (
          <PlayerRow
            name={opponent.displayName}
            slot={opponent.slot}
            connected={opponent.connected}
          />
        ) : (
          <div className="player-row pending">
            <div className="player-slot">—</div>
            <div className="player-name">Waiting for opponent…</div>
          </div>
        )}
      </section>

      {bothConnected && (
        <p className="hint">
          (Coin toss + draft + ball loop come next — for now, both connected.)
        </p>
      )}

      <div className="lobby-actions">
        <button className="btn ghost" onClick={client.leaveMatch}>
          Leave
        </button>
      </div>
    </main>
  );
}

function PlayerRow(props: {
  name: string;
  slot: "A" | "B";
  connected: boolean;
  isMe?: boolean;
}) {
  return (
    <div className={`player-row ${props.connected ? "connected" : "offline"}`}>
      <div className="player-slot">{props.slot}</div>
      <div className="player-name">
        {props.name}
        {props.isMe && <span className="me-badge">you</span>}
      </div>
      <div className="player-status">
        {props.connected ? "● online" : "○ offline"}
      </div>
    </div>
  );
}
