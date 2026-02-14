import type { Express } from "express";
import { storage, isAuthenticated, requireUserId, getUserId } from "./shared";
import { insertQuoteSchema, insertTermsTemplateSchema } from "@shared/schema";

export function registerQuotesRoutes(app: Express): void {
  app.get("/api/quotes", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.query;
      let quotesList;
      if (status && typeof status === "string") {
        quotesList = await storage.getQuotesByStatus(status);
      } else {
        quotesList = await storage.getQuotes();
      }
      res.json(quotesList);
    } catch (err: any) {
      console.error("Error fetching quotes:", err);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.get("/api/quotes/:id", isAuthenticated, async (req, res) => {
    try {
      const quote = await storage.getQuoteWithLineItems(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (err: any) {
      console.error("Error fetching quote:", err);
      res.status(500).json({ message: "Failed to fetch quote" });
    }
  });

  app.post("/api/quotes", isAuthenticated, async (req: any, res) => {
    try {
      const validation = insertQuoteSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const userId = requireUserId(req);
      const quote = await storage.createQuote({
        ...validation.data,
        createdById: userId,
      });
      res.status(201).json(quote);
    } catch (err: any) {
      console.error("Error creating quote:", err);
      res.status(500).json({ message: "Failed to create quote" });
    }
  });

  app.patch("/api/quotes/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertQuoteSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateQuote(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating quote:", err);
      res.status(500).json({ message: "Failed to update quote" });
    }
  });

  app.post("/api/quotes/:id/send", isAuthenticated, async (req, res) => {
    try {
      const quote = await storage.sendQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (err: any) {
      console.error("Error sending quote:", err);
      res.status(500).json({ message: "Failed to send quote" });
    }
  });

  app.post("/api/quotes/:id/accept", isAuthenticated, async (req, res) => {
    try {
      const quote = await storage.acceptQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (err: any) {
      console.error("Error accepting quote:", err);
      res.status(500).json({ message: "Failed to accept quote" });
    }
  });

  app.post("/api/quotes/:id/reject", isAuthenticated, async (req, res) => {
    try {
      const quote = await storage.rejectQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (err: any) {
      console.error("Error rejecting quote:", err);
      res.status(500).json({ message: "Failed to reject quote" });
    }
  });

  app.post("/api/quotes/:id/convert-to-job", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.convertQuoteToJob(req.params.id);
      if (!result) {
        return res.status(400).json({ message: "Quote must be accepted before converting to job" });
      }
      res.json(result);
    } catch (err: any) {
      console.error("Error converting quote to job:", err);
      res.status(500).json({ message: "Failed to convert quote to job" });
    }
  });

  app.post("/api/quotes/:id/revise", isAuthenticated, async (req, res) => {
    try {
      const { revisionReason } = req.body;
      if (!revisionReason || typeof revisionReason !== "string") {
        return res.status(400).json({ message: "Revision reason is required" });
      }

      const userId = getUserId(req);
      const newQuote = await storage.createQuoteRevision(req.params.id, revisionReason, userId);

      if (!newQuote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      res.status(201).json(newQuote);
    } catch (err: any) {
      console.error("Error creating quote revision:", err);
      res.status(500).json({ message: "Failed to create quote revision" });
    }
  });

  app.get("/api/quotes/:id/revisions", isAuthenticated, async (req, res) => {
    try {
      const revisions = await storage.getQuoteRevisionHistory(req.params.id);
      res.json(revisions);
    } catch (err: any) {
      console.error("Error fetching quote revisions:", err);
      res.status(500).json({ message: "Failed to fetch quote revisions" });
    }
  });

  app.delete("/api/quotes/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteQuote(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting quote:", err);
      res.status(500).json({ message: "Failed to delete quote" });
    }
  });

  // Quote milestones
  app.get("/api/quotes/:quoteId/milestones", isAuthenticated, async (req, res) => {
    try {
      const milestones = await storage.getQuoteMilestones(req.params.quoteId);
      res.json(milestones);
    } catch (err: any) {
      console.error("Error fetching quote milestones:", err);
      res.status(500).json({ message: "Failed to fetch quote milestones" });
    }
  });

  app.post("/api/quotes/:quoteId/milestones", isAuthenticated, async (req, res) => {
    try {
      const milestone = await storage.createQuoteMilestone({
        ...req.body,
        quoteId: req.params.quoteId,
      });
      res.status(201).json(milestone);
    } catch (err: any) {
      console.error("Error creating quote milestone:", err);
      res.status(500).json({ message: "Failed to create quote milestone" });
    }
  });

  app.patch("/api/quote-milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateQuoteMilestone(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Quote milestone not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating quote milestone:", err);
      res.status(500).json({ message: "Failed to update quote milestone" });
    }
  });

  app.delete("/api/quote-milestones/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteQuoteMilestone(req.params.id);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting quote milestone:", err);
      res.status(500).json({ message: "Failed to delete quote milestone" });
    }
  });

  app.delete("/api/quotes/:quoteId/milestones", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteQuoteMilestonesByQuote(req.params.quoteId);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting quote milestones:", err);
      res.status(500).json({ message: "Failed to delete quote milestones" });
    }
  });

  // Quote custom sections
  app.get("/api/quotes/:quoteId/custom-sections", isAuthenticated, async (req, res) => {
    try {
      const sections = await storage.getQuoteCustomSections(req.params.quoteId);
      res.json(sections);
    } catch (err: any) {
      console.error("Error fetching quote custom sections:", err);
      res.status(500).json({ message: "Failed to fetch quote custom sections" });
    }
  });

  app.post("/api/quotes/:quoteId/custom-sections", isAuthenticated, async (req, res) => {
    try {
      const section = await storage.createQuoteCustomSection({
        ...req.body,
        quoteId: req.params.quoteId,
      });
      res.status(201).json(section);
    } catch (err: any) {
      console.error("Error creating quote custom section:", err);
      res.status(500).json({ message: "Failed to create quote custom section" });
    }
  });

  app.patch("/api/quote-custom-sections/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateQuoteCustomSection(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Quote custom section not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating quote custom section:", err);
      res.status(500).json({ message: "Failed to update quote custom section" });
    }
  });

  app.delete("/api/quote-custom-sections/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteQuoteCustomSection(req.params.id);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting quote custom section:", err);
      res.status(500).json({ message: "Failed to delete quote custom section" });
    }
  });

  app.delete("/api/quotes/:quoteId/custom-sections", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteQuoteCustomSectionsByQuote(req.params.quoteId);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting quote custom sections:", err);
      res.status(500).json({ message: "Failed to delete quote custom sections" });
    }
  });

  // Terms templates
  app.get("/api/terms-templates", isAuthenticated, async (req, res) => {
    try {
      const templates = await storage.getTermsTemplates();
      res.json(templates);
    } catch (err: any) {
      console.error("Error fetching terms templates:", err);
      res.status(500).json({ message: "Failed to fetch terms templates" });
    }
  });

  app.get("/api/terms-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const template = await storage.getTermsTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (err: any) {
      console.error("Error fetching terms template:", err);
      res.status(500).json({ message: "Failed to fetch terms template" });
    }
  });

  app.post("/api/terms-templates", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertTermsTemplateSchema.safeParse({
        ...req.body,
        createdById: requireUserId(req),
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid template data", errors: parsed.error.issues });
      }
      const template = await storage.createTermsTemplate(parsed.data);
      res.status(201).json(template);
    } catch (err: any) {
      console.error("Error creating terms template:", err);
      res.status(500).json({ message: "Failed to create terms template" });
    }
  });

  app.patch("/api/terms-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const updateSchema = insertTermsTemplateSchema.partial();
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid template data", errors: parsed.error.issues });
      }
      const updated = await storage.updateTermsTemplate(req.params.id, parsed.data);
      if (!updated) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating terms template:", err);
      res.status(500).json({ message: "Failed to update terms template" });
    }
  });

  app.delete("/api/terms-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteTermsTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting terms template:", err);
      res.status(500).json({ message: "Failed to delete terms template" });
    }
  });

  // Quote payment schedules
  app.get("/api/quotes/:quoteId/payment-schedules", isAuthenticated, async (req, res) => {
    try {
      const schedules = await storage.getQuotePaymentSchedules(req.params.quoteId);
      res.json(schedules);
    } catch (err: any) {
      console.error("Error fetching payment schedules:", err);
      res.status(500).json({ message: "Failed to fetch payment schedules" });
    }
  });

  app.post("/api/quotes/:quoteId/payment-schedules", isAuthenticated, async (req, res) => {
    try {
      const schedule = await storage.createQuotePaymentSchedule({
        ...req.body,
        quoteId: req.params.quoteId,
      });
      res.status(201).json(schedule);
    } catch (err: any) {
      console.error("Error creating payment schedule:", err);
      res.status(500).json({ message: "Failed to create payment schedule" });
    }
  });

  app.patch("/api/payment-schedules/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateQuotePaymentSchedule(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Payment schedule not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating payment schedule:", err);
      res.status(500).json({ message: "Failed to update payment schedule" });
    }
  });

  app.delete("/api/payment-schedules/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteQuotePaymentSchedule(req.params.id);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting payment schedule:", err);
      res.status(500).json({ message: "Failed to delete payment schedule" });
    }
  });

  app.post("/api/payment-schedules/:id/mark-paid", isAuthenticated, async (req, res) => {
    try {
      const { paidAmount } = req.body;
      const updated = await storage.markPaymentSchedulePaid(req.params.id, paidAmount);
      if (!updated) {
        return res.status(404).json({ message: "Payment schedule not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error marking payment as paid:", err);
      res.status(500).json({ message: "Failed to mark payment as paid" });
    }
  });

  // Quote workflow events
  app.get("/api/quotes/:quoteId/workflow-events", isAuthenticated, async (req, res) => {
    try {
      const events = await storage.getQuoteWorkflowEvents(req.params.quoteId);
      res.json(events);
    } catch (err: any) {
      console.error("Error fetching workflow events:", err);
      res.status(500).json({ message: "Failed to fetch workflow events" });
    }
  });
}
