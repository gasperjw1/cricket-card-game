// Registry of playable game types on the /play platform. Room creation and
// room:start both validate against this — the single place a new game
// declares its player-count constraints.

export type GameConfig = {
  label: string;
  minPlayers: number;
  maxPlayers: number;
};

export const GAME_CONFIGS: Record<string, GameConfig> = {
  wildreign: { label: "Wild Reign", minPlayers: 3, maxPlayers: 8 },
};
