import type { Express } from "express";
import type { Server } from "http";
import {
  setupAuth,
  registerAuthRoutes as registerReplitAuthRoutes,
} from "../replit_integrations/auth";
import { registerAuthRoutes } from "./auth";
import { registerOrganizationsRoutes } from "./organizations";
import { registerStaffRoutes } from "./staff";
import { registerJobsRoutes } from "./jobs";
import { registerScheduleRoutes } from "./schedule";
import { registerPCItemsRoutes } from "./pcItems";
import { registerJobMilestonesRoutes } from "./jobMilestones";
import { registerNotificationsRoutes } from "./notifications";
import { registerClientPortalRoutes } from "./clientPortal";
import { registerQuotesRoutes } from "./quotes";
import { registerInvoicesRoutes } from "./invoices";
import { registerLineItemsRoutes } from "./lineItems";
import { registerPaymentsRoutes } from "./payments";
import { registerVehiclesRoutes } from "./vehicles";
import { registerJobPhotosRoutes } from "./jobPhotos";
import { registerJobReceiptsRoutes } from "./jobReceipts";
import { registerProductivityRoutes } from "./productivity";
import { registerKpiRoutes } from "./kpi";
import { registerClientsRoutes } from "./clients";
import { registerMilestonesRoutes } from "./milestones";
import { registerPayRoutes } from "./pay";

/**
 * Register all API routes. Order matters for middleware and feature gating.
 */
export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerReplitAuthRoutes(app);

  const { registerObjectStorageRoutes } = await import(
    "../replit_integrations/object_storage"
  );
  registerObjectStorageRoutes(app);

  registerAuthRoutes(app);
  registerOrganizationsRoutes(app);
  registerStaffRoutes(app);
  registerJobsRoutes(app);
  registerScheduleRoutes(app);
  registerPCItemsRoutes(app);
  registerJobMilestonesRoutes(app);
  registerNotificationsRoutes(app);
  registerClientPortalRoutes(app);
  registerQuotesRoutes(app);
  registerInvoicesRoutes(app);
  registerLineItemsRoutes(app);
  registerPaymentsRoutes(app);
  registerVehiclesRoutes(app);
  registerJobPhotosRoutes(app);
  registerJobReceiptsRoutes(app);
  registerProductivityRoutes(app);
  registerKpiRoutes(app);
  registerClientsRoutes(app);
  registerMilestonesRoutes(app);
  registerPayRoutes(app);

  return httpServer;
}
