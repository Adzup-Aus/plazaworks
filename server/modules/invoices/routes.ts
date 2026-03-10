import type { Express } from "express";
import { storage, isAuthenticated, requireUserId, requirePermission } from "../../routes/shared";
import { insertInvoiceSchema } from "@shared/schema";
import { sendPaymentLinkEmail } from "../../email";
import { triggerSyncInvoice, triggerVoidInvoiceInQuickBooks } from "../../services/quickbooksSync";

export function registerInvoicesRoutes(app: Express): void {
  /**
   * @openapi
   * /invoices:
   *   get:
   *     summary: List invoices
   *     tags: [Invoices]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: status
   *         in: query
   *         schema: { type: string }
   *       - name: jobId
   *         in: query
   *         schema: { type: string }
   *     responses:
   *       200: { description: List of invoices }
   */
  app.get("/api/invoices", isAuthenticated, requirePermission("view_invoices"), async (req, res) => {
    try {
      const { status, jobId } = req.query;
      let invoicesList: Awaited<ReturnType<typeof storage.getInvoices>>;
      if (jobId && typeof jobId === "string") {
        invoicesList = await storage.getInvoicesByJob(jobId);
      } else if (status && typeof status === "string") {
        invoicesList = await storage.getInvoicesByStatus(status);
      } else {
        invoicesList = await storage.getInvoices();
      }
      const conn = await storage.getQuickBooksConnection();
      const qbEnabled = !!(conn?.realm_id && conn.encrypted_access_token && conn.enabled_at);
      if (qbEnabled && conn && invoicesList.length > 0) {
        const mappings = await storage.getQuickBooksInvoiceMappingsForInvoices(
          conn.id,
          invoicesList.map((inv) => inv.id)
        );
        const syncedSet = new Set(mappings.map((m) => m.platform_invoice_id));
        const qbIdByInvoice = new Map(mappings.map((m) => [m.platform_invoice_id, m.quickbooks_invoice_id]));
        const enriched = invoicesList.map((inv) => ({
          ...inv,
          quickbooksSynced: syncedSet.has(inv.id),
          quickbooksInvoiceId: qbIdByInvoice.get(inv.id) ?? null,
        }));
        return res.json(enriched);
      }
      res.json(invoicesList);
    } catch (err: any) {
      console.error("Error fetching invoices:", err);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  /**
   * @openapi
   * /invoices/{id}:
   *   get:
   *     summary: Get invoice by ID
   *     tags: [Invoices]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Invoice details }
   *       404: { description: Invoice not found }
   */
  app.get("/api/invoices/:id", isAuthenticated, requirePermission("view_invoices"), async (req, res) => {
    try {
      const invoice = await storage.getInvoiceWithDetails(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      const conn = await storage.getQuickBooksConnection();
      const qbEnabled = !!(conn?.realm_id && conn.encrypted_access_token && conn.enabled_at);
      if (qbEnabled && conn) {
        const mapping = await storage.getQuickBooksInvoiceMapping(conn.id, invoice.id);
        return res.json({
          ...invoice,
          quickbooksSynced: !!mapping?.quickbooks_invoice_id,
          quickbooksInvoiceId: mapping?.quickbooks_invoice_id ?? null,
        });
      }
      res.json(invoice);
    } catch (err: any) {
      console.error("Error fetching invoice:", err);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  /**
   * @openapi
   * /invoices:
   *   post:
   *     summary: Create an invoice
   *     tags: [Invoices]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     requestBody: { content: { application/json: { schema: { type: object } } } }
   *     responses:
   *       201: { description: Invoice created }
   *       400: { description: Validation error }
   */
  app.post("/api/invoices", isAuthenticated, requirePermission("create_invoices"), async (req: any, res) => {
    try {
      const validation = insertInvoiceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const userId = requireUserId(req);
      const invoice = await storage.createInvoice({
        ...validation.data,
        createdById: userId,
      });
      triggerSyncInvoice(invoice.id);
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error creating invoice:", err);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.post("/api/jobs/:jobId/invoice", isAuthenticated, requirePermission("create_invoices"), async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const invoice = await storage.createInvoiceFromJob(req.params.jobId, userId);
      if (!invoice) {
        return res.status(404).json({ message: "Job not found" });
      }
      triggerSyncInvoice(invoice.id);
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error creating invoice from job:", err);
      res.status(500).json({ message: "Failed to create invoice from job" });
    }
  });

  app.post("/api/quotes/:quoteId/invoice", isAuthenticated, requirePermission("create_invoices"), async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const invoice = await storage.createInvoiceFromQuote(req.params.quoteId, userId);
      if (!invoice) {
        return res.status(404).json({ message: "Quote not found" });
      }
      triggerSyncInvoice(invoice.id);
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error creating invoice from quote:", err);
      res.status(500).json({ message: "Failed to create invoice from quote" });
    }
  });

  /**
   * @openapi
   * /invoices/{id}:
   *   patch:
   *     summary: Update an invoice
   *     tags: [Invoices]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     requestBody: { content: { application/json: { schema: { type: object } } } }
   *     responses:
   *       200: { description: Invoice updated }
   *       404: { description: Invoice not found }
   */
  app.patch("/api/invoices/:id", isAuthenticated, requirePermission("edit_invoices"), async (req, res) => {
    try {
      const partialSchema = insertInvoiceSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateInvoice(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      triggerSyncInvoice(req.params.id);
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating invoice:", err);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  app.post("/api/invoices/:id/send", isAuthenticated, requirePermission("edit_invoices"), async (req, res) => {
    try {
      const invoice = await storage.sendInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (err: any) {
      console.error("Error sending invoice:", err);
      res.status(500).json({ message: "Failed to send invoice" });
    }
  });

  app.post("/api/invoices/:id/trigger-quickbooks-sync", isAuthenticated, requirePermission("admin_settings"), async (req: any, res) => {
    try {
      triggerSyncInvoice(req.params.id);
      res.status(202).json({ triggered: true });
    } catch (err: any) {
      console.error("Trigger QuickBooks sync failed:", err);
      res.status(500).json({ message: "Failed to trigger QuickBooks sync" });
    }
  });

  app.post("/api/invoices/:id/payment-link", isAuthenticated, requirePermission("edit_invoices"), async (req, res) => {
    try {
      const invoice = await storage.ensureStripePaymentLinkForInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (err: any) {
      console.error("Error ensuring payment link:", err);
      res.status(500).json({ message: "Failed to ensure payment link" });
    }
  });

  app.post("/api/invoices/:id/send-payment-link", isAuthenticated, requirePermission("edit_invoices"), async (req, res) => {
    try {
      let invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      const amountDue = parseFloat(String(invoice.amountDue ?? "0"));
      if (amountDue > 0) {
        const updated = await storage.ensureStripePaymentLinkForInvoice(req.params.id);
        if (updated) invoice = updated;
      }
      const paymentLinkUrl =
        invoice.stripePaymentLinkUrl ||
        (invoice.paymentLinkToken
          ? `${process.env.APP_URL || ""}/pay/${invoice.paymentLinkToken}`
          : null);
      if (!paymentLinkUrl) {
        return res.status(400).json({ message: "No payment link available for this invoice" });
      }
      const clientEmail = invoice.clientEmail?.trim();
      if (!clientEmail) {
        return res.status(400).json({ message: "Invoice has no client email; add one before sending the payment link" });
      }
      const amountDueFormatted = parseFloat(String(invoice.amountDue ?? "0")).toFixed(2);
      await sendPaymentLinkEmail(
        clientEmail,
        invoice.clientName || "Client",
        invoice.invoiceNumber,
        amountDueFormatted,
        paymentLinkUrl
      );
      res.json({ sent: true, message: "Payment link sent to client" });
    } catch (err: any) {
      console.error("Error sending payment link email:", err);
      res.status(500).json({ message: err?.message || "Failed to send payment link" });
    }
  });

  app.delete("/api/invoices/:id", isAuthenticated, requirePermission("delete_invoices"), async (req, res) => {
    try {
      triggerVoidInvoiceInQuickBooks(req.params.id);
      const deleted = await storage.deleteInvoice(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting invoice:", err);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  app.post("/api/invoices/generate/job/:jobId", isAuthenticated, requirePermission("create_invoices"), async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const invoice = await storage.createInvoiceFromJob(req.params.jobId, userId);
      if (!invoice) {
        return res.status(404).json({ message: "Job not found" });
      }
      triggerSyncInvoice(invoice.id);
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error generating invoice from job:", err);
      res.status(500).json({ message: "Failed to generate invoice" });
    }
  });

  app.post("/api/invoices/generate/quote/:quoteId", isAuthenticated, requirePermission("create_invoices"), async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const invoice = await storage.createInvoiceFromQuote(req.params.quoteId, userId);
      if (!invoice) {
        return res.status(404).json({ message: "Quote not found" });
      }
      triggerSyncInvoice(invoice.id);
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error generating invoice from quote:", err);
      res.status(500).json({ message: "Failed to generate invoice" });
    }
  });
}
