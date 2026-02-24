import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, date, index, integer, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  "view_dashboard",
  "view_jobs",
  "create_jobs",
  "edit_jobs",
  "delete_jobs",
  "view_quotes",
  "create_quotes",
  "edit_quotes",
  "delete_quotes",
  "view_invoices",
  "create_invoices",
  "edit_invoices",
  "delete_invoices",
  "view_schedule",
  "manage_schedule",
  "view_activities",
  "view_users",
  "create_users",
  "edit_users",
  "delete_users",
  "view_clients",
  "create_clients",
  "edit_clients",
  "delete_clients",
  "view_reports",
  "admin_settings",
] as const;
export type UserPermission = typeof userPermissions[number];

/** Permissions that are automatically granted when a higher permission is assigned (e.g. create implies view). */
export const PERMISSION_IMPLICATIONS: Record<UserPermission, UserPermission[]> = {
  view_dashboard: [],
  view_jobs: [],
  create_jobs: ["view_jobs"],
  edit_jobs: ["view_jobs"],
  delete_jobs: ["view_jobs"],
  view_quotes: [],
  create_quotes: ["view_quotes"],
  edit_quotes: ["view_quotes"],
  delete_quotes: ["view_quotes"],
  view_invoices: [],
  create_invoices: ["view_invoices"],
  edit_invoices: ["view_invoices"],
  delete_invoices: ["view_invoices"],
  view_schedule: [],
  manage_schedule: ["view_schedule"],
  view_activities: [],
  view_users: [],
  create_users: ["view_users"],
  edit_users: ["view_users"],
  delete_users: ["view_users"],
  view_clients: [],
  create_clients: ["view_clients"],
  edit_clients: ["view_clients"],
  delete_clients: ["view_clients"],
  view_reports: [],
  admin_settings: [],
};

/** Expand permissions with implied ones (e.g. create_jobs adds view_jobs). */
export function normalizePermissions(permissions: string[]): UserPermission[] {
  const normalized = new Set<UserPermission>();
  for (const p of permissions) {
    if (userPermissions.includes(p as UserPermission)) {
      normalized.add(p as UserPermission);
      const implied = PERMISSION_IMPLICATIONS[p as UserPermission] ?? [];
      implied.forEach((ip) => normalized.add(ip));
    }
  }
  return Array.from(normalized);
}

// Salary types
export const salaryTypes = ["annual", "hourly"] as const;
export type SalaryType = typeof salaryTypes[number];

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
  salaryType: varchar("salary_type", { length: 20 }).default("hourly"),
  salaryAmount: decimal("salary_amount", { precision: 12, scale: 2 }),
  overtimeRateMultiplier: decimal("overtime_rate_multiplier", { precision: 4, scale: 2 }).default("1.5"),
  overtimeThresholdHours: decimal("overtime_threshold_hours", { precision: 5, scale: 2 }).default("38"),
  emailSignature: text("email_signature"),
  timezone: varchar("timezone", { length: 50 }).default("Australia/Brisbane"),
  lunchBreakMinutes: integer("lunch_break_minutes").default(30),
  lunchBreakPaid: boolean("lunch_break_paid").default(false),
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
  index("idx_staff_active").on(table.isActive),
]);

// User working hours - per-day schedule for each staff member
export const userWorkingHours = pgTable("user_working_hours", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  isWorkingDay: boolean("is_working_day").notNull().default(true),
  startTime: varchar("start_time", { length: 10 }).default("07:00"),
  endTime: varchar("end_time", { length: 10 }).default("15:30"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_working_hours_staff").on(table.staffId),
  index("idx_working_hours_day").on(table.dayOfWeek),
]);

export const staffProfilesRelations = relations(staffProfiles, ({ one }) => ({}));
export const userWorkingHoursRelations = relations(userWorkingHours, ({ one }) => ({
  staff: one(staffProfiles, {
    fields: [userWorkingHours.staffId],
    references: [staffProfiles.id],
  }),
}));

export const insertStaffProfileSchema = createInsertSchema(staffProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserWorkingHoursSchema = createInsertSchema(userWorkingHours).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type StaffProfile = typeof staffProfiles.$inferSelect;
export type InsertStaffProfile = z.infer<typeof insertStaffProfileSchema>;
export type UserWorkingHours = typeof userWorkingHours.$inferSelect;
export type InsertUserWorkingHours = z.infer<typeof insertUserWorkingHoursSchema>;
