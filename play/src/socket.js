import { io } from "socket.io-client";

// Same URL resolution as client/src/socket.ts: VITE_SERVER_URL override,
// else same-origin in production, else localhost:3001 in dev.
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.PROD ? undefined : "http://localhost:3001");

// Unlike the cricket client's socket (a module-level singleton that connects
// immediately), /play's socket needs a bearer token at connect time — so
// callers create one once they have a token, rather than importing a
// pre-connected instance.
export function connectPlaySocket(token) {
  const base = SERVER_URL ?? "";
  return io(`${base}/play`, { auth: { token } });
}
