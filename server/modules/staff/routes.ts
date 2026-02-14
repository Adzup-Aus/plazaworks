import type { Express } from "express";
import { storage, isAuthenticated, ensureStaffProfile } from "../../routes/shared";
import { updateStaffSchema } from "../../routes/schemas";

export function registerStaffRoutes(app: Express): void {
  app.get("/api/staff", isAuthenticated, ensureStaffProfile, async (req, res) => {
    try {
      const profiles = await storage.getStaffProfiles();
      res.json(profiles);
    } catch (err: any) {
      console.error("Error fetching staff:", err);
      res.status(500).json({ message: "Failed to fetch staff profiles" });
    }
  });

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

  app.patch("/api/staff/:id", isAuthenticated, async (req: any, res) => {
    try {
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

  app.get("/api/staff/:id/working-hours", isAuthenticated, async (req, res) => {
    try {
      const hours = await storage.getStaffWorkingHours(req.params.id);
      res.json(hours);
    } catch (err: any) {
      console.error("Error fetching working hours:", err);
      res.status(500).json({ message: "Failed to fetch working hours" });
    }
  });

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
}
