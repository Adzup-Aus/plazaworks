import type { Express } from "express";
import { storage, isAuthenticated } from "./shared";
import { insertJobMilestoneSchema } from "@shared/schema";

export function registerJobMilestonesRoutes(app: Express): void {
  app.get("/api/jobs/:jobId/milestones", isAuthenticated, async (req, res) => {
    try {
      const milestones = await storage.getJobMilestones(req.params.jobId);
      res.json(milestones);
    } catch (err: any) {
      console.error("Error fetching job milestones:", err);
      res.status(500).json({ message: "Failed to fetch job milestones" });
    }
  });

  app.post("/api/jobs/:jobId/milestones", isAuthenticated, async (req, res) => {
    try {
      const validation = insertJobMilestoneSchema.safeParse({
        ...req.body,
        jobId: req.params.jobId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }
      const milestone = await storage.createMilestone(validation.data);
      res.status(201).json(milestone);
    } catch (err: any) {
      console.error("Error creating job milestone:", err);
      res.status(500).json({ message: "Failed to create job milestone" });
    }
  });

  app.patch("/api/job-milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertJobMilestoneSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }
      const updated = await storage.updateMilestone(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Job milestone not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating job milestone:", err);
      res.status(500).json({ message: "Failed to update job milestone" });
    }
  });

  app.delete("/api/job-milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const milestone = await storage.getMilestone(req.params.id);
      if (!milestone) {
        return res.status(404).json({ message: "Job milestone not found" });
      }

      const pcItems = await storage.getPCItems(milestone.jobId);
      const assignedItems = pcItems.filter(
        (item) => (item as any).milestoneId === req.params.id
      );

      if (assignedItems.length > 0) {
        for (const item of assignedItems) {
          await storage.updatePCItem(item.id, { milestoneId: null } as any);
        }
      }

      await storage.deleteMilestone(req.params.id);
      res.json({ deleted: true, reassignedTasks: assignedItems.length });
    } catch (err: any) {
      console.error("Error deleting job milestone:", err);
      res.status(500).json({ message: "Failed to delete job milestone" });
    }
  });
}
