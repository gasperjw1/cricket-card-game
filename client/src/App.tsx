import { useEffect, useState } from "react";
import { socket } from "./socket.ts";

interface HealthInfo {
  batsmen: number;
  bowlers: number;
  situations: number;
}

export function App() {
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    const serverUrl = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";
    fetch(`${serverUrl}/health`)
      .then((r) => r.json())
      .then((data) => setHealth(data.cardCounts as HealthInfo))
      .catch((err) => setHealthError(String(err)));

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return (
    <main>
      <h1>Swipe Sixer</h1>
      <p className="tagline">Turn-based cricket card game.</p>

      <span className={`status ${connected ? "connected" : "disconnected"}`}>
        {connected ? "● Connected to server" : "○ Disconnected"}
      </span>

      <div className="card-counts">
        {health
          ? `Card library loaded: ${health.batsmen} batsmen · ${health.bowlers} bowlers · ${health.situations} situation cards`
          : healthError
            ? `Could not reach server: ${healthError}`
            : "Loading card library…"}
      </div>
    </main>
  );
}
