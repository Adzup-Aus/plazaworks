import type { Express } from "express";
import { storage, isAuthenticated, requireUserId } from "./shared";
import {
  insertJobTimeEntrySchema,
  insertJobCostEntrySchema,
  insertStaffCapacityRuleSchema,
  insertStaffTimeOffSchema,
} from "@shared/schema";

export function registerProductivityRoutes(app: Express): void {
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
        const userId = requireUserId(req);
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
      const userId = requireUserId(req);
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
      const userId = requireUserId(req);
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

  app.get("/api/time-off", isAuthenticated, async (req: any, res) => {
    try {
      const { staffId, dateFrom, dateTo } = req.query;
      let timeOff;

      if (staffId) {
        timeOff = await storage.getStaffTimeOff(staffId);
      } else if (dateFrom && dateTo) {
        timeOff = await storage.getTimeOffByDateRange(dateFrom, dateTo);
      } else {
        const userId = requireUserId(req);
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
      const userId = requireUserId(req);
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
      const userId = requireUserId(req);
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
      const userId = requireUserId(req);
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
      const startDate =
        (weekStart as string) || new Date().toISOString().split("T")[0];
      const capacity = await storage.getStaffCapacityView(startDate);
      res.json(capacity);
    } catch (err: any) {
      console.error("Error fetching capacity view:", err);
      res.status(500).json({ message: "Failed to fetch capacity view" });
    }
  });
}
