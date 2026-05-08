import { CoinTossScreen } from "./screens/CoinTossScreen.tsx";
import { HomeScreen } from "./screens/HomeScreen.tsx";
import { InningsScreen } from "./screens/InningsScreen.tsx";
import { LobbyScreen } from "./screens/LobbyScreen.tsx";
import { useMatchClient } from "./state.ts";

export function App() {
  const client = useMatchClient();
  const inMatch = client.matchState !== null && client.mySlot !== null;
  if (!inMatch) return <HomeScreen client={client} />;
  const phase = client.matchState!.phase;
  if (phase === "coin-toss") return <CoinTossScreen client={client} />;
  if (phase === "innings" || phase === "innings-break" || phase === "match-over") {
    return <InningsScreen client={client} />;
  }
  return <LobbyScreen client={client} />;
}
