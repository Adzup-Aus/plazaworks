import type { Express } from "express";
import { storage, isAuthenticated, requireUserId } from "./shared";
import { insertPCItemSchema } from "@shared/schema";

export function registerPCItemsRoutes(app: Express): void {
  app.get("/api/jobs/:jobId/pc-items", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getPCItems(req.params.jobId);
      res.json(items);
    } catch (err: any) {
      console.error("Error fetching PC items:", err);
      res.status(500).json({ message: "Failed to fetch PC items" });
    }
  });

  app.post("/api/jobs/:jobId/pc-items", isAuthenticated, async (req, res) => {
    try {
      const validation = insertPCItemSchema.safeParse({
        ...req.body,
        jobId: req.params.jobId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      let linkedScheduleId: string | undefined;

      if (validation.data.finishDate && validation.data.assignedToId) {
        const scheduleEntry = await storage.createScheduleEntry({
          jobId: req.params.jobId,
          staffId: validation.data.assignedToId,
          scheduledDate: validation.data.finishDate,
          durationHours: "7.5",
          status: "scheduled",
          notes: `Auto-generated from checklist: ${validation.data.title}`,
        });
        linkedScheduleId = scheduleEntry.id;
      }

      const item = await storage.createPCItem({
        ...validation.data,
        linkedScheduleId,
      });
      res.status(201).json(item);
    } catch (err: any) {
      console.error("Error creating PC item:", err);
      res.status(500).json({ message: "Failed to create PC item" });
    }
  });

  app.patch("/api/pc-items/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertPCItemSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const currentItem = await storage.getPCItem(req.params.id);
      if (!currentItem) {
        return res.status(404).json({ message: "PC item not found" });
      }

      const effectiveFinishDate =
        validation.data.finishDate !== undefined
          ? validation.data.finishDate
          : currentItem.finishDate;
      const effectiveAssignedToId =
        validation.data.assignedToId !== undefined
          ? validation.data.assignedToId
          : currentItem.assignedToId;
      let linkedScheduleId = currentItem.linkedScheduleId;

      const effectiveTitle = validation.data.title ?? currentItem.title;

      if (effectiveFinishDate && effectiveAssignedToId) {
        if (linkedScheduleId) {
          await storage.updateScheduleEntry(linkedScheduleId, {
            scheduledDate: effectiveFinishDate,
            staffId: effectiveAssignedToId,
            notes: `Auto-generated from checklist: ${effectiveTitle}`,
          });
        } else {
          const scheduleEntry = await storage.createScheduleEntry({
            jobId: currentItem.jobId,
            staffId: effectiveAssignedToId,
            scheduledDate: effectiveFinishDate,
            durationHours: "7.5",
            status: "scheduled",
            notes: `Auto-generated from checklist: ${effectiveTitle}`,
          });
          linkedScheduleId = scheduleEntry.id;
        }
      } else if (linkedScheduleId) {
        await storage.deleteScheduleEntry(linkedScheduleId);
        linkedScheduleId = null;
      }

      const updated = await storage.updatePCItem(req.params.id, {
        ...validation.data,
        linkedScheduleId,
      });
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating PC item:", err);
      res.status(500).json({ message: "Failed to update PC item" });
    }
  });

  app.post("/api/pc-items/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
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

  app.delete("/api/pc-items/:id", isAuthenticated, async (req, res) => {
    try {
      const pcItem = await storage.getPCItem(req.params.id);
      if (!pcItem) {
        return res.status(404).json({ message: "PC item not found" });
      }

      if (pcItem.linkedScheduleId) {
        await storage.deleteScheduleEntry(pcItem.linkedScheduleId);
      }

      await storage.deletePCItem(req.params.id);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting PC item:", err);
      res.status(500).json({ message: "Failed to delete PC item" });
    }
  });
}
