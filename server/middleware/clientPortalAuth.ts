import type { Request, Response, NextFunction } from "express";
import { createHmac, randomBytes } from "crypto";
import { storage } from "../storage";

const CLIENT_PORTAL_SECRET = process.env.SESSION_SECRET;
if (!CLIENT_PORTAL_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET environment variable is required in production");
}
const PORTAL_SECRET = CLIENT_PORTAL_SECRET || "dev-secret-not-for-production";
const TOKEN_EXPIRY_HOURS = 24 * 7; // 7 days

export interface ClientPortalTokenPayload {
  sessionId: string;
  clientId: string;
  portalAccountId: string;
  email: string;
  exp: number;
}

export async function createClientPortalToken(
  payload: Omit<ClientPortalTokenPayload, "exp" | "sessionId">,
  userAgent?: string,
  ipAddress?: string
): Promise<{ token: string; sessionId: string }> {
  const sessionId = randomBytes(32).toString("hex");
  const exp = Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;
  const expiresAt = new Date(exp);
  const data = JSON.stringify({ ...payload, sessionId, exp });
  const signature = createHmac("sha256", PORTAL_SECRET).update(data).digest("base64url");

  await storage.createPortalSession(
    sessionId,
    payload.clientId,
    payload.portalAccountId,
    expiresAt,
    userAgent,
    ipAddress
  );

  return { token: Buffer.from(data).toString("base64url") + "." + signature, sessionId };
}

export function parseClientPortalToken(token: string): ClientPortalTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const data = Buffer.from(parts[0], "base64url").toString("utf8");
    const expectedSig = createHmac("sha256", PORTAL_SECRET).update(data).digest("base64url");

    if (parts[1] !== expectedSig) return null;

    const payload = JSON.parse(data) as ClientPortalTokenPayload;
    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function verifyClientPortalToken(token: string): Promise<ClientPortalTokenPayload | null> {
  const payload = parseClientPortalToken(token);
  if (!payload) return null;

  const session = await storage.getPortalSession(payload.sessionId);
  if (!session) return null;
  if (session.revokedAt) return null;
  if (new Date() > session.expiresAt) return null;

  return payload;
}

export interface ClientPortalRequest extends Request {
  clientPortal?: ClientPortalTokenPayload;
}

export async function clientPortalAuth(req: ClientPortalRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized - missing token" });
  }

  const token = authHeader.substring(7);
  const payload = await verifyClientPortalToken(token);

  if (!payload) {
    return res.status(401).json({ message: "Unauthorized - invalid or expired token" });
  }

  req.clientPortal = payload;
  next();
}
