import type { Express } from "express";
import { storage, isAuthenticated, ensureStaffProfile, requireUserId, requirePermission, requireAnyPermission } from "../../routes/shared";
import { insertJobSchema } from "./model";

export function registerJobsRoutes(app: Express): void {
  /**
   * @openapi
   * /jobs:
   *   get:
   *     summary: List jobs
   *     tags: [Jobs]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: status
   *         in: query
   *         schema: { type: string }
   *     responses:
   *       200: { description: List of jobs }
   */
  // view_schedule allows listing jobs so Schedule page can show job names on entries
  app.get("/api/jobs", isAuthenticated, ensureStaffProfile, requireAnyPermission("view_jobs", "view_schedule"), async (req, res) => {
    try {
      const { status } = req.query;
      let jobsList;
      if (status && typeof status === "string") {
        jobsList = await storage.getJobsByStatus(status);
      } else {
        jobsList = await storage.getJobs();
      }
      res.json(jobsList);
    } catch (err: any) {
      console.error("Error fetching jobs:", err);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  /**
   * @openapi
   * /jobs/{id}/invoice-draft:
   *   get:
   *     summary: Get draft line items for creating an invoice from this job (from linked quote)
   *     tags: [Jobs]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Draft line items for invoice form }
   */
  app.get("/api/jobs/:id/invoice-draft", isAuthenticated, requireAnyPermission("view_jobs", "view_schedule"), async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job?.quoteId) {
        return res.json({ lineItems: [] });
      }
      const quoteData = await storage.getQuoteWithLineItems(job.quoteId);
      if (!quoteData?.lineItems?.length) {
        return res.json({ lineItems: [] });
      }
      const lineItems = quoteData.lineItems.map((item: { heading?: string | null; description?: string | null; quantity: string; unitPrice: string; amount: string }) => ({
        description: [item.heading, item.description].filter(Boolean).join(": ") || (item.description ?? ""),
        quantity: String(item.quantity ?? "1"),
        unitPrice: String(item.unitPrice ?? "0"),
        amount: String(item.amount ?? "0"),
      }));
      res.json({ lineItems });
    } catch (err: any) {
      console.error("Error fetching job invoice draft:", err);
      res.status(500).json({ message: "Failed to fetch draft" });
    }
  });

  /**
   * @openapi
   * /jobs/{id}:
   *   get:
   *     summary: Get job by ID
   *     tags: [Jobs]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Job details }
   *       404: { description: Job not found }
   */
  app.get("/api/jobs/:id", isAuthenticated, requireAnyPermission("view_jobs", "view_schedule"), async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (err: any) {
      console.error("Error fetching job:", err);
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  /**
   * @openapi
   * /jobs:
   *   post:
   *     summary: Create a job
   *     tags: [Jobs]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     requestBody: { content: { application/json: { schema: { type: object } } } }
   *     responses:
   *       201: { description: Job created }
   *       400: { description: Validation error }
   */
  app.post("/api/jobs", isAuthenticated, requirePermission("create_jobs"), async (req: any, res) => {
    try {
      const validation = insertJobSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const userId = requireUserId(req);
      const job = await storage.createJob({
        ...validation.data,
        createdById: userId,
      });
      res.status(201).json(job);
    } catch (err: any) {
      console.error("Error creating job:", err);
      res.status(500).json({ message: "Failed to create job" });
    }
  });

  /**
   * @openapi
   * /jobs/{id}:
   *   patch:
   *     summary: Update a job
   *     tags: [Jobs]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     requestBody: { content: { application/json: { schema: { type: object } } } }
   *     responses:
   *       200: { description: Job updated }
   *       404: { description: Job not found }
   */
  app.patch("/api/jobs/:id", isAuthenticated, requirePermission("edit_jobs"), async (req, res) => {
    try {
      const partialSchema = insertJobSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateJob(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating job:", err);
      res.status(500).json({ message: "Failed to update job" });
    }
  });

  /**
   * @openapi
   * /jobs/{id}:
   *   delete:
   *     summary: Delete a job
   *     tags: [Jobs]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Job deleted }
   *       404: { description: Job not found }
   */
  app.delete("/api/jobs/:id", isAuthenticated, requirePermission("delete_jobs"), async (req, res) => {
    try {
      const deleted = await storage.deleteJob(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting job:", err);
      res.status(500).json({ message: "Failed to delete job" });
    }
  });
}
