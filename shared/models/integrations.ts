import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

export const integrationStatuses = ["active", "revoked"] as const;
export type IntegrationStatus = (typeof integrationStatuses)[number];

export const integrationActions = ["created", "rotated", "revoked"] as const;
export type IntegrationAction = (typeof integrationActions)[number];

export const integrations = pgTable(
  "integrations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    apiTokenHash: varchar("api_token_hash", { length: 255 }).notNull(),
    tokenPrefix: varchar("token_prefix", { length: 8 }), // first 8 chars of token for lookup
    tokenExpiryDate: timestamp("token_expiry_date"),
    scopes: text("scopes").array().notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdBy: varchar("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    rotatedAt: timestamp("rotated_at"),
    revokedAt: timestamp("revoked_at"),
    revokedBy: varchar("revoked_by").references(() => users.id),
  },
  (table) => [
    index("idx_integration_status").on(table.status),
    index("idx_integration_created_by").on(table.createdBy),
  ]
);

export const scopes = pgTable("scopes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description").notNull(),
  resource: varchar("resource", { length: 100 }).notNull(),
  actions: text("actions").array().notNull(),
});

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull().unique(),
  type: varchar("type", { length: 100 }).notNull(),
  description: text("description"),
  configurationFields: jsonb("configuration_fields").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const integrationAuditLogs = pgTable(
  "integration_audit_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    integrationId: varchar("integration_id")
      .notNull()
      .references(() => integrations.id),
    action: varchar("action", { length: 20 }).notNull(),
    performedBy: varchar("performed_by").notNull().references(() => users.id),
    performedAt: timestamp("performed_at").defaultNow().notNull(),
    details: jsonb("details"),
  },
  (table) => [
    index("idx_audit_integration_id").on(table.integrationId),
    index("idx_audit_performed_at").on(table.performedAt),
  ]
);

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  rotatedAt: true,
  revokedAt: true,
  revokedBy: true,
  tokenPrefix: true,
}).extend({
  name: z.string().min(1, "Name is required").max(255),
  scopes: z.array(z.string()).min(1, "At least one scope is required"),
  status: z.enum(integrationStatuses).optional(),
});

export const insertScopeSchema = createInsertSchema(scopes).omit({ id: true });
export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertIntegrationAuditLogSchema = createInsertSchema(
  integrationAuditLogs
).omit({ id: true, performedAt: true });

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Scope = typeof scopes.$inferSelect;
export type InsertScope = z.infer<typeof insertScopeSchema>;
export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type IntegrationAuditLog = typeof integrationAuditLogs.$inferSelect;
export type InsertIntegrationAuditLog = z.infer<
  typeof insertIntegrationAuditLogSchema
>;
