import type { Request, Response, NextFunction } from "express";
import type { RequestWithApiIntegration } from "./apiAuth";

/**
 * Returns middleware that requires the request to be authenticated as an API integration
 * with at least one of the given scopes. If req.apiIntegration is set, checks scopes;
 * otherwise passes through (for session-authenticated routes that don't use API token).
 */
export function requireScope(...scopes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const r = req as RequestWithApiIntegration;
    if (!r.apiIntegration) {
      return next();
    }
    const hasScope = scopes.some((s) => r.apiIntegration!.scopes.includes(s));
    if (!hasScope) {
      res.status(403).json({
        error: "Forbidden",
        message: "Insufficient scope",
      });
      return;
    }
    next();
  };
}
