import type { Request, Response } from "express";
import prisma from "./db.js";

// Shared by REST routes (play-auth-routes.ts, play-friends-routes.ts) and the
// Socket.IO auth middleware in play/index.ts — one place that knows how to
// turn a bearer token into a PlatformUser.

export async function resolveSession(token: string) {
  const session = await prisma.platformSession.findUnique({
    where: { token },
    include: { user: true },
  });
  return session?.user ?? null;
}

export async function authenticatePlayer(req: Request, res: Response) {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const token = auth.slice(7);
  const user = await resolveSession(token);
  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return null;
  }
  return user;
}

export function publicUser(user: { id: string; email: string; username: string; avatarEmoji: string }) {
  return { id: user.id, email: user.email, username: user.username, avatarEmoji: user.avatarEmoji };
}
