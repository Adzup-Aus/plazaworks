import type { Express } from "express";
import { storage, isAuthenticated, requireUserId } from "../../routes/shared";
import { insertJobReceiptSchema } from "@shared/schema";
import { getFileUrl } from "../storage/utils";
import { resolveDisplayUrl, resolveDisplayUrls } from "../storage/service";

export function registerJobReceiptsRoutes(app: Express): void {
  app.get("/api/jobs/:jobId/receipts", isAuthenticated, async (req, res) => {
    try {
      const receipts = await storage.getJobReceipts(req.params.jobId);
      const withUrls = await resolveDisplayUrls(receipts);
      res.json(withUrls);
    } catch (err: any) {
      console.error("Error fetching job receipts:", err);
      res.status(500).json({ message: "Failed to fetch job receipts" });
    }
  });

  app.get("/api/job-receipts/:id", isAuthenticated, async (req, res) => {
    try {
      const receipt = await storage.getJobReceipt(req.params.id);
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      const url = await resolveDisplayUrl(receipt.url, receipt.objectKey);
      res.json({ ...receipt, url });
    } catch (err: any) {
      console.error("Error fetching job receipt:", err);
      res.status(500).json({ message: "Failed to fetch job receipt" });
    }
  });

  app.post("/api/jobs/:jobId/receipts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const staffProfile = await storage.getStaffProfileByUserId(userId);

      let filename = req.body.filename;
      if (!filename && req.body.url) {
        try {
          const urlObj = new URL(req.body.url);
          filename = urlObj.pathname.split("/").pop() || `receipt-${Date.now()}.jpg`;
        } catch {
          filename = `receipt-${Date.now()}.jpg`;
        }
      }

      const body = { ...req.body, filename, jobId: req.params.jobId, uploadedById: staffProfile?.id };
      const url = body.url as string | undefined;
      const isS3Key = url && !url.startsWith("http") && !url.startsWith("/objects/") && url.startsWith("uploads/");
      if (isS3Key) {
        body.objectKey = url;
        body.url = getFileUrl(url, url) || url;
      }
      const validation = insertJobReceiptSchema.safeParse(body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const receipt = await storage.createJobReceipt(validation.data);
      res.status(201).json(receipt);
    } catch (err: any) {
      console.error("Error creating job receipt:", err);
      res.status(500).json({ message: "Failed to create job receipt" });
    }
  });

  app.patch("/api/job-receipts/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertJobReceiptSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateJobReceipt(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating job receipt:", err);
      res.status(500).json({ message: "Failed to update job receipt" });
    }
  });

  app.delete("/api/job-receipts/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteJobReceipt(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting job receipt:", err);
      res.status(500).json({ message: "Failed to delete job receipt" });
    }
  });
}
