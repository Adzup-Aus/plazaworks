import type { Express } from "express";
import { storage, isAuthenticated } from "../../routes/shared";
import { insertPaymentSchema } from "@shared/schema";
import { triggerSyncPayment } from "../../services/quickbooksSync";

export function registerPaymentsRoutes(app: Express): void {
  app.get("/api/invoices/:invoiceId/payments", isAuthenticated, async (req, res) => {
    try {
      const paymentsList = await storage.getPaymentsByInvoice(req.params.invoiceId);
      res.json(paymentsList);
    } catch (err: any) {
      console.error("Error fetching payments:", err);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post("/api/invoices/:invoiceId/payments", isAuthenticated, async (req, res) => {
    try {
      const validation = insertPaymentSchema.safeParse({
        ...req.body,
        invoiceId: req.params.invoiceId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const payment = await storage.createPayment(validation.data);
      triggerSyncPayment(payment.invoiceId, Number(payment.amount));
      let convertedJob = null;
      const invoice = await storage.getInvoice(req.params.invoiceId);
      if (
        invoice?.quoteId &&
        (invoice.status === "partially_paid" ||
          invoice.status === "paid" ||
          parseFloat(invoice.amountDue ?? "0") <= 0) &&
        !invoice.jobId
      ) {
        try {
          const result = await storage.createJobFromPaidInvoice(invoice.id);
          if (result) convertedJob = result.job;
        } catch (err: any) {
          console.error("createJobFromPaidInvoice after manual payment:", err);
        }
      }
      res.status(201).json({
        payment,
        convertedJob,
        message: convertedJob ? "Payment recorded and job created" : "Payment recorded",
      });
    } catch (err: any) {
      console.error("Error creating payment:", err);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  app.post("/api/payments/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const payment = await storage.completePayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (err: any) {
      console.error("Error completing payment:", err);
      res.status(500).json({ message: "Failed to complete payment" });
    }
  });

  app.patch("/api/payments/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertPaymentSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updatePayment(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating payment:", err);
      res.status(500).json({ message: "Failed to update payment" });
    }
  });
}
