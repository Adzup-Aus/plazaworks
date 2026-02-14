import type { Express } from "express";
import { storage, isAuthenticated, requireUserId } from "../../routes/shared";

export function registerNotificationsRoutes(app: Express): void {
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const notificationsList = await storage.getNotifications(userId);
      res.json(notificationsList);
    } catch (err: any) {
      console.error("Error fetching notifications:", err);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (err: any) {
      console.error("Error fetching notification count:", err);
      res.status(500).json({ message: "Failed to fetch notification count" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.markNotificationRead(req.params.id);
      if (!updated) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error marking notification read:", err);
      res.status(500).json({ message: "Failed to mark notification read" });
    }
  });

  app.patch("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      await storage.markAllNotificationsRead(userId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error marking all notifications read:", err);
      res.status(500).json({ message: "Failed to mark all notifications read" });
    }
  });

  app.delete("/api/notifications/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteNotification(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting notification:", err);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });
}
