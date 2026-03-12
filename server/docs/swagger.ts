import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.OAS3Definition = {
  openapi: "3.0.0",
  info: {
    title: "Plaza API",
    version: "1.0.0",
    description:
      "Application API: jobs, quotes, invoices, clients, schedule, staff, activities, roles, integrations, and auth. Authenticate with Bearer token (UUID) or session cookie.",
  },
  servers: [{ url: "/api", description: "Base API path" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "UUID",
        description: "API token from Integrations Center",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "connect.sid",
        description: "Session cookie for web UI",
      },
    },
    schemas: {
      Client: {
        type: "object",
        description: "Client record (individual or company)",
        properties: {
          id: { type: "string", format: "uuid" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string", format: "email", nullable: true },
          phone: { type: "string", nullable: true },
          mobilePhone: { type: "string", nullable: true },
          company: { type: "string", nullable: true },
          entityType: { type: "string", enum: ["individual", "company"] },
          streetAddress: { type: "string", nullable: true },
          streetAddress2: { type: "string", nullable: true },
          city: { type: "string", nullable: true },
          state: { type: "string", nullable: true },
          postalCode: { type: "string", nullable: true },
          country: { type: "string", nullable: true },
          portalEnabled: { type: "boolean" },
          notes: { type: "string", nullable: true },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
};

/**
 * Generate OpenAPI spec from JSDoc @openapi annotations in route files.
 * Include all main app modules so jobs, quotes, invoices, clients, schedule, staff, activities, etc. appear in docs.
 */
export function generateSwaggerSpec(): Record<string, unknown> {
  const spec = swaggerJsdoc({
    definition: options,
    apis: [
      "./server/modules/integrations/routes.ts",
      "./server/modules/auth/routes.ts",
      "./server/modules/jobs/routes.ts",
      "./server/modules/quotes/routes.ts",
      "./server/modules/invoices/routes.ts",
      "./server/modules/clients/routes.ts",
      "./server/modules/schedule/routes.ts",
      "./server/modules/staff/routes.ts",
      "./server/modules/activities/routes.ts",
      "./server/modules/roles/routes.ts",
    ],
  });
  return spec as Record<string, unknown>;
}
