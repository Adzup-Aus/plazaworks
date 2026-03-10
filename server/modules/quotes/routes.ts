import type { Express } from "express";
import { randomBytes } from "crypto";
import { storage, isAuthenticated, requireUserId, getUserId, requirePermission } from "../../routes/shared";
import { insertQuoteSchema, insertTermsTemplateSchema } from "@shared/schema";
import { sendQuoteNotification } from "../../email";
import { triggerSyncInvoice } from "../../services/quickbooksSync";

export function registerQuotesRoutes(app: Express): void {
  /**
   * @openapi
   * /quotes:
   *   get:
   *     summary: List quotes
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: status
   *         in: query
   *         schema: { type: string }
   *     responses:
   *       200: { description: List of quotes }
   */
  app.get("/api/quotes", isAuthenticated, requirePermission("view_quotes"), async (req, res) => {
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

  /**
   * @openapi
   * /quotes/{id}:
   *   get:
   *     summary: Get quote by ID
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Quote details }
   *       404: { description: Quote not found }
   */
  app.get("/api/quotes/:id", isAuthenticated, requirePermission("view_quotes"), async (req, res) => {
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

  /**
   * @openapi
   * /quotes:
   *   post:
   *     summary: Create a quote
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     requestBody: { content: { application/json: { schema: { type: object } } } }
   *     responses:
   *       201: { description: Quote created }
   *       400: { description: Validation error }
   */
  app.post("/api/quotes", isAuthenticated, requirePermission("create_quotes"), async (req: any, res) => {
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

  /**
   * @openapi
   * /quotes/{id}:
   *   patch:
   *     summary: Update a quote
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     requestBody: { content: { application/json: { schema: { type: object } } } }
   *     responses:
   *       200: { description: Quote updated }
   *       404: { description: Quote not found }
   */
  app.patch("/api/quotes/:id", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
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

  app.post("/api/quotes/:id/send", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
    try {
      const quote = await storage.sendQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      const clientEmail = (quote.clientEmail ?? "").trim();
      if (!clientEmail) {
        return res.status(400).json({ message: "Quote has no client email; add one before sending" });
      }
      const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
      if (!appUrl) {
        return res.status(500).json({ message: "APP_URL is not set; cannot build respond link" });
      }
      const token = randomBytes(24).toString("hex");
      await storage.updateQuote(req.params.id, { clientResponseToken: token } as Record<string, unknown>);
      const quoteWithItems = await storage.getQuoteWithLineItems(req.params.id);
      if (!quoteWithItems) {
        return res.status(404).json({ message: "Quote not found" });
      }
      const respondUrl = `${appUrl}/quote/respond/${token}`;
      const subtotal = String(quoteWithItems.subtotal ?? "0");
      const taxRate = String(quoteWithItems.taxRate ?? "0");
      const taxAmount = String(quoteWithItems.taxAmount ?? "0");
      const total = String(quoteWithItems.total ?? "0");
      const validUntil = quoteWithItems.validUntil
        ? new Date(quoteWithItems.validUntil).toLocaleDateString(undefined, { dateStyle: "medium" })
        : undefined;
      const lineItems = (quoteWithItems.lineItems ?? []).map((item: { description?: string; quantity?: string | number; unitPrice?: string; amount?: string }) => ({
        description: item.description ?? "",
        quantity: item.quantity,
        unitPrice: item.unitPrice != null ? String(item.unitPrice) : "",
        amount: item.amount != null ? String(item.amount) : "",
      }));
      const schedules = await storage.getQuotePaymentSchedules(req.params.id);
      const paymentSchedules = schedules.map((s) => {
        const amount = s.calculatedAmount != null ? String(s.calculatedAmount) : s.fixedAmount != null ? String(s.fixedAmount) : "0";
        const days = s.dueDaysFromAcceptance ?? 0;
        let dueWhen: string;
        if (days > 0) {
          dueWhen = days === 1 ? "1 day after acceptance" : `${days} days after acceptance`;
        } else {
          if (s.type === "deposit") dueWhen = "On acceptance";
          else if (s.type === "final") dueWhen = "On completion";
          else if (s.type === "progress") dueWhen = "As scheduled";
          else dueWhen = "On acceptance";
        }
        return { name: s.name, type: s.type, amount, dueWhen };
      });
      await sendQuoteNotification({
        clientEmail,
        clientName: quoteWithItems.clientName ?? "Client",
        quoteNumber: quoteWithItems.quoteNumber ?? quoteWithItems.id,
        subtotal,
        taxRate,
        taxAmount,
        total,
        validUntil,
        lineItems,
        paymentSchedules,
        respondUrl,
      });
      const updated = await storage.getQuote(req.params.id);
      res.json(updated ?? quote);
    } catch (err: any) {
      console.error("Error sending quote:", err);
      res.status(500).json({ message: err?.message ?? "Failed to send quote" });
    }
  });

  app.post("/api/quotes/:id/accept", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
    try {
      const quote = await storage.acceptQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      let createdInvoiceId: string | undefined;
      if (!quote.convertedToInvoiceId) {
        const invoice = await storage.createInvoiceFromAcceptedQuote(req.params.id, requireUserId(req));
        createdInvoiceId = invoice?.id;
        if (invoice) triggerSyncInvoice(invoice.id);
      }
      const updated = await storage.getQuote(req.params.id);
      const payload = updated ?? quote;
      res.json(createdInvoiceId != null ? { ...payload, createdInvoiceId } : payload);
    } catch (err: any) {
      console.error("Error accepting quote:", err);
      res.status(500).json({ message: "Failed to accept quote" });
    }
  });

  app.post("/api/quotes/:id/reject", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
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

  app.post("/api/quotes/:id/convert-to-job", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
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

  app.post("/api/quotes/:id/revise", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
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

  app.get("/api/quotes/:id/revisions", isAuthenticated, requirePermission("view_quotes"), async (req, res) => {
    try {
      const revisions = await storage.getQuoteRevisionHistory(req.params.id);
      res.json(revisions);
    } catch (err: any) {
      console.error("Error fetching quote revisions:", err);
      res.status(500).json({ message: "Failed to fetch quote revisions" });
    }
  });

  app.delete("/api/quotes/:id", isAuthenticated, requirePermission("delete_quotes"), async (req, res) => {
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
  app.get("/api/quotes/:quoteId/milestones", isAuthenticated, requirePermission("view_quotes"), async (req, res) => {
    try {
      const milestones = await storage.getQuoteMilestones(req.params.quoteId);
      res.json(milestones);
    } catch (err: any) {
      console.error("Error fetching quote milestones:", err);
      res.status(500).json({ message: "Failed to fetch quote milestones" });
    }
  });

  app.post("/api/quotes/:quoteId/milestones", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
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

  app.delete("/api/quotes/:quoteId/milestones", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
    try {
      await storage.deleteQuoteMilestonesByQuote(req.params.quoteId);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting quote milestones:", err);
      res.status(500).json({ message: "Failed to delete quote milestones" });
    }
  });

  // Quote custom sections
  app.get("/api/quotes/:quoteId/custom-sections", isAuthenticated, requirePermission("view_quotes"), async (req, res) => {
    try {
      const sections = await storage.getQuoteCustomSections(req.params.quoteId);
      res.json(sections);
    } catch (err: any) {
      console.error("Error fetching quote custom sections:", err);
      res.status(500).json({ message: "Failed to fetch quote custom sections" });
    }
  });

  app.post("/api/quotes/:quoteId/custom-sections", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
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

  app.delete("/api/quotes/:quoteId/custom-sections", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
    try {
      await storage.deleteQuoteCustomSectionsByQuote(req.params.quoteId);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting quote custom sections:", err);
      res.status(500).json({ message: "Failed to delete quote custom sections" });
    }
  });

  // Terms templates
  app.get("/api/terms-templates", isAuthenticated, requirePermission("view_quotes"), async (req, res) => {
    try {
      const templates = await storage.getTermsTemplates();
      res.json(templates);
    } catch (err: any) {
      console.error("Error fetching terms templates:", err);
      res.status(500).json({ message: "Failed to fetch terms templates" });
    }
  });

  app.get("/api/terms-templates/:id", isAuthenticated, requirePermission("view_quotes"), async (req, res) => {
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

  app.post("/api/terms-templates", isAuthenticated, requirePermission("edit_quotes"), async (req: any, res) => {
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

  app.patch("/api/terms-templates/:id", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
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

  app.delete("/api/terms-templates/:id", isAuthenticated, requirePermission("delete_quotes"), async (req, res) => {
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
  app.get("/api/quotes/:quoteId/payment-schedules", isAuthenticated, requirePermission("view_quotes"), async (req, res) => {
    try {
      const schedules = await storage.getQuotePaymentSchedules(req.params.quoteId);
      res.json(schedules);
    } catch (err: any) {
      console.error("Error fetching payment schedules:", err);
      res.status(500).json({ message: "Failed to fetch payment schedules" });
    }
  });

  app.post("/api/quotes/:quoteId/payment-schedules", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
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

  app.patch("/api/payment-schedules/:id", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
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

  app.delete("/api/payment-schedules/:id", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
    try {
      await storage.deleteQuotePaymentSchedule(req.params.id);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting payment schedule:", err);
      res.status(500).json({ message: "Failed to delete payment schedule" });
    }
  });

  app.post("/api/payment-schedules/:id/mark-paid", isAuthenticated, requirePermission("edit_quotes"), async (req, res) => {
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
  app.get("/api/quotes/:quoteId/workflow-events", isAuthenticated, requirePermission("view_quotes"), async (req, res) => {
    try {
      const events = await storage.getQuoteWorkflowEvents(req.params.quoteId);
      res.json(events);
    } catch (err: any) {
      console.error("Error fetching workflow events:", err);
      res.status(500).json({ message: "Failed to fetch workflow events" });
    }
  });
}
