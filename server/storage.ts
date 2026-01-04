import {
  type StaffProfile,
  type InsertStaffProfile,
  type Job,
  type InsertJob,
  type ScheduleEntry,
  type InsertScheduleEntry,
  type PCItem,
  type InsertPCItem,
  type Notification,
  type InsertNotification,
  type ClientAccessToken,
  type InsertClientAccessToken,
  staffProfiles,
  jobs,
  scheduleEntries,
  pcItems,
  notifications,
  clientAccessTokens,
  users,
  type User,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import crypto from "crypto";

export interface IStorage {
  // Staff profile operations
  getStaffProfiles(): Promise<(StaffProfile & { user?: User })[]>;
  getStaffProfile(id: string): Promise<StaffProfile | undefined>;
  getStaffProfileByUserId(userId: string): Promise<StaffProfile | undefined>;
  createStaffProfile(profile: InsertStaffProfile): Promise<StaffProfile>;
  updateStaffProfile(id: string, profile: Partial<InsertStaffProfile>): Promise<StaffProfile | undefined>;
  deleteStaffProfile(id: string): Promise<boolean>;

  // Job operations
  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  getJobsByStatus(status: string): Promise<Job[]>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;

  // Schedule operations
  getScheduleEntries(): Promise<ScheduleEntry[]>;
  getScheduleEntry(id: string): Promise<ScheduleEntry | undefined>;
  getScheduleEntriesByJob(jobId: string): Promise<ScheduleEntry[]>;
  getScheduleEntriesByStaff(staffId: string): Promise<ScheduleEntry[]>;
  getScheduleEntriesByDateRange(startDate: string, endDate: string): Promise<ScheduleEntry[]>;
  createScheduleEntry(entry: InsertScheduleEntry): Promise<ScheduleEntry>;
  updateScheduleEntry(id: string, entry: Partial<InsertScheduleEntry>): Promise<ScheduleEntry | undefined>;
  deleteScheduleEntry(id: string): Promise<boolean>;

  // PC Item operations
  getPCItems(jobId: string): Promise<PCItem[]>;
  getPCItem(id: string): Promise<PCItem | undefined>;
  createPCItem(item: InsertPCItem): Promise<PCItem>;
  updatePCItem(id: string, item: Partial<InsertPCItem>): Promise<PCItem | undefined>;
  completePCItem(id: string, completedById: string): Promise<PCItem | undefined>;
  deletePCItem(id: string): Promise<boolean>;

  // Notification operations
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<boolean>;
  deleteNotification(id: string): Promise<boolean>;

  // Client access token operations
  getClientAccessToken(token: string): Promise<ClientAccessToken | undefined>;
  getClientAccessTokensByJob(jobId: string): Promise<ClientAccessToken[]>;
  createClientAccessToken(data: InsertClientAccessToken): Promise<ClientAccessToken>;
  revokeClientAccessToken(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Staff profile operations
  async getStaffProfiles(): Promise<(StaffProfile & { user?: User })[]> {
    const profiles = await db.select().from(staffProfiles).orderBy(desc(staffProfiles.createdAt));
    
    // Fetch associated users
    const profilesWithUsers = await Promise.all(
      profiles.map(async (profile) => {
        const [user] = await db.select().from(users).where(eq(users.id, profile.userId));
        return { ...profile, user };
      })
    );
    
    return profilesWithUsers;
  }

  async getStaffProfile(id: string): Promise<StaffProfile | undefined> {
    const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.id, id));
    return profile;
  }

  async getStaffProfileByUserId(userId: string): Promise<StaffProfile | undefined> {
    const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, userId));
    return profile;
  }

  async createStaffProfile(profile: InsertStaffProfile): Promise<StaffProfile> {
    const [created] = await db.insert(staffProfiles).values(profile).returning();
    return created;
  }

  async updateStaffProfile(id: string, profile: Partial<InsertStaffProfile>): Promise<StaffProfile | undefined> {
    const [updated] = await db
      .update(staffProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(staffProfiles.id, id))
      .returning();
    return updated;
  }

  async deleteStaffProfile(id: string): Promise<boolean> {
    const result = await db.delete(staffProfiles).where(eq(staffProfiles.id, id));
    return true;
  }

  // Job operations
  async getJobs(): Promise<Job[]> {
    return db.select().from(jobs).orderBy(desc(jobs.createdAt));
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async getJobsByStatus(status: string): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.status, status)).orderBy(desc(jobs.createdAt));
  }

  async createJob(job: InsertJob): Promise<Job> {
    const [created] = await db.insert(jobs).values(job).returning();
    return created;
  }

  async updateJob(id: string, job: Partial<InsertJob>): Promise<Job | undefined> {
    const [updated] = await db
      .update(jobs)
      .set({ ...job, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();
    return updated;
  }

  async deleteJob(id: string): Promise<boolean> {
    await db.delete(jobs).where(eq(jobs.id, id));
    return true;
  }

  // Schedule operations
  async getScheduleEntries(): Promise<ScheduleEntry[]> {
    return db.select().from(scheduleEntries).orderBy(scheduleEntries.scheduledDate);
  }

  async getScheduleEntry(id: string): Promise<ScheduleEntry | undefined> {
    const [entry] = await db.select().from(scheduleEntries).where(eq(scheduleEntries.id, id));
    return entry;
  }

  async getScheduleEntriesByJob(jobId: string): Promise<ScheduleEntry[]> {
    return db.select().from(scheduleEntries).where(eq(scheduleEntries.jobId, jobId));
  }

  async getScheduleEntriesByStaff(staffId: string): Promise<ScheduleEntry[]> {
    return db.select().from(scheduleEntries).where(eq(scheduleEntries.staffId, staffId));
  }

  async getScheduleEntriesByDateRange(startDate: string, endDate: string): Promise<ScheduleEntry[]> {
    return db
      .select()
      .from(scheduleEntries)
      .where(
        and(
          gte(scheduleEntries.scheduledDate, startDate),
          lte(scheduleEntries.scheduledDate, endDate)
        )
      )
      .orderBy(scheduleEntries.scheduledDate);
  }

  async createScheduleEntry(entry: InsertScheduleEntry): Promise<ScheduleEntry> {
    const [created] = await db.insert(scheduleEntries).values(entry).returning();
    return created;
  }

  async updateScheduleEntry(id: string, entry: Partial<InsertScheduleEntry>): Promise<ScheduleEntry | undefined> {
    const [updated] = await db
      .update(scheduleEntries)
      .set(entry)
      .where(eq(scheduleEntries.id, id))
      .returning();
    return updated;
  }

  async deleteScheduleEntry(id: string): Promise<boolean> {
    await db.delete(scheduleEntries).where(eq(scheduleEntries.id, id));
    return true;
  }

  // PC Item operations
  async getPCItems(jobId: string): Promise<PCItem[]> {
    return db.select().from(pcItems).where(eq(pcItems.jobId, jobId)).orderBy(pcItems.sortOrder);
  }

  async getPCItem(id: string): Promise<PCItem | undefined> {
    const [item] = await db.select().from(pcItems).where(eq(pcItems.id, id));
    return item;
  }

  async createPCItem(item: InsertPCItem): Promise<PCItem> {
    const [created] = await db.insert(pcItems).values(item).returning();
    return created;
  }

  async updatePCItem(id: string, item: Partial<InsertPCItem>): Promise<PCItem | undefined> {
    const [updated] = await db
      .update(pcItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(pcItems.id, id))
      .returning();
    return updated;
  }

  async completePCItem(id: string, completedById: string): Promise<PCItem | undefined> {
    const [updated] = await db
      .update(pcItems)
      .set({
        status: "completed",
        completedAt: new Date(),
        completedById,
        updatedAt: new Date(),
      })
      .where(eq(pcItems.id, id))
      .returning();
    return updated;
  }

  async deletePCItem(id: string): Promise<boolean> {
    await db.delete(pcItems).where(eq(pcItems.id, id));
    return true;
  }

  // Notification operations
  async getNotifications(userId: string): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result[0]?.count || 0;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<boolean> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
    return true;
  }

  async deleteNotification(id: string): Promise<boolean> {
    await db.delete(notifications).where(eq(notifications.id, id));
    return true;
  }

  // Client access token operations
  async getClientAccessToken(token: string): Promise<ClientAccessToken | undefined> {
    const [accessToken] = await db
      .select()
      .from(clientAccessTokens)
      .where(and(eq(clientAccessTokens.token, token), eq(clientAccessTokens.isActive, true)));
    return accessToken;
  }

  async getClientAccessTokensByJob(jobId: string): Promise<ClientAccessToken[]> {
    return db
      .select()
      .from(clientAccessTokens)
      .where(eq(clientAccessTokens.jobId, jobId))
      .orderBy(desc(clientAccessTokens.createdAt));
  }

  async createClientAccessToken(data: InsertClientAccessToken): Promise<ClientAccessToken> {
    const token = crypto.randomBytes(32).toString("hex");
    const [created] = await db
      .insert(clientAccessTokens)
      .values({ ...data, token })
      .returning();
    return created;
  }

  async revokeClientAccessToken(id: string): Promise<boolean> {
    await db
      .update(clientAccessTokens)
      .set({ isActive: false })
      .where(eq(clientAccessTokens.id, id));
    return true;
  }
}

export const storage = new DatabaseStorage();
