import type { Express } from "express";
import { storage, isAuthenticated, requireSuperAdmin } from "../../routes/shared";
import { insertAppSettingsSchema } from "@shared/schema";

export function registerSettingsRoutes(app: Express): void {
  app.get("/api/settings", isAuthenticated, async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      if (!settings) {
        return res.status(200).json(null);
      }
      res.json(settings);
    } catch (err: unknown) {
      console.error("Error fetching settings:", err);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const parsed = insertAppSettingsSchema.partial().strip().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid settings data", errors: parsed.error.issues });
      }
      const updated = await storage.updateSettings(parsed.data);
      res.json(updated);
    } catch (err: unknown) {
      console.error("Error updating settings:", err);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });
}
