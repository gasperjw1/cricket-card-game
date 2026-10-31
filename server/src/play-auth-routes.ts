import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "./db.js";
import { authenticatePlayer, publicUser } from "./play-auth.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;

// POST /play/api/auth/signup
router.post("/signup", async (req: Request, res: Response) => {
  const { email, username, password } = req.body as { email?: string; username?: string; password?: string };

  if (!email || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ error: "Enter a valid email" });
    return;
  }
  if (!username || username.trim().length < 2) {
    res.status(400).json({ error: "Username must be at least 2 characters" });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const usernameTrimmed = username.trim();
  const usernameLower = usernameTrimmed.toLowerCase();

  const [emailTaken, usernameTaken] = await Promise.all([
    prisma.platformUser.findUnique({ where: { email: normalizedEmail } }),
    prisma.platformUser.findUnique({ where: { usernameLower } }),
  ]);
  if (emailTaken) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }
  if (usernameTaken) {
    res.status(409).json({ error: "That username is taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.platformUser.create({
    data: { email: normalizedEmail, username: usernameTrimmed, usernameLower, passwordHash },
  });
  const session = await prisma.platformSession.create({ data: { userId: user.id } });

  res.json({ token: session.token, user: publicUser(user) });
});

// POST /play/api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.platformUser.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    res.status(401).json({ error: "Incorrect email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Incorrect email or password" });
    return;
  }

  // A fresh session per login — doesn't invalidate sessions on other devices.
  const session = await prisma.platformSession.create({ data: { userId: user.id } });
  res.json({ token: session.token, user: publicUser(user) });
});

// POST /play/api/auth/logout — only the caller's own session/device.
router.post("/logout", async (req: Request, res: Response) => {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = auth.slice(7);
  await prisma.platformSession.deleteMany({ where: { token } });
  res.json({ ok: true });
});

// GET /play/api/auth/me — restores a session on page load.
router.get("/me", async (req: Request, res: Response) => {
  const user = await authenticatePlayer(req, res);
  if (!user) return;
  res.json({ user: publicUser(user) });
});

export default router;
