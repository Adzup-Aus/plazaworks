import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { IStorage } from "../storage";

const hasDb = !!process.env.DATABASE_URL;
let storage: IStorage;

describe.runIf(hasDb)("storage (jobs)", () => {
  beforeAll(async () => {
    const m = await import("../storage");
    storage = m.storage;
  });

  const createdOrgIds: string[] = [];
  const createdJobIds: string[] = [];

  afterEach(async () => {
    for (const id of createdJobIds) {
      await storage.deleteJob(id);
    }
    createdJobIds.length = 0;
    for (const id of createdOrgIds) {
      await storage.deleteOrganization(id);
    }
    createdOrgIds.length = 0;
  });

  async function createTestOrg() {
    const slug = `org-jobs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const org = await storage.createOrganization({ name: "Jobs Test Org", slug });
    createdOrgIds.push(org.id);
    return org;
  }

  it("createJob returns job with required fields", async () => {
    const org = await createTestOrg();
    const job = await storage.createJob({
      organizationId: org.id,
      clientName: "Test Client",
      address: "123 Test St",
      jobType: "plumbing",
    });
    createdJobIds.push(job.id);
    expect(job.id).toBeDefined();
    expect(job.clientName).toBe("Test Client");
    expect(job.address).toBe("123 Test St");
    expect(job.jobType).toBe("plumbing");
    expect(job.status).toBeDefined();
  });

  it("getJob returns job by id", async () => {
    const org = await createTestOrg();
    const job = await storage.createJob({
      organizationId: org.id,
      clientName: "Get Client",
      address: "456 Get St",
      jobType: "electrical",
    });
    createdJobIds.push(job.id);
    const found = await storage.getJob(job.id);
    expect(found?.id).toBe(job.id);
    expect(found?.clientName).toBe("Get Client");
  });

  it("getJob returns undefined for non-existent id", async () => {
    const found = await storage.getJob("non-existent-id-12345");
    expect(found).toBeUndefined();
  });

  it("getJobs returns all jobs including created one", async () => {
    const org = await createTestOrg();
    const job = await storage.createJob({
      organizationId: org.id,
      clientName: "List Client",
      address: "789 List Ave",
      jobType: "carpentry",
    });
    createdJobIds.push(job.id);
    const allJobs = await storage.getJobs();
    expect(Array.isArray(allJobs)).toBe(true);
    expect(allJobs.some((j) => j.id === job.id)).toBe(true);
  });

  it("getJobsByStatus filters by status", async () => {
    const org = await createTestOrg();
    const job = await storage.createJob({
      organizationId: org.id,
      clientName: "Status Client",
      address: "111 Status St",
      jobType: "plumbing",
      status: "completed",
    });
    createdJobIds.push(job.id);
    const completed = await storage.getJobsByStatus("completed");
    expect(completed.some((j) => j.id === job.id)).toBe(true);
    const pending = await storage.getJobsByStatus("pending");
    expect(pending.some((j) => j.id === job.id)).toBe(false);
  });

  it("updateJob updates fields and returns updated job", async () => {
    const org = await createTestOrg();
    const job = await storage.createJob({
      organizationId: org.id,
      clientName: "Update Client",
      address: "222 Update St",
      jobType: "tiling",
    });
    createdJobIds.push(job.id);
    const updated = await storage.updateJob(job.id, { status: "in_progress", clientName: "Updated Name" });
    expect(updated?.status).toBe("in_progress");
    expect(updated?.clientName).toBe("Updated Name");
    const found = await storage.getJob(job.id);
    expect(found?.status).toBe("in_progress");
  });

  it("updateJob returns undefined for non-existent id", async () => {
    const updated = await storage.updateJob("non-existent-id", { status: "completed" });
    expect(updated).toBeUndefined();
  });

  it("deleteJob removes job and returns true", async () => {
    const org = await createTestOrg();
    const job = await storage.createJob({
      organizationId: org.id,
      clientName: "Delete Client",
      address: "333 Delete St",
      jobType: "general",
    });
    const deleted = await storage.deleteJob(job.id);
    expect(deleted).toBe(true);
    createdJobIds.push(job.id);
    const afterDelete = await storage.getJob(job.id);
    expect(afterDelete).toBeUndefined();
    createdJobIds.pop();
  });

  it("deleteJob returns true for non-existent id (no-op)", async () => {
    const deleted = await storage.deleteJob("non-existent-id");
    expect(deleted).toBe(true);
  });
});
