import { sql, relations } from "drizzle-orm";
import { pgTable, varchar, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organizations } from "./organizations";

export const activities = pgTable(
  "activities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_activities_org").on(table.organizationId),
    index("idx_activities_sort").on(table.sortOrder),
  ]
);

export const activitiesRelations = relations(activities, ({ one }) => ({
  organization: one(organizations),
}));

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
