import type { Express } from "express";
import { storage, isAuthenticated, requireUserId } from "./shared";
import {
  insertVehicleSchema,
  insertVehicleAssignmentSchema,
  insertVehicleMaintenanceSchema,
} from "@shared/schema";

export function registerVehiclesRoutes(app: Express): void {
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

  app.get("/api/vehicles/:vehicleId/assignments", isAuthenticated, async (req, res) => {
    try {
      const assignments = await storage.getVehicleAssignments(req.params.vehicleId);
      res.json(assignments);
    } catch (err: any) {
      console.error("Error fetching assignments:", err);
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

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

  app.get("/api/vehicles/:vehicleId/maintenance", isAuthenticated, async (req, res) => {
    try {
      const records = await storage.getVehicleMaintenanceRecords(req.params.vehicleId);
      res.json(records);
    } catch (err: any) {
      console.error("Error fetching maintenance records:", err);
      res.status(500).json({ message: "Failed to fetch maintenance records" });
    }
  });

  app.get("/api/vehicle-maintenance/scheduled", isAuthenticated, async (req, res) => {
    try {
      const records = await storage.getScheduledMaintenance();
      res.json(records);
    } catch (err: any) {
      console.error("Error fetching scheduled maintenance:", err);
      res.status(500).json({ message: "Failed to fetch scheduled maintenance" });
    }
  });

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

  app.post("/api/vehicles/:vehicleId/maintenance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
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
}
