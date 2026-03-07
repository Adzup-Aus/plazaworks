import type { Express } from "express";
import { storage, isAuthenticated, requireUserId } from "../../routes/shared";
import { insertJobPhotoSchema } from "@shared/schema";
import { getFileUrl } from "../storage/utils";
import { resolveDisplayUrl, resolveDisplayUrls } from "../storage/service";

export function registerJobPhotosRoutes(app: Express): void {
  app.get("/api/jobs/:jobId/photos", isAuthenticated, async (req, res) => {
    try {
      const photos = await storage.getJobPhotos(req.params.jobId);
      const withUrls = await resolveDisplayUrls(photos);
      res.json(withUrls);
    } catch (err: any) {
      console.error("Error fetching job photos:", err);
      res.status(500).json({ message: "Failed to fetch job photos" });
    }
  });

  app.get("/api/job-photos/:id", isAuthenticated, async (req, res) => {
    try {
      const photo = await storage.getJobPhoto(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      const url = await resolveDisplayUrl(photo.url, photo.objectKey);
      res.json({ ...photo, url });
    } catch (err: any) {
      console.error("Error fetching job photo:", err);
      res.status(500).json({ message: "Failed to fetch job photo" });
    }
  });

  app.post("/api/jobs/:jobId/photos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const staffProfile = await storage.getStaffProfileByUserId(userId);

      let filename = req.body.filename;
      if (!filename && req.body.url) {
        try {
          const urlObj = new URL(req.body.url);
          filename = urlObj.pathname.split("/").pop() || `photo-${Date.now()}.jpg`;
        } catch {
          filename = `photo-${Date.now()}.jpg`;
        }
      }

      const body = { ...req.body, filename, jobId: req.params.jobId, uploadedById: staffProfile?.id };
      const url = body.url as string | undefined;
      const isS3Key = url && !url.startsWith("http") && !url.startsWith("/objects/") && url.startsWith("uploads/");
      if (isS3Key) {
        body.objectKey = url;
        body.url = getFileUrl(url, url) || url;
      }
      const validation = insertJobPhotoSchema.safeParse(body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const photo = await storage.createJobPhoto(validation.data);
      res.status(201).json(photo);
    } catch (err: any) {
      console.error("Error creating job photo:", err);
      res.status(500).json({ message: "Failed to create job photo" });
    }
  });

  app.patch("/api/job-photos/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertJobPhotoSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateJobPhoto(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Photo not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating job photo:", err);
      res.status(500).json({ message: "Failed to update job photo" });
    }
  });

  app.delete("/api/job-photos/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteJobPhoto(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Photo not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting job photo:", err);
      res.status(500).json({ message: "Failed to delete job photo" });
    }
  });
}
