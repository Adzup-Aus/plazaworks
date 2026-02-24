import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Auth identity types (kept for auth layer)
export const authIdentityTypes = ["replit", "email", "phone"] as const;
export type AuthIdentityType = (typeof authIdentityTypes)[number];

// Organization member roles (kept as system roles)
export const orgMemberRoles = ["owner", "admin", "manager", "staff", "contractor"] as const;
export type OrgMemberRole = (typeof orgMemberRoles)[number];

// Terms of trade templates (no longer org-scoped)
export const termsTemplates = pgTable(
  "terms_templates",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    content: text("content").notNull(),
    serviceType: varchar("service_type", { length: 100 }),
    isDefault: boolean("is_default").notNull().default(false),
    createdById: varchar("created_by_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_terms_templates_service").on(table.serviceType),
  ]
);

// Auth identities table
export const authIdentities = pgTable(
  "auth_identities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    isVerified: boolean("is_verified").notNull().default(false),
    isPrimary: boolean("is_primary").notNull().default(false),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("uniq_identity_type_identifier").on(table.type, table.identifier),
    index("idx_identity_user").on(table.userId),
    index("idx_identity_type").on(table.type),
    index("idx_identity_identifier").on(table.identifier),
  ]
);

// Verification codes table
export const verificationCodes = pgTable(
  "verification_codes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    identityId: varchar("identity_id").references(() => authIdentities.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    code: varchar("code", { length: 10 }).notNull(),
    purpose: varchar("purpose", { length: 20 }).notNull().default("login"),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_verify_identity").on(table.identityId),
    index("idx_verify_email").on(table.email),
    index("idx_verify_phone").on(table.phone),
    index("idx_verify_code").on(table.code),
  ]
);

// Insert schemas
export const insertAuthIdentitySchema = createInsertSchema(authIdentities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVerificationCodeSchema = createInsertSchema(verificationCodes).omit({
  id: true,
  createdAt: true,
});

export const insertTermsTemplateSchema = createInsertSchema(termsTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Template name is required"),
  content: z.string().min(1, "Template content is required"),
  serviceType: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
});

// Types
export type TermsTemplate = typeof termsTemplates.$inferSelect;
export type InsertTermsTemplate = z.infer<typeof insertTermsTemplateSchema>;

export type AuthIdentity = typeof authIdentities.$inferSelect;
export type InsertAuthIdentity = z.infer<typeof insertAuthIdentitySchema>;

export type VerificationCode = typeof verificationCodes.$inferSelect;
export type InsertVerificationCode = z.infer<typeof insertVerificationCodeSchema>;
