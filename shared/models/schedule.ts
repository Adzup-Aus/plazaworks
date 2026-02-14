import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, date, decimal, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { jobs } from "./jobs";

export const scheduleEntryStatuses = ["scheduled", "completed", "cancelled"] as const;
export type ScheduleEntryStatus = typeof scheduleEntryStatuses[number];

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

export const scheduleEntriesRelations = relations(scheduleEntries, ({ one }) => ({
  job: one(jobs, {
    fields: [scheduleEntries.jobId],
    references: [jobs.id],
  }),
}));

export const insertScheduleEntrySchema = createInsertSchema(scheduleEntries).omit({
  id: true,
  createdAt: true,
});

export type ScheduleEntry = typeof scheduleEntries.$inferSelect;
export type InsertScheduleEntry = z.infer<typeof insertScheduleEntrySchema>;
