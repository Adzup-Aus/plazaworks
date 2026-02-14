/** Productivity module – schema re-exports from shared for use by this module. */
export {
  jobTimeEntries,
  jobCostEntries,
  staffCapacityRules,
  staffTimeOff,
  insertJobTimeEntrySchema,
  insertJobCostEntrySchema,
  insertStaffCapacityRuleSchema,
  insertStaffTimeOffSchema,
  timeEntryCategories,
  costCategories,
  type JobTimeEntry,
  type InsertJobTimeEntry,
  type JobCostEntry,
  type InsertJobCostEntry,
  type StaffCapacityRule,
  type StaffTimeOff,
} from "@shared/schema";
