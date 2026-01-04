import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { 
  insertJobSchema, 
  insertScheduleEntrySchema, 
  insertPCItemSchema,
  insertNotificationSchema,
  insertClientAccessTokenSchema,
  insertQuoteSchema,
  insertInvoiceSchema,
  insertLineItemSchema,
  insertPaymentSchema,
  insertVehicleSchema,
  insertVehicleAssignmentSchema,
  insertChecklistTemplateSchema,
  insertChecklistTemplateItemSchema,
  insertChecklistRunSchema,
  insertChecklistRunItemSchema,
  insertJobPhotoSchema,
  insertVehicleMaintenanceSchema,
  insertJobTimeEntrySchema,
  insertJobCostEntrySchema,
  insertStaffCapacityRuleSchema,
  insertStaffTimeOffSchema,
  userRoles, 
  employmentTypes, 
  userPermissions,
  pcItemStatuses,
  notificationTypes,
  quoteStatuses,
  invoiceStatuses,
  paymentStatuses,
  paymentMethods,
  vehicleStatuses,
  checklistTargets,
  checklistItemTypes,
  maintenanceStatuses,
  timeEntryCategories,
  costCategories,
  timeOffStatuses
} from "@shared/schema";
import { z } from "zod";

// Validation schema for staff profile updates
const updateStaffSchema = z.object({
  roles: z.array(z.enum(userRoles)).optional(),
  employmentType: z.enum(employmentTypes).optional(),
  permissions: z.array(z.enum(userPermissions)).optional(),
  isActive: z.boolean().optional(),
  phone: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);

  // Middleware to auto-create staff profile for authenticated users
  const ensureStaffProfile = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (userId) {
        const existingProfile = await storage.getStaffProfileByUserId(userId);
        if (!existingProfile) {
          await storage.createStaffProfile({
            userId,
            roles: ["plumber"],
            employmentType: "permanent",
            permissions: [],
            isActive: true,
          });
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };

  // =====================
  // STAFF PROFILE ROUTES
  // =====================

  // Get all staff profiles
  app.get("/api/staff", isAuthenticated, ensureStaffProfile, async (req, res) => {
    try {
      const profiles = await storage.getStaffProfiles();
      res.json(profiles);
    } catch (err: any) {
      console.error("Error fetching staff:", err);
      res.status(500).json({ message: "Failed to fetch staff profiles" });
    }
  });

  // Get single staff profile
  app.get("/api/staff/:id", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getStaffProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Staff profile not found" });
      }
      res.json(profile);
    } catch (err: any) {
      console.error("Error fetching staff profile:", err);
      res.status(500).json({ message: "Failed to fetch staff profile" });
    }
  });

  // Update staff profile (roles, permissions, employment type)
  app.patch("/api/staff/:id", isAuthenticated, async (req: any, res) => {
    try {
      // Validate input
      const validation = updateStaffSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateStaffProfile(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Staff profile not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating staff profile:", err);
      res.status(500).json({ message: "Failed to update staff profile" });
    }
  });

  // =====================
  // STAFF WORKING HOURS ROUTES
  // =====================

  // Get staff working hours
  app.get("/api/staff/:id/working-hours", isAuthenticated, async (req, res) => {
    try {
      const hours = await storage.getStaffWorkingHours(req.params.id);
      res.json(hours);
    } catch (err: any) {
      console.error("Error fetching working hours:", err);
      res.status(500).json({ message: "Failed to fetch working hours" });
    }
  });

  // Set staff working hours (replaces all existing hours)
  app.put("/api/staff/:id/working-hours", isAuthenticated, async (req, res) => {
    try {
      const { hours } = req.body;
      if (!Array.isArray(hours)) {
        return res.status(400).json({ message: "Hours must be an array" });
      }
      const updated = await storage.setStaffWorkingHours(req.params.id, hours);
      res.json(updated);
    } catch (err: any) {
      console.error("Error setting working hours:", err);
      res.status(500).json({ message: "Failed to set working hours" });
    }
  });

  // =====================
  // JOB ROUTES
  // =====================

  // Get all jobs
  app.get("/api/jobs", isAuthenticated, ensureStaffProfile, async (req, res) => {
    try {
      const { status } = req.query;
      let jobsList;
      if (status && typeof status === "string") {
        jobsList = await storage.getJobsByStatus(status);
      } else {
        jobsList = await storage.getJobs();
      }
      res.json(jobsList);
    } catch (err: any) {
      console.error("Error fetching jobs:", err);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  // Get single job
  app.get("/api/jobs/:id", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (err: any) {
      console.error("Error fetching job:", err);
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  // Create job
  app.post("/api/jobs", isAuthenticated, async (req: any, res) => {
    try {
      const validation = insertJobSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const userId = req.user?.claims?.sub;
      const job = await storage.createJob({
        ...validation.data,
        createdById: userId,
      });
      res.status(201).json(job);
    } catch (err: any) {
      console.error("Error creating job:", err);
      res.status(500).json({ message: "Failed to create job" });
    }
  });

  // Update job
  app.patch("/api/jobs/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertJobSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateJob(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating job:", err);
      res.status(500).json({ message: "Failed to update job" });
    }
  });

  // Delete job
  app.delete("/api/jobs/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteJob(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting job:", err);
      res.status(500).json({ message: "Failed to delete job" });
    }
  });

  // =====================
  // SCHEDULE ROUTES
  // =====================

  // Get all schedule entries
  app.get("/api/schedule", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, jobId, staffId } = req.query;
      
      let entries;
      if (startDate && endDate && typeof startDate === "string" && typeof endDate === "string") {
        entries = await storage.getScheduleEntriesByDateRange(startDate, endDate);
      } else if (jobId && typeof jobId === "string") {
        entries = await storage.getScheduleEntriesByJob(jobId);
      } else if (staffId && typeof staffId === "string") {
        entries = await storage.getScheduleEntriesByStaff(staffId);
      } else {
        entries = await storage.getScheduleEntries();
      }
      res.json(entries);
    } catch (err: any) {
      console.error("Error fetching schedule:", err);
      res.status(500).json({ message: "Failed to fetch schedule entries" });
    }
  });

  // Get single schedule entry
  app.get("/api/schedule/:id", isAuthenticated, async (req, res) => {
    try {
      const entry = await storage.getScheduleEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      res.json(entry);
    } catch (err: any) {
      console.error("Error fetching schedule entry:", err);
      res.status(500).json({ message: "Failed to fetch schedule entry" });
    }
  });

  // Create schedule entry
  app.post("/api/schedule", isAuthenticated, async (req: any, res) => {
    try {
      // Get the user's staff profile as fallback if no staffId provided
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      if (!staffProfile) {
        return res.status(400).json({ message: "Staff profile not found" });
      }

      // Allow assigning to specific staff member or default to current user
      const scheduleData = {
        jobId: req.body.jobId,
        staffId: req.body.staffId || staffProfile.id,
        scheduledDate: req.body.scheduledDate,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        durationHours: req.body.durationHours || "7.5",
        status: req.body.status || "scheduled",
        notes: req.body.notes,
      };

      const validation = insertScheduleEntrySchema.safeParse(scheduleData);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const entry = await storage.createScheduleEntry(validation.data);
      res.status(201).json(entry);
    } catch (err: any) {
      console.error("Error creating schedule entry:", err);
      res.status(500).json({ message: "Failed to create schedule entry" });
    }
  });

  // Create multiple schedule entries at once (for multi-day scheduling)
  app.post("/api/schedule/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      if (!staffProfile) {
        return res.status(400).json({ message: "Staff profile not found" });
      }

      const { entries } = req.body;
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ message: "Entries array is required" });
      }

      const created = [];
      for (const entry of entries) {
        const scheduleData = {
          jobId: entry.jobId,
          staffId: entry.staffId || staffProfile.id,
          scheduledDate: entry.scheduledDate,
          startTime: entry.startTime,
          endTime: entry.endTime,
          durationHours: entry.durationHours || "7.5",
          status: entry.status || "scheduled",
          notes: entry.notes,
        };

        const validation = insertScheduleEntrySchema.safeParse(scheduleData);
        if (!validation.success) {
          return res.status(400).json({ message: validation.error.errors[0].message });
        }

        const createdEntry = await storage.createScheduleEntry(validation.data);
        created.push(createdEntry);
      }

      res.status(201).json(created);
    } catch (err: any) {
      console.error("Error creating bulk schedule entries:", err);
      res.status(500).json({ message: "Failed to create schedule entries" });
    }
  });

  // Mark schedule entry as complete
  app.post("/api/schedule/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateScheduleEntry(req.params.id, { status: "completed" });
      if (!updated) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error completing schedule entry:", err);
      res.status(500).json({ message: "Failed to complete schedule entry" });
    }
  });

  // Cancel schedule entry
  app.post("/api/schedule/:id/cancel", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateScheduleEntry(req.params.id, { status: "cancelled" });
      if (!updated) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error cancelling schedule entry:", err);
      res.status(500).json({ message: "Failed to cancel schedule entry" });
    }
  });

  // Check staff availability for a date
  app.get("/api/schedule/availability/:staffId/:date", isAuthenticated, async (req, res) => {
    try {
      const { staffId, date } = req.params;
      const availability = await storage.getStaffAvailability(staffId, date);
      res.json(availability);
    } catch (err: any) {
      console.error("Error checking availability:", err);
      res.status(500).json({ message: "Failed to check availability" });
    }
  });

  // Update schedule entry
  app.patch("/api/schedule/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertScheduleEntrySchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateScheduleEntry(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating schedule entry:", err);
      res.status(500).json({ message: "Failed to update schedule entry" });
    }
  });

  // Delete schedule entry
  app.delete("/api/schedule/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteScheduleEntry(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting schedule entry:", err);
      res.status(500).json({ message: "Failed to delete schedule entry" });
    }
  });

  // =====================
  // PC ITEM ROUTES
  // =====================

  // Get PC items for a job
  app.get("/api/jobs/:jobId/pc-items", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getPCItems(req.params.jobId);
      res.json(items);
    } catch (err: any) {
      console.error("Error fetching PC items:", err);
      res.status(500).json({ message: "Failed to fetch PC items" });
    }
  });

  // Create PC item
  app.post("/api/jobs/:jobId/pc-items", isAuthenticated, async (req, res) => {
    try {
      const validation = insertPCItemSchema.safeParse({
        ...req.body,
        jobId: req.params.jobId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const item = await storage.createPCItem(validation.data);
      res.status(201).json(item);
    } catch (err: any) {
      console.error("Error creating PC item:", err);
      res.status(500).json({ message: "Failed to create PC item" });
    }
  });

  // Update PC item
  app.patch("/api/pc-items/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertPCItemSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updatePCItem(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "PC item not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating PC item:", err);
      res.status(500).json({ message: "Failed to update PC item" });
    }
  });

  // Complete PC item
  app.post("/api/pc-items/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const completed = await storage.completePCItem(req.params.id, userId);
      if (!completed) {
        return res.status(404).json({ message: "PC item not found" });
      }
      res.json(completed);
    } catch (err: any) {
      console.error("Error completing PC item:", err);
      res.status(500).json({ message: "Failed to complete PC item" });
    }
  });

  // Delete PC item
  app.delete("/api/pc-items/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deletePCItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "PC item not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting PC item:", err);
      res.status(500).json({ message: "Failed to delete PC item" });
    }
  });

  // =====================
  // NOTIFICATION ROUTES
  // =====================

  // Get notifications for current user
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const notificationsList = await storage.getNotifications(userId);
      res.json(notificationsList);
    } catch (err: any) {
      console.error("Error fetching notifications:", err);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (err: any) {
      console.error("Error fetching notification count:", err);
      res.status(500).json({ message: "Failed to fetch notification count" });
    }
  });

  // Mark notification as read
  app.patch("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.markNotificationRead(req.params.id);
      if (!updated) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error marking notification read:", err);
      res.status(500).json({ message: "Failed to mark notification read" });
    }
  });

  // Mark all notifications as read
  app.patch("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      await storage.markAllNotificationsRead(userId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error marking all notifications read:", err);
      res.status(500).json({ message: "Failed to mark all notifications read" });
    }
  });

  // Delete notification
  app.delete("/api/notifications/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteNotification(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting notification:", err);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // =====================
  // CLIENT PORTAL ROUTES
  // =====================

  // Generate share link for a job
  app.post("/api/jobs/:jobId/share", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const job = await storage.getJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const accessToken = await storage.createClientAccessToken({
        jobId: req.params.jobId,
        createdById: userId,
        isActive: true,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      });

      res.status(201).json(accessToken);
    } catch (err: any) {
      console.error("Error creating share link:", err);
      res.status(500).json({ message: "Failed to create share link" });
    }
  });

  // Get share links for a job
  app.get("/api/jobs/:jobId/share", isAuthenticated, async (req, res) => {
    try {
      const tokens = await storage.getClientAccessTokensByJob(req.params.jobId);
      res.json(tokens);
    } catch (err: any) {
      console.error("Error fetching share links:", err);
      res.status(500).json({ message: "Failed to fetch share links" });
    }
  });

  // Revoke share link
  app.delete("/api/share/:id", isAuthenticated, async (req, res) => {
    try {
      const revoked = await storage.revokeClientAccessToken(req.params.id);
      if (!revoked) {
        return res.status(404).json({ message: "Share link not found" });
      }
      res.json({ revoked: true });
    } catch (err: any) {
      console.error("Error revoking share link:", err);
      res.status(500).json({ message: "Failed to revoke share link" });
    }
  });

  // PUBLIC: Get job details by token (no auth required)
  app.get("/api/portal/:token", async (req, res) => {
    try {
      const accessToken = await storage.getClientAccessToken(req.params.token);
      if (!accessToken) {
        return res.status(404).json({ message: "Invalid or expired link" });
      }

      // Check if token is expired
      if (accessToken.expiresAt && new Date(accessToken.expiresAt) < new Date()) {
        return res.status(410).json({ message: "This link has expired" });
      }

      const job = await storage.getJob(accessToken.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Get PC items for the job
      const pcItemsList = await storage.getPCItems(accessToken.jobId);

      // Get invoices for the job
      const jobInvoices = await storage.getInvoicesByJob(accessToken.jobId);

      // Return limited job info for client view
      res.json({
        job: {
          id: job.id,
          clientName: job.clientName,
          address: job.address,
          jobType: job.jobType,
          status: job.status,
          description: job.description,
        },
        pcItems: pcItemsList.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          dueDate: item.dueDate,
        })),
        invoices: jobInvoices
          .filter((inv) => inv.status !== "draft")
          .map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            status: inv.status,
            total: inv.total,
            amountPaid: inv.amountPaid,
            amountDue: inv.amountDue,
            dueDate: inv.dueDate,
          })),
      });
    } catch (err: any) {
      console.error("Error fetching portal data:", err);
      res.status(500).json({ message: "Failed to fetch job details" });
    }
  });

  // =====================
  // QUOTE ROUTES
  // =====================

  // Get all quotes
  app.get("/api/quotes", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.query;
      let quotesList;
      if (status && typeof status === "string") {
        quotesList = await storage.getQuotesByStatus(status);
      } else {
        quotesList = await storage.getQuotes();
      }
      res.json(quotesList);
    } catch (err: any) {
      console.error("Error fetching quotes:", err);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  // Get single quote with line items
  app.get("/api/quotes/:id", isAuthenticated, async (req, res) => {
    try {
      const quote = await storage.getQuoteWithLineItems(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (err: any) {
      console.error("Error fetching quote:", err);
      res.status(500).json({ message: "Failed to fetch quote" });
    }
  });

  // Create quote
  app.post("/api/quotes", isAuthenticated, async (req: any, res) => {
    try {
      const validation = insertQuoteSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const userId = req.user?.claims?.sub;
      const quote = await storage.createQuote({
        ...validation.data,
        createdById: userId,
      });
      res.status(201).json(quote);
    } catch (err: any) {
      console.error("Error creating quote:", err);
      res.status(500).json({ message: "Failed to create quote" });
    }
  });

  // Update quote
  app.patch("/api/quotes/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertQuoteSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateQuote(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating quote:", err);
      res.status(500).json({ message: "Failed to update quote" });
    }
  });

  // Send quote to client
  app.post("/api/quotes/:id/send", isAuthenticated, async (req, res) => {
    try {
      const quote = await storage.sendQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (err: any) {
      console.error("Error sending quote:", err);
      res.status(500).json({ message: "Failed to send quote" });
    }
  });

  // Accept quote
  app.post("/api/quotes/:id/accept", isAuthenticated, async (req, res) => {
    try {
      const quote = await storage.acceptQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (err: any) {
      console.error("Error accepting quote:", err);
      res.status(500).json({ message: "Failed to accept quote" });
    }
  });

  // Reject quote
  app.post("/api/quotes/:id/reject", isAuthenticated, async (req, res) => {
    try {
      const quote = await storage.rejectQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (err: any) {
      console.error("Error rejecting quote:", err);
      res.status(500).json({ message: "Failed to reject quote" });
    }
  });

  // Convert quote to job
  app.post("/api/quotes/:id/convert-to-job", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.convertQuoteToJob(req.params.id);
      if (!result) {
        return res.status(400).json({ message: "Quote must be accepted before converting to job" });
      }
      res.json(result);
    } catch (err: any) {
      console.error("Error converting quote to job:", err);
      res.status(500).json({ message: "Failed to convert quote to job" });
    }
  });

  // Delete quote
  app.delete("/api/quotes/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteQuote(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting quote:", err);
      res.status(500).json({ message: "Failed to delete quote" });
    }
  });

  // =====================
  // INVOICE ROUTES
  // =====================

  // Get all invoices
  app.get("/api/invoices", isAuthenticated, async (req, res) => {
    try {
      const { status, jobId } = req.query;
      let invoicesList;
      if (jobId && typeof jobId === "string") {
        invoicesList = await storage.getInvoicesByJob(jobId);
      } else if (status && typeof status === "string") {
        invoicesList = await storage.getInvoicesByStatus(status);
      } else {
        invoicesList = await storage.getInvoices();
      }
      res.json(invoicesList);
    } catch (err: any) {
      console.error("Error fetching invoices:", err);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Get single invoice with details
  app.get("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const invoice = await storage.getInvoiceWithDetails(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (err: any) {
      console.error("Error fetching invoice:", err);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  // Create invoice
  app.post("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const validation = insertInvoiceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const userId = req.user?.claims?.sub;
      const invoice = await storage.createInvoice({
        ...validation.data,
        createdById: userId,
      });
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error creating invoice:", err);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Create invoice from job
  app.post("/api/jobs/:jobId/invoice", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const invoice = await storage.createInvoiceFromJob(req.params.jobId, userId);
      if (!invoice) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error creating invoice from job:", err);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Create invoice from quote
  app.post("/api/quotes/:quoteId/invoice", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const invoice = await storage.createInvoiceFromQuote(req.params.quoteId, userId);
      if (!invoice) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error creating invoice from quote:", err);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Update invoice
  app.patch("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertInvoiceSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateInvoice(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating invoice:", err);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  // Send invoice
  app.post("/api/invoices/:id/send", isAuthenticated, async (req, res) => {
    try {
      const invoice = await storage.sendInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (err: any) {
      console.error("Error sending invoice:", err);
      res.status(500).json({ message: "Failed to send invoice" });
    }
  });

  // Delete invoice
  app.delete("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteInvoice(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting invoice:", err);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Generate invoice from job
  app.post("/api/invoices/generate/job/:jobId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const invoice = await storage.createInvoiceFromJob(req.params.jobId, userId);
      if (!invoice) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error generating invoice from job:", err);
      res.status(500).json({ message: "Failed to generate invoice" });
    }
  });

  // Generate invoice from quote
  app.post("/api/invoices/generate/quote/:quoteId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const invoice = await storage.createInvoiceFromQuote(req.params.quoteId, userId);
      if (!invoice) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error generating invoice from quote:", err);
      res.status(500).json({ message: "Failed to generate invoice" });
    }
  });

  // =====================
  // LINE ITEM ROUTES
  // =====================

  // Get line items for quote
  app.get("/api/quotes/:quoteId/line-items", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getLineItemsByQuote(req.params.quoteId);
      res.json(items);
    } catch (err: any) {
      console.error("Error fetching line items:", err);
      res.status(500).json({ message: "Failed to fetch line items" });
    }
  });

  // Get line items for invoice
  app.get("/api/invoices/:invoiceId/line-items", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getLineItemsByInvoice(req.params.invoiceId);
      res.json(items);
    } catch (err: any) {
      console.error("Error fetching line items:", err);
      res.status(500).json({ message: "Failed to fetch line items" });
    }
  });

  // Create line item for quote
  app.post("/api/quotes/:quoteId/line-items", isAuthenticated, async (req, res) => {
    try {
      const validation = insertLineItemSchema.safeParse({
        ...req.body,
        quoteId: req.params.quoteId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const item = await storage.createLineItem(validation.data);
      res.status(201).json(item);
    } catch (err: any) {
      console.error("Error creating line item:", err);
      res.status(500).json({ message: "Failed to create line item" });
    }
  });

  // Create line item for invoice
  app.post("/api/invoices/:invoiceId/line-items", isAuthenticated, async (req, res) => {
    try {
      const validation = insertLineItemSchema.safeParse({
        ...req.body,
        invoiceId: req.params.invoiceId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const item = await storage.createLineItem(validation.data);
      res.status(201).json(item);
    } catch (err: any) {
      console.error("Error creating line item:", err);
      res.status(500).json({ message: "Failed to create line item" });
    }
  });

  // Update line item
  app.patch("/api/line-items/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertLineItemSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateLineItem(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Line item not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating line item:", err);
      res.status(500).json({ message: "Failed to update line item" });
    }
  });

  // Delete line item
  app.delete("/api/line-items/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteLineItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Line item not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting line item:", err);
      res.status(500).json({ message: "Failed to delete line item" });
    }
  });

  // =====================
  // PAYMENT ROUTES
  // =====================

  // Get payments for invoice
  app.get("/api/invoices/:invoiceId/payments", isAuthenticated, async (req, res) => {
    try {
      const paymentsList = await storage.getPaymentsByInvoice(req.params.invoiceId);
      res.json(paymentsList);
    } catch (err: any) {
      console.error("Error fetching payments:", err);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // Create payment
  app.post("/api/invoices/:invoiceId/payments", isAuthenticated, async (req, res) => {
    try {
      const validation = insertPaymentSchema.safeParse({
        ...req.body,
        invoiceId: req.params.invoiceId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const payment = await storage.createPayment(validation.data);
      res.status(201).json(payment);
    } catch (err: any) {
      console.error("Error creating payment:", err);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  // Complete payment
  app.post("/api/payments/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const payment = await storage.completePayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (err: any) {
      console.error("Error completing payment:", err);
      res.status(500).json({ message: "Failed to complete payment" });
    }
  });

  // Update payment
  app.patch("/api/payments/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertPaymentSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updatePayment(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating payment:", err);
      res.status(500).json({ message: "Failed to update payment" });
    }
  });

  // =====================
  // PHASE 4: VEHICLE ROUTES
  // =====================

  // List all vehicles
  app.get("/api/vehicles", isAuthenticated, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const vehiclesList = status 
        ? await storage.getVehiclesByStatus(status)
        : await storage.getVehicles();
      res.json(vehiclesList);
    } catch (err: any) {
      console.error("Error fetching vehicles:", err);
      res.status(500).json({ message: "Failed to fetch vehicles" });
    }
  });

  // Get single vehicle with current assignment
  app.get("/api/vehicles/:id", isAuthenticated, async (req, res) => {
    try {
      const vehicle = await storage.getVehicleWithAssignment(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      res.json(vehicle);
    } catch (err: any) {
      console.error("Error fetching vehicle:", err);
      res.status(500).json({ message: "Failed to fetch vehicle" });
    }
  });

  // Create vehicle
  app.post("/api/vehicles", isAuthenticated, async (req, res) => {
    try {
      const validation = insertVehicleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const vehicle = await storage.createVehicle(validation.data);
      res.status(201).json(vehicle);
    } catch (err: any) {
      console.error("Error creating vehicle:", err);
      res.status(500).json({ message: "Failed to create vehicle" });
    }
  });

  // Update vehicle
  app.patch("/api/vehicles/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertVehicleSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateVehicle(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating vehicle:", err);
      res.status(500).json({ message: "Failed to update vehicle" });
    }
  });

  // Delete vehicle
  app.delete("/api/vehicles/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteVehicle(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting vehicle:", err);
      res.status(500).json({ message: "Failed to delete vehicle" });
    }
  });

  // =====================
  // VEHICLE ASSIGNMENT ROUTES
  // =====================

  // Get vehicle assignments
  app.get("/api/vehicles/:vehicleId/assignments", isAuthenticated, async (req, res) => {
    try {
      const assignments = await storage.getVehicleAssignments(req.params.vehicleId);
      res.json(assignments);
    } catch (err: any) {
      console.error("Error fetching assignments:", err);
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  // Assign vehicle to staff
  app.post("/api/vehicles/:vehicleId/assign", isAuthenticated, async (req: any, res) => {
    try {
      const validation = insertVehicleAssignmentSchema.safeParse({
        ...req.body,
        vehicleId: req.params.vehicleId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const assignment = await storage.assignVehicle(validation.data);
      res.status(201).json(assignment);
    } catch (err: any) {
      console.error("Error assigning vehicle:", err);
      res.status(500).json({ message: "Failed to assign vehicle" });
    }
  });

  // Return vehicle (end assignment)
  app.post("/api/vehicle-assignments/:id/return", isAuthenticated, async (req, res) => {
    try {
      const returned = await storage.returnVehicle(req.params.id);
      if (!returned) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      res.json(returned);
    } catch (err: any) {
      console.error("Error returning vehicle:", err);
      res.status(500).json({ message: "Failed to return vehicle" });
    }
  });

  // =====================
  // CHECKLIST TEMPLATE ROUTES
  // =====================

  // List checklist templates
  app.get("/api/checklist-templates", isAuthenticated, async (req, res) => {
    try {
      const target = req.query.target as string | undefined;
      const templates = target
        ? await storage.getChecklistTemplatesByTarget(target)
        : await storage.getChecklistTemplates();
      res.json(templates);
    } catch (err: any) {
      console.error("Error fetching checklist templates:", err);
      res.status(500).json({ message: "Failed to fetch checklist templates" });
    }
  });

  // Get single checklist template with items
  app.get("/api/checklist-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const template = await storage.getChecklistTemplateWithItems(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (err: any) {
      console.error("Error fetching checklist template:", err);
      res.status(500).json({ message: "Failed to fetch checklist template" });
    }
  });

  // Create checklist template
  app.post("/api/checklist-templates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const validation = insertChecklistTemplateSchema.safeParse({
        ...req.body,
        createdById: userId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const template = await storage.createChecklistTemplate(validation.data);
      res.status(201).json(template);
    } catch (err: any) {
      console.error("Error creating checklist template:", err);
      res.status(500).json({ message: "Failed to create checklist template" });
    }
  });

  // Update checklist template
  app.patch("/api/checklist-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertChecklistTemplateSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateChecklistTemplate(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating checklist template:", err);
      res.status(500).json({ message: "Failed to update checklist template" });
    }
  });

  // Delete checklist template
  app.delete("/api/checklist-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteChecklistTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting checklist template:", err);
      res.status(500).json({ message: "Failed to delete checklist template" });
    }
  });

  // =====================
  // CHECKLIST TEMPLATE ITEM ROUTES
  // =====================

  // Get template items
  app.get("/api/checklist-templates/:templateId/items", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getChecklistTemplateItems(req.params.templateId);
      res.json(items);
    } catch (err: any) {
      console.error("Error fetching template items:", err);
      res.status(500).json({ message: "Failed to fetch template items" });
    }
  });

  // Create template item
  app.post("/api/checklist-templates/:templateId/items", isAuthenticated, async (req, res) => {
    try {
      const validation = insertChecklistTemplateItemSchema.safeParse({
        ...req.body,
        templateId: req.params.templateId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const item = await storage.createChecklistTemplateItem(validation.data);
      res.status(201).json(item);
    } catch (err: any) {
      console.error("Error creating template item:", err);
      res.status(500).json({ message: "Failed to create template item" });
    }
  });

  // Update template item
  app.patch("/api/checklist-template-items/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertChecklistTemplateItemSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateChecklistTemplateItem(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating template item:", err);
      res.status(500).json({ message: "Failed to update template item" });
    }
  });

  // Delete template item
  app.delete("/api/checklist-template-items/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteChecklistTemplateItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting template item:", err);
      res.status(500).json({ message: "Failed to delete template item" });
    }
  });

  // =====================
  // CHECKLIST RUN ROUTES
  // =====================

  // List checklist runs with optional filters
  app.get("/api/checklist-runs", isAuthenticated, async (req, res) => {
    try {
      const filters = {
        vehicleId: req.query.vehicleId as string | undefined,
        jobId: req.query.jobId as string | undefined,
        completedById: req.query.completedById as string | undefined,
      };
      const runs = await storage.getChecklistRuns(filters);
      res.json(runs);
    } catch (err: any) {
      console.error("Error fetching checklist runs:", err);
      res.status(500).json({ message: "Failed to fetch checklist runs" });
    }
  });

  // Get single checklist run with items
  app.get("/api/checklist-runs/:id", isAuthenticated, async (req, res) => {
    try {
      const run = await storage.getChecklistRunWithItems(req.params.id);
      if (!run) {
        return res.status(404).json({ message: "Checklist run not found" });
      }
      res.json(run);
    } catch (err: any) {
      console.error("Error fetching checklist run:", err);
      res.status(500).json({ message: "Failed to fetch checklist run" });
    }
  });

  // Start a new checklist run
  app.post("/api/checklist-runs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      
      const validation = insertChecklistRunSchema.safeParse({
        ...req.body,
        completedById: staffProfile?.id,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const run = await storage.startChecklistRun(validation.data);
      res.status(201).json(run);
    } catch (err: any) {
      console.error("Error starting checklist run:", err);
      res.status(500).json({ message: "Failed to start checklist run" });
    }
  });

  // Complete a checklist run
  app.post("/api/checklist-runs/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const completed = await storage.completeChecklistRun(req.params.id);
      if (!completed) {
        return res.status(404).json({ message: "Checklist run not found" });
      }
      res.json(completed);
    } catch (err: any) {
      console.error("Error completing checklist run:", err);
      res.status(500).json({ message: "Failed to complete checklist run" });
    }
  });

  // =====================
  // CHECKLIST RUN ITEM ROUTES
  // =====================

  // Get run items
  app.get("/api/checklist-runs/:runId/items", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getChecklistRunItems(req.params.runId);
      res.json(items);
    } catch (err: any) {
      console.error("Error fetching run items:", err);
      res.status(500).json({ message: "Failed to fetch run items" });
    }
  });

  // Update run item (answer a checklist question)
  app.patch("/api/checklist-run-items/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertChecklistRunItemSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateChecklistRunItem(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating run item:", err);
      res.status(500).json({ message: "Failed to update run item" });
    }
  });

  // =====================
  // JOB PHOTO ROUTES
  // =====================

  // Get photos for a job
  app.get("/api/jobs/:jobId/photos", isAuthenticated, async (req, res) => {
    try {
      const photos = await storage.getJobPhotos(req.params.jobId);
      res.json(photos);
    } catch (err: any) {
      console.error("Error fetching job photos:", err);
      res.status(500).json({ message: "Failed to fetch job photos" });
    }
  });

  // Get single photo
  app.get("/api/job-photos/:id", isAuthenticated, async (req, res) => {
    try {
      const photo = await storage.getJobPhoto(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      res.json(photo);
    } catch (err: any) {
      console.error("Error fetching job photo:", err);
      res.status(500).json({ message: "Failed to fetch job photo" });
    }
  });

  // Upload photo metadata (actual file upload handled separately)
  app.post("/api/jobs/:jobId/photos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);

      // Generate filename from URL if not provided
      let filename = req.body.filename;
      if (!filename && req.body.url) {
        try {
          const urlObj = new URL(req.body.url);
          filename = urlObj.pathname.split('/').pop() || `photo-${Date.now()}.jpg`;
        } catch {
          filename = `photo-${Date.now()}.jpg`;
        }
      }

      const validation = insertJobPhotoSchema.safeParse({
        ...req.body,
        filename,
        jobId: req.params.jobId,
        uploadedById: staffProfile?.id,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const photo = await storage.createJobPhoto(validation.data);
      res.status(201).json(photo);
    } catch (err: any) {
      console.error("Error creating job photo:", err);
      res.status(500).json({ message: "Failed to create job photo" });
    }
  });

  // Update photo (caption, category)
  app.patch("/api/job-photos/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertJobPhotoSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateJobPhoto(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Photo not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating job photo:", err);
      res.status(500).json({ message: "Failed to update job photo" });
    }
  });

  // Delete photo
  app.delete("/api/job-photos/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteJobPhoto(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Photo not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting job photo:", err);
      res.status(500).json({ message: "Failed to delete job photo" });
    }
  });

  // =====================
  // VEHICLE MAINTENANCE ROUTES
  // =====================

  // Get maintenance records for a vehicle
  app.get("/api/vehicles/:vehicleId/maintenance", isAuthenticated, async (req, res) => {
    try {
      const records = await storage.getVehicleMaintenanceRecords(req.params.vehicleId);
      res.json(records);
    } catch (err: any) {
      console.error("Error fetching maintenance records:", err);
      res.status(500).json({ message: "Failed to fetch maintenance records" });
    }
  });

  // Get all scheduled maintenance
  app.get("/api/vehicle-maintenance/scheduled", isAuthenticated, async (req, res) => {
    try {
      const records = await storage.getScheduledMaintenance();
      res.json(records);
    } catch (err: any) {
      console.error("Error fetching scheduled maintenance:", err);
      res.status(500).json({ message: "Failed to fetch scheduled maintenance" });
    }
  });

  // Get single maintenance record
  app.get("/api/vehicle-maintenance/:id", isAuthenticated, async (req, res) => {
    try {
      const record = await storage.getVehicleMaintenance(req.params.id);
      if (!record) {
        return res.status(404).json({ message: "Maintenance record not found" });
      }
      res.json(record);
    } catch (err: any) {
      console.error("Error fetching maintenance record:", err);
      res.status(500).json({ message: "Failed to fetch maintenance record" });
    }
  });

  // Create maintenance record
  app.post("/api/vehicles/:vehicleId/maintenance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const validation = insertVehicleMaintenanceSchema.safeParse({
        ...req.body,
        vehicleId: req.params.vehicleId,
        createdById: userId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const record = await storage.createVehicleMaintenance(validation.data);
      res.status(201).json(record);
    } catch (err: any) {
      console.error("Error creating maintenance record:", err);
      res.status(500).json({ message: "Failed to create maintenance record" });
    }
  });

  // Update maintenance record
  app.patch("/api/vehicle-maintenance/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertVehicleMaintenanceSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateVehicleMaintenance(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Maintenance record not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating maintenance record:", err);
      res.status(500).json({ message: "Failed to update maintenance record" });
    }
  });

  // Complete maintenance
  app.post("/api/vehicle-maintenance/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const { completedDate } = req.body;
      if (!completedDate) {
        return res.status(400).json({ message: "Completed date is required" });
      }

      const completed = await storage.completeVehicleMaintenance(req.params.id, completedDate);
      if (!completed) {
        return res.status(404).json({ message: "Maintenance record not found" });
      }
      res.json(completed);
    } catch (err: any) {
      console.error("Error completing maintenance:", err);
      res.status(500).json({ message: "Failed to complete maintenance" });
    }
  });

  // Delete maintenance record
  app.delete("/api/vehicle-maintenance/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteVehicleMaintenance(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Maintenance record not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting maintenance record:", err);
      res.status(500).json({ message: "Failed to delete maintenance record" });
    }
  });

  // ==========================================
  // PHASE 5: PRODUCTIVITY, BACKCOSTING & CAPACITY ROUTES
  // ==========================================

  // Time Entry Routes
  app.get("/api/jobs/:jobId/time-entries", isAuthenticated, async (req, res) => {
    try {
      const entries = await storage.getJobTimeEntries(req.params.jobId);
      res.json(entries);
    } catch (err: any) {
      console.error("Error fetching time entries:", err);
      res.status(500).json({ message: "Failed to fetch time entries" });
    }
  });

  app.get("/api/time-entries", isAuthenticated, async (req: any, res) => {
    try {
      const { staffId, dateFrom, dateTo } = req.query;
      let entries;
      
      if (staffId) {
        entries = await storage.getTimeEntriesByStaff(staffId, dateFrom, dateTo);
      } else if (dateFrom && dateTo) {
        entries = await storage.getTimeEntriesByDateRange(dateFrom, dateTo);
      } else {
        // Get current user's entries
        const userId = req.user?.claims?.sub;
        const staffProfile = await storage.getStaffProfileByUserId(userId);
        if (staffProfile) {
          entries = await storage.getTimeEntriesByStaff(staffProfile.id);
        } else {
          entries = [];
        }
      }
      
      res.json(entries);
    } catch (err: any) {
      console.error("Error fetching time entries:", err);
      res.status(500).json({ message: "Failed to fetch time entries" });
    }
  });

  app.post("/api/jobs/:jobId/time-entries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);

      const validation = insertJobTimeEntrySchema.safeParse({
        ...req.body,
        jobId: req.params.jobId,
        staffId: req.body.staffId || staffProfile?.id,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const entry = await storage.createTimeEntry(validation.data);
      res.status(201).json(entry);
    } catch (err: any) {
      console.error("Error creating time entry:", err);
      res.status(500).json({ message: "Failed to create time entry" });
    }
  });

  app.patch("/api/time-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertJobTimeEntrySchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateTimeEntry(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating time entry:", err);
      res.status(500).json({ message: "Failed to update time entry" });
    }
  });

  app.delete("/api/time-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteTimeEntry(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting time entry:", err);
      res.status(500).json({ message: "Failed to delete time entry" });
    }
  });

  // Cost Entry Routes
  app.get("/api/jobs/:jobId/cost-entries", isAuthenticated, async (req, res) => {
    try {
      const entries = await storage.getJobCostEntries(req.params.jobId);
      res.json(entries);
    } catch (err: any) {
      console.error("Error fetching cost entries:", err);
      res.status(500).json({ message: "Failed to fetch cost entries" });
    }
  });

  app.post("/api/jobs/:jobId/cost-entries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);

      const validation = insertJobCostEntrySchema.safeParse({
        ...req.body,
        jobId: req.params.jobId,
        recordedById: staffProfile?.id,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const entry = await storage.createCostEntry(validation.data);
      res.status(201).json(entry);
    } catch (err: any) {
      console.error("Error creating cost entry:", err);
      res.status(500).json({ message: "Failed to create cost entry" });
    }
  });

  app.patch("/api/cost-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertJobCostEntrySchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateCostEntry(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Cost entry not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating cost entry:", err);
      res.status(500).json({ message: "Failed to update cost entry" });
    }
  });

  app.delete("/api/cost-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteCostEntry(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Cost entry not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting cost entry:", err);
      res.status(500).json({ message: "Failed to delete cost entry" });
    }
  });

  // Staff Capacity Rules Routes
  app.get("/api/capacity-rules", isAuthenticated, async (req, res) => {
    try {
      const rules = await storage.getStaffCapacityRules();
      res.json(rules);
    } catch (err: any) {
      console.error("Error fetching capacity rules:", err);
      res.status(500).json({ message: "Failed to fetch capacity rules" });
    }
  });

  app.get("/api/capacity-rules/:staffId", isAuthenticated, async (req, res) => {
    try {
      const rule = await storage.getStaffCapacityRule(req.params.staffId);
      if (!rule) {
        return res.status(404).json({ message: "Capacity rule not found" });
      }
      res.json(rule);
    } catch (err: any) {
      console.error("Error fetching capacity rule:", err);
      res.status(500).json({ message: "Failed to fetch capacity rule" });
    }
  });

  app.post("/api/capacity-rules", isAuthenticated, async (req, res) => {
    try {
      const validation = insertStaffCapacityRuleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const rule = await storage.createOrUpdateCapacityRule(validation.data);
      res.status(201).json(rule);
    } catch (err: any) {
      console.error("Error creating capacity rule:", err);
      res.status(500).json({ message: "Failed to create capacity rule" });
    }
  });

  app.delete("/api/capacity-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteCapacityRule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Capacity rule not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting capacity rule:", err);
      res.status(500).json({ message: "Failed to delete capacity rule" });
    }
  });

  // Time Off Routes
  app.get("/api/time-off", isAuthenticated, async (req: any, res) => {
    try {
      const { staffId, dateFrom, dateTo } = req.query;
      let timeOff;
      
      if (staffId) {
        timeOff = await storage.getStaffTimeOff(staffId);
      } else if (dateFrom && dateTo) {
        timeOff = await storage.getTimeOffByDateRange(dateFrom, dateTo);
      } else {
        // Get current user's time off
        const userId = req.user?.claims?.sub;
        const staffProfile = await storage.getStaffProfileByUserId(userId);
        if (staffProfile) {
          timeOff = await storage.getStaffTimeOff(staffProfile.id);
        } else {
          timeOff = [];
        }
      }
      
      res.json(timeOff);
    } catch (err: any) {
      console.error("Error fetching time off:", err);
      res.status(500).json({ message: "Failed to fetch time off" });
    }
  });

  app.post("/api/time-off", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);

      const validation = insertStaffTimeOffSchema.safeParse({
        ...req.body,
        staffId: req.body.staffId || staffProfile?.id,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const request = await storage.createTimeOffRequest(validation.data);
      res.status(201).json(request);
    } catch (err: any) {
      console.error("Error creating time off request:", err);
      res.status(500).json({ message: "Failed to create time off request" });
    }
  });

  app.post("/api/time-off/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      
      const approved = await storage.approveTimeOff(req.params.id, staffProfile?.id || "");
      if (!approved) {
        return res.status(404).json({ message: "Time off request not found" });
      }
      res.json(approved);
    } catch (err: any) {
      console.error("Error approving time off:", err);
      res.status(500).json({ message: "Failed to approve time off" });
    }
  });

  app.post("/api/time-off/:id/reject", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      
      const rejected = await storage.rejectTimeOff(req.params.id, staffProfile?.id || "");
      if (!rejected) {
        return res.status(404).json({ message: "Time off request not found" });
      }
      res.json(rejected);
    } catch (err: any) {
      console.error("Error rejecting time off:", err);
      res.status(500).json({ message: "Failed to reject time off" });
    }
  });

  app.delete("/api/time-off/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteTimeOff(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Time off request not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting time off:", err);
      res.status(500).json({ message: "Failed to delete time off" });
    }
  });

  // Analytics & Reporting Routes
  app.get("/api/productivity/metrics", isAuthenticated, async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };
      const metrics = await storage.getStaffProductivityMetrics(dateFrom, dateTo);
      res.json(metrics);
    } catch (err: any) {
      console.error("Error fetching productivity metrics:", err);
      res.status(500).json({ message: "Failed to fetch productivity metrics" });
    }
  });

  app.get("/api/backcosting", isAuthenticated, async (req, res) => {
    try {
      const summaries = await storage.getAllJobBackcosting();
      res.json(summaries);
    } catch (err: any) {
      console.error("Error fetching backcosting data:", err);
      res.status(500).json({ message: "Failed to fetch backcosting data" });
    }
  });

  app.get("/api/jobs/:jobId/backcosting", isAuthenticated, async (req, res) => {
    try {
      const summary = await storage.getJobBackcostingSummary(req.params.jobId);
      if (!summary) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(summary);
    } catch (err: any) {
      console.error("Error fetching job backcosting:", err);
      res.status(500).json({ message: "Failed to fetch job backcosting" });
    }
  });

  app.get("/api/capacity", isAuthenticated, async (req, res) => {
    try {
      const { weekStart } = req.query;
      // Default to current week if not specified
      const startDate = weekStart as string || new Date().toISOString().split('T')[0];
      const capacity = await storage.getStaffCapacityView(startDate);
      res.json(capacity);
    } catch (err: any) {
      console.error("Error fetching capacity view:", err);
      res.status(500).json({ message: "Failed to fetch capacity view" });
    }
  });

  // =====================
  // KPI MODULE ROUTES
  // =====================

  // KPI Dashboard - Daily view
  app.get("/api/kpi/dashboard/daily", isAuthenticated, async (req, res) => {
    try {
      const { date } = req.query;
      const dashboard = await storage.getKpiDashboardDaily(date as string);
      res.json(dashboard);
    } catch (err: any) {
      console.error("Error fetching daily KPI dashboard:", err);
      res.status(500).json({ message: "Failed to fetch daily KPI dashboard" });
    }
  });

  // KPI Dashboard - Weekly view
  app.get("/api/kpi/dashboard/weekly", isAuthenticated, async (req, res) => {
    try {
      const { weekStart } = req.query;
      const dashboard = await storage.getKpiDashboardWeekly(weekStart as string);
      res.json(dashboard);
    } catch (err: any) {
      console.error("Error fetching weekly KPI dashboard:", err);
      res.status(500).json({ message: "Failed to fetch weekly KPI dashboard" });
    }
  });

  // KPI Summary for individual tradesman
  app.get("/api/kpi/staff/:staffId/summary", isAuthenticated, async (req, res) => {
    try {
      const summary = await storage.getTradesmanKpiSummary(req.params.staffId);
      if (!summary) {
        return res.status(404).json({ message: "Staff not found" });
      }
      res.json(summary);
    } catch (err: any) {
      console.error("Error fetching tradesman KPI summary:", err);
      res.status(500).json({ message: "Failed to fetch tradesman KPI summary" });
    }
  });

  // KPI Snapshots - Daily
  app.get("/api/kpi/snapshots/daily", isAuthenticated, async (req, res) => {
    try {
      const { staffId, dateFrom, dateTo } = req.query;
      const snapshots = await storage.getKpiDailySnapshots(
        staffId as string,
        dateFrom as string,
        dateTo as string
      );
      res.json(snapshots);
    } catch (err: any) {
      console.error("Error fetching daily snapshots:", err);
      res.status(500).json({ message: "Failed to fetch daily snapshots" });
    }
  });

  // KPI Snapshots - Weekly
  app.get("/api/kpi/snapshots/weekly", isAuthenticated, async (req, res) => {
    try {
      const { staffId, weekStart } = req.query;
      const snapshots = await storage.getKpiWeeklySnapshots(
        staffId as string,
        weekStart as string
      );
      res.json(snapshots);
    } catch (err: any) {
      console.error("Error fetching weekly snapshots:", err);
      res.status(500).json({ message: "Failed to fetch weekly snapshots" });
    }
  });

  // KPI Snapshots - Monthly
  app.get("/api/kpi/snapshots/monthly", isAuthenticated, async (req, res) => {
    try {
      const { month } = req.query;
      const snapshots = await storage.getKpiMonthlySnapshots(month as string);
      res.json(snapshots);
    } catch (err: any) {
      console.error("Error fetching monthly snapshots:", err);
      res.status(500).json({ message: "Failed to fetch monthly snapshots" });
    }
  });

  // Calculate and save daily snapshot (typically called by scheduler)
  app.post("/api/kpi/snapshots/daily/:staffId", isAuthenticated, async (req: any, res) => {
    try {
      const { date } = req.body;
      const targetDate = date || new Date().toISOString().split("T")[0];
      const snapshot = await storage.calculateDailyKpiSnapshot(req.params.staffId, targetDate);
      res.status(201).json(snapshot);
    } catch (err: any) {
      console.error("Error calculating daily snapshot:", err);
      res.status(500).json({ message: "Failed to calculate daily snapshot" });
    }
  });

  // KPI Targets
  app.get("/api/kpi/targets", isAuthenticated, async (req, res) => {
    try {
      const targets = await storage.getKpiTargets();
      res.json(targets);
    } catch (err: any) {
      console.error("Error fetching KPI targets:", err);
      res.status(500).json({ message: "Failed to fetch KPI targets" });
    }
  });

  app.get("/api/kpi/targets/:teamConfig", isAuthenticated, async (req, res) => {
    try {
      const target = await storage.getKpiTargetByConfig(req.params.teamConfig);
      if (!target) {
        return res.status(404).json({ message: "Target configuration not found" });
      }
      res.json(target);
    } catch (err: any) {
      console.error("Error fetching KPI target:", err);
      res.status(500).json({ message: "Failed to fetch KPI target" });
    }
  });

  // KPI Alerts
  app.get("/api/kpi/alerts", isAuthenticated, async (req, res) => {
    try {
      const { acknowledged } = req.query;
      const ack = acknowledged === "true" ? true : acknowledged === "false" ? false : undefined;
      const alerts = await storage.getKpiAlerts(ack);
      res.json(alerts);
    } catch (err: any) {
      console.error("Error fetching KPI alerts:", err);
      res.status(500).json({ message: "Failed to fetch KPI alerts" });
    }
  });

  app.get("/api/kpi/alerts/staff/:staffId", isAuthenticated, async (req, res) => {
    try {
      const alerts = await storage.getKpiAlertsByStaff(req.params.staffId);
      res.json(alerts);
    } catch (err: any) {
      console.error("Error fetching staff KPI alerts:", err);
      res.status(500).json({ message: "Failed to fetch staff KPI alerts" });
    }
  });

  app.post("/api/kpi/alerts/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const alert = await storage.acknowledgeKpiAlert(req.params.id, userId);
      if (!alert) {
        return res.status(404).json({ message: "Alert not found" });
      }
      res.json(alert);
    } catch (err: any) {
      console.error("Error acknowledging alert:", err);
      res.status(500).json({ message: "Failed to acknowledge alert" });
    }
  });

  // Bonus Periods
  app.get("/api/kpi/bonus", isAuthenticated, async (req, res) => {
    try {
      const { staffId } = req.query;
      const periods = await storage.getBonusPeriods(staffId as string);
      res.json(periods);
    } catch (err: any) {
      console.error("Error fetching bonus periods:", err);
      res.status(500).json({ message: "Failed to fetch bonus periods" });
    }
  });

  app.get("/api/kpi/bonus/current/:staffId", isAuthenticated, async (req, res) => {
    try {
      const period = await storage.getCurrentBonusPeriod(req.params.staffId);
      if (!period) {
        return res.status(404).json({ message: "No current bonus period" });
      }
      res.json(period);
    } catch (err: any) {
      console.error("Error fetching current bonus period:", err);
      res.status(500).json({ message: "Failed to fetch current bonus period" });
    }
  });

  app.post("/api/kpi/bonus/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const period = await storage.approveBonusPeriod(req.params.id, userId);
      if (!period) {
        return res.status(404).json({ message: "Bonus period not found" });
      }
      res.json(period);
    } catch (err: any) {
      console.error("Error approving bonus:", err);
      res.status(500).json({ message: "Failed to approve bonus" });
    }
  });

  app.post("/api/kpi/bonus/:id/pay", isAuthenticated, async (req, res) => {
    try {
      const period = await storage.markBonusPeriodPaid(req.params.id);
      if (!period) {
        return res.status(404).json({ message: "Bonus period not found" });
      }
      res.json(period);
    } catch (err: any) {
      console.error("Error marking bonus paid:", err);
      res.status(500).json({ message: "Failed to mark bonus paid" });
    }
  });

  // Sales Phase Progression
  app.get("/api/kpi/staff/:staffId/phase-log", isAuthenticated, async (req, res) => {
    try {
      const log = await storage.getPhaseLog(req.params.staffId);
      res.json(log);
    } catch (err: any) {
      console.error("Error fetching phase log:", err);
      res.status(500).json({ message: "Failed to fetch phase log" });
    }
  });

  app.post("/api/kpi/staff/:staffId/advance-phase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { notes } = req.body;
      await storage.advanceSalesPhase(req.params.staffId, userId, notes);
      res.json({ success: true, message: "Sales phase advanced successfully" });
    } catch (err: any) {
      console.error("Error advancing sales phase:", err);
      res.status(500).json({ message: err.message || "Failed to advance sales phase" });
    }
  });

  // Phase Checklist
  app.get("/api/kpi/staff/:staffId/phase-checklist", isAuthenticated, async (req, res) => {
    try {
      const { fromPhase, toPhase } = req.query;
      const from = parseInt(fromPhase as string) || 1;
      const to = parseInt(toPhase as string) || 2;
      const checklist = await storage.getPhaseChecklist(req.params.staffId, from, to);
      res.json(checklist);
    } catch (err: any) {
      console.error("Error fetching phase checklist:", err);
      res.status(500).json({ message: "Failed to fetch phase checklist" });
    }
  });

  app.post("/api/kpi/phase-checklist/:id/toggle", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const item = await storage.togglePhaseChecklistItem(req.params.id, userId);
      if (!item) {
        return res.status(404).json({ message: "Checklist item not found" });
      }
      res.json(item);
    } catch (err: any) {
      console.error("Error toggling checklist item:", err);
      res.status(500).json({ message: "Failed to toggle checklist item" });
    }
  });

  return httpServer;
}
