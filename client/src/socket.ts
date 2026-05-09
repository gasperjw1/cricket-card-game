import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@swipe-sixer/shared";

// Connection URL resolution:
// - VITE_SERVER_URL env var wins (use to point to a remote server).
// - Otherwise, in production builds connect to the page's own origin
//   (the server serves the static client from the same Fly app).
// - In dev, fall back to the local tsx-watch server on :3001.
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.PROD ? undefined : "http://localhost:3001");

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const socket: AppSocket = io(SERVER_URL, {
  autoConnect: true,
});
