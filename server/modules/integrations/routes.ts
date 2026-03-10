import type { Express } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { storage, isAuthenticated, requirePermission, getUserId } from "../../routes/shared";
import { type Integration } from "./model";
import { generateSwaggerSpec } from "../../docs/swagger";
import swaggerUi from "swagger-ui-express";

const createIntegrationBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  scopes: z.array(z.string()).min(1, "At least one scope is required"),
  tokenExpiryDate: z.string().datetime().optional().nullable(),
});

const rotateTokenBodySchema = z.object({
  tokenExpiryDate: z.string().datetime().optional().nullable(),
});

const createServiceBodySchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  configurationFields: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["text", "password", "url", "number", "email", "textarea"]),
      label: z.string(),
      required: z.boolean(),
      placeholder: z.string().optional(),
      defaultValue: z.string().optional(),
      helpText: z.string().optional(),
    })
  ),
});

const updateServiceBodySchema = createServiceBodySchema.partial();

function toIntegrationResponse(row: Integration) {
  const { apiTokenHash: _, tokenPrefix: __, ...rest } = row;
  return rest;
}

export function registerIntegrationsRoutes(app: Express): void {
  const adminOnly: [typeof isAuthenticated, ReturnType<typeof requirePermission>] = [
    isAuthenticated,
    requirePermission("admin_settings"),
  ];

  /**
   * @openapi
   * /scopes:
   *   get:
   *     summary: List available scopes
   *     tags: [Scopes]
   *     responses:
   *       200:
   *         description: List of scopes
   */
  app.get("/api/scopes", isAuthenticated, async (_req, res) => {
    try {
      const list = await storage.getScopes();
      res.json(list);
    } catch (err) {
      console.error("Error fetching scopes:", err);
      res.status(500).json({ message: "Failed to fetch scopes" });
    }
  });

  /**
   * @openapi
   * /integrations:
   *   get:
   *     summary: List all integrations
   *     tags: [Integrations]
   *     security: [{ cookieAuth: [] }]
   *     responses:
   *       200:
   *         description: List of integrations
   */
  app.get("/api/integrations", ...adminOnly, async (_req, res) => {
    try {
      const list = await storage.getIntegrations();
      res.json(list.map(toIntegrationResponse));
    } catch (err) {
      console.error("Error fetching integrations:", err);
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  /**
   * @openapi
   * /integrations:
   *   post:
   *     summary: Create a new integration
   *     tags: [Integrations]
   *     security: [{ cookieAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, scopes]
   *             properties:
   *               name: { type: string }
   *               description: { type: string }
   *               scopes: { type: array, items: { type: string } }
   *               tokenExpiryDate: { type: string, format: date-time, nullable: true }
   *     responses:
   *       201:
   *         description: Integration created (includes apiToken in response only once)
   */
  app.post("/api/integrations", ...adminOnly, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
      }
      const parsed = createIntegrationBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Bad Request", message: "Invalid input", details: parsed.error.flatten() });
      }
      const { name, description, scopes: scopesList, tokenExpiryDate } = parsed.data;
      const apiToken = crypto.randomUUID();
      const apiTokenHash = await bcrypt.hash(apiToken, 10);
      const tokenPrefix = apiToken.slice(0, 8);

      const integration = await storage.createIntegration({
        name,
        description: description ?? null,
        apiTokenHash,
        tokenPrefix,
        scopes: scopesList,
        status: "active",
        createdBy: userId,
        tokenExpiryDate: tokenExpiryDate ? new Date(tokenExpiryDate) : null,
      });

      await storage.createIntegrationAuditLog({
        integrationId: integration.id,
        action: "created",
        performedBy: userId,
        details: { name },
      });

      res.status(201).json({
        ...toIntegrationResponse(integration),
        apiToken, // only time we return the raw token
      });
    } catch (err) {
      console.error("Error creating integration:", err);
      res.status(500).json({ message: "Failed to create integration" });
    }
  });

  /**
   * @openapi
   * /integrations/{id}:
   *   get:
   *     summary: Get integration details
   *     tags: [Integrations]
   *     security: [{ cookieAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Integration details
   *       404:
   *         description: Not found
   */
  app.get("/api/integrations/:id", ...adminOnly, async (req, res) => {
    try {
      const integration = await storage.getIntegration(req.params.id);
      if (!integration) {
        return res.status(404).json({ error: "Not Found", message: "Integration not found" });
      }
      res.json(toIntegrationResponse(integration));
    } catch (err) {
      console.error("Error fetching integration:", err);
      res.status(500).json({ message: "Failed to fetch integration" });
    }
  });

  /**
   * @openapi
   * /integrations/{id}/rotate:
   *   post:
   *     summary: Rotate API token
   *     tags: [Integrations]
   *     security: [{ cookieAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               tokenExpiryDate: { type: string, format: date-time, nullable: true }
   *     responses:
   *       200:
   *         description: New token returned (only once)
   *       404:
   *         description: Not found
   */
  app.post("/api/integrations/:id/rotate", ...adminOnly, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
      }
      const integration = await storage.getIntegration(req.params.id);
      if (!integration) {
        return res.status(404).json({ error: "Not Found", message: "Integration not found" });
      }
      if (integration.status !== "active") {
        return res.status(400).json({ error: "Bad Request", message: "Cannot rotate revoked integration" });
      }
      const body = rotateTokenBodySchema.safeParse(req.body ?? {});
      const tokenExpiryDate = body.success && body.data.tokenExpiryDate
        ? new Date(body.data.tokenExpiryDate)
        : integration.tokenExpiryDate;

      const newToken = crypto.randomUUID();
      const apiTokenHash = await bcrypt.hash(newToken, 10);
      const tokenPrefix = newToken.slice(0, 8);

      const updated = await storage.updateIntegration(integration.id, {
        apiTokenHash,
        tokenPrefix,
        tokenExpiryDate,
        rotatedAt: new Date(),
      });
      if (!updated) {
        return res.status(500).json({ message: "Failed to rotate token" });
      }

      await storage.createIntegrationAuditLog({
        integrationId: integration.id,
        action: "rotated",
        performedBy: userId,
        details: {},
      });

      res.json({
        ...toIntegrationResponse(updated),
        apiToken: newToken,
      });
    } catch (err) {
      console.error("Error rotating token:", err);
      res.status(500).json({ message: "Failed to rotate token" });
    }
  });

  /**
   * @openapi
   * /integrations/{id}:
   *   delete:
   *     summary: Revoke an integration
   *     tags: [Integrations]
   *     security: [{ cookieAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       204:
   *         description: Revoked
   *       404:
   *         description: Not found
   */
  app.delete("/api/integrations/:id", ...adminOnly, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
      }
      const integration = await storage.getIntegration(req.params.id);
      if (!integration) {
        return res.status(404).json({ error: "Not Found", message: "Integration not found" });
      }
      if (integration.status === "revoked") {
        return res.status(204).send();
      }
      await storage.updateIntegration(integration.id, {
        status: "revoked",
        revokedAt: new Date(),
        revokedBy: userId,
      });
      await storage.createIntegrationAuditLog({
        integrationId: integration.id,
        action: "revoked",
        performedBy: userId,
        details: {},
      });
      res.status(204).send();
    } catch (err) {
      console.error("Error revoking integration:", err);
      res.status(500).json({ message: "Failed to revoke integration" });
    }
  });

  /**
   * @openapi
   * /integrations/{id}/audit-log:
   *   get:
   *     summary: Get integration audit log
   *     tags: [Integrations]
   *     security: [{ cookieAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Audit log entries
   */
  app.get("/api/integrations/:id/audit-log", ...adminOnly, async (req, res) => {
    try {
      const integration = await storage.getIntegration(req.params.id);
      if (!integration) {
        return res.status(404).json({ error: "Not Found", message: "Integration not found" });
      }
      const logs = await storage.getIntegrationAuditLogs(req.params.id);
      res.json(logs);
    } catch (err) {
      console.error("Error fetching audit log:", err);
      res.status(500).json({ message: "Failed to fetch audit log" });
    }
  });

  // Services
  app.get("/api/services", ...adminOnly, async (_req, res) => {
    try {
      const list = await storage.getServices();
      res.json(list);
    } catch (err) {
      console.error("Error fetching services:", err);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.post("/api/services", isAuthenticated, requirePermission("admin_settings"), async (req, res) => {
    try {
      const parsed = createServiceBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Bad Request", message: "Invalid input", details: parsed.error.flatten() });
      }
      const service = await storage.createService(parsed.data);
      return res.status(201).json(service);
    } catch (err: unknown) {
      console.error("Error creating service:", err);
      return res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.get("/api/services/:id", ...adminOnly, async (req, res) => {
    try {
      const service = await storage.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ error: "Not Found", message: "Service not found" });
      }
      res.json(service);
    } catch (err) {
      console.error("Error fetching service:", err);
      res.status(500).json({ message: "Failed to fetch service" });
    }
  });

  app.patch("/api/services/:id", ...adminOnly, async (req, res) => {
    try {
      const parsed = updateServiceBodySchema.safeParse(req.body);
      if (!parsed.success) {
        const errMsg = parsed.error.errors[0]?.message ?? "Invalid input";
        return res.status(400).json({ error: "Bad Request", message: errMsg });
      }
      const service = await storage.updateService(req.params.id, parsed.data);
      if (!service) {
        return res.status(404).json({ error: "Not Found", message: "Service not found" });
      }
      res.json(service);
    } catch (err) {
      console.error("Error updating service:", err);
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", isAuthenticated, requirePermission("admin_settings"), async (req, res) => {
    try {
      const deleted = await storage.deleteService(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Not Found", message: "Service not found" });
      }
      return res.status(204).send();
    } catch (err: unknown) {
      console.error("Error deleting service:", err);
      return res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // OpenAPI spec and Swagger UI
  app.get("/api/docs/openapi.json", (_req, res) => {
    try {
      const spec = generateSwaggerSpec();
      res.json(spec);
    } catch (err) {
      console.error("Error generating OpenAPI spec:", err);
      res.status(500).json({ message: "Failed to generate spec" });
    }
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(null, {
    swaggerOptions: {
      url: "/api/docs/openapi.json",
    },
  }));
}
