import { CoinTossScreen } from "./screens/CoinTossScreen.tsx";
import { HomeScreen } from "./screens/HomeScreen.tsx";
import { LobbyScreen } from "./screens/LobbyScreen.tsx";
import { useMatchClient } from "./state.ts";

export function App() {
  const client = useMatchClient();
  const inMatch = client.matchState !== null && client.mySlot !== null;
  if (!inMatch) return <HomeScreen client={client} />;
  if (client.matchState!.phase === "coin-toss") {
    return <CoinTossScreen client={client} />;
  }
  return <LobbyScreen client={client} />;
}
