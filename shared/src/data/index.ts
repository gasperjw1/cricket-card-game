import type { CardRoster } from "../types/cards.js";
import roster from "./cards.json" with { type: "json" };

export const CARDS: CardRoster = roster as CardRoster;
