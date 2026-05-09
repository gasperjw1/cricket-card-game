import { CoinTossScreen } from "./screens/CoinTossScreen.tsx";
import { HomeScreen } from "./screens/HomeScreen.tsx";
import { InningsScreen } from "./screens/InningsScreen.tsx";
import { LobbyScreen } from "./screens/LobbyScreen.tsx";
import { useMatchClient } from "./state.ts";

export function App() {
  const client = useMatchClient();
  return (
    <>
      <PortraitLock />
      <AppRouter client={client} />
    </>
  );
}

function AppRouter({ client }: { client: ReturnType<typeof useMatchClient> }) {
  const inMatch = client.matchState !== null && client.mySlot !== null;
  if (!inMatch) return <HomeScreen client={client} />;
  const phase = client.matchState!.phase;
  if (phase === "coin-toss") return <CoinTossScreen client={client} />;
  if (phase === "innings" || phase === "innings-break" || phase === "match-over") {
    return <InningsScreen client={client} />;
  }
  return <LobbyScreen client={client} />;
}

// Hidden by default; CSS only reveals it on phone-sized landscape viewports.
// See `.portrait-lock` in index.css.
function PortraitLock() {
  return (
    <div className="portrait-lock" aria-hidden="true">
      <div className="portrait-lock-inner">
        <div className="portrait-lock-icon">📱</div>
        <h2>Please rotate your device</h2>
        <p>Swipe Sixer is designed for portrait mode on phones.</p>
      </div>
    </div>
  );
}
