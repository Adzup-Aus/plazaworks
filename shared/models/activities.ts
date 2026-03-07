import { sql, relations } from "drizzle-orm";
import { pgTable, varchar, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const activities = pgTable(
  "activities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    color: varchar("color", { length: 20 }).default("#6366f1"),
    icon: varchar("icon", { length: 50 }),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_activities_sort").on(table.sortOrder),
  ]
);

export const activitiesRelations = relations(activities, () => ({}));

const insertSchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = insertSchema.refine(
  (data) => data.name != null && String(data.name).trim().length > 0,
  { message: "Name is required and must be non-empty", path: ["name"] }
);

/** For PATCH: partial fields only */
export const patchActivitySchema = insertSchema.partial();

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
