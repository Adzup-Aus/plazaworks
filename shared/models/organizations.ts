import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  index,
  integer,
  decimal,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Organization types
export const organizationTypes = ["owner", "primary", "customer"] as const;
export type OrganizationType = (typeof organizationTypes)[number];

// Subscription tiers
export const subscriptionTiers = ["starter", "professional", "scale"] as const;
export type SubscriptionTier = (typeof subscriptionTiers)[number];

// Subscription statuses
export const subscriptionStatuses = ["active", "cancelled", "past_due", "trialing"] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

// Organization member roles
export const orgMemberRoles = ["owner", "admin", "manager", "staff", "contractor"] as const;
export type OrgMemberRole = (typeof orgMemberRoles)[number];

// Auth identity types
export const authIdentityTypes = ["replit", "email", "phone"] as const;
export type AuthIdentityType = (typeof authIdentityTypes)[number];

// Organizations table
export const organizations = pgTable(
  "organizations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    type: varchar("type", { length: 20 }).notNull().default("customer"),
    isOwner: boolean("is_owner").notNull().default(false),
    logoUrl: varchar("logo_url", { length: 500 }),
    address: text("address"),
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 255 }),
    website: varchar("website", { length: 255 }),
    timezone: varchar("timezone", { length: 50 }).default("Australia/Brisbane"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_org_slug").on(table.slug),
    index("idx_org_type").on(table.type),
    index("idx_org_active").on(table.isActive),
  ]
);

// Organization subscriptions table
export const organizationSubscriptions = pgTable(
  "organization_subscriptions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    tier: varchar("tier", { length: 20 }).notNull().default("starter"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    maxUsers: integer("max_users").default(3),
    maxJobs: integer("max_jobs"),
    features: text("features").array().default(sql`ARRAY[]::text[]`),
    startDate: timestamp("start_date").defaultNow(),
    endDate: timestamp("end_date"),
    renewalDate: timestamp("renewal_date"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("uniq_sub_org").on(table.organizationId),
    index("idx_sub_org").on(table.organizationId),
    index("idx_sub_tier").on(table.tier),
    index("idx_sub_status").on(table.status),
  ]
);

// Organization settings table
export const organizationSettings = pgTable(
  "organization_settings",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    autoConvertApprovedQuotes: boolean("auto_convert_approved_quotes").notNull().default(true),
    autoCreateJobFromInvoice: boolean("auto_create_job_from_invoice").notNull().default(true),
    defaultTaxRate: decimal("default_tax_rate", { precision: 5, scale: 2 }).default("10"),
    defaultPaymentTermsDays: integer("default_payment_terms_days").default(14),
    quoteNumberPrefix: varchar("quote_number_prefix", { length: 10 }).default("Q-"),
    invoiceNumberPrefix: varchar("invoice_number_prefix", { length: 10 }).default("INV-"),
    jobNumberPrefix: varchar("job_number_prefix", { length: 10 }).default("J-"),
    defaultQuoteTerms: text("default_quote_terms"),
    defaultInvoiceTerms: text("default_invoice_terms"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("uniq_settings_org").on(table.organizationId),
    index("idx_settings_org").on(table.organizationId),
  ]
);

// Organization counters table
export const organizationCounters = pgTable(
  "organization_counters",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    counterKey: varchar("counter_key", { length: 50 }).notNull(),
    nextValue: integer("next_value").notNull().default(1),
    prefix: varchar("prefix", { length: 20 }).default(""),
    padLength: integer("pad_length").default(4),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("uniq_counter_org_key").on(table.organizationId, table.counterKey),
    index("idx_counter_org").on(table.organizationId),
  ]
);

// Terms of trade templates
export const termsTemplates = pgTable(
  "terms_templates",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    content: text("content").notNull(),
    serviceType: varchar("service_type", { length: 100 }),
    isDefault: boolean("is_default").notNull().default(false),
    createdById: varchar("created_by_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_terms_templates_org").on(table.organizationId),
    index("idx_terms_templates_service").on(table.serviceType),
  ]
);

// Organization members table
export const organizationMembers = pgTable(
  "organization_members",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull(),
    role: varchar("role", { length: 20 }).notNull().default("staff"),
    isLocked: boolean("is_locked").notNull().default(false),
    invitedBy: varchar("invited_by"),
    invitedAt: timestamp("invited_at"),
    joinedAt: timestamp("joined_at").defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("uniq_member_org_user").on(table.organizationId, table.userId),
    index("idx_member_org").on(table.organizationId),
    index("idx_member_user").on(table.userId),
    index("idx_member_role").on(table.role),
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

// Organization invites table
export const organizationInvites = pgTable(
  "organization_invites",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    role: varchar("role", { length: 20 }).notNull().default("staff"),
    inviteCode: varchar("invite_code", { length: 20 }).notNull().unique(),
    invitedBy: varchar("invited_by").notNull(),
    expiresAt: timestamp("expires_at"),
    acceptedAt: timestamp("accepted_at"),
    acceptedBy: varchar("accepted_by"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_invite_org").on(table.organizationId),
    index("idx_invite_code").on(table.inviteCode),
    index("idx_invite_email").on(table.email),
  ]
);

// Relations
export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  subscription: one(organizationSubscriptions, {
    fields: [organizations.id],
    references: [organizationSubscriptions.organizationId],
  }),
  settings: one(organizationSettings, {
    fields: [organizations.id],
    references: [organizationSettings.organizationId],
  }),
  members: many(organizationMembers),
  invites: many(organizationInvites),
}));

export const organizationSettingsRelations = relations(organizationSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationSettings.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationSubscriptionsRelations = relations(
  organizationSubscriptions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationSubscriptions.organizationId],
      references: [organizations.id],
    }),
  })
);

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationInvitesRelations = relations(organizationInvites, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationInvites.organizationId],
    references: [organizations.id],
  }),
}));

// Insert schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationSubscriptionSchema = createInsertSchema(
  organizationSubscriptions
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationSettingsSchema = createInsertSchema(organizationSettings)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    defaultTaxRate: z.string().optional(),
  });

export const insertOrganizationMemberSchema = createInsertSchema(organizationMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuthIdentitySchema = createInsertSchema(authIdentities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVerificationCodeSchema = createInsertSchema(verificationCodes).omit({
  id: true,
  createdAt: true,
});

export const insertOrganizationInviteSchema = createInsertSchema(organizationInvites).omit({
  id: true,
  createdAt: true,
});

// Types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

export type OrganizationSubscription = typeof organizationSubscriptions.$inferSelect;
export type InsertOrganizationSubscription = z.infer<typeof insertOrganizationSubscriptionSchema>;

export type OrganizationSettings = typeof organizationSettings.$inferSelect;
export type InsertOrganizationSettings = z.infer<typeof insertOrganizationSettingsSchema>;

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;

export type AuthIdentity = typeof authIdentities.$inferSelect;
export type InsertAuthIdentity = z.infer<typeof insertAuthIdentitySchema>;

export type VerificationCode = typeof verificationCodes.$inferSelect;
export type InsertVerificationCode = z.infer<typeof insertVerificationCodeSchema>;

export type OrganizationInvite = typeof organizationInvites.$inferSelect;
export type InsertOrganizationInvite = z.infer<typeof insertOrganizationInviteSchema>;

export const TIER_CONFIG = {
  starter: {
    name: "Starter",
    price: 0,
    maxUsers: 3,
    maxJobs: 50,
    features: ["jobs", "schedule", "basic_reports"],
  },
  professional: {
    name: "Professional",
    price: 99,
    maxUsers: 15,
    maxJobs: 500,
    features: [
      "jobs",
      "schedule",
      "quotes",
      "invoices",
      "vehicles",
      "checklists",
      "time_tracking",
      "reports",
    ],
  },
  scale: {
    name: "Scale",
    price: 249,
    maxUsers: null,
    maxJobs: null,
    features: [
      "jobs",
      "schedule",
      "quotes",
      "invoices",
      "vehicles",
      "checklists",
      "time_tracking",
      "backcosting",
      "kpi",
      "capacity_planning",
      "api_access",
      "priority_support",
      "reports",
    ],
  },
} as const;
