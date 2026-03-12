import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { integrations } from "@shared/schema";

export interface ApiIntegration {
  id: string;
  scopes: string[];
  tokenExpiryDate: Date | null;
  createdBy: string;
}

export interface RequestWithApiIntegration extends Request {
  apiIntegration?: ApiIntegration;
}

/**
 * Middleware that validates Bearer API token and sets req.apiIntegration.
 * If no Authorization Bearer header, calls next() without setting (session auth may apply).
 * If token is invalid/expired/revoked, responds with 401.
 */
export function apiAuth(
  req: RequestWithApiIntegration,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  if (!token) return next();

  (async () => {
    try {
      const prefix = token.slice(0, 8);
      const rows = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.tokenPrefix, prefix),
            eq(integrations.status, "active")
          )
        );

      for (const row of rows) {
        const match = await bcrypt.compare(token, row.apiTokenHash);
        if (!match) continue;

        if (row.tokenExpiryDate && new Date(row.tokenExpiryDate) < new Date()) {
          res.status(401).json({
            error: "Unauthorized",
            message: "API token has expired",
          });
          return;
        }

        req.apiIntegration = {
          id: row.id,
          scopes: row.scopes ?? [],
          tokenExpiryDate: row.tokenExpiryDate,
          createdBy: row.createdBy,
        };
        return next();
      }

      res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or revoked API token",
      });
    } catch (err) {
      console.error("API token validation error:", err);
      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to validate API token",
      });
    }
  })();
}
