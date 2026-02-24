import type { Express } from "express";
import { storage, isAuthenticated } from "../../routes/shared";
import { insertClientSchema } from "@shared/schema";

export function registerClientsRoutes(app: Express): void {
  app.get("/api/clients", isAuthenticated, async (req: any, res) => {
    try {
      const clientList = await storage.getClients();
      res.json(clientList);
    } catch (err: any) {
      console.error("Error fetching clients:", err);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (err: any) {
      console.error("Error fetching client:", err);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertClientSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Invalid client data", errors: parsed.error.issues });
      }

      const client = await storage.createClient(parsed.data);
      res.status(201).json(client);
    } catch (err: any) {
      console.error("Error creating client:", err);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  app.patch("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateClient(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating client:", err);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteClient(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting client:", err);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  app.post("/api/clients/:id/portal-access", isAuthenticated, async (req, res) => {
    try {
      const { enabled } = req.body;
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      if (enabled) {
        if (!client.email) {
          return res
            .status(400)
            .json({ message: "Client must have an email to enable portal access" });
        }

        let portalAccount = await storage.getClientPortalAccountByClientId(client.id);
        if (!portalAccount) {
          portalAccount = await storage.createClientPortalAccount({
            clientId: client.id,
            email: client.email,
          });
        }
      }

      const updated = await storage.updateClient(req.params.id, { portalEnabled: enabled });
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating portal access:", err);
      res.status(500).json({ message: "Failed to update portal access" });
    }
  });
}
