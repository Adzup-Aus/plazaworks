import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { clients } from "./clients";

// quickbooks_connections: one row per platform (single-tenant)
export const quickbooks_connections = pgTable("quickbooks_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  encrypted_client_id: text("encrypted_client_id"),
  encrypted_client_secret: text("encrypted_client_secret"),
  encrypted_access_token: text("encrypted_access_token"),
  encrypted_refresh_token: text("encrypted_refresh_token"),
  realm_id: varchar("realm_id", { length: 64 }),
  token_expires_at: timestamp("token_expires_at"),
  enabled_at: timestamp("enabled_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// quickbooks_customer_mappings: platform client -> QB customer id
export const quickbooks_customer_mappings = pgTable(
  "quickbooks_customer_mappings",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    quickbooks_connection_id: varchar("quickbooks_connection_id", {
      length: 255,
    })
      .notNull()
      .references(() => quickbooks_connections.id, { onDelete: "cascade" }),
    platform_client_id: varchar("platform_client_id", { length: 255 })
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    quickbooks_customer_id: varchar("quickbooks_customer_id", {
      length: 64,
    }).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("uq_quickbooks_customer_mapping_conn_client").on(
      table.quickbooks_connection_id,
      table.platform_client_id
    ),
    index("idx_qb_customer_mapping_conn").on(table.quickbooks_connection_id),
  ]
);

// quickbooks_invoice_mappings: platform invoice -> QB invoice id
export const quickbooks_invoice_mappings = pgTable(
  "quickbooks_invoice_mappings",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    quickbooks_connection_id: varchar("quickbooks_connection_id", {
      length: 255,
    })
      .notNull()
      .references(() => quickbooks_connections.id, { onDelete: "cascade" }),
    platform_invoice_id: varchar("platform_invoice_id", { length: 255 })
      .notNull(),
    quickbooks_invoice_id: varchar("quickbooks_invoice_id", {
      length: 64,
    }).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("uq_quickbooks_invoice_mapping_conn_inv").on(
      table.quickbooks_connection_id,
      table.platform_invoice_id
    ),
    index("idx_qb_invoice_mapping_conn").on(table.quickbooks_connection_id),
    index("idx_qb_invoice_mapping_inv").on(table.platform_invoice_id),
  ]
);

export const insertQuickBooksConnectionSchema = createInsertSchema(
  quickbooks_connections
).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertQuickBooksCustomerMappingSchema = createInsertSchema(
  quickbooks_customer_mappings
).omit({
  id: true,
  created_at: true,
});

export const insertQuickBooksInvoiceMappingSchema = createInsertSchema(
  quickbooks_invoice_mappings
).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type QuickBooksConnection = typeof quickbooks_connections.$inferSelect;
export type InsertQuickBooksConnection = typeof quickbooks_connections.$inferInsert;
export type QuickBooksCustomerMapping =
  typeof quickbooks_customer_mappings.$inferSelect;
export type InsertQuickBooksCustomerMapping =
  typeof quickbooks_customer_mappings.$inferInsert;
export type QuickBooksInvoiceMapping =
  typeof quickbooks_invoice_mappings.$inferSelect;
export type InsertQuickBooksInvoiceMapping =
  typeof quickbooks_invoice_mappings.$inferInsert;
