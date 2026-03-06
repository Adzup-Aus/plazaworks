import type { Express } from "express";
import { storage } from "../../routes/shared";
import { getStripe } from "../../services/stripeService";

export function registerPayRoutes(app: Express): void {
  app.get("/api/pay/success-details", async (req, res) => {
    try {
      const sessionId = req.query.session_id;
      if (!sessionId || typeof sessionId !== "string" || !sessionId.trim()) {
        return res.status(400).json({ message: "session_id is required" });
      }
      const sid = sessionId.trim();
      let invoice = await storage.getInvoiceByStripeSessionId(sid);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found for this session" });
      }

      // If webhook did not run (e.g. local dev), complete payment from Stripe session so invoice turns paid and job is created
      if (invoice.status !== "paid") {
        const stripe = getStripe();
        if (stripe) {
          try {
            const session = await stripe.checkout.sessions.retrieve(sid);
            if (session.payment_status === "paid" && session.metadata?.invoiceId === invoice.id) {
              const amountTotal = session.amount_total ?? 0;
              const amountPaid = (amountTotal / 100).toFixed(2);
              await storage.createInvoicePayment({
                invoiceId: invoice.id,
                amount: amountPaid,
                paymentMethod: "stripe",
                status: "completed",
                stripePaymentIntentId:
                  typeof session.payment_intent === "string" ? session.payment_intent : null,
                description: `Stripe payment ${session.id}`,
              });
              const updated = await storage.getInvoice(invoice.id);
              if (
                (updated?.status === "partially_paid" || updated?.status === "paid") &&
                updated.quoteId &&
                !updated.jobId
              ) {
                try {
                  await storage.createJobFromPaidInvoice(invoice.id);
                } catch (err: any) {
                  console.error("createJobFromPaidInvoice from success-details:", err);
                }
              }
              invoice = (await storage.getInvoice(invoice.id)) ?? invoice;
            }
          } catch (err: any) {
            console.error("Stripe session retrieve in success-details:", err);
          }
        }
      }

      const amountPaid = invoice.amountPaid ?? invoice.total ?? "0";
      const jobCreated = Boolean(invoice.jobId);
      let jobNumber: string | undefined;
      if (invoice.jobId) {
        const job = await storage.getJob(invoice.jobId);
        jobNumber = job?.jobNumber ?? undefined;
      }
      res.json({
        invoiceNumber: invoice.invoiceNumber,
        amountPaid: String(amountPaid),
        jobCreated,
        jobId: invoice.jobId ?? undefined,
        jobNumber,
      });
    } catch (err: any) {
      console.error("Error fetching payment success details:", err);
      res.status(500).json({ message: "Failed to fetch success details" });
    }
  });

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
