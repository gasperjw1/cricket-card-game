import { HomeScreen } from "./screens/HomeScreen.tsx";
import { LobbyScreen } from "./screens/LobbyScreen.tsx";
import { useMatchClient } from "./state.ts";

export function App() {
  const client = useMatchClient();
  const inMatch = client.matchState !== null && client.mySlot !== null;
  return inMatch ? <LobbyScreen client={client} /> : <HomeScreen client={client} />;
}
