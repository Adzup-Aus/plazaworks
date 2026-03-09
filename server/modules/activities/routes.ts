import type { Express } from "express";
import { storage, isAuthenticated, requirePermission, requireAnyPermission } from "../../routes/shared";
import { insertActivitySchema, patchActivitySchema } from "./model";

export function registerActivitiesRoutes(app: Express): void {
  /**
   * @openapi
   * /activities:
   *   get:
   *     summary: List activities
   *     tags: [Activities]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     responses:
   *       200: { description: List of activities }
   */
  // view_schedule allows listing activities so Schedule page can show activity names on entries
  app.get("/api/activities", isAuthenticated, requireAnyPermission("view_activities", "view_schedule"), async (req: any, res) => {
    try {
      const list = await storage.getActivities();
      res.json(list);
    } catch (err: any) {
      console.error("Error fetching activities:", err);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  /**
   * @openapi
   * /activities/{id}:
   *   get:
   *     summary: Get activity by ID
   *     tags: [Activities]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Activity details }
   *       404: { description: Activity not found }
   */
  app.get("/api/activities/:id", isAuthenticated, requireAnyPermission("view_activities", "view_schedule"), async (req: any, res) => {
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

  /**
   * @openapi
   * /activities:
   *   post:
   *     summary: Create an activity
   *     tags: [Activities]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     requestBody: { content: { application/json: { schema: { type: object } } } }
   *     responses:
   *       201: { description: Activity created }
   *       400: { description: Validation error }
   */
  app.post("/api/activities", isAuthenticated, requirePermission("view_activities"), async (req: any, res) => {
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

  /**
   * @openapi
   * /activities/{id}:
   *   patch:
   *     summary: Update an activity
   *     tags: [Activities]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     requestBody: { content: { application/json: { schema: { type: object } } } }
   *     responses:
   *       200: { description: Activity updated }
   *       404: { description: Activity not found }
   */
  app.patch("/api/activities/:id", isAuthenticated, requirePermission("view_activities"), async (req: any, res) => {
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

  /**
   * @openapi
   * /activities/{id}:
   *   delete:
   *     summary: Delete an activity
   *     tags: [Activities]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Activity deleted }
   *       400: { description: Activity in use }
   */
  app.delete("/api/activities/:id", isAuthenticated, requirePermission("view_activities"), async (req: any, res) => {
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
