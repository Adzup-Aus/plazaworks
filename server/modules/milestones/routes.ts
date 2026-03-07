import type { Express } from "express";
import { storage, isAuthenticated, requireUserId } from "../../routes/shared";
import { insertMilestonePaymentSchema, insertMilestoneMediaSchema } from "@shared/schema";
import { getFileUrl } from "../storage/utils";
import { resolveDisplayUrls } from "../storage/service";

export function registerMilestonesRoutes(app: Express): void {
  app.get("/api/milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const milestone = await storage.getMilestoneWithDetails(req.params.id);
      if (!milestone) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      const media = (milestone as { media?: { url?: string | null; objectKey?: string | null }[] }).media;
      if (media?.length) {
        (milestone as { media: unknown[] }).media = await resolveDisplayUrls(media);
      }
      res.json(milestone);
    } catch (err: any) {
      console.error("Error fetching milestone:", err);
      res.status(500).json({ message: "Failed to fetch milestone" });
    }
  });

  app.patch("/api/milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateMilestone(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating milestone:", err);
      res.status(500).json({ message: "Failed to update milestone" });
    }
  });

  app.post("/api/milestones/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const staffProfile = await storage.getStaffProfileByUserId(userId);

      const updated = await storage.completeMilestone(
        req.params.id,
        staffProfile?.id || userId
      );
      if (!updated) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error completing milestone:", err);
      res.status(500).json({ message: "Failed to complete milestone" });
    }
  });

  app.delete("/api/milestones/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteMilestone(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting milestone:", err);
      res.status(500).json({ message: "Failed to delete milestone" });
    }
  });

  app.get("/api/milestones/:milestoneId/payments", isAuthenticated, async (req, res) => {
    try {
      const payments = await storage.getMilestonePayments(req.params.milestoneId);
      res.json(payments);
    } catch (err: any) {
      console.error("Error fetching payments:", err);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.get("/api/jobs/:jobId/pending-payments", isAuthenticated, async (req, res) => {
    try {
      const payments = await storage.getPendingPaymentsByJob(req.params.jobId);
      res.json(payments);
    } catch (err: any) {
      console.error("Error fetching pending payments:", err);
      res.status(500).json({ message: "Failed to fetch pending payments" });
    }
  });

  app.post("/api/milestones/:milestoneId/payments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const staffProfile = await storage.getStaffProfileByUserId(userId);

      const parsed = insertMilestonePaymentSchema.safeParse({
        ...req.body,
        milestoneId: req.params.milestoneId,
        requestedAt: new Date(),
        requestedById: staffProfile?.id,
      });

      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Invalid payment data", errors: parsed.error.issues });
      }

      const payment = await storage.createMilestonePayment(parsed.data);
      res.status(201).json(payment);
    } catch (err: any) {
      console.error("Error creating payment:", err);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  app.patch("/api/milestone-payments/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateMilestonePayment(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating payment:", err);
      res.status(500).json({ message: "Failed to update payment" });
    }
  });

  app.post("/api/milestone-payments/:id/paid", isAuthenticated, async (req, res) => {
    try {
      const { paymentMethod, paymentReference } = req.body;
      const updated = await storage.recordMilestonePaymentPaid(
        req.params.id,
        paymentMethod,
        paymentReference
      );
      if (!updated) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error recording payment:", err);
      res.status(500).json({ message: "Failed to record payment" });
    }
  });

  app.get("/api/milestones/:milestoneId/media", isAuthenticated, async (req, res) => {
    try {
      const media = await storage.getMilestoneMedia(req.params.milestoneId);
      const withUrls = await resolveDisplayUrls(media);
      res.json(withUrls);
    } catch (err: any) {
      console.error("Error fetching media:", err);
      res.status(500).json({ message: "Failed to fetch media" });
    }
  });

  app.get("/api/jobs/:jobId/media", isAuthenticated, async (req, res) => {
    try {
      const media = await storage.getJobMedia(req.params.jobId);
      const withUrls = await resolveDisplayUrls(media);
      res.json(withUrls);
    } catch (err: any) {
      console.error("Error fetching job media:", err);
      res.status(500).json({ message: "Failed to fetch job media" });
    }
  });

  app.post("/api/milestones/:milestoneId/media", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const staffProfile = await storage.getStaffProfileByUserId(userId);

      const milestone = await storage.getMilestone(req.params.milestoneId);
      if (!milestone) {
        return res.status(404).json({ message: "Milestone not found" });
      }

      const body = {
        ...req.body,
        milestoneId: req.params.milestoneId,
        jobId: milestone.jobId,
        uploadedById: staffProfile?.id,
        workDate: req.body.workDate || new Date().toISOString().split("T")[0],
      };
      const url = body.url as string | undefined;
      const isS3Key = url && !url.startsWith("http") && !url.startsWith("/objects/") && url.startsWith("uploads/");
      if (isS3Key) {
        body.objectKey = url;
        body.url = getFileUrl(url, url) || url;
      }
      const parsed = insertMilestoneMediaSchema.safeParse(body);

      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Invalid media data", errors: parsed.error.issues });
      }

      const media = await storage.createMilestoneMedia(parsed.data);
      res.status(201).json(media);
    } catch (err: any) {
      console.error("Error creating media:", err);
      res.status(500).json({ message: "Failed to create media" });
    }
  });

  app.patch("/api/milestone-media/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateMilestoneMedia(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Media not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating media:", err);
      res.status(500).json({ message: "Failed to update media" });
    }
  });

  app.delete("/api/milestone-media/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteMilestoneMedia(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting media:", err);
      res.status(500).json({ message: "Failed to delete media" });
    }
  });
}
