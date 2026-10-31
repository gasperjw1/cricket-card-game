import { randomBytes } from "node:crypto";
import prisma from "../db.js";

// Same format as the cricket game's inviteCode (server/src/match-registry.ts):
// 6 chars, crypto-random, charset excludes I/O/0/1 so codes read unambiguously
// aloud or typed. Collision check here is DB-backed instead of an in-memory Map.
const INVITE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const INVITE_LENGTH = 6;

function generateCode(): string {
  const bytes = randomBytes(INVITE_LENGTH);
  let code = "";
  for (let i = 0; i < INVITE_LENGTH; i++) {
    code += INVITE_CHARSET[bytes[i]! % INVITE_CHARSET.length];
  }
  return code;
}

export async function generateUniqueRoomCode(): Promise<string> {
  let code = generateCode();
  while (await prisma.platformRoom.findUnique({ where: { code } })) {
    code = generateCode();
  }
  return code;
}
