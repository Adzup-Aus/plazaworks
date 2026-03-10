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
