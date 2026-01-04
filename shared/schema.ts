import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, date, index, integer, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

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

// Staff profiles - extends auth users with role info
export const staffProfiles = pgTable("staff_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  roles: text("roles").array().notNull().default(sql`ARRAY['plumber']::text[]`),
  employmentType: varchar("employment_type", { length: 20 }).notNull().default("permanent"),
  permissions: text("permissions").array().notNull().default(sql`ARRAY[]::text[]`),
  phone: varchar("phone", { length: 20 }),
  skills: text("skills").array().default(sql`ARRAY[]::text[]`),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_staff_user_id").on(table.userId),
  index("idx_staff_active").on(table.isActive),
]);

// Jobs table
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  clientEmail: varchar("client_email", { length: 255 }),
  clientPhone: varchar("client_phone", { length: 50 }),
  address: text("address").notNull(),
  jobType: varchar("job_type", { length: 50 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  priority: varchar("priority", { length: 20 }).default("normal"),
  estimatedDuration: varchar("estimated_duration", { length: 50 }),
  notes: text("notes"),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_jobs_status").on(table.status),
  index("idx_jobs_type").on(table.jobType),
  index("idx_jobs_created").on(table.createdAt),
]);

// Schedule entries - assigns staff to jobs on specific dates
export const scheduleEntries = pgTable("schedule_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").notNull(),
  scheduledDate: date("scheduled_date").notNull(),
  startTime: varchar("start_time", { length: 10 }),
  endTime: varchar("end_time", { length: 10 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
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
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  assignedToId: varchar("assigned_to_id"),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at"),
  completedById: varchar("completed_by_id"),
  sortOrder: varchar("sort_order", { length: 10 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_pc_items_job").on(table.jobId),
  index("idx_pc_items_status").on(table.status),
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
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_client_tokens_job").on(table.jobId),
  index("idx_client_tokens_token").on(table.token),
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

// Quote statuses
export const quoteStatuses = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired"
] as const;

export type QuoteStatus = typeof quoteStatuses[number];

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
  quoteNumber: varchar("quote_number", { length: 50 }).notNull().unique(),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  clientEmail: varchar("client_email", { length: 255 }),
  clientPhone: varchar("client_phone", { length: 50 }),
  clientAddress: text("client_address").notNull(),
  jobType: varchar("job_type", { length: 50 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("10"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
  validUntil: date("valid_until"),
  notes: text("notes"),
  termsAndConditions: text("terms_and_conditions"),
  convertedToJobId: varchar("converted_to_job_id"),
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
]);

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: "set null" }),
  quoteId: varchar("quote_id").references(() => quotes.id, { onDelete: "set null" }),
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
]);

// Line items - shared between quotes and invoices
export const lineItems = pgTable("line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").references(() => quotes.id, { onDelete: "cascade" }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_line_items_quote").on(table.quoteId),
  index("idx_line_items_invoice").on(table.invoiceId),
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
  convertedJob: one(jobs, {
    fields: [quotes.convertedToJobId],
    references: [jobs.id],
  }),
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
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
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
}).extend({
  clientName: z.string().min(1, "Client name is required"),
  clientAddress: z.string().min(1, "Address is required"),
  jobType: z.enum(jobTypes),
  status: z.enum(quoteStatuses).optional(),
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
  description: z.string().min(1, "Description is required"),
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

// Phase 3 Types
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type LineItem = typeof lineItems.$inferSelect;
export type InsertLineItem = z.infer<typeof insertLineItemSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

// Helper types
export type QuoteWithLineItems = Quote & {
  lineItems: LineItem[];
};

export type InvoiceWithDetails = Invoice & {
  lineItems: LineItem[];
  payments: Payment[];
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
