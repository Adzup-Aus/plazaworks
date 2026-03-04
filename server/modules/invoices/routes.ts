import type { Express } from "express";
import { storage, isAuthenticated, requireUserId, requirePermission } from "../../routes/shared";
import { insertInvoiceSchema } from "@shared/schema";
import { sendPaymentLinkEmail } from "../../email";

export function registerInvoicesRoutes(app: Express): void {
  app.get("/api/invoices", isAuthenticated, requirePermission("view_invoices"), async (req, res) => {
    try {
      const { status, jobId } = req.query;
      let invoicesList;
      if (jobId && typeof jobId === "string") {
        invoicesList = await storage.getInvoicesByJob(jobId);
      } else if (status && typeof status === "string") {
        invoicesList = await storage.getInvoicesByStatus(status);
      } else {
        invoicesList = await storage.getInvoices();
      }
      res.json(invoicesList);
    } catch (err: any) {
      console.error("Error fetching invoices:", err);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", isAuthenticated, requirePermission("view_invoices"), async (req, res) => {
    try {
      const invoice = await storage.getInvoiceWithDetails(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (err: any) {
      console.error("Error fetching invoice:", err);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

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
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error creating invoice from quote:", err);
      res.status(500).json({ message: "Failed to create invoice from quote" });
    }
  });

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

  app.post("/api/invoices/:id/send-payment-link", isAuthenticated, requirePermission("edit_invoices"), async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
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
      const amountDue = parseFloat(invoice.amountDue ?? "0").toFixed(2);
      await sendPaymentLinkEmail(
        clientEmail,
        invoice.clientName || "Client",
        invoice.invoiceNumber,
        amountDue,
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
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error generating invoice from quote:", err);
      res.status(500).json({ message: "Failed to generate invoice" });
    }
  });
}
