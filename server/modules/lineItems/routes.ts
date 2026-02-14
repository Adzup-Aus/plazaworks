import type { Express } from "express";
import { storage, isAuthenticated } from "../../routes/shared";
import { insertLineItemSchema } from "@shared/schema";

export function registerLineItemsRoutes(app: Express): void {
  app.get("/api/quotes/:quoteId/line-items", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getLineItemsByQuote(req.params.quoteId);
      res.json(items);
    } catch (err: any) {
      console.error("Error fetching line items:", err);
      res.status(500).json({ message: "Failed to fetch line items" });
    }
  });

  app.get("/api/invoices/:invoiceId/line-items", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getLineItemsByInvoice(req.params.invoiceId);
      res.json(items);
    } catch (err: any) {
      console.error("Error fetching line items:", err);
      res.status(500).json({ message: "Failed to fetch line items" });
    }
  });

  app.post("/api/quotes/:quoteId/line-items", isAuthenticated, async (req, res) => {
    try {
      const validation = insertLineItemSchema.safeParse({
        ...req.body,
        quoteId: req.params.quoteId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const item = await storage.createLineItem(validation.data);
      res.status(201).json(item);
    } catch (err: any) {
      console.error("Error creating line item:", err);
      res.status(500).json({ message: "Failed to create line item" });
    }
  });

  app.post("/api/invoices/:invoiceId/line-items", isAuthenticated, async (req, res) => {
    try {
      const validation = insertLineItemSchema.safeParse({
        ...req.body,
        invoiceId: req.params.invoiceId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const item = await storage.createLineItem(validation.data);
      res.status(201).json(item);
    } catch (err: any) {
      console.error("Error creating line item:", err);
      res.status(500).json({ message: "Failed to create line item" });
    }
  });

  app.patch("/api/line-items/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertLineItemSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateLineItem(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Line item not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating line item:", err);
      res.status(500).json({ message: "Failed to update line item" });
    }
  });

  app.delete("/api/line-items/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteLineItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Line item not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting line item:", err);
      res.status(500).json({ message: "Failed to delete line item" });
    }
  });
}
