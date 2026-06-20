import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { prisma } from "./db.js";

export type AuthRequest = Request & { userId: string };

type TokenPayload = { sub: string; email: string };

export function issueToken(user: { id: string; email: string }) {
  return jwt.sign({ sub: user.id, email: user.email } satisfies TokenPayload, config.jwtSecret, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  try { return (jwt.verify(token, config.jwtSecret) as TokenPayload).sub; }
  catch { return null; }
}

export async function authenticate(request: Request, _response: Response, next: NextFunction) {
  const directUser = request.header("x-user-id");
  const bearer = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  let userId = directUser ?? "demo-user";
  if (bearer) {
    try { userId = (jwt.verify(bearer, config.jwtSecret) as TokenPayload).sub; }
    catch { userId = "demo-user"; }
  }
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  (request as AuthRequest).userId = exists?.id ?? "demo-user";
  next();
}

export function authUser(request: Request) {
  return (request as AuthRequest).userId;
}
