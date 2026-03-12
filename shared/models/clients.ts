import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Client types (business classification)
export const clientTypes = ["residential", "commercial", "property_manager", "builder", "other"] as const;
export type ClientType = typeof clientTypes[number];

// Entity type: individual vs company (for display/forms)
export const entityTypes = ["individual", "company"] as const;
export type EntityType = (typeof entityTypes)[number];

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  mobilePhone: varchar("mobile_phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  entityType: varchar("entity_type", { length: 20 }).default("individual"),
  clientType: varchar("client_type", { length: 50 }).default("residential"),
  streetAddress: varchar("street_address", { length: 255 }),
  streetAddress2: varchar("street_address_2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }).default("Australia"),
  portalEnabled: boolean("portal_enabled").default(false),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_clients_email").on(table.email),
  index("idx_clients_phone").on(table.phone),
  index("idx_clients_name").on(table.lastName, table.firstName),
]);

export const clientsRelations = relations(clients, ({ one, many }) => ({}));

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  clientType: z.enum(clientTypes).optional(),
  entityType: z.enum(entityTypes).optional(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
