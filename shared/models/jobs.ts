import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobNumber: varchar("job_number", { length: 50 }),
  jobName: varchar("job_name", { length: 255 }),
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
  quoteId: varchar("quote_id"),
  invoiceId: varchar("invoice_id"),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_jobs_status").on(table.status),
  index("idx_jobs_type").on(table.jobType),
  index("idx_jobs_created").on(table.createdAt),
  index("idx_jobs_number").on(table.jobNumber),
  index("idx_jobs_ref").on(table.referenceNumber),
]);

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

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
