import type { Express } from "express";
import { storage } from "./shared";

export function registerPayRoutes(app: Express): void {
  app.get("/api/pay/:token", async (req, res) => {
    try {
      const invoice = await storage.getInvoiceByPaymentToken(req.params.token);
      if (!invoice) {
        return res
          .status(404)
          .json({ message: "Invoice not found or payment link expired" });
      }

      const paymentSchedules = invoice.quoteId
        ? await storage.getQuotePaymentSchedules(invoice.quoteId)
        : [];

      res.json({
        ...invoice,
        paymentSchedules: paymentSchedules.filter((s) => s.invoiceId === invoice.id),
      });
    } catch (err: any) {
      console.error("Error fetching invoice by payment token:", err);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.post("/api/pay/:token/payment", async (req, res) => {
    try {
      const invoice = await storage.getInvoiceByPaymentToken(req.params.token);
      if (!invoice) {
        return res
          .status(404)
          .json({ message: "Invoice not found or payment link expired" });
      }

      const { amount, paymentMethod, reference } = req.body;
      if (!amount) {
        return res.status(400).json({ message: "Payment amount is required" });
      }

      const paymentAmount = parseFloat(amount);
      const currentAmountDue = parseFloat(invoice.amountDue || "0");

      if (paymentAmount <= 0) {
        return res.status(400).json({ message: "Payment amount must be positive" });
      }
      if (paymentAmount > currentAmountDue) {
        return res
          .status(400)
          .json({ message: "Payment amount exceeds balance due" });
      }

      const payment = await storage.createInvoicePayment({
        invoiceId: invoice.id,
        amount: String(paymentAmount.toFixed(2)),
        paymentMethod: paymentMethod || "online",
        description: reference || `PAY-${Date.now()}`,
        status: "completed",
      });

      const newAmountDue = Math.max(0, currentAmountDue - paymentAmount);
      const newStatus = newAmountDue === 0 ? "paid" : "partial";

      await storage.updateInvoice(invoice.id, {
        amountDue: String(newAmountDue.toFixed(2)),
        status: newStatus,
      });

      if (invoice.quoteId) {
        const schedules = await storage.getQuotePaymentSchedules(invoice.quoteId);
        const depositSchedule = schedules.find(
          (s) =>
            s.type === "deposit" &&
            !s.isPaid &&
            s.invoiceId === invoice.id
        );
        if (depositSchedule) {
          const depositAmount = parseFloat(
            depositSchedule.calculatedAmount || "0"
          );
          if (paymentAmount >= depositAmount) {
            await storage.markPaymentSchedulePaid(
              depositSchedule.id,
              String(paymentAmount.toFixed(2))
            );
          }
        }
      }

      res.json({
        success: true,
        payment,
        newAmountDue: newAmountDue.toFixed(2),
      });
    } catch (err: any) {
      console.error("Error recording payment:", err);
      res.status(500).json({ message: "Failed to record payment" });
    }
  });
}
