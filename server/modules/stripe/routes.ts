import type { Express, Request, Response } from "express";
import type Stripe from "stripe";
import { getStripe } from "../../services/stripeService";
import { storage } from "../../routes/shared";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export function registerStripeRoutes(app: Express): void {
  app.post("/api/webhooks/stripe", async (req: Request, res: Response) => {
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const signature = req.headers["stripe-signature"];
    if (!WEBHOOK_SECRET || !rawBody || !signature) {
      if (!WEBHOOK_SECRET) return res.status(200).send();
      return res.status(400).send("Missing body or signature");
    }

    const stripe = getStripe();
    if (!stripe) return res.status(200).send();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature as string,
        WEBHOOK_SECRET
      ) as Stripe.Event;
    } catch (err: any) {
      console.error("Stripe webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoiceId;
      if (!invoiceId) {
        return res.status(200).send();
      }

      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(200).send();
      }

      const amountTotal = session.amount_total ?? 0;
      const amountPaid = (amountTotal / 100).toFixed(2);

      await storage.createInvoicePayment({
        invoiceId,
        amount: amountPaid,
        paymentMethod: "stripe",
        status: "completed",
        stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        description: `Stripe payment ${session.id}`,
      });

      // Guarantee job creation for Stripe-paid invoices (independent of autoCreateJobFromInvoice)
      const updated = await storage.getInvoice(invoiceId);
      if (
        (updated?.status === "partially_paid" || updated?.status === "paid") &&
        updated.quoteId &&
        !updated.jobId
      ) {
        try {
          await storage.createJobFromPaidInvoice(invoiceId);
        } catch (err: any) {
          console.error("createJobFromPaidInvoice after Stripe payment:", err);
        }
      }
    }

    res.status(200).send();
  });
}
