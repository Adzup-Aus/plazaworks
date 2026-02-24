import type { Express } from "express";
import { storage, isAuthenticated } from "../../routes/shared";
import { insertActivitySchema, patchActivitySchema } from "./model";

export function registerActivitiesRoutes(app: Express): void {
  app.get("/api/activities", isAuthenticated, async (req: any, res) => {
    try {
      const list = await storage.getActivities();
      res.json(list);
    } catch (err: any) {
      console.error("Error fetching activities:", err);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.get("/api/activities/:id", isAuthenticated, async (req: any, res) => {
    try {
      const activity = await storage.getActivity(req.params.id);
      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      res.json(activity);
    } catch (err: any) {
      console.error("Error fetching activity:", err);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  app.post("/api/activities", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertActivitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.errors[0]?.message ?? "Validation failed" });
      }
      const activity = await storage.createActivity(parsed.data);
      res.status(201).json(activity);
    } catch (err: any) {
      console.error("Error creating activity:", err);
      res.status(500).json({ message: "Failed to create activity" });
    }
  });

  app.patch("/api/activities/:id", isAuthenticated, async (req: any, res) => {
    try {
      const existing = await storage.getActivity(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Activity not found" });
      }
      const partial = patchActivitySchema.safeParse(req.body);
      if (!partial.success) {
        return res
          .status(400)
          .json({ message: partial.error.errors[0]?.message ?? "Validation failed" });
      }
      const updated = await storage.updateActivity(req.params.id, partial.data);
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating activity:", err);
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  app.delete("/api/activities/:id", isAuthenticated, async (req: any, res) => {
    try {
      const existing = await storage.getActivity(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Activity not found" });
      }
      const inUse = await storage.getScheduleEntriesByActivity(req.params.id);
      if (inUse.length > 0) {
        return res
          .status(400)
          .json({ message: "Activity is in use by schedule entries and cannot be deleted" });
      }
      await storage.deleteActivity(req.params.id);
      res.status(200).json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting activity:", err);
      res.status(500).json({ message: "Failed to delete activity" });
    }
  });
}
