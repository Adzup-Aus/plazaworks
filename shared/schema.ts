import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, date, index } from "drizzle-orm/pg-core";
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
