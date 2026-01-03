import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { insertJobSchema, insertScheduleEntrySchema, userRoles, employmentTypes, userPermissions } from "@shared/schema";
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

  return httpServer;
}
