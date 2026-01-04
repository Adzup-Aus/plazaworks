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
  userRoles, 
  employmentTypes, 
  userPermissions,
  pcItemStatuses,
  notificationTypes
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
      // Get the user's staff profile to use as the staff id
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      if (!staffProfile) {
        return res.status(400).json({ message: "Staff profile not found" });
      }

      // Build the schedule entry with staffId from authenticated user
      const scheduleData = {
        jobId: req.body.jobId,
        staffId: staffProfile.id,
        scheduledDate: req.body.scheduledDate,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
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
      });
    } catch (err: any) {
      console.error("Error fetching portal data:", err);
      res.status(500).json({ message: "Failed to fetch job details" });
    }
  });

  return httpServer;
}
