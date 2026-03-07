import type { Express } from "express";
import type { Server } from "http";
import {
  setupAuth,
  registerAuthRoutes as registerReplitAuthRoutes,
} from "../replit_integrations/auth";
import { registerAuthRoutes } from "../modules/auth/routes";
import { registerSettingsRoutes } from "../modules/settings/routes";
import { registerStaffRoutes } from "../modules/staff/routes";
import { registerJobsRoutes } from "../modules/jobs/routes";
import { registerScheduleRoutes } from "../modules/schedule/routes";
import { registerActivitiesRoutes } from "../modules/activities/routes";
import { registerPCItemsRoutes } from "../modules/pcItems/routes";
import { registerJobMilestonesRoutes } from "../modules/jobMilestones/routes";
import { registerNotificationsRoutes } from "../modules/notifications/routes";
import { registerClientPortalRoutes } from "../modules/clientPortal/routes";
import { registerQuotesRoutes } from "../modules/quotes/routes";
import { registerInvoicesRoutes } from "../modules/invoices/routes";
import { registerLineItemsRoutes } from "../modules/lineItems/routes";
import { registerPaymentsRoutes } from "../modules/payments/routes";
import { registerVehiclesRoutes } from "../modules/vehicles/routes";
import { registerJobPhotosRoutes } from "../modules/jobPhotos/routes";
import { registerJobReceiptsRoutes } from "../modules/jobReceipts/routes";
import { registerProductivityRoutes } from "../modules/productivity/routes";
import { registerKpiRoutes } from "../modules/kpi/routes";
import { registerClientsRoutes } from "../modules/clients/routes";
import { registerMilestonesRoutes } from "../modules/milestones/routes";
import { registerPayRoutes } from "../modules/pay/routes";
import { registerRolesRoutes } from "../modules/roles/routes";
import { registerStripeRoutes } from "../modules/stripe/routes";
import { registerQuoteRespondRoutes } from "../modules/quoteRespond/routes";

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
  registerSettingsRoutes(app);
  registerStaffRoutes(app);
  registerJobsRoutes(app);
  registerScheduleRoutes(app);
  registerActivitiesRoutes(app);
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
  registerRolesRoutes(app);
  registerStripeRoutes(app);
  registerQuoteRespondRoutes(app);

  return httpServer;
}
