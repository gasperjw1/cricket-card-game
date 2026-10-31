import { Router, type Request, type Response } from "express";
import prisma from "./db.js";
import { authenticatePlayer } from "./play-auth.js";

const router = Router();

function publicFriend(user: { id: string; username: string; avatarEmoji: string }) {
  return { userId: user.id, username: user.username, avatarEmoji: user.avatarEmoji };
}

// POST /play/api/friends/request  { username }
router.post("/request", async (req: Request, res: Response) => {
  const me = await authenticatePlayer(req, res);
  if (!me) return;

  const { username } = req.body as { username?: string };
  if (!username || !username.trim()) {
    res.status(400).json({ error: "Username required" });
    return;
  }
  const usernameLower = username.trim().toLowerCase();

  const target = await prisma.platformUser.findUnique({ where: { usernameLower } });
  if (!target) {
    res.status(404).json({ error: "No user with that username" });
    return;
  }
  if (target.id === me.id) {
    res.status(400).json({ error: "You can't friend yourself" });
    return;
  }

  const existing = await prisma.platformFriendship.findFirst({
    where: {
      OR: [
        { requesterId: me.id, addresseeId: target.id },
        { requesterId: target.id, addresseeId: me.id },
      ],
    },
  });
  if (existing) {
    res.status(409).json({ error: "A friend request already exists between you two" });
    return;
  }

  const friendship = await prisma.platformFriendship.create({
    data: { requesterId: me.id, addresseeId: target.id },
  });
  res.json({ id: friendship.id, status: friendship.status });
});

// POST /play/api/friends/:id/accept
router.post("/:id/accept", async (req: Request, res: Response) => {
  const me = await authenticatePlayer(req, res);
  if (!me) return;

  const friendship = await prisma.platformFriendship.findUnique({ where: { id: req.params.id } });
  if (!friendship) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  if (friendship.addresseeId !== me.id) {
    res.status(403).json({ error: "Only the recipient can accept this request" });
    return;
  }
  if (friendship.status !== "pending") {
    res.status(400).json({ error: "Request is no longer pending" });
    return;
  }

  const updated = await prisma.platformFriendship.update({
    where: { id: friendship.id },
    data: { status: "accepted" },
  });
  res.json({ id: updated.id, status: updated.status });
});

// POST /play/api/friends/:id/decline — either party may decline/cancel; deleting
// (rather than marking "declined") lets a new request be sent again later.
router.post("/:id/decline", async (req: Request, res: Response) => {
  const me = await authenticatePlayer(req, res);
  if (!me) return;

  const friendship = await prisma.platformFriendship.findUnique({ where: { id: req.params.id } });
  if (!friendship) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  if (friendship.requesterId !== me.id && friendship.addresseeId !== me.id) {
    res.status(403).json({ error: "Not your request" });
    return;
  }

  await prisma.platformFriendship.delete({ where: { id: friendship.id } });
  res.json({ ok: true });
});

// GET /play/api/friends — accepted friends (both directions merged), plus
// pending incoming/outgoing requests separately for a "Friends" / "Requests" UI.
router.get("/", async (req: Request, res: Response) => {
  const me = await authenticatePlayer(req, res);
  if (!me) return;

  const rows = await prisma.platformFriendship.findMany({
    where: { OR: [{ requesterId: me.id }, { addresseeId: me.id }] },
    include: { requester: true, addressee: true },
  });

  const friends = rows
    .filter(r => r.status === "accepted")
    .map(r => publicFriend(r.requesterId === me.id ? r.addressee : r.requester));

  const incoming = rows
    .filter(r => r.status === "pending" && r.addresseeId === me.id)
    .map(r => ({ id: r.id, from: publicFriend(r.requester) }));

  const outgoing = rows
    .filter(r => r.status === "pending" && r.requesterId === me.id)
    .map(r => ({ id: r.id, to: publicFriend(r.addressee) }));

  res.json({ friends, incoming, outgoing });
});

export default router;
