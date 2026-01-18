import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, date, index, integer, decimal, json, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// =====================
// MULTI-TENANT ACCESS CONTROL
// =====================

// Organization types
export const organizationTypes = ["owner", "primary", "customer"] as const;
export type OrganizationType = typeof organizationTypes[number];

// Subscription tiers
export const subscriptionTiers = ["starter", "professional", "scale"] as const;
export type SubscriptionTier = typeof subscriptionTiers[number];

// Subscription statuses
export const subscriptionStatuses = ["active", "cancelled", "past_due", "trialing"] as const;
export type SubscriptionStatus = typeof subscriptionStatuses[number];

// Organization member roles
export const orgMemberRoles = ["owner", "admin", "manager", "staff", "contractor"] as const;
export type OrgMemberRole = typeof orgMemberRoles[number];

// Auth identity types
export const authIdentityTypes = ["replit", "email", "phone"] as const;
export type AuthIdentityType = typeof authIdentityTypes[number];

// Organizations table
export const organizations = pgTable("organizations", {
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
}, (table) => [
  index("idx_org_slug").on(table.slug),
  index("idx_org_type").on(table.type),
  index("idx_org_active").on(table.isActive),
]);

// Organization subscriptions table
export const organizationSubscriptions = pgTable("organization_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
}, (table) => [
  unique("uniq_sub_org").on(table.organizationId),
  index("idx_sub_org").on(table.organizationId),
  index("idx_sub_tier").on(table.tier),
  index("idx_sub_status").on(table.status),
]);

// Organization settings table - configurable settings per organization
export const organizationSettings = pgTable("organization_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  // Quote/Invoice settings
  autoConvertApprovedQuotes: boolean("auto_convert_approved_quotes").notNull().default(true),
  autoCreateJobFromInvoice: boolean("auto_create_job_from_invoice").notNull().default(true),
  defaultTaxRate: decimal("default_tax_rate", { precision: 5, scale: 2 }).default("10"),
  defaultPaymentTermsDays: integer("default_payment_terms_days").default(14),
  // Quote numbering
  quoteNumberPrefix: varchar("quote_number_prefix", { length: 10 }).default("Q-"),
  invoiceNumberPrefix: varchar("invoice_number_prefix", { length: 10 }).default("INV-"),
  jobNumberPrefix: varchar("job_number_prefix", { length: 10 }).default("J-"),
  // Default terms and conditions
  defaultQuoteTerms: text("default_quote_terms"),
  defaultInvoiceTerms: text("default_invoice_terms"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("uniq_settings_org").on(table.organizationId),
  index("idx_settings_org").on(table.organizationId),
]);

// Organization counters table - for sequential numbering (quotes/jobs/invoices share same number)
export const organizationCounters = pgTable("organization_counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  counterKey: varchar("counter_key", { length: 50 }).notNull(), // e.g., "job_invoice" for shared numbering
  nextValue: integer("next_value").notNull().default(1),
  prefix: varchar("prefix", { length: 20 }).default(""),
  padLength: integer("pad_length").default(4), // e.g., 4 = "0001"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("uniq_counter_org_key").on(table.organizationId, table.counterKey),
  index("idx_counter_org").on(table.organizationId),
]);

// Terms of trade templates - reusable templates for different service types
export const termsTemplates = pgTable("terms_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  content: text("content").notNull(),
  serviceType: varchar("service_type", { length: 100 }),
  isDefault: boolean("is_default").notNull().default(false),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_terms_templates_org").on(table.organizationId),
  index("idx_terms_templates_service").on(table.serviceType),
]);

// Organization members table - links users to organizations
export const organizationMembers = pgTable("organization_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("staff"),
  isLocked: boolean("is_locked").notNull().default(false),
  invitedBy: varchar("invited_by"),
  invitedAt: timestamp("invited_at"),
  joinedAt: timestamp("joined_at").defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("uniq_member_org_user").on(table.organizationId, table.userId),
  index("idx_member_org").on(table.organizationId),
  index("idx_member_user").on(table.userId),
  index("idx_member_role").on(table.role),
]);

// Auth identities table - supports multiple auth methods per user
export const authIdentities = pgTable("auth_identities", {
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
}, (table) => [
  unique("uniq_identity_type_identifier").on(table.type, table.identifier),
  index("idx_identity_user").on(table.userId),
  index("idx_identity_type").on(table.type),
  index("idx_identity_identifier").on(table.identifier),
]);

// Verification codes table - for OTP
export const verificationCodes = pgTable("verification_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identityId: varchar("identity_id").references(() => authIdentities.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  code: varchar("code", { length: 10 }).notNull(),
  purpose: varchar("purpose", { length: 20 }).notNull().default("login"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_verify_identity").on(table.identityId),
  index("idx_verify_email").on(table.email),
  index("idx_verify_phone").on(table.phone),
  index("idx_verify_code").on(table.code),
]);

// Organization invites table
export const organizationInvites = pgTable("organization_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  role: varchar("role", { length: 20 }).notNull().default("staff"),
  inviteCode: varchar("invite_code", { length: 20 }).notNull().unique(),
  invitedBy: varchar("invited_by").notNull(),
  expiresAt: timestamp("expires_at"),
  acceptedAt: timestamp("accepted_at"),
  acceptedBy: varchar("accepted_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_invite_org").on(table.organizationId),
  index("idx_invite_code").on(table.inviteCode),
  index("idx_invite_email").on(table.email),
]);

// Multi-tenant relations
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

export const organizationSubscriptionsRelations = relations(organizationSubscriptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationSubscriptions.organizationId],
    references: [organizations.id],
  }),
}));

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

// Multi-tenant insert schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationSubscriptionSchema = createInsertSchema(organizationSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationSettingsSchema = createInsertSchema(organizationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
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

// Multi-tenant types
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

// Tier configuration - defines feature limits per tier
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
    features: ["jobs", "schedule", "quotes", "invoices", "vehicles", "checklists", "time_tracking", "reports"],
  },
  scale: {
    name: "Scale",
    price: 249,
    maxUsers: null,
    maxJobs: null,
    features: ["jobs", "schedule", "quotes", "invoices", "vehicles", "checklists", "time_tracking", "backcosting", "kpi", "capacity_planning", "api_access", "priority_support", "reports"],
  },
} as const;

// User roles enum
export const userRoles = [
  "plumber",
  "plumbing_manager",
  "project_manager",
  "carpenter",
  "waterproofer",
  "tiler",
  "electrician",
  "admin"
] as const;

export type UserRole = typeof userRoles[number];

// Employment types
export const employmentTypes = ["permanent", "contractor"] as const;
export type EmploymentType = typeof employmentTypes[number];

// User permissions
export const userPermissions = [
  "view_jobs",
  "create_jobs",
  "edit_jobs",
  "delete_jobs",
  "view_users",
  "create_users",
  "edit_users",
  "delete_users",
  "view_schedule",
  "manage_schedule",
  "view_reports",
  "admin_settings"
] as const;

export type UserPermission = typeof userPermissions[number];

// Job statuses
export const jobStatuses = [
  "pending",
  "scheduled",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled"
] as const;

export type JobStatus = typeof jobStatuses[number];

// Job types
export const jobTypes = [
  "plumbing",
  "renovation",
  "waterproofing",
  "tiling",
  "electrical",
  "carpentry",
  "general"
] as const;

export type JobType = typeof jobTypes[number];

// Salary types
export const salaryTypes = ["annual", "hourly"] as const;
export type SalaryType = typeof salaryTypes[number];

// Staff profiles - extends auth users with role info
export const staffProfiles = pgTable("staff_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  roles: text("roles").array().notNull().default(sql`ARRAY['plumber']::text[]`),
  employmentType: varchar("employment_type", { length: 20 }).notNull().default("permanent"),
  permissions: text("permissions").array().notNull().default(sql`ARRAY[]::text[]`),
  phone: varchar("phone", { length: 20 }),
  skills: text("skills").array().default(sql`ARRAY[]::text[]`),
  isActive: boolean("is_active").notNull().default(true),
  // Compensation fields
  salaryType: varchar("salary_type", { length: 20 }).default("hourly"),
  salaryAmount: decimal("salary_amount", { precision: 12, scale: 2 }),
  overtimeRateMultiplier: decimal("overtime_rate_multiplier", { precision: 4, scale: 2 }).default("1.5"),
  overtimeThresholdHours: decimal("overtime_threshold_hours", { precision: 5, scale: 2 }).default("38"),
  // Contact fields
  emailSignature: text("email_signature"),
  // Working hours fields
  timezone: varchar("timezone", { length: 50 }).default("Australia/Brisbane"),
  lunchBreakMinutes: integer("lunch_break_minutes").default(30),
  lunchBreakPaid: boolean("lunch_break_paid").default(false),
  // KPI Module fields
  hourlyCostLoaded: decimal("hourly_cost_loaded", { precision: 10, scale: 2 }),
  dailyCostLoaded: decimal("daily_cost_loaded", { precision: 10, scale: 2 }),
  salesPhase: integer("sales_phase").default(1),
  phaseStartDate: date("phase_start_date"),
  weeklyLaborTarget: decimal("weekly_labor_target", { precision: 10, scale: 2 }).default("10000"),
  dailyLaborTarget: decimal("daily_labor_target", { precision: 10, scale: 2 }).default("2000"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_staff_user_id").on(table.userId),
  index("idx_staff_org").on(table.organizationId),
  index("idx_staff_active").on(table.isActive),
]);

// Jobs table
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  // Job numbering - same as invoice number for seamless workflow
  jobNumber: varchar("job_number", { length: 50 }),
  // Job name auto-generated as "[Client Name] | Suburb"
  jobName: varchar("job_name", { length: 255 }),
  // Shared reference number linking quote/job/invoice
  referenceNumber: integer("reference_number"),
  clientId: varchar("client_id"),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  clientEmail: varchar("client_email", { length: 255 }),
  clientPhone: varchar("client_phone", { length: 50 }),
  address: text("address").notNull(),
  suburb: varchar("suburb", { length: 100 }),
  jobType: varchar("job_type", { length: 50 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  priority: varchar("priority", { length: 20 }).default("normal"),
  estimatedDurationHours: decimal("estimated_duration_hours", { precision: 6, scale: 2 }),
  notes: text("notes"),
  // Links to quote and invoice
  quoteId: varchar("quote_id"),
  invoiceId: varchar("invoice_id"),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_jobs_org").on(table.organizationId),
  index("idx_jobs_status").on(table.status),
  index("idx_jobs_type").on(table.jobType),
  index("idx_jobs_created").on(table.createdAt),
  index("idx_jobs_number").on(table.jobNumber),
  index("idx_jobs_ref").on(table.referenceNumber),
]);

// Schedule entry statuses
export const scheduleEntryStatuses = ["scheduled", "completed", "cancelled"] as const;
export type ScheduleEntryStatus = typeof scheduleEntryStatuses[number];

// Schedule entries - assigns staff to jobs on specific dates
export const scheduleEntries = pgTable("schedule_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").notNull(),
  scheduledDate: date("scheduled_date").notNull(),
  startTime: varchar("start_time", { length: 10 }),
  endTime: varchar("end_time", { length: 10 }),
  durationHours: decimal("duration_hours", { precision: 4, scale: 2 }).default("7.5"),
  status: varchar("status", { length: 20 }).default("scheduled"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_schedule_job").on(table.jobId),
  index("idx_schedule_staff").on(table.staffId),
  index("idx_schedule_date").on(table.scheduledDate),
]);

// Relations
export const staffProfilesRelations = relations(staffProfiles, ({ one }) => ({
  // Could add user relation if needed
}));

export const jobsRelations = relations(jobs, ({ many }) => ({
  scheduleEntries: many(scheduleEntries),
}));

export const scheduleEntriesRelations = relations(scheduleEntries, ({ one }) => ({
  job: one(jobs, {
    fields: [scheduleEntries.jobId],
    references: [jobs.id],
  }),
}));

// Insert schemas
export const insertStaffProfileSchema = createInsertSchema(staffProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  clientName: z.string().min(1, "Client name is required"),
  address: z.string().min(1, "Address is required"),
  jobType: z.enum(jobTypes),
  status: z.enum(jobStatuses).optional(),
});

export const insertScheduleEntrySchema = createInsertSchema(scheduleEntries).omit({
  id: true,
  createdAt: true,
});

// Types
export type StaffProfile = typeof staffProfiles.$inferSelect;
export type InsertStaffProfile = z.infer<typeof insertStaffProfileSchema>;

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

export type ScheduleEntry = typeof scheduleEntries.$inferSelect;
export type InsertScheduleEntry = z.infer<typeof insertScheduleEntrySchema>;

// Helper type for job with schedule
export type JobWithSchedule = Job & {
  scheduleEntries: ScheduleEntry[];
};

// =====================
// STAFF WORKING HOURS
// =====================

// User working hours - per-day schedule for each staff member
export const userWorkingHours = pgTable("user_working_hours", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 1=Monday, etc.
  isWorkingDay: boolean("is_working_day").notNull().default(true),
  startTime: varchar("start_time", { length: 10 }).default("07:00"),
  endTime: varchar("end_time", { length: 10 }).default("15:30"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_working_hours_staff").on(table.staffId),
  index("idx_working_hours_day").on(table.dayOfWeek),
]);

export const userWorkingHoursRelations = relations(userWorkingHours, ({ one }) => ({
  staff: one(staffProfiles, {
    fields: [userWorkingHours.staffId],
    references: [staffProfiles.id],
  }),
}));

export const insertUserWorkingHoursSchema = createInsertSchema(userWorkingHours).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserWorkingHours = typeof userWorkingHours.$inferSelect;
export type InsertUserWorkingHours = z.infer<typeof insertUserWorkingHoursSchema>;

// =====================
// PHASE 2: PC Items, Notifications, Client Portal
// =====================

// PC Item statuses
export const pcItemStatuses = [
  "pending",
  "in_progress",
  "completed",
  "not_applicable"
] as const;

export type PCItemStatus = typeof pcItemStatuses[number];

// Notification types
export const notificationTypes = [
  "job_assigned",
  "job_updated",
  "job_completed",
  "schedule_changed",
  "pc_item_added",
  "pc_item_completed",
  "general"
] as const;

export type NotificationType = typeof notificationTypes[number];

// PC Items - Practical Completion items for jobs
export const pcItems = pgTable("pc_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  milestoneId: varchar("milestone_id"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  assignedToId: varchar("assigned_to_id"),
  startDate: date("start_date"),
  finishDate: date("finish_date"),
  completedAt: timestamp("completed_at"),
  completedById: varchar("completed_by_id"),
  sortOrder: varchar("sort_order", { length: 10 }).default("0"),
  linkedScheduleId: varchar("linked_schedule_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_pc_items_job").on(table.jobId),
  index("idx_pc_items_status").on(table.status),
  index("idx_pc_items_milestone").on(table.milestoneId),
]);

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  relatedJobId: varchar("related_job_id"),
  relatedPCItemId: varchar("related_pc_item_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_notifications_user").on(table.userId),
  index("idx_notifications_read").on(table.isRead),
  index("idx_notifications_created").on(table.createdAt),
]);

// Client access tokens - for shareable job links
export const clientAccessTokens = pgTable("client_access_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  shortCode: varchar("short_code", { length: 8 }).unique(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_client_tokens_job").on(table.jobId),
  index("idx_client_tokens_token").on(table.token),
  index("idx_client_tokens_short_code").on(table.shortCode),
]);

// Phase 2 Relations
export const pcItemsRelations = relations(pcItems, ({ one }) => ({
  job: one(jobs, {
    fields: [pcItems.jobId],
    references: [jobs.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  job: one(jobs, {
    fields: [notifications.relatedJobId],
    references: [jobs.id],
  }),
}));

export const clientAccessTokensRelations = relations(clientAccessTokens, ({ one }) => ({
  job: one(jobs, {
    fields: [clientAccessTokens.jobId],
    references: [jobs.id],
  }),
}));

// Phase 2 Insert Schemas
export const insertPCItemSchema = createInsertSchema(pcItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  completedById: true,
}).extend({
  title: z.string().min(1, "Title is required"),
  status: z.enum(pcItemStatuses).optional(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
}).extend({
  type: z.enum(notificationTypes),
  title: z.string().min(1, "Title is required"),
});

export const insertClientAccessTokenSchema = createInsertSchema(clientAccessTokens).omit({
  id: true,
  createdAt: true,
  token: true,
});

// Phase 2 Types
export type PCItem = typeof pcItems.$inferSelect;
export type InsertPCItem = z.infer<typeof insertPCItemSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type ClientAccessToken = typeof clientAccessTokens.$inferSelect;
export type InsertClientAccessToken = z.infer<typeof insertClientAccessTokenSchema>;

// =====================
// PHASE 3: Quotes, Invoices, Payments
// =====================

// Quote statuses (internal)
export const quoteStatuses = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired"
] as const;

export type QuoteStatus = typeof quoteStatuses[number];

// Quote client statuses (client-facing approval workflow)
export const quoteClientStatuses = [
  "pending",
  "approved",
  "rejected",
  "changes_requested"
] as const;

export type QuoteClientStatus = typeof quoteClientStatuses[number];

// Payment schedule types
export const paymentScheduleTypes = [
  "deposit",
  "progress",
  "final"
] as const;

export type PaymentScheduleType = typeof paymentScheduleTypes[number];

// Invoice statuses
export const invoiceStatuses = [
  "draft",
  "sent",
  "paid",
  "partially_paid",
  "overdue",
  "cancelled"
] as const;

export type InvoiceStatus = typeof invoiceStatuses[number];

// Payment statuses
export const paymentStatuses = [
  "pending",
  "processing",
  "completed",
  "failed",
  "refunded"
] as const;

export type PaymentStatus = typeof paymentStatuses[number];

// Payment methods
export const paymentMethods = [
  "stripe",
  "bank_transfer",
  "cash",
  "cheque",
  "other"
] as const;

export type PaymentMethod = typeof paymentMethods[number];

// Quotes table
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  quoteNumber: varchar("quote_number", { length: 50 }).notNull().unique(),
  // Shared reference number linking quote/job/invoice (sequential per org)
  referenceNumber: integer("reference_number"),
  // Client reference - required, no manual entry allowed
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  // Snapshot of client details at time of quote creation (for historical accuracy)
  clientName: varchar("client_name", { length: 255 }).notNull(),
  clientEmail: varchar("client_email", { length: 255 }),
  clientPhone: varchar("client_phone", { length: 50 }),
  clientAddress: text("client_address").notNull(),
  jobType: varchar("job_type", { length: 50 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  // Client approval workflow
  clientStatus: varchar("client_status", { length: 50 }).default("pending"),
  clientApprovedAt: timestamp("client_approved_at"),
  clientApprovedById: varchar("client_approved_by_id"),
  clientRejectedAt: timestamp("client_rejected_at"),
  clientChangesRequestedAt: timestamp("client_changes_requested_at"),
  clientChangesNote: text("client_changes_note"),
  // Financials
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("10"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
  validUntil: date("valid_until"),
  notes: text("notes"),
  termsAndConditions: text("terms_and_conditions"),
  // Terms of Trade from template
  termsOfTradeTemplateId: varchar("terms_of_trade_template_id").references(() => termsTemplates.id, { onDelete: "set null" }),
  termsOfTradeContent: text("terms_of_trade_content"),
  // Conversion tracking
  convertedToJobId: varchar("converted_to_job_id"),
  convertedToInvoiceId: varchar("converted_to_invoice_id"),
  // Revision tracking
  revisionNumber: integer("revision_number").notNull().default(1),
  parentQuoteId: varchar("parent_quote_id"),
  revisionReason: text("revision_reason"),
  isLatestRevision: boolean("is_latest_revision").notNull().default(true),
  supersededByQuoteId: varchar("superseded_by_quote_id"),
  createdById: varchar("created_by_id"),
  sentAt: timestamp("sent_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_quotes_status").on(table.status),
  index("idx_quotes_number").on(table.quoteNumber),
  index("idx_quotes_created").on(table.createdAt),
  index("idx_quotes_client").on(table.clientId),
  index("idx_quotes_client_status").on(table.clientStatus),
  index("idx_quotes_ref").on(table.referenceNumber),
  index("idx_quotes_parent").on(table.parentQuoteId),
]);

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  // Shared reference number linking quote/job/invoice (sequential per org)
  referenceNumber: integer("reference_number"),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: "set null" }),
  quoteId: varchar("quote_id").references(() => quotes.id, { onDelete: "set null" }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  clientEmail: varchar("client_email", { length: 255 }),
  clientPhone: varchar("client_phone", { length: 50 }),
  clientAddress: text("client_address").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("10"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull().default("0"),
  amountDue: decimal("amount_due", { precision: 10, scale: 2 }).notNull().default("0"),
  dueDate: date("due_date"),
  notes: text("notes"),
  termsAndConditions: text("terms_and_conditions"),
  // Payment link token for client portal access
  paymentLinkToken: varchar("payment_link_token", { length: 100 }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  createdById: varchar("created_by_id"),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_invoices_status").on(table.status),
  index("idx_invoices_number").on(table.invoiceNumber),
  index("idx_invoices_job").on(table.jobId),
  index("idx_invoices_due").on(table.dueDate),
  index("idx_invoices_ref").on(table.referenceNumber),
  index("idx_invoices_token").on(table.paymentLinkToken),
]);

// Invoice payments table - records individual payments against an invoice
export const invoicePayments = pgTable("invoice_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  // Optional milestone reference if payment is for a specific milestone
  milestoneId: varchar("milestone_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull().default("stripe"),
  status: varchar("status", { length: 20 }).notNull().default("completed"),
  // Payment provider references
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
  // Payment details
  description: varchar("description", { length: 255 }),
  paidAt: timestamp("paid_at").defaultNow(),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_inv_payments_invoice").on(table.invoiceId),
  index("idx_inv_payments_status").on(table.status),
  index("idx_inv_payments_paid").on(table.paidAt),
]);

// Quote milestones - for organizing line items into phases/stages
export const quoteMilestones = pgTable("quote_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sequence: integer("sequence").notNull().default(1),
  expectedStartDate: date("expected_start_date"),
  expectedEndDate: date("expected_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_quote_milestones_quote").on(table.quoteId),
]);

// Quote custom sections - for additional text sections like "What's Included", "What's NOT Included", etc.
export const quoteCustomSections = pgTable("quote_custom_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  heading: varchar("heading", { length: 255 }).notNull(),
  content: text("content").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_quote_custom_sections_quote").on(table.quoteId),
]);

// Line items - shared between quotes and invoices
export const lineItems = pgTable("line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").references(() => quotes.id, { onDelete: "cascade" }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
  // Optional milestone reference for quote line items
  quoteMilestoneId: varchar("quote_milestone_id").references(() => quoteMilestones.id, { onDelete: "set null" }),
  // Heading for the line item (e.g., "Kitchen Renovation", "Bathroom Plumbing")
  heading: varchar("heading", { length: 255 }),
  // Short description for the line item
  description: varchar("description", { length: 500 }).notNull(),
  // Rich text description for detailed scope of works (stored as JSON/HTML)
  richDescription: text("rich_description"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_line_items_quote").on(table.quoteId),
  index("idx_line_items_invoice").on(table.invoiceId),
  index("idx_line_items_milestone").on(table.quoteMilestoneId),
]);

// Quote payment schedules - for split payments (deposit, progress, final)
export const quotePaymentSchedules = pgTable("quote_payment_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(), // deposit, progress, final
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Deposit", "Progress Payment 1", "Final Payment"
  // Amount can be percentage or fixed amount
  isPercentage: boolean("is_percentage").notNull().default(true),
  percentage: decimal("percentage", { precision: 5, scale: 2 }), // e.g., 20.00 for 20%
  fixedAmount: decimal("fixed_amount", { precision: 10, scale: 2 }),
  // Calculated amount from quote total
  calculatedAmount: decimal("calculated_amount", { precision: 10, scale: 2 }),
  // Optional milestone reference for milestone-based payments
  quoteMilestoneId: varchar("quote_milestone_id").references(() => quoteMilestones.id, { onDelete: "set null" }),
  milestoneDescription: varchar("milestone_description", { length: 255 }),
  // Due date offset from quote acceptance (in days)
  dueDaysFromAcceptance: integer("due_days_from_acceptance").default(0),
  sortOrder: integer("sort_order").default(0),
  // Payment tracking
  isPaid: boolean("is_paid").notNull().default(false),
  paidAt: timestamp("paid_at"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_payment_schedule_quote").on(table.quoteId),
  index("idx_payment_schedule_type").on(table.type),
  index("idx_payment_schedule_milestone").on(table.quoteMilestoneId),
]);

// Quote workflow events - audit trail for client interactions
export const quoteWorkflowEvents = pgTable("quote_workflow_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 50 }).notNull(), // sent, viewed, approved, rejected, changes_requested, converted
  actorType: varchar("actor_type", { length: 20 }).notNull(), // staff, client
  actorId: varchar("actor_id"),
  notes: text("notes"),
  metadata: json("metadata"), // Additional event-specific data
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_workflow_event_quote").on(table.quoteId),
  index("idx_workflow_event_type").on(table.eventType),
]);

// Payments table
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
  transactionReference: varchar("transaction_reference", { length: 255 }),
  notes: text("notes"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_payments_invoice").on(table.invoiceId),
  index("idx_payments_status").on(table.status),
  index("idx_payments_created").on(table.createdAt),
]);

// Phase 3 Relations
export const quotesRelations = relations(quotes, ({ many, one }) => ({
  lineItems: many(lineItems),
  milestones: many(quoteMilestones),
  paymentSchedules: many(quotePaymentSchedules),
  workflowEvents: many(quoteWorkflowEvents),
  customSections: many(quoteCustomSections),
  client: one(clients, {
    fields: [quotes.clientId],
    references: [clients.id],
  }),
  convertedJob: one(jobs, {
    fields: [quotes.convertedToJobId],
    references: [jobs.id],
  }),
  convertedInvoice: one(invoices, {
    fields: [quotes.convertedToInvoiceId],
    references: [invoices.id],
  }),
}));

export const quoteCustomSectionsRelations = relations(quoteCustomSections, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteCustomSections.quoteId],
    references: [quotes.id],
  }),
}));

export const quoteMilestonesRelations = relations(quoteMilestones, ({ one, many }) => ({
  quote: one(quotes, {
    fields: [quoteMilestones.quoteId],
    references: [quotes.id],
  }),
  lineItems: many(lineItems),
  paymentSchedules: many(quotePaymentSchedules),
}));

export const invoicesRelations = relations(invoices, ({ many, one }) => ({
  lineItems: many(lineItems),
  payments: many(payments),
  job: one(jobs, {
    fields: [invoices.jobId],
    references: [jobs.id],
  }),
  quote: one(quotes, {
    fields: [invoices.quoteId],
    references: [quotes.id],
  }),
}));

export const lineItemsRelations = relations(lineItems, ({ one }) => ({
  quote: one(quotes, {
    fields: [lineItems.quoteId],
    references: [quotes.id],
  }),
  invoice: one(invoices, {
    fields: [lineItems.invoiceId],
    references: [invoices.id],
  }),
  quoteMilestone: one(quoteMilestones, {
    fields: [lineItems.quoteMilestoneId],
    references: [quoteMilestones.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

export const quotePaymentSchedulesRelations = relations(quotePaymentSchedules, ({ one }) => ({
  quote: one(quotes, {
    fields: [quotePaymentSchedules.quoteId],
    references: [quotes.id],
  }),
  invoice: one(invoices, {
    fields: [quotePaymentSchedules.invoiceId],
    references: [invoices.id],
  }),
  quoteMilestone: one(quoteMilestones, {
    fields: [quotePaymentSchedules.quoteMilestoneId],
    references: [quoteMilestones.id],
  }),
}));

export const quoteWorkflowEventsRelations = relations(quoteWorkflowEvents, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteWorkflowEvents.quoteId],
    references: [quotes.id],
  }),
}));

// Phase 3 Insert Schemas
export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  quoteNumber: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  acceptedAt: true,
  rejectedAt: true,
  clientApprovedAt: true,
  clientRejectedAt: true,
  clientChangesRequestedAt: true,
  convertedToInvoiceId: true,
}).extend({
  clientId: z.string().min(1, "Client is required"),
  clientName: z.string().min(1, "Client name is required"),
  clientAddress: z.string().min(1, "Address is required"),
  jobType: z.enum(jobTypes),
  status: z.enum(quoteStatuses).optional(),
  clientStatus: z.enum(quoteClientStatuses).optional(),
  subtotal: z.string().optional(),
  taxRate: z.string().optional(),
  taxAmount: z.string().optional(),
  total: z.string().optional(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  invoiceNumber: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  paidAt: true,
}).extend({
  clientName: z.string().min(1, "Client name is required"),
  clientAddress: z.string().min(1, "Address is required"),
  status: z.enum(invoiceStatuses).optional(),
  subtotal: z.string().optional(),
  taxRate: z.string().optional(),
  taxAmount: z.string().optional(),
  total: z.string().optional(),
  amountPaid: z.string().optional(),
  amountDue: z.string().optional(),
});

export const insertLineItemSchema = createInsertSchema(lineItems).omit({
  id: true,
  createdAt: true,
}).extend({
  heading: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  richDescription: z.string().optional(),
  quantity: z.string().optional(),
  unitPrice: z.string(),
  amount: z.string(),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  paidAt: true,
}).extend({
  amount: z.string(),
  paymentMethod: z.enum(paymentMethods),
  status: z.enum(paymentStatuses).optional(),
});

export const insertQuotePaymentScheduleSchema = createInsertSchema(quotePaymentSchedules).omit({
  id: true,
  createdAt: true,
  paidAt: true,
  invoiceId: true,
}).extend({
  type: z.enum(paymentScheduleTypes),
  name: z.string().min(1, "Payment name is required"),
  percentage: z.string().optional(),
  fixedAmount: z.string().optional(),
  calculatedAmount: z.string().optional(),
  paidAmount: z.string().optional(),
});

export const insertQuoteWorkflowEventSchema = createInsertSchema(quoteWorkflowEvents).omit({
  id: true,
  createdAt: true,
});

export const insertQuoteMilestoneSchema = createInsertSchema(quoteMilestones).omit({
  id: true,
  createdAt: true,
}).extend({
  title: z.string().min(1, "Milestone title is required"),
  description: z.string().optional(),
  sequence: z.number().optional(),
  expectedStartDate: z.string().optional(),
  expectedEndDate: z.string().optional(),
});

export const insertQuoteCustomSectionSchema = createInsertSchema(quoteCustomSections).omit({
  id: true,
  createdAt: true,
}).extend({
  heading: z.string().min(1, "Section heading is required"),
  content: z.string().optional().nullable(),
  sortOrder: z.number().optional(),
});

export const insertInvoicePaymentSchema = createInsertSchema(invoicePayments).omit({
  id: true,
  createdAt: true,
  paidAt: true,
}).extend({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  amount: z.string(),
  paymentMethod: z.enum(paymentMethods).optional(),
  status: z.enum(paymentStatuses).optional(),
  description: z.string().optional(),
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

export const insertOrganizationCounterSchema = createInsertSchema(organizationCounters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  organizationId: z.string().min(1, "Organization ID is required"),
  counterKey: z.string().min(1, "Counter key is required"),
  nextValue: z.number().optional(),
  prefix: z.string().optional(),
  padLength: z.number().optional(),
});

// Phase 3 Types
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type LineItem = typeof lineItems.$inferSelect;
export type InsertLineItem = z.infer<typeof insertLineItemSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type QuotePaymentSchedule = typeof quotePaymentSchedules.$inferSelect;
export type InsertQuotePaymentSchedule = z.infer<typeof insertQuotePaymentScheduleSchema>;

export type QuoteWorkflowEvent = typeof quoteWorkflowEvents.$inferSelect;
export type InsertQuoteWorkflowEvent = z.infer<typeof insertQuoteWorkflowEventSchema>;

export type QuoteMilestone = typeof quoteMilestones.$inferSelect;
export type InsertQuoteMilestone = z.infer<typeof insertQuoteMilestoneSchema>;

export type QuoteCustomSection = typeof quoteCustomSections.$inferSelect;
export type InsertQuoteCustomSection = z.infer<typeof insertQuoteCustomSectionSchema>;

export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type InsertInvoicePayment = z.infer<typeof insertInvoicePaymentSchema>;

export type OrganizationCounter = typeof organizationCounters.$inferSelect;
export type InsertOrganizationCounter = z.infer<typeof insertOrganizationCounterSchema>;

export type TermsTemplate = typeof termsTemplates.$inferSelect;
export type InsertTermsTemplate = z.infer<typeof insertTermsTemplateSchema>;

// Helper types
export type QuoteWithLineItems = Quote & {
  lineItems: LineItem[];
};

export type QuoteMilestoneWithLineItems = QuoteMilestone & {
  lineItems: LineItem[];
};

export type QuoteWithDetails = Quote & {
  lineItems: LineItem[];
  milestones: QuoteMilestone[];
  paymentSchedules: QuotePaymentSchedule[];
  workflowEvents: QuoteWorkflowEvent[];
};

export type InvoiceWithDetails = Invoice & {
  lineItems: LineItem[];
  payments: Payment[];
  invoicePayments: InvoicePayment[];
};

// =====================
// PHASE 4: Vehicle Management, Checklists & Photos
// =====================

// Vehicle status enum
export const vehicleStatuses = ["available", "in_use", "maintenance", "retired"] as const;
export type VehicleStatus = typeof vehicleStatuses[number];

// Checklist target enum - what the checklist applies to
export const checklistTargets = ["vehicle", "job"] as const;
export type ChecklistTarget = typeof checklistTargets[number];

// Checklist item type enum
export const checklistItemTypes = ["checkbox", "text", "number", "photo"] as const;
export type ChecklistItemType = typeof checklistItemTypes[number];

// Maintenance status enum
export const maintenanceStatuses = ["scheduled", "in_progress", "completed", "cancelled"] as const;
export type MaintenanceStatus = typeof maintenanceStatuses[number];

// Vehicles table
export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  registrationNumber: varchar("registration_number", { length: 20 }).notNull().unique(),
  make: varchar("make", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  year: integer("year"),
  color: varchar("color", { length: 50 }),
  vin: varchar("vin", { length: 50 }),
  status: varchar("status", { length: 50 }).notNull().default("available"),
  currentOdometer: integer("current_odometer").default(0),
  fuelType: varchar("fuel_type", { length: 50 }),
  capacity: integer("capacity"),
  notes: text("notes"),
  insuranceExpiry: varchar("insurance_expiry", { length: 10 }),
  registrationExpiry: varchar("registration_expiry", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_vehicles_status").on(table.status),
  index("idx_vehicles_rego").on(table.registrationNumber),
]);

// Vehicle assignments - tracks which staff is assigned to which vehicle
export const vehicleAssignments = pgTable("vehicle_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow(),
  returnedAt: timestamp("returned_at"),
  notes: text("notes"),
}, (table) => [
  index("idx_vehicle_assignments_vehicle").on(table.vehicleId),
  index("idx_vehicle_assignments_staff").on(table.staffId),
]);

// Checklist templates - reusable checklist definitions
export const checklistTemplates = pgTable("checklist_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  target: varchar("target", { length: 50 }).notNull().default("vehicle"),
  isActive: boolean("is_active").default(true),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_checklist_templates_target").on(table.target),
  index("idx_checklist_templates_active").on(table.isActive),
]);

// Checklist template items - questions/items within a template
export const checklistTemplateItems = pgTable("checklist_template_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => checklistTemplates.id, { onDelete: "cascade" }),
  question: varchar("question", { length: 500 }).notNull(),
  itemType: varchar("item_type", { length: 50 }).notNull().default("checkbox"),
  isRequired: boolean("is_required").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_checklist_template_items_template").on(table.templateId),
]);

// Checklist runs - actual completed checklists
export const checklistRuns = pgTable("checklist_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => checklistTemplates.id),
  vehicleId: varchar("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: "set null" }),
  scheduleEntryId: varchar("schedule_entry_id").references(() => scheduleEntries.id, { onDelete: "set null" }),
  completedById: varchar("completed_by_id").references(() => staffProfiles.id),
  status: varchar("status", { length: 50 }).notNull().default("in_progress"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
}, (table) => [
  index("idx_checklist_runs_template").on(table.templateId),
  index("idx_checklist_runs_vehicle").on(table.vehicleId),
  index("idx_checklist_runs_job").on(table.jobId),
  index("idx_checklist_runs_completed_by").on(table.completedById),
]);

// Checklist run items - individual answers for a checklist run
export const checklistRunItems = pgTable("checklist_run_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => checklistRuns.id, { onDelete: "cascade" }),
  templateItemId: varchar("template_item_id").notNull().references(() => checklistTemplateItems.id),
  question: varchar("question", { length: 500 }).notNull(),
  itemType: varchar("item_type", { length: 50 }).notNull(),
  isChecked: boolean("is_checked").default(false),
  textValue: text("text_value"),
  numberValue: decimal("number_value", { precision: 10, scale: 2 }),
  photoUrl: varchar("photo_url", { length: 500 }),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_checklist_run_items_run").on(table.runId),
]);

// Job photos - photos attached to jobs
export const jobPhotos = pgTable("job_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  scheduleEntryId: varchar("schedule_entry_id").references(() => scheduleEntries.id, { onDelete: "set null" }),
  uploadedById: varchar("uploaded_by_id").references(() => staffProfiles.id),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalFilename: varchar("original_filename", { length: 255 }),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSize: integer("file_size"),
  url: varchar("url", { length: 1000 }).notNull(),
  thumbnailUrl: varchar("thumbnail_url", { length: 1000 }),
  caption: varchar("caption", { length: 500 }),
  category: varchar("category", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_job_photos_job").on(table.jobId),
  index("idx_job_photos_schedule").on(table.scheduleEntryId),
  index("idx_job_photos_uploaded_by").on(table.uploadedById),
]);

// Job receipts - receipts/expense scans attached to jobs
export const jobReceipts = pgTable("job_receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  uploadedById: varchar("uploaded_by_id").references(() => staffProfiles.id),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalFilename: varchar("original_filename", { length: 255 }),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSize: integer("file_size"),
  url: varchar("url", { length: 1000 }).notNull(),
  thumbnailUrl: varchar("thumbnail_url", { length: 1000 }),
  description: varchar("description", { length: 500 }),
  vendor: varchar("vendor", { length: 255 }),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  receiptDate: date("receipt_date"),
  category: varchar("category", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_job_receipts_job").on(table.jobId),
  index("idx_job_receipts_uploaded_by").on(table.uploadedById),
]);

// Vehicle maintenance records
export const vehicleMaintenance = pgTable("vehicle_maintenance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  maintenanceType: varchar("maintenance_type", { length: 100 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("scheduled"),
  scheduledDate: varchar("scheduled_date", { length: 10 }),
  completedDate: varchar("completed_date", { length: 10 }),
  odometerAtService: integer("odometer_at_service"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  vendor: varchar("vendor", { length: 200 }),
  notes: text("notes"),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_vehicle_maintenance_vehicle").on(table.vehicleId),
  index("idx_vehicle_maintenance_status").on(table.status),
  index("idx_vehicle_maintenance_scheduled").on(table.scheduledDate),
]);

// Phase 4 Relations
export const vehiclesRelations = relations(vehicles, ({ many }) => ({
  assignments: many(vehicleAssignments),
  checklistRuns: many(checklistRuns),
  maintenance: many(vehicleMaintenance),
}));

export const vehicleAssignmentsRelations = relations(vehicleAssignments, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [vehicleAssignments.vehicleId],
    references: [vehicles.id],
  }),
  staff: one(staffProfiles, {
    fields: [vehicleAssignments.staffId],
    references: [staffProfiles.id],
  }),
}));

export const checklistTemplatesRelations = relations(checklistTemplates, ({ many }) => ({
  items: many(checklistTemplateItems),
  runs: many(checklistRuns),
}));

export const checklistTemplateItemsRelations = relations(checklistTemplateItems, ({ one }) => ({
  template: one(checklistTemplates, {
    fields: [checklistTemplateItems.templateId],
    references: [checklistTemplates.id],
  }),
}));

export const checklistRunsRelations = relations(checklistRuns, ({ one, many }) => ({
  template: one(checklistTemplates, {
    fields: [checklistRuns.templateId],
    references: [checklistTemplates.id],
  }),
  vehicle: one(vehicles, {
    fields: [checklistRuns.vehicleId],
    references: [vehicles.id],
  }),
  job: one(jobs, {
    fields: [checklistRuns.jobId],
    references: [jobs.id],
  }),
  completedBy: one(staffProfiles, {
    fields: [checklistRuns.completedById],
    references: [staffProfiles.id],
  }),
  items: many(checklistRunItems),
}));

export const checklistRunItemsRelations = relations(checklistRunItems, ({ one }) => ({
  run: one(checklistRuns, {
    fields: [checklistRunItems.runId],
    references: [checklistRuns.id],
  }),
  templateItem: one(checklistTemplateItems, {
    fields: [checklistRunItems.templateItemId],
    references: [checklistTemplateItems.id],
  }),
}));

export const jobPhotosRelations = relations(jobPhotos, ({ one }) => ({
  job: one(jobs, {
    fields: [jobPhotos.jobId],
    references: [jobs.id],
  }),
  scheduleEntry: one(scheduleEntries, {
    fields: [jobPhotos.scheduleEntryId],
    references: [scheduleEntries.id],
  }),
  uploadedBy: one(staffProfiles, {
    fields: [jobPhotos.uploadedById],
    references: [staffProfiles.id],
  }),
}));

export const jobReceiptsRelations = relations(jobReceipts, ({ one }) => ({
  job: one(jobs, {
    fields: [jobReceipts.jobId],
    references: [jobs.id],
  }),
  uploadedBy: one(staffProfiles, {
    fields: [jobReceipts.uploadedById],
    references: [staffProfiles.id],
  }),
}));

export const vehicleMaintenanceRelations = relations(vehicleMaintenance, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [vehicleMaintenance.vehicleId],
    references: [vehicles.id],
  }),
}));

// Phase 4 Insert Schemas
export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  registrationNumber: z.string().min(1, "Registration number is required"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  status: z.enum(vehicleStatuses).optional(),
});

export const insertVehicleAssignmentSchema = createInsertSchema(vehicleAssignments).omit({
  id: true,
  assignedAt: true,
}).extend({
  vehicleId: z.string().min(1, "Vehicle is required"),
  staffId: z.string().min(1, "Staff member is required"),
});

export const insertChecklistTemplateSchema = createInsertSchema(checklistTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Name is required"),
  target: z.enum(checklistTargets).optional(),
});

export const insertChecklistTemplateItemSchema = createInsertSchema(checklistTemplateItems).omit({
  id: true,
  createdAt: true,
}).extend({
  templateId: z.string().min(1, "Template is required"),
  question: z.string().min(1, "Question is required"),
  itemType: z.enum(checklistItemTypes).optional(),
});

export const insertChecklistRunSchema = createInsertSchema(checklistRuns).omit({
  id: true,
  startedAt: true,
  completedAt: true,
}).extend({
  templateId: z.string().min(1, "Template is required"),
});

export const insertChecklistRunItemSchema = createInsertSchema(checklistRunItems).omit({
  id: true,
  completedAt: true,
}).extend({
  runId: z.string().min(1, "Run is required"),
  templateItemId: z.string().min(1, "Template item is required"),
  question: z.string().min(1, "Question is required"),
});

export const insertJobPhotoSchema = createInsertSchema(jobPhotos).omit({
  id: true,
  createdAt: true,
}).extend({
  jobId: z.string().min(1, "Job is required"),
  filename: z.string().min(1, "Filename is required"),
  url: z.string().min(1, "URL is required"),
});

export const insertJobReceiptSchema = createInsertSchema(jobReceipts).omit({
  id: true,
  createdAt: true,
}).extend({
  jobId: z.string().min(1, "Job is required"),
  filename: z.string().min(1, "Filename is required"),
  url: z.string().min(1, "URL is required"),
  amount: z.string().optional(),
});

export const insertVehicleMaintenanceSchema = createInsertSchema(vehicleMaintenance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  vehicleId: z.string().min(1, "Vehicle is required"),
  maintenanceType: z.string().min(1, "Maintenance type is required"),
  status: z.enum(maintenanceStatuses).optional(),
});

// Phase 4 Types
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;

export type VehicleAssignment = typeof vehicleAssignments.$inferSelect;
export type InsertVehicleAssignment = z.infer<typeof insertVehicleAssignmentSchema>;

export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type InsertChecklistTemplate = z.infer<typeof insertChecklistTemplateSchema>;

export type ChecklistTemplateItem = typeof checklistTemplateItems.$inferSelect;
export type InsertChecklistTemplateItem = z.infer<typeof insertChecklistTemplateItemSchema>;

export type ChecklistRun = typeof checklistRuns.$inferSelect;
export type InsertChecklistRun = z.infer<typeof insertChecklistRunSchema>;

export type ChecklistRunItem = typeof checklistRunItems.$inferSelect;
export type InsertChecklistRunItem = z.infer<typeof insertChecklistRunItemSchema>;

export type JobPhoto = typeof jobPhotos.$inferSelect;
export type InsertJobPhoto = z.infer<typeof insertJobPhotoSchema>;

export type JobReceipt = typeof jobReceipts.$inferSelect;
export type InsertJobReceipt = z.infer<typeof insertJobReceiptSchema>;

export type VehicleMaintenance = typeof vehicleMaintenance.$inferSelect;
export type InsertVehicleMaintenance = z.infer<typeof insertVehicleMaintenanceSchema>;

// Phase 4 Helper types
export type VehicleWithAssignment = Vehicle & {
  currentAssignment?: VehicleAssignment & { staff?: StaffProfile };
};

export type ChecklistTemplateWithItems = ChecklistTemplate & {
  items: ChecklistTemplateItem[];
};

export type ChecklistRunWithItems = ChecklistRun & {
  items: ChecklistRunItem[];
  template?: ChecklistTemplate;
};

// ==========================================
// PHASE 5: PRODUCTIVITY, BACKCOSTING & CAPACITY
// ==========================================

// Time entry categories for productivity tracking
export const timeEntryCategories = ["labor", "travel", "admin", "break", "training"] as const;

// Cost entry categories for backcosting
export const costCategories = ["labor", "material", "subcontractor", "equipment", "misc"] as const;

// Cost source types
export const costSourceTypes = ["time_entry", "purchase_order", "invoice", "manual"] as const;

// Time off status
export const timeOffStatuses = ["pending", "approved", "rejected"] as const;

// Job time entries - time tracking per job/staff
export const jobTimeEntries = pgTable("job_time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").notNull().references(() => staffProfiles.id),
  scheduleEntryId: varchar("schedule_entry_id").references(() => scheduleEntries.id, { onDelete: "set null" }),
  workDate: date("work_date").notNull(),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  hoursWorked: decimal("hours_worked", { precision: 5, scale: 2 }).notNull(),
  category: varchar("category", { length: 50 }).default("labor"),
  isBillable: boolean("is_billable").default(true),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_time_entries_job").on(table.jobId),
  index("idx_time_entries_staff").on(table.staffId),
  index("idx_time_entries_date").on(table.workDate),
]);

// Job cost entries - backcosting tracking
export const jobCostEntries = pgTable("job_cost_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 50 }).notNull(),
  sourceType: varchar("source_type", { length: 50 }).default("manual"),
  sourceRef: varchar("source_ref", { length: 255 }),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1"),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }).notNull(),
  vendor: varchar("vendor", { length: 255 }),
  receiptUrl: varchar("receipt_url", { length: 1000 }),
  recordedById: varchar("recorded_by_id").references(() => staffProfiles.id),
  recordedAt: timestamp("recorded_at").defaultNow(),
  notes: text("notes"),
}, (table) => [
  index("idx_cost_entries_job").on(table.jobId),
  index("idx_cost_entries_category").on(table.category),
]);

// Staff capacity rules - default weekly availability
export const staffCapacityRules = pgTable("staff_capacity_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "cascade" }).unique(),
  mondayHours: decimal("monday_hours", { precision: 4, scale: 2 }).default("8"),
  tuesdayHours: decimal("tuesday_hours", { precision: 4, scale: 2 }).default("8"),
  wednesdayHours: decimal("wednesday_hours", { precision: 4, scale: 2 }).default("8"),
  thursdayHours: decimal("thursday_hours", { precision: 4, scale: 2 }).default("8"),
  fridayHours: decimal("friday_hours", { precision: 4, scale: 2 }).default("8"),
  saturdayHours: decimal("saturday_hours", { precision: 4, scale: 2 }).default("0"),
  sundayHours: decimal("sunday_hours", { precision: 4, scale: 2 }).default("0"),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Staff time off - leave/vacation tracking
export const staffTimeOff = pgTable("staff_time_off", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: varchar("reason", { length: 255 }),
  status: varchar("status", { length: 50 }).default("pending"),
  approvedById: varchar("approved_by_id").references(() => staffProfiles.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_time_off_staff").on(table.staffId),
  index("idx_time_off_dates").on(table.startDate, table.endDate),
]);

// Phase 5 Relations
export const jobTimeEntriesRelations = relations(jobTimeEntries, ({ one }) => ({
  job: one(jobs, {
    fields: [jobTimeEntries.jobId],
    references: [jobs.id],
  }),
  staff: one(staffProfiles, {
    fields: [jobTimeEntries.staffId],
    references: [staffProfiles.id],
  }),
  scheduleEntry: one(scheduleEntries, {
    fields: [jobTimeEntries.scheduleEntryId],
    references: [scheduleEntries.id],
  }),
}));

export const jobCostEntriesRelations = relations(jobCostEntries, ({ one }) => ({
  job: one(jobs, {
    fields: [jobCostEntries.jobId],
    references: [jobs.id],
  }),
  recordedBy: one(staffProfiles, {
    fields: [jobCostEntries.recordedById],
    references: [staffProfiles.id],
  }),
}));

export const staffCapacityRulesRelations = relations(staffCapacityRules, ({ one }) => ({
  staff: one(staffProfiles, {
    fields: [staffCapacityRules.staffId],
    references: [staffProfiles.id],
  }),
}));

export const staffTimeOffRelations = relations(staffTimeOff, ({ one }) => ({
  staff: one(staffProfiles, {
    fields: [staffTimeOff.staffId],
    references: [staffProfiles.id],
  }),
  approvedBy: one(staffProfiles, {
    fields: [staffTimeOff.approvedById],
    references: [staffProfiles.id],
  }),
}));

// Phase 5 Validation Schemas

// Strict numeric regex that only accepts valid decimal numbers
const STRICT_NUMERIC_REGEX = /^-?\d+(\.\d+)?$/;

// Helper for strict numeric string validation - validates and normalizes
const numericString = (fieldName: string, min = 0) => 
  z.string()
    .min(1, `${fieldName} is required`)
    .refine((val) => STRICT_NUMERIC_REGEX.test(val.trim()), {
      message: `${fieldName} must be a valid number (digits only, optional decimal)`,
    })
    .refine((val) => Number(val) >= min, {
      message: `${fieldName} must be at least ${min}`,
    })
    .transform((val) => String(Number(val.trim()))); // Normalize to clean numeric string

// Optional numeric string - uses union to properly handle undefined
const optionalNumericString = (min = 0) =>
  z.union([
    z.string()
      .refine((val) => val === "" || STRICT_NUMERIC_REGEX.test(val.trim()), {
        message: "Must be a valid number (digits only, optional decimal)",
      })
      .refine((val) => val === "" || Number(val) >= min, {
        message: `Must be at least ${min}`,
      })
      .transform((val) => val === "" ? undefined : String(Number(val.trim()))),
    z.undefined(),
  ]);

export const insertJobTimeEntrySchema = createInsertSchema(jobTimeEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  jobId: z.string().min(1, "Job is required"),
  staffId: z.string().min(1, "Staff member is required"),
  workDate: z.string().min(1, "Work date is required"),
  hoursWorked: numericString("Hours worked", 0.01),
  hourlyRate: optionalNumericString(0),
  category: z.enum(timeEntryCategories).optional().default("labor"),
});

export const insertJobCostEntrySchema = createInsertSchema(jobCostEntries).omit({
  id: true,
  recordedAt: true,
}).extend({
  jobId: z.string().min(1, "Job is required"),
  category: z.enum(costCategories, { required_error: "Category is required" }),
  description: z.string().min(1, "Description is required"),
  quantity: numericString("Quantity", 0.01).optional().default("1"),
  unitCost: numericString("Unit cost", 0),
  totalCost: numericString("Total cost", 0),
});

const hoursRuleSchema = optionalNumericString(0).transform((val) => val || "8");

export const insertStaffCapacityRuleSchema = createInsertSchema(staffCapacityRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  staffId: z.string().min(1, "Staff member is required"),
  mondayHours: hoursRuleSchema,
  tuesdayHours: hoursRuleSchema,
  wednesdayHours: hoursRuleSchema,
  thursdayHours: hoursRuleSchema,
  fridayHours: hoursRuleSchema,
  saturdayHours: hoursRuleSchema,
  sundayHours: hoursRuleSchema,
});

export const insertStaffTimeOffSchema = createInsertSchema(staffTimeOff).omit({
  id: true,
  createdAt: true,
}).extend({
  staffId: z.string().min(1, "Staff member is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

// Phase 5 Types
export type JobTimeEntry = typeof jobTimeEntries.$inferSelect;
export type InsertJobTimeEntry = z.infer<typeof insertJobTimeEntrySchema>;

export type JobCostEntry = typeof jobCostEntries.$inferSelect;
export type InsertJobCostEntry = z.infer<typeof insertJobCostEntrySchema>;

export type StaffCapacityRule = typeof staffCapacityRules.$inferSelect;
export type InsertStaffCapacityRule = z.infer<typeof insertStaffCapacityRuleSchema>;

export type StaffTimeOff = typeof staffTimeOff.$inferSelect;
export type InsertStaffTimeOff = z.infer<typeof insertStaffTimeOffSchema>;

// Phase 5 Helper types
export type StaffProductivityMetrics = {
  staffId: string;
  staffName: string;
  totalHours: number;
  billableHours: number;
  utilizationRate: number;
  jobsWorked: number;
};

export type JobBackcostingSummary = {
  jobId: string;
  jobTitle: string;
  quotedAmount: number;
  actualLaborCost: number;
  actualMaterialCost: number;
  actualOtherCosts: number;
  totalActualCost: number;
  grossProfit: number;
  profitMargin: number;
  variance: number;
};

export type StaffCapacityView = {
  staffId: string;
  staffName: string;
  role: string;
  weeklyCapacity: number;
  scheduledHours: number;
  loggedHours: number;
  availableHours: number;
  utilizationPercent: number;
};

// =====================
// KPI MODULE TABLES
// =====================

// Alert types and severities
export const kpiAlertTypes = [
  "daily_target_warning",
  "free_site_visit",
  "cash_critical",
  "job_over_duration",
  "invoice_overdue",
  "weekly_target_missed",
  "close_rate_low",
  "lead_cost_high",
  "pipeline_low",
  "monthly_target_missed",
  "phase_stuck"
] as const;
export type KpiAlertType = typeof kpiAlertTypes[number];

export const kpiAlertSeverities = ["info", "warning", "critical"] as const;
export type KpiAlertSeverity = typeof kpiAlertSeverities[number];

// Team configurations for targets
export const teamConfigs = ["1P+1A", "2P+2A", "3P+2A"] as const;
export type TeamConfig = typeof teamConfigs[number];

// KPI Daily Snapshots - per tradesman per day
export const kpiDailySnapshots = pgTable("kpi_daily_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staffProfiles.id),
  snapshotDate: date("snapshot_date").notNull(),
  laborRevenue: decimal("labor_revenue", { precision: 12, scale: 2 }).default("0"),
  hoursLogged: decimal("hours_logged", { precision: 6, scale: 2 }).default("0"),
  jobsCompleted: integer("jobs_completed").default(0),
  quotesAndSentValue: decimal("quotes_sent_value", { precision: 12, scale: 2 }).default("0"),
  quotesSentCount: integer("quotes_sent_count").default(0),
  quotesAcceptedValue: decimal("quotes_accepted_value", { precision: 12, scale: 2 }).default("0"),
  quotesAcceptedCount: integer("quotes_accepted_count").default(0),
  targetLabor: decimal("target_labor", { precision: 10, scale: 2 }).default("2000"),
  targetMet: boolean("target_met").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kpi_daily_staff").on(table.staffId),
  index("idx_kpi_daily_date").on(table.snapshotDate),
]);

// KPI Weekly Snapshots - per tradesman per week
export const kpiWeeklySnapshots = pgTable("kpi_weekly_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staffProfiles.id),
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull(),
  laborRevenue: decimal("labor_revenue", { precision: 12, scale: 2 }).default("0"),
  hoursLogged: decimal("hours_logged", { precision: 8, scale: 2 }).default("0"),
  jobsCompleted: integer("jobs_completed").default(0),
  quotesSentValue: decimal("quotes_sent_value", { precision: 12, scale: 2 }).default("0"),
  closeRate: decimal("close_rate", { precision: 5, scale: 2 }).default("0"),
  targetLabor: decimal("target_labor", { precision: 10, scale: 2 }).default("10000"),
  targetMet: boolean("target_met").default(false),
  daysTargetMet: integer("days_target_met").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kpi_weekly_staff").on(table.staffId),
  index("idx_kpi_weekly_dates").on(table.weekStart, table.weekEnd),
]);

// KPI Monthly Snapshots - company-wide or per staff
export const kpiMonthlySnapshots = pgTable("kpi_monthly_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").references(() => staffProfiles.id), // nullable for company-wide
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM format
  laborRevenue: decimal("labor_revenue", { precision: 14, scale: 2 }).default("0"),
  materialsRevenue: decimal("materials_revenue", { precision: 14, scale: 2 }).default("0"),
  totalRevenue: decimal("total_revenue", { precision: 14, scale: 2 }).default("0"),
  totalCosts: decimal("total_costs", { precision: 14, scale: 2 }).default("0"),
  netProfit: decimal("net_profit", { precision: 14, scale: 2 }).default("0"),
  targetRevenue: decimal("target_revenue", { precision: 14, scale: 2 }),
  targetProfit: decimal("target_profit", { precision: 14, scale: 2 }),
  varianceRevenue: decimal("variance_revenue", { precision: 14, scale: 2 }).default("0"),
  varianceProfit: decimal("variance_profit", { precision: 14, scale: 2 }).default("0"),
  jobsCompleted: integer("jobs_completed").default(0),
  jobsStarted: integer("jobs_started").default(0),
  averageCloseRate: decimal("average_close_rate", { precision: 5, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kpi_monthly_staff").on(table.staffId),
  index("idx_kpi_monthly_month").on(table.month),
]);

// KPI Targets - team configuration targets
export const kpiTargets = pgTable("kpi_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamConfig: varchar("team_config", { length: 20 }).notNull(),
  dailyLaborTarget: decimal("daily_labor_target", { precision: 10, scale: 2 }).default("2000"),
  weeklyLaborTarget: decimal("weekly_labor_target", { precision: 10, scale: 2 }).default("10000"),
  monthlyRevenueTarget: decimal("monthly_revenue_target", { precision: 14, scale: 2 }),
  monthlyProfitTarget: decimal("monthly_profit_target", { precision: 14, scale: 2 }),
  closeRateTarget: decimal("close_rate_target", { precision: 5, scale: 2 }).default("70"),
  isActive: boolean("is_active").default(true),
  effectiveFrom: date("effective_from").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kpi_targets_config").on(table.teamConfig),
  index("idx_kpi_targets_active").on(table.isActive),
]);

// KPI Alerts Log
export const kpiAlertsLog = pgTable("kpi_alerts_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertType: varchar("alert_type", { length: 50 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull().default("warning"),
  staffId: varchar("staff_id").references(() => staffProfiles.id),
  triggeredAt: timestamp("triggered_at").defaultNow(),
  message: text("message").notNull(),
  data: json("data"),
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedById: varchar("acknowledged_by_id").references(() => staffProfiles.id),
  acknowledgedAt: timestamp("acknowledged_at"),
}, (table) => [
  index("idx_kpi_alerts_type").on(table.alertType),
  index("idx_kpi_alerts_staff").on(table.staffId),
  index("idx_kpi_alerts_ack").on(table.acknowledged),
]);

// Tradesman Bonus Periods
export const tradesmanBonusPeriods = pgTable("tradesman_bonus_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staffProfiles.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  closedSalesLaborValue: decimal("closed_sales_labor_value", { precision: 12, scale: 2 }).default("0"),
  salesPhase: integer("sales_phase").default(1),
  bonusTier: varchar("bonus_tier", { length: 50 }),
  bonusAmount: decimal("bonus_amount", { precision: 10, scale: 2 }).default("0"),
  approvedById: varchar("approved_by_id").references(() => staffProfiles.id),
  approvedAt: timestamp("approved_at"),
  paid: boolean("paid").default(false),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_bonus_staff").on(table.staffId),
  index("idx_bonus_period").on(table.periodStart, table.periodEnd),
]);

// Phase Progression Checklist
export const phaseProgressionChecklist = pgTable("phase_progression_checklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staffProfiles.id),
  fromPhase: integer("from_phase").notNull(),
  toPhase: integer("to_phase").notNull(),
  checklistItem: varchar("checklist_item", { length: 255 }).notNull(),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  verifiedById: varchar("verified_by_id").references(() => staffProfiles.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_phase_checklist_staff").on(table.staffId),
  index("idx_phase_checklist_phases").on(table.fromPhase, table.toPhase),
]);

// User Phase Log - history of phase changes
export const userPhaseLog = pgTable("user_phase_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staffProfiles.id),
  previousPhase: integer("previous_phase").notNull(),
  newPhase: integer("new_phase").notNull(),
  changedById: varchar("changed_by_id").references(() => staffProfiles.id),
  changedAt: timestamp("changed_at").defaultNow(),
  notes: text("notes"),
}, (table) => [
  index("idx_phase_log_staff").on(table.staffId),
]);

// KPI Module Relations
export const kpiDailySnapshotsRelations = relations(kpiDailySnapshots, ({ one }) => ({
  staff: one(staffProfiles, {
    fields: [kpiDailySnapshots.staffId],
    references: [staffProfiles.id],
  }),
}));

export const kpiWeeklySnapshotsRelations = relations(kpiWeeklySnapshots, ({ one }) => ({
  staff: one(staffProfiles, {
    fields: [kpiWeeklySnapshots.staffId],
    references: [staffProfiles.id],
  }),
}));

export const kpiMonthlySnapshotsRelations = relations(kpiMonthlySnapshots, ({ one }) => ({
  staff: one(staffProfiles, {
    fields: [kpiMonthlySnapshots.staffId],
    references: [staffProfiles.id],
  }),
}));

export const kpiAlertsLogRelations = relations(kpiAlertsLog, ({ one }) => ({
  staff: one(staffProfiles, {
    fields: [kpiAlertsLog.staffId],
    references: [staffProfiles.id],
  }),
  acknowledgedBy: one(staffProfiles, {
    fields: [kpiAlertsLog.acknowledgedById],
    references: [staffProfiles.id],
  }),
}));

export const tradesmanBonusPeriodsRelations = relations(tradesmanBonusPeriods, ({ one }) => ({
  staff: one(staffProfiles, {
    fields: [tradesmanBonusPeriods.staffId],
    references: [staffProfiles.id],
  }),
  approvedBy: one(staffProfiles, {
    fields: [tradesmanBonusPeriods.approvedById],
    references: [staffProfiles.id],
  }),
}));

export const phaseProgressionChecklistRelations = relations(phaseProgressionChecklist, ({ one }) => ({
  staff: one(staffProfiles, {
    fields: [phaseProgressionChecklist.staffId],
    references: [staffProfiles.id],
  }),
  verifiedBy: one(staffProfiles, {
    fields: [phaseProgressionChecklist.verifiedById],
    references: [staffProfiles.id],
  }),
}));

export const userPhaseLogRelations = relations(userPhaseLog, ({ one }) => ({
  staff: one(staffProfiles, {
    fields: [userPhaseLog.staffId],
    references: [staffProfiles.id],
  }),
  changedBy: one(staffProfiles, {
    fields: [userPhaseLog.changedById],
    references: [staffProfiles.id],
  }),
}));

// KPI Module Insert Schemas
export const insertKpiDailySnapshotSchema = createInsertSchema(kpiDailySnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertKpiWeeklySnapshotSchema = createInsertSchema(kpiWeeklySnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertKpiMonthlySnapshotSchema = createInsertSchema(kpiMonthlySnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertKpiTargetSchema = createInsertSchema(kpiTargets).omit({
  id: true,
  createdAt: true,
});

export const insertKpiAlertSchema = createInsertSchema(kpiAlertsLog).omit({
  id: true,
});

export const insertBonusPeriodSchema = createInsertSchema(tradesmanBonusPeriods).omit({
  id: true,
  createdAt: true,
});

export const insertPhaseChecklistSchema = createInsertSchema(phaseProgressionChecklist).omit({
  id: true,
  createdAt: true,
});

export const insertPhaseLogSchema = createInsertSchema(userPhaseLog).omit({
  id: true,
});

// KPI Module Types
export type KpiDailySnapshot = typeof kpiDailySnapshots.$inferSelect;
export type InsertKpiDailySnapshot = z.infer<typeof insertKpiDailySnapshotSchema>;

export type KpiWeeklySnapshot = typeof kpiWeeklySnapshots.$inferSelect;
export type InsertKpiWeeklySnapshot = z.infer<typeof insertKpiWeeklySnapshotSchema>;

export type KpiMonthlySnapshot = typeof kpiMonthlySnapshots.$inferSelect;
export type InsertKpiMonthlySnapshot = z.infer<typeof insertKpiMonthlySnapshotSchema>;

export type KpiTarget = typeof kpiTargets.$inferSelect;
export type InsertKpiTarget = z.infer<typeof insertKpiTargetSchema>;

export type KpiAlert = typeof kpiAlertsLog.$inferSelect;
export type InsertKpiAlert = z.infer<typeof insertKpiAlertSchema>;

export type TradesmanBonusPeriod = typeof tradesmanBonusPeriods.$inferSelect;
export type InsertBonusPeriod = z.infer<typeof insertBonusPeriodSchema>;

export type PhaseProgressionChecklistItem = typeof phaseProgressionChecklist.$inferSelect;
export type InsertPhaseChecklistItem = z.infer<typeof insertPhaseChecklistSchema>;

export type UserPhaseLogEntry = typeof userPhaseLog.$inferSelect;
export type InsertPhaseLogEntry = z.infer<typeof insertPhaseLogSchema>;

// KPI Dashboard Types
export type KpiDashboardDaily = {
  staffId: string;
  staffName: string;
  laborRevenue: number;
  hoursLogged: number;
  jobsCompleted: number;
  quotesSentValue: number;
  targetLabor: number;
  targetMet: boolean;
  status: "green" | "amber" | "red";
};

export type KpiDashboardWeekly = {
  staffId: string;
  staffName: string;
  laborRevenue: number;
  quotesSentValue: number;
  closeRate: number;
  daysTargetMet: number;
  targetLabor: number;
  targetMet: boolean;
};

export type KpiDashboardMonthly = {
  totalRevenue: number;
  laborRevenue: number;
  netProfit: number;
  targetRevenue: number;
  targetProfit: number;
  varianceRevenue: number;
  varianceProfit: number;
  jobsCompleted: number;
  staffHittingKpis: number;
  totalStaff: number;
};

export type TradesmanKpiSummary = {
  staffId: string;
  staffName: string;
  salesPhase: number;
  weeksAtPhase: number;
  dailyLabor: number;
  dailyTarget: number;
  weeklyLabor: number;
  weeklyTarget: number;
  closeRate: number;
  streakDays: number;
  projectedBonus: number;
};

// =====================
// CLIENT PORTAL SYSTEM
// =====================

// Client types
export const clientTypes = ["residential", "commercial", "property_manager", "builder", "other"] as const;
export type ClientType = typeof clientTypes[number];

// Milestone statuses
export const milestoneStatuses = ["pending", "in_progress", "completed", "cancelled"] as const;
export type MilestoneStatus = typeof milestoneStatuses[number];

// Milestone payment statuses
export const milestonePaymentStatuses = ["pending", "requested", "approved", "paid", "overdue"] as const;
export type MilestonePaymentStatus = typeof milestonePaymentStatuses[number];

// Clients table - full contact and address details
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  // Contact details
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  mobilePhone: varchar("mobile_phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  clientType: varchar("client_type", { length: 50 }).default("residential"),
  // Address
  streetAddress: varchar("street_address", { length: 255 }),
  streetAddress2: varchar("street_address_2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }).default("Australia"),
  // Portal access
  portalEnabled: boolean("portal_enabled").default(false),
  // Notes
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_clients_org").on(table.organizationId),
  index("idx_clients_email").on(table.email),
  index("idx_clients_phone").on(table.phone),
  index("idx_clients_name").on(table.lastName, table.firstName),
]);

// Client portal accounts - separate authentication for clients
export const clientPortalAccounts = pgTable("client_portal_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  isVerified: boolean("is_verified").default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_portal_client").on(table.clientId),
  index("idx_client_portal_email").on(table.email),
]);

// Client portal verification codes
export const clientPortalVerificationCodes = pgTable("client_portal_verification_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalAccountId: varchar("portal_account_id").references(() => clientPortalAccounts.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }),
  code: varchar("code", { length: 10 }).notNull(),
  purpose: varchar("purpose", { length: 20 }).notNull().default("login"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_client_verify_account").on(table.portalAccountId),
  index("idx_client_verify_email").on(table.email),
]);

// Client portal sessions - for token validation and revocation
export const clientPortalSessions = pgTable("client_portal_sessions", {
  id: varchar("id").primaryKey(), // Session ID from token
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  portalAccountId: varchar("portal_account_id").notNull().references(() => clientPortalAccounts.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_portal_session_client").on(table.clientId),
  index("idx_portal_session_expires").on(table.expiresAt),
]);

// Job milestones - based on scope of works from invoices
export const jobMilestones = pgTable("job_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  // Milestone details
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  // Scheduling
  scheduledStartDate: date("scheduled_start_date"),
  scheduledEndDate: date("scheduled_end_date"),
  estimatedDays: integer("estimated_days"),
  // Progress
  status: varchar("status", { length: 50 }).default("pending"),
  progressPercent: integer("progress_percent").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  completedById: varchar("completed_by_id").references(() => staffProfiles.id),
  // Payment requirement
  requiresPayment: boolean("requires_payment").default(false),
  paymentAmount: decimal("payment_amount", { precision: 12, scale: 2 }),
  paymentPercentage: decimal("payment_percentage", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_milestones_job").on(table.jobId),
  index("idx_milestones_invoice").on(table.invoiceId),
  index("idx_milestones_status").on(table.status),
  index("idx_milestones_sort").on(table.sortOrder),
]);

// Milestone payments - progress payment tracking
export const milestonePayments = pgTable("milestone_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  milestoneId: varchar("milestone_id").notNull().references(() => jobMilestones.id, { onDelete: "cascade" }),
  // Payment details
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  // Request/approval tracking
  requestedAt: timestamp("requested_at"),
  requestedById: varchar("requested_by_id").references(() => staffProfiles.id),
  approvedAt: timestamp("approved_at"),
  approvedByClientAt: timestamp("approved_by_client_at"),
  paidAt: timestamp("paid_at"),
  // Payment reference
  paymentMethod: varchar("payment_method", { length: 100 }),
  paymentReference: varchar("payment_reference", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_milestone_payments_milestone").on(table.milestoneId),
  index("idx_milestone_payments_status").on(table.status),
]);

// Milestone media - photos and notes from tradesmen
export const milestoneMedia = pgTable("milestone_media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  milestoneId: varchar("milestone_id").notNull().references(() => jobMilestones.id, { onDelete: "cascade" }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  scheduleEntryId: varchar("schedule_entry_id").references(() => scheduleEntries.id, { onDelete: "set null" }),
  uploadedById: varchar("uploaded_by_id").references(() => staffProfiles.id),
  // Media type and content
  mediaType: varchar("media_type", { length: 20 }).notNull().default("photo"),
  // Photo fields
  filename: varchar("filename", { length: 255 }),
  url: varchar("url", { length: 1000 }),
  thumbnailUrl: varchar("thumbnail_url", { length: 1000 }),
  caption: varchar("caption", { length: 500 }),
  // Note fields
  noteContent: text("note_content"),
  // Date of work
  workDate: date("work_date"),
  // Client visibility
  visibleToClient: boolean("visible_to_client").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_milestone_media_milestone").on(table.milestoneId),
  index("idx_milestone_media_job").on(table.jobId),
  index("idx_milestone_media_date").on(table.workDate),
  index("idx_milestone_media_type").on(table.mediaType),
]);

// Client Portal Relations
export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clients.organizationId],
    references: [organizations.id],
  }),
  portalAccount: one(clientPortalAccounts, {
    fields: [clients.id],
    references: [clientPortalAccounts.clientId],
  }),
}));

export const clientPortalAccountsRelations = relations(clientPortalAccounts, ({ one, many }) => ({
  client: one(clients, {
    fields: [clientPortalAccounts.clientId],
    references: [clients.id],
  }),
  verificationCodes: many(clientPortalVerificationCodes),
}));

export const clientPortalVerificationCodesRelations = relations(clientPortalVerificationCodes, ({ one }) => ({
  portalAccount: one(clientPortalAccounts, {
    fields: [clientPortalVerificationCodes.portalAccountId],
    references: [clientPortalAccounts.id],
  }),
}));

export const jobMilestonesRelations = relations(jobMilestones, ({ one, many }) => ({
  job: one(jobs, {
    fields: [jobMilestones.jobId],
    references: [jobs.id],
  }),
  invoice: one(invoices, {
    fields: [jobMilestones.invoiceId],
    references: [invoices.id],
  }),
  completedBy: one(staffProfiles, {
    fields: [jobMilestones.completedById],
    references: [staffProfiles.id],
  }),
  payments: many(milestonePayments),
  media: many(milestoneMedia),
}));

export const milestonePaymentsRelations = relations(milestonePayments, ({ one }) => ({
  milestone: one(jobMilestones, {
    fields: [milestonePayments.milestoneId],
    references: [jobMilestones.id],
  }),
  requestedBy: one(staffProfiles, {
    fields: [milestonePayments.requestedById],
    references: [staffProfiles.id],
  }),
}));

export const milestoneMediaRelations = relations(milestoneMedia, ({ one }) => ({
  milestone: one(jobMilestones, {
    fields: [milestoneMedia.milestoneId],
    references: [jobMilestones.id],
  }),
  job: one(jobs, {
    fields: [milestoneMedia.jobId],
    references: [jobs.id],
  }),
  scheduleEntry: one(scheduleEntries, {
    fields: [milestoneMedia.scheduleEntryId],
    references: [scheduleEntries.id],
  }),
  uploadedBy: one(staffProfiles, {
    fields: [milestoneMedia.uploadedById],
    references: [staffProfiles.id],
  }),
}));

// Client Portal Insert Schemas
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
});

export const insertClientPortalAccountSchema = createInsertSchema(clientPortalAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
}).extend({
  clientId: z.string().min(1, "Client is required"),
  email: z.string().email("Valid email is required"),
});

export const insertJobMilestoneSchema = createInsertSchema(jobMilestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
  completedById: true,
}).extend({
  jobId: z.string().min(1, "Job is required"),
  title: z.string().min(1, "Title is required"),
  status: z.enum(milestoneStatuses).optional(),
});

export const insertMilestonePaymentSchema = createInsertSchema(milestonePayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  milestoneId: z.string().min(1, "Milestone is required"),
  amount: z.string().min(1, "Amount is required"),
  status: z.enum(milestonePaymentStatuses).optional(),
});

export const insertMilestoneMediaSchema = createInsertSchema(milestoneMedia).omit({
  id: true,
  createdAt: true,
}).extend({
  milestoneId: z.string().min(1, "Milestone is required"),
  jobId: z.string().min(1, "Job is required"),
  mediaType: z.enum(["photo", "note"]),
});

// Client Portal Types
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type ClientPortalAccount = typeof clientPortalAccounts.$inferSelect;
export type InsertClientPortalAccount = z.infer<typeof insertClientPortalAccountSchema>;

export type ClientPortalVerificationCode = typeof clientPortalVerificationCodes.$inferSelect;

export type JobMilestone = typeof jobMilestones.$inferSelect;
export type InsertJobMilestone = z.infer<typeof insertJobMilestoneSchema>;

export type MilestonePayment = typeof milestonePayments.$inferSelect;
export type InsertMilestonePayment = z.infer<typeof insertMilestonePaymentSchema>;

export type MilestoneMedia = typeof milestoneMedia.$inferSelect;
export type InsertMilestoneMedia = z.infer<typeof insertMilestoneMediaSchema>;

// Client Portal Helper Types
export type ClientWithPortal = Client & {
  portalAccount?: ClientPortalAccount;
};

export type JobMilestoneWithDetails = JobMilestone & {
  payments: MilestonePayment[];
  media: MilestoneMedia[];
};

export type ClientJobView = {
  jobId: string;
  jobTitle: string;
  jobStatus: string;
  milestones: JobMilestoneWithDetails[];
  totalAmount: number;
  paidAmount: number;
  pendingPayments: number;
  progressPercent: number;
  nextMilestone?: JobMilestone;
  hasScheduledDates: boolean;
};

export type ClientPortalDashboard = {
  client: Client;
  activeJobs: ClientJobView[];
  upcomingPayments: MilestonePayment[];
  recentMedia: MilestoneMedia[];
};
