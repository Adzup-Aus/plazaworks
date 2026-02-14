/** Re-export jobs schema and types from shared for use by this module. */
export {
  jobs,
  jobsRelations,
  insertJobSchema,
  jobStatuses,
  jobTypes,
  type Job,
  type InsertJob,
  type JobWithSchedule,
} from "@shared/schema";
