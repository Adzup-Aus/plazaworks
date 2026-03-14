import type { Express } from "express";
import { randomBytes } from "crypto";
import { storage, isAuthenticated, requireUserId, getUserId, requirePermission } from "../../routes/shared";
import { insertQuoteSchema, insertFullQuoteSchema, insertTermsTemplateSchema } from "@shared/schema";
import { sendQuoteNotification } from "../../email";
import { triggerSyncInvoice } from "../../services/quickbooksSync";

export function registerQuotesRoutes(app: Express): void {
  /**
   * @openapi
   * /quotes:
   *   get:
   *     summary: List quotes
   *     description: Returns all quotes, optionally filtered by status. Requires view_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: status
   *         in: query
   *         description: Filter by quote status (draft, sent, accepted, rejected, expired)
   *         schema:
   *           type: string
   *           enum: [draft, sent, accepted, rejected, expired]
   *     responses:
   *       200:
   *         description: List of quote records
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items: { $ref: '#/components/schemas/Quote' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing view_quotes) }
   *       500: { description: Server error }
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
   * /quotes/full:
   *   post:
   *     summary: Create a complete quote (atomic)
   *     description: |
   *       Creates a quote with all related entities in a single atomic transaction.
   *       Includes milestones with line items, payment schedules, and custom sections.
   *       Either all entities are created, or nothing is persisted (rollback on error).
   *       Optionally set options.status to "sent" and options.sendEmail to trigger client email.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/CreateFullQuoteRequest' }
   *     responses:
   *       201:
   *         description: Complete quote created with all related entities
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/QuoteWithLineItems' }
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing create_quotes) }
   *       500: { description: Server error or transaction rollback }
   */
  app.post("/api/quotes/full", isAuthenticated, requirePermission("create_quotes"), async (req: any, res) => {
    try {
      const validation = insertFullQuoteSchema.safeParse(req.body);
      if (!validation.success) {
        const first = validation.error.errors[0];
        return res.status(400).json({ message: first?.message ?? "Validation failed" });
      }
      const userId = requireUserId(req);
      const full = await storage.createFullQuote(validation.data, userId);
      const quote = full;
      if (validation.data.options?.status === "sent" && validation.data.options?.sendEmail) {
        const clientEmail = (quote.clientEmail ?? "").trim();
        if (clientEmail) {
          const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
          if (appUrl) {
            const token = randomBytes(24).toString("hex");
            await storage.updateQuote(quote.id, { clientResponseToken: token } as Record<string, unknown>);
            const quoteWithItems = await storage.getQuoteWithLineItems(quote.id);
            if (quoteWithItems) {
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
              const schedules = await storage.getQuotePaymentSchedules(quote.id);
              const paymentSchedules = schedules.map((s) => {
                const amount = s.calculatedAmount != null ? String(s.calculatedAmount) : s.fixedAmount != null ? String(s.fixedAmount) : "0";
                const days = s.dueDaysFromAcceptance ?? 0;
                let dueWhen: string;
                if (days > 0) {
                  dueWhen = days === 1 ? "1 day after acceptance" : `${days} days after acceptance`;
                } else {
                  if (s.type === "deposit") dueWhen = "On acceptance";
                  else if (s.type === "final") dueWhen = "On completion";
                  else if (s.type === "progress" || s.type === "milestone") dueWhen = "As scheduled";
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
            }
          }
        }
      }
      res.status(201).json(full);
    } catch (err: any) {
      console.error("Error creating full quote:", err);
      res.status(500).json({ message: err?.message ?? "Failed to create quote" });
    }
  });

  /**
   * @openapi
   * /quotes/{id}:
   *   get:
   *     summary: Get quote by ID with line items
   *     description: Returns a single quote including its line items. Requires view_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         description: Quote UUID
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Quote with nested line items
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/QuoteWithLineItems' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing view_quotes) }
   *       404:
   *         description: Quote not found
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       500: { description: Server error }
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
   *     description: Creates a new quote. quoteNumber is auto-generated. Requires create_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [clientId, clientName, clientAddress, jobType]
   *             properties:
   *               clientId: { type: string, format: uuid, description: Client UUID }
   *               clientName: { type: string, minLength: 1 }
   *               clientEmail: { type: string, nullable: true }
   *               clientPhone: { type: string, nullable: true }
   *               clientAddress: { type: string, minLength: 1 }
   *               jobType: { type: string, description: Job type code }
   *               description: { type: string, nullable: true }
   *               status: { type: string, enum: [draft, sent, accepted, rejected, expired], default: draft }
   *               clientStatus: { type: string, enum: [pending, approved, rejected, changes_requested], nullable: true }
   *               subtotal: { type: string, nullable: true }
   *               taxRate: { type: string, nullable: true }
   *               taxAmount: { type: string, nullable: true }
   *               total: { type: string, nullable: true }
   *               validUntil: { type: string, format: date, nullable: true }
   *               notes: { type: string, nullable: true }
   *               termsAndConditions: { type: string, nullable: true }
   *               termsOfTradeTemplateId: { type: string, format: uuid, nullable: true }
   *               termsOfTradeContent: { type: string, nullable: true }
   *     responses:
   *       201:
   *         description: Quote created
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Quote' }
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing create_quotes) }
   *       500: { description: Server error }
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
   *     description: Partially update a quote. All request body fields are optional. Requires edit_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         description: Quote UUID
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               clientId: { type: string, format: uuid, nullable: true }
   *               clientName: { type: string, nullable: true }
   *               clientEmail: { type: string, nullable: true }
   *               clientPhone: { type: string, nullable: true }
   *               clientAddress: { type: string, nullable: true }
   *               jobType: { type: string, nullable: true }
   *               description: { type: string, nullable: true }
   *               status: { type: string, enum: [draft, sent, accepted, rejected, expired], nullable: true }
   *               clientStatus: { type: string, enum: [pending, approved, rejected, changes_requested], nullable: true }
   *               subtotal: { type: string, nullable: true }
   *               taxRate: { type: string, nullable: true }
   *               taxAmount: { type: string, nullable: true }
   *               total: { type: string, nullable: true }
   *               validUntil: { type: string, format: date, nullable: true }
   *               notes: { type: string, nullable: true }
   *               termsAndConditions: { type: string, nullable: true }
   *               termsOfTradeTemplateId: { type: string, format: uuid, nullable: true }
   *               termsOfTradeContent: { type: string, nullable: true }
   *     responses:
   *       200:
   *         description: Updated quote
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Quote' }
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing edit_quotes) }
   *       404:
   *         description: Quote not found
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       500: { description: Server error }
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

  /**
   * @openapi
   * /quotes/{id}/send:
   *   post:
   *     summary: Send quote to client
   *     description: Marks quote as sent, generates a client response token, and sends email to client with respond link. Quote must have clientEmail. Requires edit_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         description: Quote UUID
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Updated quote (sent)
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Quote' }
   *       400:
   *         description: Quote has no client email
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing edit_quotes) }
   *       404:
   *         description: Quote not found
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       500: { description: Server error (e.g. APP_URL not set) }
   */
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

  /**
   * @openapi
   * /quotes/{id}/accept:
   *   post:
   *     summary: Accept quote
   *     description: Marks quote as accepted. If not already converted, creates an invoice from the quote. Returns quote with optional createdInvoiceId. Requires edit_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         description: Quote UUID
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Accepted quote; may include createdInvoiceId (UUID) when an invoice was created
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - { $ref: '#/components/schemas/Quote' }
   *                 - type: object
   *                   properties:
   *                     createdInvoiceId: { type: string, format: uuid, description: Present when invoice was just created }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing edit_quotes) }
   *       404:
   *         description: Quote not found
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       500: { description: Server error }
   */
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

  /**
   * @openapi
   * /quotes/{id}/reject:
   *   post:
   *     summary: Reject quote
   *     description: Marks quote as rejected. Requires edit_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         description: Quote UUID
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Rejected quote
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Quote' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing edit_quotes) }
   *       404:
   *         description: Quote not found
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       500: { description: Server error }
   */
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

  /**
   * @openapi
   * /quotes/{id}/convert-to-job:
   *   post:
   *     summary: Convert accepted quote to job
   *     description: Creates a job from an accepted quote. Quote must be in accepted status. Requires edit_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         description: Quote UUID
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Created job (shape depends on jobs module)
   *         content:
   *           application/json:
   *             schema: { type: object, description: Job record }
   *       400:
   *         description: Quote must be accepted before converting to job
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing edit_quotes) }
   *       500: { description: Server error }
   */
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

  /**
   * @openapi
   * /quotes/{id}/revise:
   *   post:
   *     summary: Create a quote revision
   *     description: Creates a new quote as a revision of the given quote, with revisionReason. The new quote is returned. Requires edit_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         description: Quote UUID to revise
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [revisionReason]
   *             properties:
   *               revisionReason: { type: string, description: Reason for this revision }
   *     responses:
   *       201:
   *         description: New quote (revision) created
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Quote' }
   *       400:
   *         description: Revision reason is required
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing edit_quotes) }
   *       404:
   *         description: Quote not found
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       500: { description: Server error }
   */
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

  /**
   * @openapi
   * /quotes/{id}/revisions:
   *   get:
   *     summary: Get quote revision history
   *     description: Returns the revision history for a quote (parent and superseded quotes). Requires view_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         description: Quote UUID
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: List of quotes in revision chain
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items: { $ref: '#/components/schemas/Quote' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing view_quotes) }
   *       500: { description: Server error }
   */
  app.get("/api/quotes/:id/revisions", isAuthenticated, requirePermission("view_quotes"), async (req, res) => {
    try {
      const revisions = await storage.getQuoteRevisionHistory(req.params.id);
      res.json(revisions);
    } catch (err: any) {
      console.error("Error fetching quote revisions:", err);
      res.status(500).json({ message: "Failed to fetch quote revisions" });
    }
  });

  /**
   * @openapi
   * /quotes/{id}:
   *   delete:
   *     summary: Delete a quote
   *     description: Permanently deletes a quote. Requires delete_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         description: Quote UUID
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Quote deleted
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 deleted: { type: boolean, example: true }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing delete_quotes) }
   *       404:
   *         description: Quote not found
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       500: { description: Server error }
   */
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

  // Terms templates
  /**
   * @openapi
   * /terms-templates:
   *   get:
   *     summary: List terms templates
   *     description: Returns all terms-of-trade templates. Requires view_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: List of terms templates
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items: { $ref: '#/components/schemas/TermsTemplate' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing view_quotes) }
   *       500: { description: Server error }
   */
  app.get("/api/terms-templates", isAuthenticated, requirePermission("view_quotes"), async (req, res) => {
    try {
      const templates = await storage.getTermsTemplates();
      res.json(templates);
    } catch (err: any) {
      console.error("Error fetching terms templates:", err);
      res.status(500).json({ message: "Failed to fetch terms templates" });
    }
  });

  /**
   * @openapi
   * /terms-templates/{id}:
   *   get:
   *     summary: Get terms template by ID
   *     description: Returns a single terms-of-trade template. Requires view_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Terms template
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/TermsTemplate' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing view_quotes) }
   *       404:
   *         description: Template not found
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       500: { description: Server error }
   */
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

  /**
   * @openapi
   * /terms-templates:
   *   post:
   *     summary: Create terms template
   *     description: Creates a new terms-of-trade template. createdById is set from authenticated user. Requires edit_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, content]
   *             properties:
   *               name: { type: string }
   *               content: { type: string }
   *               serviceType: { type: string, nullable: true }
   *               isDefault: { type: boolean, nullable: true }
   *     responses:
   *       201:
   *         description: Created terms template
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/TermsTemplate' }
   *       400:
   *         description: Invalid template data
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing edit_quotes) }
   *       500: { description: Server error }
   */
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

  /**
   * @openapi
   * /terms-templates/{id}:
   *   patch:
   *     summary: Update terms template
   *     description: Partially update a terms template. Requires edit_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name: { type: string, nullable: true }
   *               content: { type: string, nullable: true }
   *               serviceType: { type: string, nullable: true }
   *               isDefault: { type: boolean, nullable: true }
   *     responses:
   *       200:
   *         description: Updated terms template
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/TermsTemplate' }
   *       400:
   *         description: Invalid template data
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing edit_quotes) }
   *       404:
   *         description: Template not found
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       500: { description: Server error }
   */
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

  /**
   * @openapi
   * /terms-templates/{id}:
   *   delete:
   *     summary: Delete terms template
   *     description: Permanently deletes a terms template. Requires delete_quotes permission.
   *     tags: [Quotes]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Template deleted
   *         content:
   *           application/json:
   *             schema: { type: object, properties: { success: { type: boolean, example: true } } }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing delete_quotes) }
   *       404:
   *         description: Template not found
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorMessage' }
   *       500: { description: Server error }
   */
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
}
