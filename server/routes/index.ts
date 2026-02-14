import type { Express } from "express";
import type { Server } from "http";
import { setupAuth, registerAuthRoutes } from "../replit_integrations/auth";

/**
 * Register all API routes. Order matters for middleware and feature gating.
 */
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  const { registerObjectStorageRoutes } = await import("../replit_integrations/object_storage");
  registerObjectStorageRoutes(app);

  const { registerAppRoutes } = await import("./app");
  registerAppRoutes(app);

  return httpServer;
}
