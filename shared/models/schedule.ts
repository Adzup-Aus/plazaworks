import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, date, decimal, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { jobs } from "./jobs";
import { activities } from "./activities";

export const scheduleEntryStatuses = ["scheduled", "completed", "cancelled"] as const;
export type ScheduleEntryStatus = typeof scheduleEntryStatuses[number];

export const scheduleEntries = pgTable(
  "schedule_entries",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    jobId: varchar("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    activityId: varchar("activity_id").references(() => activities.id, { onDelete: "cascade" }),
    staffId: varchar("staff_id").notNull(),
    scheduledDate: date("scheduled_date").notNull(),
    startTime: varchar("start_time", { length: 10 }),
    endTime: varchar("end_time", { length: 10 }),
    durationHours: decimal("duration_hours", { precision: 4, scale: 2 }).default("7.5"),
    status: varchar("status", { length: 20 }).default("scheduled"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_schedule_job").on(table.jobId),
    index("idx_schedule_activity").on(table.activityId),
    index("idx_schedule_staff").on(table.staffId),
    index("idx_schedule_date").on(table.scheduledDate),
  ]
);

export const scheduleEntriesRelations = relations(scheduleEntries, ({ one }) => ({
  job: one(jobs, {
    fields: [scheduleEntries.jobId],
    references: [jobs.id],
  }),
  activity: one(activities, {
    fields: [scheduleEntries.activityId],
    references: [activities.id],
  }),
}));

const baseInsertSchema = createInsertSchema(scheduleEntries).omit({
  id: true,
  createdAt: true,
});

export const insertScheduleEntrySchema = baseInsertSchema.refine(
  (data) => {
    const hasJob = data.jobId != null && String(data.jobId).trim() !== "";
    const hasActivity = data.activityId != null && String(data.activityId).trim() !== "";
    return hasJob !== hasActivity;
  },
  { message: "Exactly one of jobId or activityId must be set", path: ["jobId"] }
);

/** For PATCH: partial fields, no one-of refinement */
export const patchScheduleEntrySchema = baseInsertSchema.partial();

export type ScheduleEntry = typeof scheduleEntries.$inferSelect;
export type InsertScheduleEntry = z.infer<typeof insertScheduleEntrySchema>;
