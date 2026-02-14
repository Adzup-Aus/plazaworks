import type { Express } from "express";
import { storage, isAuthenticated, requireUserId } from "../../routes/shared";
import { insertScheduleEntrySchema } from "./model";

export function registerScheduleRoutes(app: Express): void {
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

  app.post("/api/schedule", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      if (!staffProfile) {
        return res.status(400).json({ message: "Staff profile not found" });
      }

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

  app.post("/api/schedule/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
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

  app.post("/api/schedule/:id/reset", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateScheduleEntry(req.params.id, { status: "scheduled" });
      if (!updated) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error resetting schedule entry:", err);
      res.status(500).json({ message: "Failed to reset schedule entry" });
    }
  });

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
}
