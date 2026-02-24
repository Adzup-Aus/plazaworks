import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Global application settings (single-tenant).
 * Replaces organizationSettings and organization-level company info.
 */
export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Company Information (from organizations table)
  companyName: varchar("company_name", { length: 255 }).notNull().default("My Company"),
  companyAddress: text("company_address"),
  companyPhone: varchar("company_phone", { length: 50 }),
  companyEmail: varchar("company_email", { length: 255 }),
  companyWebsite: varchar("company_website", { length: 255 }),
  timezone: varchar("timezone", { length: 50 }).default("Australia/Brisbane"),

  // Business Settings (from organizationSettings)
  autoConvertApprovedQuotes: boolean("auto_convert_approved_quotes").notNull().default(true),
  autoCreateJobFromInvoice: boolean("auto_create_job_from_invoice").notNull().default(true),
  defaultTaxRate: decimal("default_tax_rate", { precision: 5, scale: 2 }).default("10"),
  defaultPaymentTermsDays: integer("default_payment_terms_days").default(14),

  // Numbering Prefixes
  quoteNumberPrefix: varchar("quote_number_prefix", { length: 10 }).default("Q-"),
  invoiceNumberPrefix: varchar("invoice_number_prefix", { length: 10 }).default("INV-"),
  jobNumberPrefix: varchar("job_number_prefix", { length: 10 }).default("J-"),

  // Default Terms
  defaultQuoteTerms: text("default_quote_terms"),
  defaultInvoiceTerms: text("default_invoice_terms"),

  // Feature Flags (replaces subscription tier checking)
  featuresEnabled: text("features_enabled").array().default(sql`ARRAY['jobs', 'schedule', 'quotes', 'invoices', 'time_tracking', 'vehicles', 'checklists', 'kpi', 'backcosting']::text[]`),

  // Limits (optional, null = unlimited)
  maxUsers: integer("max_users"),
  maxJobsPerMonth: integer("max_jobs_per_month"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** Global numeric counters (e.g. job/invoice sequence). Single-tenant. */
export const appCounters = pgTable("app_counters", {
  counterKey: varchar("counter_key", { length: 64 }).primaryKey(),
  nextValue: integer("next_value").notNull().default(2),
  padLength: integer("pad_length").notNull().default(4),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAppSettingsSchema = createInsertSchema(appSettings)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    defaultTaxRate: z.string().optional(),
  });

export type AppSettings = typeof appSettings.$inferSelect;
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
