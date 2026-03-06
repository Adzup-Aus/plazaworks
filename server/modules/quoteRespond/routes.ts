import type { Express } from "express";
import { storage } from "../../routes/shared";

/**
 * Public (no-auth) routes so clients can view and respond to quotes via email link token.
 * Used when the client does not have access to the app/portal.
 */
export function registerQuoteRespondRoutes(app: Express): void {
  /** GET quote by token – public, returns quote with line items and payment schedules for display */
  app.get("/api/quote/respond/:token", async (req, res) => {
    try {
      const data = await storage.getQuoteWithLineItemsByClientResponseToken(req.params.token);
      if (!data) {
        return res.status(404).json({ message: "Quote not found or link expired" });
      }
      const schedules = await storage.getQuotePaymentSchedules(data.id);
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
      res.json({ ...data, paymentSchedules });
    } catch (err: unknown) {
      console.error("Quote respond GET:", err);
      res.status(500).json({ message: "Failed to load quote" });
    }
  });

  /** POST respond (accept / reject / request_review) – public */
  app.post("/api/quote/respond/:token", async (req, res) => {
    try {
      const quote = await storage.getQuoteByClientResponseToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found or link expired" });
      }
      const action = (req.body?.action ?? "").toString().toLowerCase();
      const note = typeof req.body?.note === "string" ? req.body.note.trim() : null;

      if (quote.clientStatus !== "pending" && quote.status !== "sent") {
        return res.status(400).json({
          message: "This quote has already been responded to.",
          status: quote.status,
          clientStatus: quote.clientStatus,
        });
      }

      if (action === "accept") {
        await storage.updateQuote(quote.id, {
          clientStatus: "approved",
          clientApprovedAt: new Date(),
          clientApprovedById: quote.clientId ?? undefined,
          status: "accepted",
          acceptedAt: new Date(),
        } as Record<string, unknown>);
        await storage.createQuoteWorkflowEvent({
          quoteId: quote.id,
          eventType: "approved",
          actorType: "client",
          actorId: quote.clientId ?? "email_link",
          notes: note,
        });
        if (!quote.convertedToInvoiceId) {
          try {
            await storage.createInvoiceFromAcceptedQuote(quote.id, "system");
          } catch (e) {
            console.error("Create invoice from accepted quote (email link):", e);
          }
        }
        const updated = await storage.getQuote(quote.id);
        return res.json({ success: true, action: "accept", quote: updated });
      }

      if (action === "reject") {
        await storage.updateQuote(quote.id, {
          clientStatus: "rejected",
          clientRejectedAt: new Date(),
          status: "rejected",
        } as Record<string, unknown>);
        await storage.createQuoteWorkflowEvent({
          quoteId: quote.id,
          eventType: "rejected",
          actorType: "client",
          actorId: quote.clientId ?? "email_link",
          notes: note,
        });
        const updated = await storage.getQuote(quote.id);
        return res.json({ success: true, action: "reject", quote: updated });
      }

      if (action === "request_review" || action === "request_changes") {
        await storage.updateQuote(quote.id, {
          clientStatus: "changes_requested",
          clientChangesRequestedAt: new Date(),
          clientChangesNote: note ?? undefined,
          status: "draft",
        } as Record<string, unknown>);
        await storage.createQuoteWorkflowEvent({
          quoteId: quote.id,
          eventType: "changes_requested",
          actorType: "client",
          actorId: quote.clientId ?? "email_link",
          notes: note,
        });
        const updated = await storage.getQuote(quote.id);
        return res.json({ success: true, action: "request_review", quote: updated });
      }

      return res.status(400).json({
        message: "Invalid action. Use accept, reject, or request_review.",
      });
    } catch (err: unknown) {
      console.error("Quote respond POST:", err);
      res.status(500).json({ message: "Failed to submit response" });
    }
  });
}
