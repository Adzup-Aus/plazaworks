import type { Express } from "express";
import { storage, isAuthenticated, requirePermission } from "../../routes/shared";
import { insertClientSchema } from "@shared/schema";

export function registerClientsRoutes(app: Express): void {
  /**
   * @openapi
   * /clients:
   *   get:
   *     summary: List clients (paginated)
   *     description: Returns a page of clients, optionally filtered by search term (matches name, company, email, phone). Requires view_clients permission.
   *     tags: [Clients]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: page
   *         in: query
   *         description: 1-based page number
   *         schema: { type: integer, minimum: 1, default: 1 }
   *       - name: limit
   *         in: query
   *         description: Number of items per page (max 100)
   *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
   *       - name: search
   *         in: query
   *         description: Optional search string (firstName, lastName, company, email, phone)
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Paginated list of clients. nextPageUrl is the path+query for the next page, or null if no next page.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [items, total, page, limit, nextPageUrl]
   *               properties:
   *                 items:
   *                   type: array
   *                   items: { $ref: '#/components/schemas/Client' }
   *                 total: { type: integer, description: Total number of clients matching the request }
   *                 page: { type: integer, description: Current page number }
   *                 limit: { type: integer, description: Page size }
   *                 nextPageUrl: { type: string, nullable: true, description: Path + query for next page, or null }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing view_clients) }
   *       500: { description: Server error }
   */
  app.get("/api/clients", isAuthenticated, requirePermission("view_clients"), async (req: any, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "10"), 10) || 10));
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const offset = (page - 1) * limit;
      const { items, total } = await storage.getClientsPaginated({ limit, offset, search });
      const hasNextPage = page * limit < total;
      const nextPageUrl = hasNextPage
        ? `/api/clients?page=${page + 1}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`
        : null;
      res.json({ items, total, page, limit, nextPageUrl });
    } catch (err: any) {
      console.error("Error fetching clients:", err);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  /**
   * @openapi
   * /clients/{id}:
   *   get:
   *     summary: Get client by ID
   *     description: Returns a single client. Requires view_clients permission.
   *     tags: [Clients]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         description: Client UUID
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Client details
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Client' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing view_clients) }
   *       404: { description: Client not found }
   *       500: { description: Server error }
   */
  app.get("/api/clients/:id", isAuthenticated, requirePermission("view_clients"), async (req, res) => {
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

  /**
   * @openapi
   * /clients:
   *   post:
   *     summary: Create a client
   *     description: Create a new client. Requires create_clients permission. Accepts addressLine1/addressLine2 and type/companyName as aliases for streetAddress/streetAddress2 and entityType/company.
   *     tags: [Clients]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [firstName, lastName]
   *             properties:
   *               firstName: { type: string, minLength: 1, description: First name (required) }
   *               lastName: { type: string, minLength: 1, description: Last name (required) }
   *               email: { type: string, format: email, nullable: true }
   *               phone: { type: string, nullable: true }
   *               mobilePhone: { type: string, nullable: true }
   *               company: { type: string, nullable: true }
   *               companyName: { type: string, nullable: true, description: Alias for company }
   *               entityType: { type: string, enum: [individual, company], default: individual }
   *               type: { type: string, enum: [individual, company], description: Alias for entityType }
   *               addressLine1: { type: string, nullable: true, description: Alias for streetAddress }
   *               addressLine2: { type: string, nullable: true, description: Alias for streetAddress2 }
   *               city: { type: string, nullable: true }
   *               state: { type: string, nullable: true }
   *               postalCode: { type: string, nullable: true }
   *               country: { type: string, nullable: true }
   *               portalEnabled: { type: boolean, default: false }
   *               notes: { type: string, nullable: true }
   *     responses:
   *       201:
   *         description: Client created
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Client' }
   *       400:
   *         description: Validation error (e.g. missing firstName/lastName or invalid email)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message: { type: string }
   *                 errors: { type: array, items: { type: object } }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing create_clients) }
   *       500: { description: Server error }
   */
  app.post("/api/clients", isAuthenticated, requirePermission("create_clients"), async (req: any, res) => {
    try {
      const body = { ...req.body };
      if (body.addressLine1 !== undefined) body.streetAddress = body.streetAddress ?? body.addressLine1;
      if (body.addressLine2 !== undefined) body.streetAddress2 = body.streetAddress2 ?? body.addressLine2;
      if (body.type !== undefined) body.entityType = body.entityType ?? body.type;
      if (body.companyName !== undefined) body.company = body.company ?? body.companyName;
      delete body.addressLine1;
      delete body.addressLine2;
      delete body.type;
      delete body.companyName;
      const parsed = insertClientSchema.safeParse(body);
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

  /**
   * @openapi
   * /clients/{id}:
   *   patch:
   *     summary: Update a client
   *     description: Partially update a client. Requires edit_clients permission. Same body fields as POST (all optional). Aliases addressLine1/2, type, companyName supported.
   *     tags: [Clients]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         description: Client UUID
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               firstName: { type: string }
   *               lastName: { type: string }
   *               email: { type: string, format: email, nullable: true }
   *               phone: { type: string, nullable: true }
   *               mobilePhone: { type: string, nullable: true }
   *               company: { type: string, nullable: true }
   *               companyName: { type: string, nullable: true }
   *               entityType: { type: string, enum: [individual, company] }
   *               type: { type: string, enum: [individual, company] }
   *               addressLine1: { type: string, nullable: true }
   *               addressLine2: { type: string, nullable: true }
   *               city: { type: string, nullable: true }
   *               state: { type: string, nullable: true }
   *               postalCode: { type: string, nullable: true }
   *               country: { type: string, nullable: true }
   *               portalEnabled: { type: boolean }
   *               notes: { type: string, nullable: true }
   *     responses:
   *       200:
   *         description: Client updated
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Client' }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing edit_clients) }
   *       404: { description: Client not found }
   *       500: { description: Server error }
   */
  app.patch("/api/clients/:id", isAuthenticated, requirePermission("edit_clients"), async (req: any, res) => {
    try {
      const body = { ...req.body };
      if (body.addressLine1 !== undefined) body.streetAddress = body.streetAddress ?? body.addressLine1;
      if (body.addressLine2 !== undefined) body.streetAddress2 = body.streetAddress2 ?? body.addressLine2;
      if (body.type !== undefined) body.entityType = body.entityType ?? body.type;
      if (body.companyName !== undefined) body.company = body.company ?? body.companyName;
      delete body.addressLine1;
      delete body.addressLine2;
      delete body.type;
      delete body.companyName;
      const updated = await storage.updateClient(req.params.id, body);
      if (!updated) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating client:", err);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  /**
   * @openapi
   * /clients/{id}:
   *   delete:
   *     summary: Delete a client
   *     description: Permanently delete a client. Requires delete_clients permission.
   *     tags: [Clients]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         description: Client UUID
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Client deleted
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean, example: true }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing delete_clients) }
   *       500: { description: Server error }
   */
  app.delete("/api/clients/:id", isAuthenticated, requirePermission("delete_clients"), async (req, res) => {
    try {
      await storage.deleteClient(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting client:", err);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  /**
   * @openapi
   * /clients/{id}/portal-access:
   *   post:
   *     summary: Enable or disable client portal access
   *     description: Toggle portal access for a client. Enabling requires the client to have an email. Requires edit_clients permission.
   *     tags: [Clients]
   *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         description: Client UUID
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [enabled]
   *             properties:
   *               enabled: { type: boolean, description: true to enable portal, false to disable }
   *     responses:
   *       200:
   *         description: Client updated with new portal setting
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Client' }
   *       400:
   *         description: Client must have an email to enable portal access
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message: { type: string }
   *       401: { description: Unauthorized }
   *       403: { description: Forbidden (missing edit_clients) }
   *       404: { description: Client not found }
   *       500: { description: Server error }
   */
  app.post("/api/clients/:id/portal-access", isAuthenticated, requirePermission("edit_clients"), async (req, res) => {
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
