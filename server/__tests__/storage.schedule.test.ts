import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { IStorage } from "../storage";

const hasDb = !!process.env.DATABASE_URL;
let storage: IStorage;

describe.runIf(hasDb)("storage (schedule)", () => {
  beforeAll(async () => {
    const m = await import("../storage");
    storage = m.storage;
  });

  const createdOrgIds: string[] = [];
  const createdJobIds: string[] = [];
  const createdStaffIds: string[] = [];
  const createdEntryIds: string[] = [];

  afterEach(async () => {
    for (const id of createdEntryIds) {
      await storage.deleteScheduleEntry(id);
    }
    createdEntryIds.length = 0;
    for (const id of createdJobIds) {
      await storage.deleteJob(id);
    }
    createdJobIds.length = 0;
    for (const id of createdStaffIds) {
      await storage.deleteStaffProfile(id);
    }
    createdStaffIds.length = 0;
    for (const id of createdOrgIds) {
      await storage.deleteOrganization(id);
    }
    createdOrgIds.length = 0;
  });

  async function createTestOrg() {
    const slug = `org-sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const org = await storage.createOrganization({ name: "Schedule Test Org", slug });
    createdOrgIds.push(org.id);
    return org;
  }

  it("createScheduleEntry returns entry with required fields", async () => {
    const org = await createTestOrg();
    const job = await storage.createJob({
      organizationId: org.id,
      clientName: "Schedule Client",
      address: "456 Schedule Ave",
      jobType: "plumbing",
    });
    createdJobIds.push(job.id);
    const staff = await storage.createStaffProfile({
      userId: `staff-${Date.now()}`,
      organizationId: org.id,
    });
    createdStaffIds.push(staff.id);
    const scheduledDate = "2025-06-01";
    const entry = await storage.createScheduleEntry({
      jobId: job.id,
      staffId: staff.id,
      scheduledDate,
      status: "scheduled",
    });
    createdEntryIds.push(entry.id);
    expect(entry.id).toBeDefined();
    expect(entry.jobId).toBe(job.id);
    expect(entry.staffId).toBe(staff.id);
    expect(entry.scheduledDate).toBe(scheduledDate);
    expect(entry.status).toBe("scheduled");
  });

  it("getScheduleEntry returns entry by id", async () => {
    const org = await createTestOrg();
    const job = await storage.createJob({
      organizationId: org.id,
      clientName: "Get Entry Client",
      address: "111 Get St",
      jobType: "electrical",
    });
    createdJobIds.push(job.id);
    const staff = await storage.createStaffProfile({
      userId: `staff-get-${Date.now()}`,
      organizationId: org.id,
    });
    createdStaffIds.push(staff.id);
    const entry = await storage.createScheduleEntry({
      jobId: job.id,
      staffId: staff.id,
      scheduledDate: "2025-07-01",
      status: "scheduled",
    });
    createdEntryIds.push(entry.id);
    const found = await storage.getScheduleEntry(entry.id);
    expect(found?.id).toBe(entry.id);
    expect(found?.jobId).toBe(job.id);
  });

  it("getScheduleEntry returns undefined for non-existent id", async () => {
    const found = await storage.getScheduleEntry("non-existent-entry-id");
    expect(found).toBeUndefined();
  });

  it("getScheduleEntriesByDateRange returns entries in range", async () => {
    const org = await createTestOrg();
    const job = await storage.createJob({
      organizationId: org.id,
      clientName: "Range Client",
      address: "222 Range St",
      jobType: "carpentry",
    });
    createdJobIds.push(job.id);
    const staff = await storage.createStaffProfile({
      userId: `staff-range-${Date.now()}`,
      organizationId: org.id,
    });
    createdStaffIds.push(staff.id);
    const entry = await storage.createScheduleEntry({
      jobId: job.id,
      staffId: staff.id,
      scheduledDate: "2025-06-15",
      status: "scheduled",
    });
    createdEntryIds.push(entry.id);
    const byRange = await storage.getScheduleEntriesByDateRange("2025-06-01", "2025-06-30");
    expect(byRange.some((e) => e.id === entry.id)).toBe(true);
  });

  it("getScheduleEntriesByJob returns entries for job", async () => {
    const org = await createTestOrg();
    const job = await storage.createJob({
      organizationId: org.id,
      clientName: "By Job Client",
      address: "333 Job St",
      jobType: "general",
    });
    createdJobIds.push(job.id);
    const staff = await storage.createStaffProfile({
      userId: `staff-job-${Date.now()}`,
      organizationId: org.id,
    });
    createdStaffIds.push(staff.id);
    const entry = await storage.createScheduleEntry({
      jobId: job.id,
      staffId: staff.id,
      scheduledDate: "2025-08-01",
      status: "scheduled",
    });
    createdEntryIds.push(entry.id);
    const byJob = await storage.getScheduleEntriesByJob(job.id);
    expect(byJob).toHaveLength(1);
    expect(byJob[0].id).toBe(entry.id);
  });

  it("getScheduleEntriesByStaff returns entries for staff", async () => {
    const org = await createTestOrg();
    const job = await storage.createJob({
      organizationId: org.id,
      clientName: "By Staff Client",
      address: "444 Staff St",
      jobType: "tiling",
    });
    createdJobIds.push(job.id);
    const staff = await storage.createStaffProfile({
      userId: `staff-by-${Date.now()}`,
      organizationId: org.id,
    });
    createdStaffIds.push(staff.id);
    const entry = await storage.createScheduleEntry({
      jobId: job.id,
      staffId: staff.id,
      scheduledDate: "2025-09-01",
      status: "scheduled",
    });
    createdEntryIds.push(entry.id);
    const byStaff = await storage.getScheduleEntriesByStaff(staff.id);
    expect(byStaff.some((e) => e.id === entry.id)).toBe(true);
  });

  it("updateScheduleEntry updates fields", async () => {
    const org = await createTestOrg();
    const job = await storage.createJob({
      organizationId: org.id,
      clientName: "Update Entry Client",
      address: "555 Update St",
      jobType: "plumbing",
    });
    createdJobIds.push(job.id);
    const staff = await storage.createStaffProfile({
      userId: `staff-update-${Date.now()}`,
      organizationId: org.id,
    });
    createdStaffIds.push(staff.id);
    const entry = await storage.createScheduleEntry({
      jobId: job.id,
      staffId: staff.id,
      scheduledDate: "2025-10-01",
      status: "scheduled",
    });
    createdEntryIds.push(entry.id);
    const updated = await storage.updateScheduleEntry(entry.id, { status: "completed" });
    expect(updated?.status).toBe("completed");
  });

  it("deleteScheduleEntry removes entry", async () => {
    const org = await createTestOrg();
    const job = await storage.createJob({
      organizationId: org.id,
      clientName: "Delete Entry Client",
      address: "666 Delete St",
      jobType: "plumbing",
    });
    createdJobIds.push(job.id);
    const staff = await storage.createStaffProfile({
      userId: `staff-del-${Date.now()}`,
      organizationId: org.id,
    });
    createdStaffIds.push(staff.id);
    const entry = await storage.createScheduleEntry({
      jobId: job.id,
      staffId: staff.id,
      scheduledDate: "2025-11-01",
      status: "scheduled",
    });
    const deleted = await storage.deleteScheduleEntry(entry.id);
    expect(deleted).toBe(true);
    createdEntryIds.push(entry.id);
    const afterDelete = await storage.getScheduleEntry(entry.id);
    expect(afterDelete).toBeUndefined();
    createdEntryIds.pop();
  });
});
