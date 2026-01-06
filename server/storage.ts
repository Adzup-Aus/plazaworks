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
  type Quote,
  type InsertQuote,
  type Invoice,
  type InsertInvoice,
  type LineItem,
  type InsertLineItem,
  type Payment,
  type InsertPayment,
  type QuoteWithLineItems,
  type InvoiceWithDetails,
  type Vehicle,
  type InsertVehicle,
  type VehicleAssignment,
  type InsertVehicleAssignment,
  type VehicleWithAssignment,
  type ChecklistTemplate,
  type InsertChecklistTemplate,
  type ChecklistTemplateItem,
  type InsertChecklistTemplateItem,
  type ChecklistTemplateWithItems,
  type ChecklistRun,
  type InsertChecklistRun,
  type ChecklistRunItem,
  type InsertChecklistRunItem,
  type ChecklistRunWithItems,
  type JobPhoto,
  type InsertJobPhoto,
  type VehicleMaintenance,
  type InsertVehicleMaintenance,
  type JobTimeEntry,
  type InsertJobTimeEntry,
  type JobCostEntry,
  type InsertJobCostEntry,
  type StaffCapacityRule,
  type InsertStaffCapacityRule,
  type StaffTimeOff,
  type InsertStaffTimeOff,
  type StaffProductivityMetrics,
  type JobBackcostingSummary,
  type StaffCapacityView,
  // KPI Module types
  type KpiDailySnapshot,
  type InsertKpiDailySnapshot,
  type KpiWeeklySnapshot,
  type InsertKpiWeeklySnapshot,
  type KpiMonthlySnapshot,
  type InsertKpiMonthlySnapshot,
  type KpiTarget,
  type InsertKpiTarget,
  type KpiAlert,
  type InsertKpiAlert,
  type TradesmanBonusPeriod,
  type InsertBonusPeriod,
  type PhaseProgressionChecklistItem,
  type InsertPhaseChecklistItem,
  type UserPhaseLogEntry,
  type InsertPhaseLogEntry,
  type KpiDashboardDaily,
  type KpiDashboardWeekly,
  type KpiDashboardMonthly,
  type TradesmanKpiSummary,
  type UserWorkingHours,
  type InsertUserWorkingHours,
  // Multi-tenant types
  type Organization,
  type InsertOrganization,
  type OrganizationSubscription,
  type InsertOrganizationSubscription,
  type OrganizationMember,
  type InsertOrganizationMember,
  type AuthIdentity,
  type InsertAuthIdentity,
  type VerificationCode,
  type InsertVerificationCode,
  type OrganizationInvite,
  type InsertOrganizationInvite,
  // Client Portal types
  type Client,
  type InsertClient,
  type ClientPortalAccount,
  type InsertClientPortalAccount,
  type ClientPortalVerificationCode,
  type JobMilestone,
  type InsertJobMilestone,
  type MilestonePayment,
  type InsertMilestonePayment,
  type MilestoneMedia,
  type InsertMilestoneMedia,
  type JobMilestoneWithDetails,
  staffProfiles,
  userWorkingHours,
  jobs,
  scheduleEntries,
  pcItems,
  notifications,
  clientAccessTokens,
  quotes,
  invoices,
  lineItems,
  payments,
  vehicles,
  vehicleAssignments,
  checklistTemplates,
  checklistTemplateItems,
  checklistRuns,
  checklistRunItems,
  jobPhotos,
  vehicleMaintenance,
  jobTimeEntries,
  jobCostEntries,
  staffCapacityRules,
  staffTimeOff,
  // KPI Module tables
  kpiDailySnapshots,
  kpiWeeklySnapshots,
  kpiMonthlySnapshots,
  kpiTargets,
  kpiAlertsLog,
  tradesmanBonusPeriods,
  phaseProgressionChecklist,
  userPhaseLog,
  users,
  type User,
  // Multi-tenant tables
  organizations,
  organizationSubscriptions,
  organizationMembers,
  authIdentities,
  verificationCodes,
  organizationInvites,
  // Client Portal tables
  clients,
  clientPortalAccounts,
  clientPortalVerificationCodes,
  clientPortalSessions,
  jobMilestones,
  milestonePayments,
  milestoneMedia,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, lt, sql, inArray, isNull } from "drizzle-orm";
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

  // Quote operations
  getQuotes(): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  getQuoteWithLineItems(id: string): Promise<QuoteWithLineItems | undefined>;
  getQuotesByStatus(status: string): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote | undefined>;
  sendQuote(id: string): Promise<Quote | undefined>;
  acceptQuote(id: string): Promise<Quote | undefined>;
  rejectQuote(id: string): Promise<Quote | undefined>;
  convertQuoteToJob(id: string): Promise<{ quote: Quote; job: Job } | undefined>;
  deleteQuote(id: string): Promise<boolean>;
  generateQuoteNumber(): Promise<string>;

  // Invoice operations
  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoiceWithDetails(id: string): Promise<InvoiceWithDetails | undefined>;
  getInvoicesByStatus(status: string): Promise<Invoice[]>;
  getInvoicesByJob(jobId: string): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  createInvoiceFromJob(jobId: string, createdById?: string): Promise<Invoice | undefined>;
  createInvoiceFromQuote(quoteId: string, createdById?: string): Promise<Invoice | undefined>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  sendInvoice(id: string): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;
  generateInvoiceNumber(): Promise<string>;

  // Line item operations
  getLineItemsByQuote(quoteId: string): Promise<LineItem[]>;
  getLineItemsByInvoice(invoiceId: string): Promise<LineItem[]>;
  createLineItem(item: InsertLineItem): Promise<LineItem>;
  updateLineItem(id: string, item: Partial<InsertLineItem>): Promise<LineItem | undefined>;
  deleteLineItem(id: string): Promise<boolean>;

  // Payment operations
  getPaymentsByInvoice(invoiceId: string): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  completePayment(id: string): Promise<Payment | undefined>;

  // Vehicle operations
  getVehicles(): Promise<Vehicle[]>;
  getVehicle(id: string): Promise<Vehicle | undefined>;
  getVehicleWithAssignment(id: string): Promise<VehicleWithAssignment | undefined>;
  getVehiclesByStatus(status: string): Promise<Vehicle[]>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: string): Promise<boolean>;

  // Vehicle assignment operations
  getVehicleAssignments(vehicleId: string): Promise<VehicleAssignment[]>;
  getCurrentAssignment(vehicleId: string): Promise<VehicleAssignment | undefined>;
  getAssignmentsByStaff(staffId: string): Promise<VehicleAssignment[]>;
  assignVehicle(assignment: InsertVehicleAssignment): Promise<VehicleAssignment>;
  returnVehicle(assignmentId: string): Promise<VehicleAssignment | undefined>;

  // Checklist template operations
  getChecklistTemplates(): Promise<ChecklistTemplate[]>;
  getChecklistTemplate(id: string): Promise<ChecklistTemplate | undefined>;
  getChecklistTemplateWithItems(id: string): Promise<ChecklistTemplateWithItems | undefined>;
  getChecklistTemplatesByTarget(target: string): Promise<ChecklistTemplate[]>;
  createChecklistTemplate(template: InsertChecklistTemplate): Promise<ChecklistTemplate>;
  updateChecklistTemplate(id: string, template: Partial<InsertChecklistTemplate>): Promise<ChecklistTemplate | undefined>;
  deleteChecklistTemplate(id: string): Promise<boolean>;

  // Checklist template item operations
  getChecklistTemplateItems(templateId: string): Promise<ChecklistTemplateItem[]>;
  createChecklistTemplateItem(item: InsertChecklistTemplateItem): Promise<ChecklistTemplateItem>;
  updateChecklistTemplateItem(id: string, item: Partial<InsertChecklistTemplateItem>): Promise<ChecklistTemplateItem | undefined>;
  deleteChecklistTemplateItem(id: string): Promise<boolean>;

  // Checklist run operations
  getChecklistRuns(filters?: { vehicleId?: string; jobId?: string; completedById?: string }): Promise<ChecklistRun[]>;
  getChecklistRun(id: string): Promise<ChecklistRun | undefined>;
  getChecklistRunWithItems(id: string): Promise<ChecklistRunWithItems | undefined>;
  startChecklistRun(run: InsertChecklistRun): Promise<ChecklistRunWithItems>;
  completeChecklistRun(id: string): Promise<ChecklistRun | undefined>;

  // Checklist run item operations
  getChecklistRunItems(runId: string): Promise<ChecklistRunItem[]>;
  updateChecklistRunItem(id: string, item: Partial<InsertChecklistRunItem>): Promise<ChecklistRunItem | undefined>;

  // Job photo operations
  getJobPhotos(jobId: string): Promise<JobPhoto[]>;
  getJobPhoto(id: string): Promise<JobPhoto | undefined>;
  createJobPhoto(photo: InsertJobPhoto): Promise<JobPhoto>;
  updateJobPhoto(id: string, photo: Partial<InsertJobPhoto>): Promise<JobPhoto | undefined>;
  deleteJobPhoto(id: string): Promise<boolean>;

  // Vehicle maintenance operations
  getVehicleMaintenanceRecords(vehicleId: string): Promise<VehicleMaintenance[]>;
  getVehicleMaintenance(id: string): Promise<VehicleMaintenance | undefined>;
  getScheduledMaintenance(): Promise<VehicleMaintenance[]>;
  createVehicleMaintenance(maintenance: InsertVehicleMaintenance): Promise<VehicleMaintenance>;
  updateVehicleMaintenance(id: string, maintenance: Partial<InsertVehicleMaintenance>): Promise<VehicleMaintenance | undefined>;
  completeVehicleMaintenance(id: string, completedDate: string): Promise<VehicleMaintenance | undefined>;
  deleteVehicleMaintenance(id: string): Promise<boolean>;

  // Phase 5: Time entry operations
  getJobTimeEntries(jobId: string): Promise<JobTimeEntry[]>;
  getTimeEntriesByStaff(staffId: string, dateFrom?: string, dateTo?: string): Promise<JobTimeEntry[]>;
  getTimeEntriesByDateRange(dateFrom: string, dateTo: string): Promise<JobTimeEntry[]>;
  getTimeEntry(id: string): Promise<JobTimeEntry | undefined>;
  createTimeEntry(entry: InsertJobTimeEntry): Promise<JobTimeEntry>;
  updateTimeEntry(id: string, entry: Partial<InsertJobTimeEntry>): Promise<JobTimeEntry | undefined>;
  deleteTimeEntry(id: string): Promise<boolean>;

  // Phase 5: Cost entry operations
  getJobCostEntries(jobId: string): Promise<JobCostEntry[]>;
  getCostEntry(id: string): Promise<JobCostEntry | undefined>;
  createCostEntry(entry: InsertJobCostEntry): Promise<JobCostEntry>;
  updateCostEntry(id: string, entry: Partial<InsertJobCostEntry>): Promise<JobCostEntry | undefined>;
  deleteCostEntry(id: string): Promise<boolean>;

  // Phase 5: Staff capacity operations
  getStaffCapacityRules(): Promise<StaffCapacityRule[]>;
  getStaffCapacityRule(staffId: string): Promise<StaffCapacityRule | undefined>;
  createOrUpdateCapacityRule(rule: InsertStaffCapacityRule): Promise<StaffCapacityRule>;
  deleteCapacityRule(id: string): Promise<boolean>;

  // Phase 5: Time off operations
  getStaffTimeOff(staffId: string): Promise<StaffTimeOff[]>;
  getTimeOffByDateRange(dateFrom: string, dateTo: string): Promise<StaffTimeOff[]>;
  getTimeOffRequest(id: string): Promise<StaffTimeOff | undefined>;
  createTimeOffRequest(request: InsertStaffTimeOff): Promise<StaffTimeOff>;
  approveTimeOff(id: string, approvedById: string): Promise<StaffTimeOff | undefined>;
  rejectTimeOff(id: string, approvedById: string): Promise<StaffTimeOff | undefined>;
  deleteTimeOff(id: string): Promise<boolean>;

  // Phase 5: Analytics & reporting
  getStaffProductivityMetrics(dateFrom?: string, dateTo?: string): Promise<StaffProductivityMetrics[]>;
  getJobBackcostingSummary(jobId: string): Promise<JobBackcostingSummary | undefined>;
  getAllJobBackcosting(): Promise<JobBackcostingSummary[]>;
  getStaffCapacityView(weekStartDate: string): Promise<StaffCapacityView[]>;

  // Staff working hours operations
  getStaffWorkingHours(staffId: string): Promise<UserWorkingHours[]>;
  setStaffWorkingHours(staffId: string, hours: InsertUserWorkingHours[]): Promise<UserWorkingHours[]>;
  getStaffAvailability(staffId: string, date: string): Promise<{ isAvailable: boolean; startTime?: string; endTime?: string }>;

  // Multi-tenant: Organization operations
  getOrganizations(): Promise<Organization[]>;
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  getOwnerOrganization(): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: string): Promise<boolean>;

  // Multi-tenant: Subscription operations
  getOrganizationSubscription(organizationId: string): Promise<OrganizationSubscription | undefined>;
  createOrganizationSubscription(sub: InsertOrganizationSubscription): Promise<OrganizationSubscription>;
  updateOrganizationSubscription(id: string, sub: Partial<InsertOrganizationSubscription>): Promise<OrganizationSubscription | undefined>;

  // Multi-tenant: Member operations
  getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]>;
  getOrganizationMember(organizationId: string, userId: string): Promise<OrganizationMember | undefined>;
  getUserMemberships(userId: string): Promise<OrganizationMember[]>;
  createOrganizationMember(member: InsertOrganizationMember): Promise<OrganizationMember>;
  updateOrganizationMember(id: string, member: Partial<InsertOrganizationMember>): Promise<OrganizationMember | undefined>;
  deleteOrganizationMember(id: string): Promise<boolean>;

  // Multi-tenant: Auth identity operations
  getAuthIdentities(userId: string): Promise<AuthIdentity[]>;
  getAuthIdentityByIdentifier(type: string, identifier: string): Promise<AuthIdentity | undefined>;
  createAuthIdentity(identity: InsertAuthIdentity): Promise<AuthIdentity>;
  updateAuthIdentity(id: string, identity: Partial<InsertAuthIdentity>): Promise<AuthIdentity | undefined>;
  deleteAuthIdentity(id: string): Promise<boolean>;

  // Multi-tenant: Verification code operations
  createVerificationCode(code: InsertVerificationCode): Promise<VerificationCode>;
  getVerificationCode(code: string, email?: string, phone?: string): Promise<VerificationCode | undefined>;
  markVerificationCodeUsed(id: string): Promise<void>;
  cleanupExpiredCodes(): Promise<void>;

  // Multi-tenant: Invite operations
  getOrganizationInvites(organizationId: string): Promise<OrganizationInvite[]>;
  getInviteByCode(code: string): Promise<OrganizationInvite | undefined>;
  createOrganizationInvite(invite: InsertOrganizationInvite): Promise<OrganizationInvite>;
  acceptInvite(id: string, userId: string): Promise<OrganizationInvite | undefined>;
  deleteOrganizationInvite(id: string): Promise<boolean>;

  // Client operations
  getClients(organizationId: string): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getClientByEmail(organizationId: string, email: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;

  // Client portal account operations
  getClientPortalAccount(id: string): Promise<ClientPortalAccount | undefined>;
  getClientPortalAccountByEmail(email: string): Promise<ClientPortalAccount | undefined>;
  getClientPortalAccountByClientId(clientId: string): Promise<ClientPortalAccount | undefined>;
  createClientPortalAccount(account: InsertClientPortalAccount): Promise<ClientPortalAccount>;
  updateClientPortalAccount(id: string, account: Partial<InsertClientPortalAccount>): Promise<ClientPortalAccount | undefined>;
  deleteClientPortalAccount(id: string): Promise<boolean>;

  // Client portal verification operations
  createClientPortalVerificationCode(portalAccountId: string | null, email: string, purpose: string): Promise<ClientPortalVerificationCode>;
  verifyClientPortalCode(email: string, code: string, purpose: string): Promise<ClientPortalVerificationCode | undefined>;

  // Client portal session operations
  createPortalSession(id: string, clientId: string, portalAccountId: string, expiresAt: Date, userAgent?: string, ipAddress?: string): Promise<void>;
  getPortalSession(id: string): Promise<{ clientId: string; expiresAt: Date; revokedAt: Date | null } | undefined>;
  revokePortalSession(id: string): Promise<void>;
  revokeAllPortalSessions(clientId: string): Promise<void>;
  cleanupExpiredPortalSessions(): Promise<void>;

  // Job milestone operations
  getJobMilestones(jobId: string): Promise<JobMilestone[]>;
  getMilestone(id: string): Promise<JobMilestone | undefined>;
  getMilestoneWithDetails(id: string): Promise<JobMilestoneWithDetails | undefined>;
  createMilestone(milestone: InsertJobMilestone): Promise<JobMilestone>;
  updateMilestone(id: string, milestone: Partial<InsertJobMilestone>): Promise<JobMilestone | undefined>;
  completeMilestone(id: string, completedById: string): Promise<JobMilestone | undefined>;
  deleteMilestone(id: string): Promise<boolean>;

  // Milestone payment operations
  getMilestonePayments(milestoneId: string): Promise<MilestonePayment[]>;
  getMilestonePayment(id: string): Promise<MilestonePayment | undefined>;
  getPendingPaymentsByJob(jobId: string): Promise<MilestonePayment[]>;
  createMilestonePayment(payment: InsertMilestonePayment): Promise<MilestonePayment>;
  updateMilestonePayment(id: string, payment: Partial<InsertMilestonePayment>): Promise<MilestonePayment | undefined>;
  approveMilestonePayment(id: string): Promise<MilestonePayment | undefined>;
  recordMilestonePaymentPaid(id: string, paymentMethod: string, paymentReference?: string): Promise<MilestonePayment | undefined>;

  // Milestone media operations
  getMilestoneMedia(milestoneId: string): Promise<MilestoneMedia[]>;
  getJobMedia(jobId: string): Promise<MilestoneMedia[]>;
  getMediaByDate(jobId: string, workDate: string): Promise<MilestoneMedia[]>;
  createMilestoneMedia(media: InsertMilestoneMedia): Promise<MilestoneMedia>;
  updateMilestoneMedia(id: string, media: Partial<InsertMilestoneMedia>): Promise<MilestoneMedia | undefined>;
  deleteMilestoneMedia(id: string): Promise<boolean>;

  // Client portal specific operations
  getClientJobsForPortal(clientId: string): Promise<Job[]>;
  getJobMilestonesForPortal(jobId: string): Promise<JobMilestoneWithDetails[]>;
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

  // Quote operations
  async getQuotes(): Promise<Quote[]> {
    return db.select().from(quotes).orderBy(desc(quotes.createdAt));
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote;
  }

  async getQuoteWithLineItems(id: string): Promise<QuoteWithLineItems | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    if (!quote) return undefined;
    const items = await db.select().from(lineItems).where(eq(lineItems.quoteId, id)).orderBy(lineItems.sortOrder);
    return { ...quote, lineItems: items };
  }

  async getQuotesByStatus(status: string): Promise<Quote[]> {
    return db.select().from(quotes).where(eq(quotes.status, status)).orderBy(desc(quotes.createdAt));
  }

  async createQuote(quote: InsertQuote): Promise<Quote> {
    const quoteNumber = await this.generateQuoteNumber();
    const [created] = await db.insert(quotes).values({ ...quote, quoteNumber }).returning();
    return created;
  }

  async updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote | undefined> {
    const [updated] = await db
      .update(quotes)
      .set({ ...quote, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return updated;
  }

  async sendQuote(id: string): Promise<Quote | undefined> {
    const [updated] = await db
      .update(quotes)
      .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return updated;
  }

  async acceptQuote(id: string): Promise<Quote | undefined> {
    const [updated] = await db
      .update(quotes)
      .set({ status: "accepted", acceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return updated;
  }

  async rejectQuote(id: string): Promise<Quote | undefined> {
    const [updated] = await db
      .update(quotes)
      .set({ status: "rejected", rejectedAt: new Date(), updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return updated;
  }

  async convertQuoteToJob(id: string): Promise<{ quote: Quote; job: Job } | undefined> {
    const quote = await this.getQuote(id);
    if (!quote || quote.status !== "accepted") return undefined;

    const [job] = await db.insert(jobs).values({
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      clientPhone: quote.clientPhone,
      address: quote.clientAddress,
      jobType: quote.jobType,
      description: quote.description,
      status: "pending",
      createdById: quote.createdById,
    }).returning();

    const [updatedQuote] = await db
      .update(quotes)
      .set({ convertedToJobId: job.id, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();

    return { quote: updatedQuote, job };
  }

  async deleteQuote(id: string): Promise<boolean> {
    await db.delete(quotes).where(eq(quotes.id, id));
    return true;
  }

  async generateQuoteNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(quotes)
      .where(sql`EXTRACT(YEAR FROM ${quotes.createdAt}) = ${year}`);
    const count = (result[0]?.count || 0) + 1;
    return `Q${year}-${String(count).padStart(4, "0")}`;
  }

  // Invoice operations
  async getInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async getInvoiceWithDetails(id: string): Promise<InvoiceWithDetails | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!invoice) return undefined;
    const items = await db.select().from(lineItems).where(eq(lineItems.invoiceId, id)).orderBy(lineItems.sortOrder);
    const invoicePayments = await db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(desc(payments.createdAt));
    return { ...invoice, lineItems: items, payments: invoicePayments };
  }

  async getInvoicesByStatus(status: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.status, status)).orderBy(desc(invoices.createdAt));
  }

  async getInvoicesByJob(jobId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.jobId, jobId)).orderBy(desc(invoices.createdAt));
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const invoiceNumber = await this.generateInvoiceNumber();
    const amountDue = invoice.total || "0";
    const [created] = await db.insert(invoices).values({ ...invoice, invoiceNumber, amountDue }).returning();
    return created;
  }

  async createInvoiceFromJob(jobId: string, createdById?: string): Promise<Invoice | undefined> {
    const job = await this.getJob(jobId);
    if (!job) return undefined;

    const invoiceNumber = await this.generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // 14 days payment terms

    const [invoice] = await db.insert(invoices).values({
      invoiceNumber,
      jobId,
      clientName: job.clientName,
      clientEmail: job.clientEmail,
      clientPhone: job.clientPhone,
      clientAddress: job.address,
      status: "draft",
      dueDate: dueDate.toISOString().split("T")[0],
      createdById,
    }).returning();

    return invoice;
  }

  async createInvoiceFromQuote(quoteId: string, createdById?: string): Promise<Invoice | undefined> {
    const quoteData = await this.getQuoteWithLineItems(quoteId);
    if (!quoteData) return undefined;

    const invoiceNumber = await this.generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const [invoice] = await db.insert(invoices).values({
      invoiceNumber,
      quoteId,
      clientName: quoteData.clientName,
      clientEmail: quoteData.clientEmail,
      clientPhone: quoteData.clientPhone,
      clientAddress: quoteData.clientAddress,
      status: "draft",
      subtotal: quoteData.subtotal,
      taxRate: quoteData.taxRate,
      taxAmount: quoteData.taxAmount,
      total: quoteData.total,
      amountDue: quoteData.total,
      dueDate: dueDate.toISOString().split("T")[0],
      createdById,
    }).returning();

    // Copy line items
    for (const item of quoteData.lineItems) {
      await db.insert(lineItems).values({
        invoiceId: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        sortOrder: item.sortOrder,
      });
    }

    return invoice;
  }

  async updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updated] = await db
      .update(invoices)
      .set({ ...invoice, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  async sendInvoice(id: string): Promise<Invoice | undefined> {
    const [updated] = await db
      .update(invoices)
      .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    await db.delete(invoices).where(eq(invoices.id, id));
    return true;
  }

  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(sql`EXTRACT(YEAR FROM ${invoices.createdAt}) = ${year}`);
    const count = (result[0]?.count || 0) + 1;
    return `INV${year}-${String(count).padStart(4, "0")}`;
  }

  // Line item operations
  async getLineItemsByQuote(quoteId: string): Promise<LineItem[]> {
    return db.select().from(lineItems).where(eq(lineItems.quoteId, quoteId)).orderBy(lineItems.sortOrder);
  }

  async getLineItemsByInvoice(invoiceId: string): Promise<LineItem[]> {
    return db.select().from(lineItems).where(eq(lineItems.invoiceId, invoiceId)).orderBy(lineItems.sortOrder);
  }

  async createLineItem(item: InsertLineItem): Promise<LineItem> {
    const [created] = await db.insert(lineItems).values(item).returning();
    return created;
  }

  async updateLineItem(id: string, item: Partial<InsertLineItem>): Promise<LineItem | undefined> {
    const [updated] = await db
      .update(lineItems)
      .set(item)
      .where(eq(lineItems.id, id))
      .returning();
    return updated;
  }

  async deleteLineItem(id: string): Promise<boolean> {
    await db.delete(lineItems).where(eq(lineItems.id, id));
    return true;
  }

  // Payment operations
  async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.invoiceId, invoiceId)).orderBy(desc(payments.createdAt));
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [created] = await db.insert(payments).values(payment).returning();

    // Update invoice amounts
    const invoice = await this.getInvoice(payment.invoiceId);
    if (invoice) {
      const currentPaid = parseFloat(invoice.amountPaid || "0");
      const paymentAmount = parseFloat(payment.amount);
      const newPaid = currentPaid + paymentAmount;
      const total = parseFloat(invoice.total || "0");
      const newDue = Math.max(0, total - newPaid);
      const newStatus = newDue <= 0 ? "paid" : newPaid > 0 ? "partially_paid" : invoice.status;

      await this.updateInvoice(invoice.id, {
        amountPaid: newPaid.toFixed(2),
        amountDue: newDue.toFixed(2),
        status: newStatus as any,
      });
    }

    return created;
  }

  async updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [updated] = await db
      .update(payments)
      .set(payment)
      .where(eq(payments.id, id))
      .returning();
    return updated;
  }

  async completePayment(id: string): Promise<Payment | undefined> {
    const [updated] = await db
      .update(payments)
      .set({ status: "completed", paidAt: new Date() })
      .where(eq(payments.id, id))
      .returning();

    // Update invoice if payment completed
    if (updated) {
      const invoice = await this.getInvoice(updated.invoiceId);
      if (invoice) {
        const allPayments = await this.getPaymentsByInvoice(updated.invoiceId);
        const completedPayments = allPayments.filter(p => p.status === "completed");
        const totalPaid = completedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const total = parseFloat(invoice.total || "0");
        const amountDue = Math.max(0, total - totalPaid);
        const newStatus = amountDue <= 0 ? "paid" : totalPaid > 0 ? "partially_paid" : invoice.status;

        await this.updateInvoice(invoice.id, {
          amountPaid: totalPaid.toFixed(2),
          amountDue: amountDue.toFixed(2),
          status: newStatus as any,
          ...(newStatus === "paid" ? { paidAt: new Date() } : {}),
        } as Partial<InsertInvoice>);
      }
    }

    return updated;
  }

  // =====================
  // Phase 4: Vehicle Operations
  // =====================

  async getVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles).orderBy(desc(vehicles.createdAt));
  }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle;
  }

  async getVehicleWithAssignment(id: string): Promise<VehicleWithAssignment | undefined> {
    const vehicle = await this.getVehicle(id);
    if (!vehicle) return undefined;

    const currentAssignment = await this.getCurrentAssignment(id);
    if (currentAssignment) {
      const [staff] = await db.select().from(staffProfiles).where(eq(staffProfiles.id, currentAssignment.staffId));
      return { ...vehicle, currentAssignment: { ...currentAssignment, staff } };
    }
    return vehicle;
  }

  async getVehiclesByStatus(status: string): Promise<Vehicle[]> {
    return await db.select().from(vehicles).where(eq(vehicles.status, status)).orderBy(desc(vehicles.createdAt));
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const [created] = await db.insert(vehicles).values(vehicle).returning();
    return created;
  }

  async updateVehicle(id: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const [updated] = await db
      .update(vehicles)
      .set({ ...vehicle, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning();
    return updated;
  }

  async deleteVehicle(id: string): Promise<boolean> {
    await db.delete(vehicles).where(eq(vehicles.id, id));
    return true;
  }

  // Vehicle Assignment Operations
  async getVehicleAssignments(vehicleId: string): Promise<VehicleAssignment[]> {
    return await db.select().from(vehicleAssignments)
      .where(eq(vehicleAssignments.vehicleId, vehicleId))
      .orderBy(desc(vehicleAssignments.assignedAt));
  }

  async getCurrentAssignment(vehicleId: string): Promise<VehicleAssignment | undefined> {
    const [assignment] = await db.select().from(vehicleAssignments)
      .where(and(
        eq(vehicleAssignments.vehicleId, vehicleId),
        sql`${vehicleAssignments.returnedAt} IS NULL`
      ))
      .orderBy(desc(vehicleAssignments.assignedAt))
      .limit(1);
    return assignment;
  }

  async getAssignmentsByStaff(staffId: string): Promise<VehicleAssignment[]> {
    return await db.select().from(vehicleAssignments)
      .where(eq(vehicleAssignments.staffId, staffId))
      .orderBy(desc(vehicleAssignments.assignedAt));
  }

  async assignVehicle(assignment: InsertVehicleAssignment): Promise<VehicleAssignment> {
    // Return any existing assignment for this vehicle
    const existing = await this.getCurrentAssignment(assignment.vehicleId);
    if (existing) {
      await this.returnVehicle(existing.id);
    }

    // Create new assignment
    const [created] = await db.insert(vehicleAssignments).values(assignment).returning();

    // Update vehicle status to in_use
    await this.updateVehicle(assignment.vehicleId, { status: "in_use" });

    return created;
  }

  async returnVehicle(assignmentId: string): Promise<VehicleAssignment | undefined> {
    const [updated] = await db
      .update(vehicleAssignments)
      .set({ returnedAt: new Date() })
      .where(eq(vehicleAssignments.id, assignmentId))
      .returning();

    if (updated) {
      // Update vehicle status to available
      await this.updateVehicle(updated.vehicleId, { status: "available" });
    }

    return updated;
  }

  // Checklist Template Operations
  async getChecklistTemplates(): Promise<ChecklistTemplate[]> {
    return await db.select().from(checklistTemplates)
      .where(eq(checklistTemplates.isActive, true))
      .orderBy(desc(checklistTemplates.createdAt));
  }

  async getChecklistTemplate(id: string): Promise<ChecklistTemplate | undefined> {
    const [template] = await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, id));
    return template;
  }

  async getChecklistTemplateWithItems(id: string): Promise<ChecklistTemplateWithItems | undefined> {
    const template = await this.getChecklistTemplate(id);
    if (!template) return undefined;

    const items = await this.getChecklistTemplateItems(id);
    return { ...template, items };
  }

  async getChecklistTemplatesByTarget(target: string): Promise<ChecklistTemplate[]> {
    return await db.select().from(checklistTemplates)
      .where(and(
        eq(checklistTemplates.target, target),
        eq(checklistTemplates.isActive, true)
      ))
      .orderBy(desc(checklistTemplates.createdAt));
  }

  async createChecklistTemplate(template: InsertChecklistTemplate): Promise<ChecklistTemplate> {
    const [created] = await db.insert(checklistTemplates).values(template).returning();
    return created;
  }

  async updateChecklistTemplate(id: string, template: Partial<InsertChecklistTemplate>): Promise<ChecklistTemplate | undefined> {
    const [updated] = await db
      .update(checklistTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(checklistTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteChecklistTemplate(id: string): Promise<boolean> {
    // Soft delete by setting isActive to false
    await db.update(checklistTemplates).set({ isActive: false }).where(eq(checklistTemplates.id, id));
    return true;
  }

  // Checklist Template Item Operations
  async getChecklistTemplateItems(templateId: string): Promise<ChecklistTemplateItem[]> {
    return await db.select().from(checklistTemplateItems)
      .where(eq(checklistTemplateItems.templateId, templateId))
      .orderBy(checklistTemplateItems.sortOrder);
  }

  async createChecklistTemplateItem(item: InsertChecklistTemplateItem): Promise<ChecklistTemplateItem> {
    const [created] = await db.insert(checklistTemplateItems).values(item).returning();
    return created;
  }

  async updateChecklistTemplateItem(id: string, item: Partial<InsertChecklistTemplateItem>): Promise<ChecklistTemplateItem | undefined> {
    const [updated] = await db
      .update(checklistTemplateItems)
      .set(item)
      .where(eq(checklistTemplateItems.id, id))
      .returning();
    return updated;
  }

  async deleteChecklistTemplateItem(id: string): Promise<boolean> {
    await db.delete(checklistTemplateItems).where(eq(checklistTemplateItems.id, id));
    return true;
  }

  // Checklist Run Operations
  async getChecklistRuns(filters?: { vehicleId?: string; jobId?: string; completedById?: string }): Promise<ChecklistRun[]> {
    let query = db.select().from(checklistRuns);
    
    if (filters?.vehicleId) {
      query = query.where(eq(checklistRuns.vehicleId, filters.vehicleId)) as typeof query;
    }
    if (filters?.jobId) {
      query = query.where(eq(checklistRuns.jobId, filters.jobId)) as typeof query;
    }
    if (filters?.completedById) {
      query = query.where(eq(checklistRuns.completedById, filters.completedById)) as typeof query;
    }
    
    return await query.orderBy(desc(checklistRuns.startedAt));
  }

  async getChecklistRun(id: string): Promise<ChecklistRun | undefined> {
    const [run] = await db.select().from(checklistRuns).where(eq(checklistRuns.id, id));
    return run;
  }

  async getChecklistRunWithItems(id: string): Promise<ChecklistRunWithItems | undefined> {
    const run = await this.getChecklistRun(id);
    if (!run) return undefined;

    const items = await this.getChecklistRunItems(id);
    const template = await this.getChecklistTemplate(run.templateId);
    return { ...run, items, template };
  }

  async startChecklistRun(run: InsertChecklistRun): Promise<ChecklistRunWithItems> {
    // Create the run
    const [created] = await db.insert(checklistRuns).values(run).returning();

    // Get template items and create run items
    const templateItems = await this.getChecklistTemplateItems(run.templateId);
    const runItems: ChecklistRunItem[] = [];

    for (const templateItem of templateItems) {
      const [runItem] = await db.insert(checklistRunItems).values({
        runId: created.id,
        templateItemId: templateItem.id,
        question: templateItem.question,
        itemType: templateItem.itemType,
      }).returning();
      runItems.push(runItem);
    }

    const template = await this.getChecklistTemplate(run.templateId);
    return { ...created, items: runItems, template };
  }

  async completeChecklistRun(id: string): Promise<ChecklistRun | undefined> {
    const [updated] = await db
      .update(checklistRuns)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(checklistRuns.id, id))
      .returning();
    return updated;
  }

  // Checklist Run Item Operations
  async getChecklistRunItems(runId: string): Promise<ChecklistRunItem[]> {
    return await db.select().from(checklistRunItems)
      .where(eq(checklistRunItems.runId, runId));
  }

  async updateChecklistRunItem(id: string, item: Partial<InsertChecklistRunItem>): Promise<ChecklistRunItem | undefined> {
    const [updated] = await db
      .update(checklistRunItems)
      .set({ ...item, completedAt: new Date() })
      .where(eq(checklistRunItems.id, id))
      .returning();
    return updated;
  }

  // Job Photo Operations
  async getJobPhotos(jobId: string): Promise<JobPhoto[]> {
    return await db.select().from(jobPhotos)
      .where(eq(jobPhotos.jobId, jobId))
      .orderBy(desc(jobPhotos.createdAt));
  }

  async getJobPhoto(id: string): Promise<JobPhoto | undefined> {
    const [photo] = await db.select().from(jobPhotos).where(eq(jobPhotos.id, id));
    return photo;
  }

  async createJobPhoto(photo: InsertJobPhoto): Promise<JobPhoto> {
    const [created] = await db.insert(jobPhotos).values(photo).returning();
    return created;
  }

  async updateJobPhoto(id: string, photo: Partial<InsertJobPhoto>): Promise<JobPhoto | undefined> {
    const [updated] = await db
      .update(jobPhotos)
      .set(photo)
      .where(eq(jobPhotos.id, id))
      .returning();
    return updated;
  }

  async deleteJobPhoto(id: string): Promise<boolean> {
    await db.delete(jobPhotos).where(eq(jobPhotos.id, id));
    return true;
  }

  // Vehicle Maintenance Operations
  async getVehicleMaintenanceRecords(vehicleId: string): Promise<VehicleMaintenance[]> {
    return await db.select().from(vehicleMaintenance)
      .where(eq(vehicleMaintenance.vehicleId, vehicleId))
      .orderBy(desc(vehicleMaintenance.scheduledDate));
  }

  async getVehicleMaintenance(id: string): Promise<VehicleMaintenance | undefined> {
    const [record] = await db.select().from(vehicleMaintenance).where(eq(vehicleMaintenance.id, id));
    return record;
  }

  async getScheduledMaintenance(): Promise<VehicleMaintenance[]> {
    return await db.select().from(vehicleMaintenance)
      .where(eq(vehicleMaintenance.status, "scheduled"))
      .orderBy(vehicleMaintenance.scheduledDate);
  }

  async createVehicleMaintenance(maintenance: InsertVehicleMaintenance): Promise<VehicleMaintenance> {
    const [created] = await db.insert(vehicleMaintenance).values(maintenance).returning();
    return created;
  }

  async updateVehicleMaintenance(id: string, maintenance: Partial<InsertVehicleMaintenance>): Promise<VehicleMaintenance | undefined> {
    const [updated] = await db
      .update(vehicleMaintenance)
      .set({ ...maintenance, updatedAt: new Date() })
      .where(eq(vehicleMaintenance.id, id))
      .returning();
    return updated;
  }

  async completeVehicleMaintenance(id: string, completedDate: string): Promise<VehicleMaintenance | undefined> {
    const [updated] = await db
      .update(vehicleMaintenance)
      .set({ status: "completed", completedDate, updatedAt: new Date() })
      .where(eq(vehicleMaintenance.id, id))
      .returning();

    // Update vehicle status back to available if it was in maintenance
    if (updated) {
      const vehicle = await this.getVehicle(updated.vehicleId);
      if (vehicle && vehicle.status === "maintenance") {
        await this.updateVehicle(updated.vehicleId, { status: "available" });
      }
    }

    return updated;
  }

  async deleteVehicleMaintenance(id: string): Promise<boolean> {
    await db.delete(vehicleMaintenance).where(eq(vehicleMaintenance.id, id));
    return true;
  }

  // ==========================================
  // PHASE 5: PRODUCTIVITY, BACKCOSTING & CAPACITY
  // ==========================================

  // Time Entry Operations
  async getJobTimeEntries(jobId: string): Promise<JobTimeEntry[]> {
    return await db.select().from(jobTimeEntries)
      .where(eq(jobTimeEntries.jobId, jobId))
      .orderBy(desc(jobTimeEntries.workDate));
  }

  async getTimeEntriesByStaff(staffId: string, dateFrom?: string, dateTo?: string): Promise<JobTimeEntry[]> {
    let query = db.select().from(jobTimeEntries).where(eq(jobTimeEntries.staffId, staffId));
    
    if (dateFrom && dateTo) {
      return await db.select().from(jobTimeEntries)
        .where(and(
          eq(jobTimeEntries.staffId, staffId),
          gte(jobTimeEntries.workDate, dateFrom),
          lte(jobTimeEntries.workDate, dateTo)
        ))
        .orderBy(desc(jobTimeEntries.workDate));
    }
    
    return await db.select().from(jobTimeEntries)
      .where(eq(jobTimeEntries.staffId, staffId))
      .orderBy(desc(jobTimeEntries.workDate));
  }

  async getTimeEntriesByDateRange(dateFrom: string, dateTo: string): Promise<JobTimeEntry[]> {
    return await db.select().from(jobTimeEntries)
      .where(and(
        gte(jobTimeEntries.workDate, dateFrom),
        lte(jobTimeEntries.workDate, dateTo)
      ))
      .orderBy(desc(jobTimeEntries.workDate));
  }

  async getTimeEntry(id: string): Promise<JobTimeEntry | undefined> {
    const [entry] = await db.select().from(jobTimeEntries).where(eq(jobTimeEntries.id, id));
    return entry;
  }

  async createTimeEntry(entry: InsertJobTimeEntry): Promise<JobTimeEntry> {
    const [created] = await db.insert(jobTimeEntries).values(entry).returning();
    return created;
  }

  async updateTimeEntry(id: string, entry: Partial<InsertJobTimeEntry>): Promise<JobTimeEntry | undefined> {
    const [updated] = await db
      .update(jobTimeEntries)
      .set({ ...entry, updatedAt: new Date() })
      .where(eq(jobTimeEntries.id, id))
      .returning();
    return updated;
  }

  async deleteTimeEntry(id: string): Promise<boolean> {
    await db.delete(jobTimeEntries).where(eq(jobTimeEntries.id, id));
    return true;
  }

  // Cost Entry Operations
  async getJobCostEntries(jobId: string): Promise<JobCostEntry[]> {
    return await db.select().from(jobCostEntries)
      .where(eq(jobCostEntries.jobId, jobId))
      .orderBy(desc(jobCostEntries.recordedAt));
  }

  async getCostEntry(id: string): Promise<JobCostEntry | undefined> {
    const [entry] = await db.select().from(jobCostEntries).where(eq(jobCostEntries.id, id));
    return entry;
  }

  async createCostEntry(entry: InsertJobCostEntry): Promise<JobCostEntry> {
    const [created] = await db.insert(jobCostEntries).values(entry).returning();
    return created;
  }

  async updateCostEntry(id: string, entry: Partial<InsertJobCostEntry>): Promise<JobCostEntry | undefined> {
    const [updated] = await db
      .update(jobCostEntries)
      .set(entry)
      .where(eq(jobCostEntries.id, id))
      .returning();
    return updated;
  }

  async deleteCostEntry(id: string): Promise<boolean> {
    await db.delete(jobCostEntries).where(eq(jobCostEntries.id, id));
    return true;
  }

  // Staff Capacity Operations
  async getStaffCapacityRules(): Promise<StaffCapacityRule[]> {
    return await db.select().from(staffCapacityRules);
  }

  async getStaffCapacityRule(staffId: string): Promise<StaffCapacityRule | undefined> {
    const [rule] = await db.select().from(staffCapacityRules).where(eq(staffCapacityRules.staffId, staffId));
    return rule;
  }

  async createOrUpdateCapacityRule(rule: InsertStaffCapacityRule): Promise<StaffCapacityRule> {
    const existing = await this.getStaffCapacityRule(rule.staffId);
    
    if (existing) {
      const [updated] = await db
        .update(staffCapacityRules)
        .set({ ...rule, updatedAt: new Date() })
        .where(eq(staffCapacityRules.staffId, rule.staffId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(staffCapacityRules).values(rule).returning();
      return created;
    }
  }

  async deleteCapacityRule(id: string): Promise<boolean> {
    await db.delete(staffCapacityRules).where(eq(staffCapacityRules.id, id));
    return true;
  }

  // Time Off Operations
  async getStaffTimeOff(staffId: string): Promise<StaffTimeOff[]> {
    return await db.select().from(staffTimeOff)
      .where(eq(staffTimeOff.staffId, staffId))
      .orderBy(desc(staffTimeOff.startDate));
  }

  async getTimeOffByDateRange(dateFrom: string, dateTo: string): Promise<StaffTimeOff[]> {
    return await db.select().from(staffTimeOff)
      .where(and(
        lte(staffTimeOff.startDate, dateTo),
        gte(staffTimeOff.endDate, dateFrom)
      ))
      .orderBy(staffTimeOff.startDate);
  }

  async getTimeOffRequest(id: string): Promise<StaffTimeOff | undefined> {
    const [request] = await db.select().from(staffTimeOff).where(eq(staffTimeOff.id, id));
    return request;
  }

  async createTimeOffRequest(request: InsertStaffTimeOff): Promise<StaffTimeOff> {
    const [created] = await db.insert(staffTimeOff).values(request).returning();
    return created;
  }

  async approveTimeOff(id: string, approvedById: string): Promise<StaffTimeOff | undefined> {
    const [updated] = await db
      .update(staffTimeOff)
      .set({ status: "approved", approvedById })
      .where(eq(staffTimeOff.id, id))
      .returning();
    return updated;
  }

  async rejectTimeOff(id: string, approvedById: string): Promise<StaffTimeOff | undefined> {
    const [updated] = await db
      .update(staffTimeOff)
      .set({ status: "rejected", approvedById })
      .where(eq(staffTimeOff.id, id))
      .returning();
    return updated;
  }

  async deleteTimeOff(id: string): Promise<boolean> {
    await db.delete(staffTimeOff).where(eq(staffTimeOff.id, id));
    return true;
  }

  // Analytics & Reporting
  // Safe numeric parser for reading from database - returns default for null/undefined/invalid
  // Note: Data should already be validated on insert, this is a defensive fallback for edge cases
  private safeParseFloat(value: string | null | undefined, defaultValue: number = 0): number {
    if (value === null || value === undefined || value === "") {
      return defaultValue;
    }
    const parsed = parseFloat(value);
    if (isNaN(parsed) || !isFinite(parsed)) {
      console.warn(`safeParseFloat: Invalid numeric value "${value}", using default ${defaultValue}`);
      return defaultValue;
    }
    return parsed;
  }

  async getStaffProductivityMetrics(dateFrom?: string, dateTo?: string): Promise<StaffProductivityMetrics[]> {
    const allStaff = await this.getStaffProfiles();
    const metrics: StaffProductivityMetrics[] = [];

    for (const staff of allStaff) {
      const entries = await this.getTimeEntriesByStaff(staff.id, dateFrom, dateTo);
      
      const totalHours = entries.reduce((sum, e) => sum + this.safeParseFloat(e.hoursWorked, 0), 0);
      const billableHours = entries
        .filter(e => e.isBillable)
        .reduce((sum, e) => sum + this.safeParseFloat(e.hoursWorked, 0), 0);
      
      const jobIds = new Set(entries.map(e => e.jobId));
      
      metrics.push({
        staffId: staff.id,
        staffName: `${staff.firstName || ""} ${staff.lastName || ""}`.trim() || staff.email || "Unknown",
        totalHours,
        billableHours,
        utilizationRate: totalHours > 0 ? (billableHours / totalHours) * 100 : 0,
        jobsWorked: jobIds.size,
      });
    }

    return metrics;
  }

  async getJobBackcostingSummary(jobId: string): Promise<JobBackcostingSummary | undefined> {
    const job = await this.getJob(jobId);
    if (!job) return undefined;

    const costEntries = await this.getJobCostEntries(jobId);
    const timeEntries = await this.getJobTimeEntries(jobId);
    
    // Get quoted amount from associated quotes (safely handle missing/null values)
    const quotesResult = await db.select().from(quotes).where(eq(quotes.jobId, jobId));
    const quotedAmount = quotesResult.reduce((sum, q) => sum + this.safeParseFloat(q.totalAmount, 0), 0);
    
    // Calculate labor cost from time entries (default $50/hr if rate not set)
    const DEFAULT_HOURLY_RATE = 50;
    const actualLaborCost = timeEntries.reduce((sum, e) => {
      const hours = this.safeParseFloat(e.hoursWorked, 0);
      const rate = this.safeParseFloat(e.hourlyRate, DEFAULT_HOURLY_RATE);
      return sum + (hours * rate);
    }, 0);
    
    // Calculate costs by category
    const actualMaterialCost = costEntries
      .filter(e => e.category === "material")
      .reduce((sum, e) => sum + this.safeParseFloat(e.totalCost, 0), 0);
    
    const actualOtherCosts = costEntries
      .filter(e => e.category !== "material" && e.category !== "labor")
      .reduce((sum, e) => sum + this.safeParseFloat(e.totalCost, 0), 0);
    
    // Add manual labor entries from cost entries
    const manualLaborCost = costEntries
      .filter(e => e.category === "labor")
      .reduce((sum, e) => sum + this.safeParseFloat(e.totalCost, 0), 0);
    
    const totalActualCost = actualLaborCost + manualLaborCost + actualMaterialCost + actualOtherCosts;
    const grossProfit = quotedAmount - totalActualCost;
    const profitMargin = quotedAmount > 0 ? (grossProfit / quotedAmount) * 100 : 0;
    const variance = totalActualCost - quotedAmount;

    return {
      jobId,
      jobTitle: job.clientName,
      quotedAmount,
      actualLaborCost: actualLaborCost + manualLaborCost,
      actualMaterialCost,
      actualOtherCosts,
      totalActualCost,
      grossProfit,
      profitMargin,
      variance,
    };
  }

  async getAllJobBackcosting(): Promise<JobBackcostingSummary[]> {
    const allJobs = await this.getJobs();
    const summaries: JobBackcostingSummary[] = [];

    for (const job of allJobs) {
      const summary = await this.getJobBackcostingSummary(job.id);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  }

  async getStaffCapacityView(weekStartDate: string): Promise<StaffCapacityView[]> {
    const allStaff = await this.getStaffProfiles();
    const capacityRules = await this.getStaffCapacityRules();
    
    // Calculate week end date (7 days from start)
    const startDate = new Date(weekStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const weekEndDate = endDate.toISOString().split('T')[0];

    // Get schedule entries and time entries for the week
    const scheduleResults = await db.select().from(scheduleEntries)
      .where(and(
        gte(scheduleEntries.scheduledDate, weekStartDate),
        lte(scheduleEntries.scheduledDate, weekEndDate)
      ));
    
    const timeResults = await this.getTimeEntriesByDateRange(weekStartDate, weekEndDate);
    
    // Get time off for the week
    const timeOffResults = await this.getTimeOffByDateRange(weekStartDate, weekEndDate);

    const views: StaffCapacityView[] = [];

    for (const staff of allStaff) {
      const rule = capacityRules.find(r => r.staffId === staff.id);
      
      // Calculate weekly capacity (sum of daily hours) using safe parsing
      const weeklyCapacity = rule ? (
        this.safeParseFloat(rule.mondayHours, 0) +
        this.safeParseFloat(rule.tuesdayHours, 0) +
        this.safeParseFloat(rule.wednesdayHours, 0) +
        this.safeParseFloat(rule.thursdayHours, 0) +
        this.safeParseFloat(rule.fridayHours, 0) +
        this.safeParseFloat(rule.saturdayHours, 0) +
        this.safeParseFloat(rule.sundayHours, 0)
      ) : 40; // Default 40 hours/week

      // Count scheduled entries (assume 8 hours per scheduled day)
      const staffSchedules = scheduleResults.filter(s => s.staffId === staff.id);
      const scheduledHours = staffSchedules.length * 8;

      // Sum logged hours using safe parsing
      const staffTimeEntries = timeResults.filter(t => t.staffId === staff.id);
      const loggedHours = staffTimeEntries.reduce((sum, e) => sum + this.safeParseFloat(e.hoursWorked, 0), 0);

      // Subtract time off (if any approved)
      const staffTimeOff = timeOffResults.filter(t => t.staffId === staff.id && t.status === "approved");
      // Simple calculation: each day of time off reduces capacity by 8 hours
      let timeOffDays = 0;
      for (const to of staffTimeOff) {
        const toStart = new Date(to.startDate);
        const toEnd = new Date(to.endDate);
        const overlapStart = toStart < startDate ? startDate : toStart;
        const overlapEnd = toEnd > endDate ? endDate : toEnd;
        timeOffDays += Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24) + 1);
      }
      
      const adjustedCapacity = Math.max(0, weeklyCapacity - (timeOffDays * 8));
      const availableHours = Math.max(0, adjustedCapacity - scheduledHours);
      const utilizationPercent = adjustedCapacity > 0 ? (scheduledHours / adjustedCapacity) * 100 : 0;

      views.push({
        staffId: staff.id,
        staffName: `${staff.firstName || ""} ${staff.lastName || ""}`.trim() || staff.email || "Unknown",
        role: staff.role || "plumber",
        weeklyCapacity: adjustedCapacity,
        scheduledHours,
        loggedHours,
        availableHours,
        utilizationPercent: Math.min(100, utilizationPercent),
      });
    }

    return views;
  }

  // =====================
  // KPI MODULE OPERATIONS
  // =====================

  // KPI Daily Snapshots
  async getKpiDailySnapshots(staffId?: string, dateFrom?: string, dateTo?: string): Promise<KpiDailySnapshot[]> {
    let query = db.select().from(kpiDailySnapshots);
    const conditions = [];
    if (staffId) conditions.push(eq(kpiDailySnapshots.staffId, staffId));
    if (dateFrom) conditions.push(gte(kpiDailySnapshots.snapshotDate, dateFrom));
    if (dateTo) conditions.push(lte(kpiDailySnapshots.snapshotDate, dateTo));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    return query.orderBy(desc(kpiDailySnapshots.snapshotDate));
  }

  async createKpiDailySnapshot(snapshot: InsertKpiDailySnapshot): Promise<KpiDailySnapshot> {
    const [created] = await db.insert(kpiDailySnapshots).values(snapshot).returning();
    return created;
  }

  async upsertKpiDailySnapshot(snapshot: InsertKpiDailySnapshot): Promise<KpiDailySnapshot> {
    const existing = await db.select().from(kpiDailySnapshots)
      .where(and(
        eq(kpiDailySnapshots.staffId, snapshot.staffId),
        eq(kpiDailySnapshots.snapshotDate, snapshot.snapshotDate)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      const [updated] = await db.update(kpiDailySnapshots)
        .set(snapshot)
        .where(eq(kpiDailySnapshots.id, existing[0].id))
        .returning();
      return updated;
    }
    return this.createKpiDailySnapshot(snapshot);
  }

  // KPI Weekly Snapshots
  async getKpiWeeklySnapshots(staffId?: string, weekStart?: string): Promise<KpiWeeklySnapshot[]> {
    let query = db.select().from(kpiWeeklySnapshots);
    const conditions = [];
    if (staffId) conditions.push(eq(kpiWeeklySnapshots.staffId, staffId));
    if (weekStart) conditions.push(eq(kpiWeeklySnapshots.weekStart, weekStart));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    return query.orderBy(desc(kpiWeeklySnapshots.weekStart));
  }

  async createKpiWeeklySnapshot(snapshot: InsertKpiWeeklySnapshot): Promise<KpiWeeklySnapshot> {
    const [created] = await db.insert(kpiWeeklySnapshots).values(snapshot).returning();
    return created;
  }

  // KPI Monthly Snapshots
  async getKpiMonthlySnapshots(month?: string): Promise<KpiMonthlySnapshot[]> {
    let query = db.select().from(kpiMonthlySnapshots);
    if (month) {
      query = query.where(eq(kpiMonthlySnapshots.month, month)) as any;
    }
    return query.orderBy(desc(kpiMonthlySnapshots.month));
  }

  async createKpiMonthlySnapshot(snapshot: InsertKpiMonthlySnapshot): Promise<KpiMonthlySnapshot> {
    const [created] = await db.insert(kpiMonthlySnapshots).values(snapshot).returning();
    return created;
  }

  // KPI Targets
  async getKpiTargets(): Promise<KpiTarget[]> {
    return db.select().from(kpiTargets).where(eq(kpiTargets.isActive, true));
  }

  async getKpiTargetByConfig(teamConfig: string): Promise<KpiTarget | undefined> {
    const [target] = await db.select().from(kpiTargets)
      .where(and(eq(kpiTargets.teamConfig, teamConfig), eq(kpiTargets.isActive, true)))
      .limit(1);
    return target;
  }

  async createKpiTarget(target: InsertKpiTarget): Promise<KpiTarget> {
    const [created] = await db.insert(kpiTargets).values(target).returning();
    return created;
  }

  async updateKpiTarget(id: string, target: Partial<InsertKpiTarget>): Promise<KpiTarget | undefined> {
    const [updated] = await db.update(kpiTargets)
      .set(target)
      .where(eq(kpiTargets.id, id))
      .returning();
    return updated;
  }

  // KPI Alerts
  async getKpiAlerts(acknowledged?: boolean): Promise<KpiAlert[]> {
    let query = db.select().from(kpiAlertsLog);
    if (acknowledged !== undefined) {
      query = query.where(eq(kpiAlertsLog.acknowledged, acknowledged)) as any;
    }
    return query.orderBy(desc(kpiAlertsLog.triggeredAt));
  }

  async getKpiAlertsByStaff(staffId: string): Promise<KpiAlert[]> {
    return db.select().from(kpiAlertsLog)
      .where(eq(kpiAlertsLog.staffId, staffId))
      .orderBy(desc(kpiAlertsLog.triggeredAt));
  }

  async createKpiAlert(alert: InsertKpiAlert): Promise<KpiAlert> {
    const [created] = await db.insert(kpiAlertsLog).values(alert).returning();
    return created;
  }

  async acknowledgeKpiAlert(id: string, acknowledgedById: string): Promise<KpiAlert | undefined> {
    const [updated] = await db.update(kpiAlertsLog)
      .set({ 
        acknowledged: true, 
        acknowledgedById, 
        acknowledgedAt: new Date() 
      })
      .where(eq(kpiAlertsLog.id, id))
      .returning();
    return updated;
  }

  // Tradesman Bonus Periods
  async getBonusPeriods(staffId?: string): Promise<TradesmanBonusPeriod[]> {
    let query = db.select().from(tradesmanBonusPeriods);
    if (staffId) {
      query = query.where(eq(tradesmanBonusPeriods.staffId, staffId)) as any;
    }
    return query.orderBy(desc(tradesmanBonusPeriods.periodEnd));
  }

  async getCurrentBonusPeriod(staffId: string): Promise<TradesmanBonusPeriod | undefined> {
    const today = new Date().toISOString().split("T")[0];
    const [period] = await db.select().from(tradesmanBonusPeriods)
      .where(and(
        eq(tradesmanBonusPeriods.staffId, staffId),
        lte(tradesmanBonusPeriods.periodStart, today),
        gte(tradesmanBonusPeriods.periodEnd, today)
      ))
      .limit(1);
    return period;
  }

  async createBonusPeriod(period: InsertBonusPeriod): Promise<TradesmanBonusPeriod> {
    const [created] = await db.insert(tradesmanBonusPeriods).values(period).returning();
    return created;
  }

  async approveBonusPeriod(id: string, approvedById: string): Promise<TradesmanBonusPeriod | undefined> {
    const [updated] = await db.update(tradesmanBonusPeriods)
      .set({ approvedById, approvedAt: new Date() })
      .where(eq(tradesmanBonusPeriods.id, id))
      .returning();
    return updated;
  }

  async markBonusPeriodPaid(id: string): Promise<TradesmanBonusPeriod | undefined> {
    const [updated] = await db.update(tradesmanBonusPeriods)
      .set({ paid: true, paidAt: new Date() })
      .where(eq(tradesmanBonusPeriods.id, id))
      .returning();
    return updated;
  }

  // Phase Progression Checklist
  async getPhaseChecklist(staffId: string, fromPhase: number, toPhase: number): Promise<PhaseProgressionChecklistItem[]> {
    return db.select().from(phaseProgressionChecklist)
      .where(and(
        eq(phaseProgressionChecklist.staffId, staffId),
        eq(phaseProgressionChecklist.fromPhase, fromPhase),
        eq(phaseProgressionChecklist.toPhase, toPhase)
      ));
  }

  async createPhaseChecklistItem(item: InsertPhaseChecklistItem): Promise<PhaseProgressionChecklistItem> {
    const [created] = await db.insert(phaseProgressionChecklist).values(item).returning();
    return created;
  }

  async togglePhaseChecklistItem(id: string, verifiedById?: string): Promise<PhaseProgressionChecklistItem | undefined> {
    const [existing] = await db.select().from(phaseProgressionChecklist)
      .where(eq(phaseProgressionChecklist.id, id))
      .limit(1);
    
    if (!existing) return undefined;
    
    const [updated] = await db.update(phaseProgressionChecklist)
      .set({
        completed: !existing.completed,
        completedAt: !existing.completed ? new Date() : null,
        verifiedById: !existing.completed ? verifiedById : null,
      })
      .where(eq(phaseProgressionChecklist.id, id))
      .returning();
    return updated;
  }

  // User Phase Log
  async getPhaseLog(staffId: string): Promise<UserPhaseLogEntry[]> {
    return db.select().from(userPhaseLog)
      .where(eq(userPhaseLog.staffId, staffId))
      .orderBy(desc(userPhaseLog.changedAt));
  }

  async createPhaseLogEntry(entry: InsertPhaseLogEntry): Promise<UserPhaseLogEntry> {
    const [created] = await db.insert(userPhaseLog).values(entry).returning();
    return created;
  }

  // KPI Dashboard Calculations
  async getKpiDashboardDaily(date?: string): Promise<KpiDashboardDaily[]> {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const allStaff = await this.getStaffProfiles();
    const snapshots = await this.getKpiDailySnapshots(undefined, targetDate, targetDate);
    
    const results: KpiDashboardDaily[] = [];
    
    for (const staff of allStaff) {
      const snapshot = snapshots.find(s => s.staffId === staff.id);
      const laborRevenue = snapshot ? this.safeParseFloat(snapshot.laborRevenue, 0) : 0;
      const targetLabor = staff.dailyLaborTarget ? this.safeParseFloat(staff.dailyLaborTarget, 2000) : 2000;
      const ratio = targetLabor > 0 ? laborRevenue / targetLabor : 0;
      
      let status: "green" | "amber" | "red" = "red";
      if (ratio >= 1) status = "green";
      else if (ratio >= 0.75) status = "amber";
      
      results.push({
        staffId: staff.id,
        staffName: staff.user?.firstName 
          ? `${staff.user.firstName} ${staff.user.lastName || ""}`.trim()
          : staff.user?.email || "Unknown",
        laborRevenue,
        hoursLogged: snapshot ? this.safeParseFloat(snapshot.hoursLogged, 0) : 0,
        jobsCompleted: snapshot?.jobsCompleted || 0,
        quotesSentValue: snapshot ? this.safeParseFloat(snapshot.quotesAndSentValue, 0) : 0,
        targetLabor,
        targetMet: ratio >= 1,
        status,
      });
    }
    
    return results;
  }

  async getKpiDashboardWeekly(weekStart?: string): Promise<KpiDashboardWeekly[]> {
    const startDate = weekStart || this.getWeekStart(new Date());
    const allStaff = await this.getStaffProfiles();
    const snapshots = await this.getKpiWeeklySnapshots(undefined, startDate);
    
    const results: KpiDashboardWeekly[] = [];
    
    for (const staff of allStaff) {
      const snapshot = snapshots.find(s => s.staffId === staff.id);
      const laborRevenue = snapshot ? this.safeParseFloat(snapshot.laborRevenue, 0) : 0;
      const targetLabor = staff.weeklyLaborTarget ? this.safeParseFloat(staff.weeklyLaborTarget, 10000) : 10000;
      
      results.push({
        staffId: staff.id,
        staffName: staff.user?.firstName 
          ? `${staff.user.firstName} ${staff.user.lastName || ""}`.trim()
          : staff.user?.email || "Unknown",
        laborRevenue,
        quotesSentValue: snapshot ? this.safeParseFloat(snapshot.quotesSentValue, 0) : 0,
        closeRate: snapshot ? this.safeParseFloat(snapshot.closeRate, 0) : 0,
        daysTargetMet: snapshot?.daysTargetMet || 0,
        targetLabor,
        targetMet: laborRevenue >= targetLabor,
      });
    }
    
    return results;
  }

  private getWeekStart(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split("T")[0];
  }

  async getTradesmanKpiSummary(staffId: string): Promise<TradesmanKpiSummary | undefined> {
    const staff = await this.getStaffProfile(staffId);
    if (!staff) return undefined;
    
    const today = new Date().toISOString().split("T")[0];
    const weekStart = this.getWeekStart(new Date());
    
    const dailySnapshots = await this.getKpiDailySnapshots(staffId, today, today);
    const weeklySnapshots = await this.getKpiWeeklySnapshots(staffId, weekStart);
    
    const dailySnapshot = dailySnapshots[0];
    const weeklySnapshot = weeklySnapshots[0];
    
    // Calculate weeks at current phase
    let weeksAtPhase = 0;
    if (staff.phaseStartDate) {
      const phaseStart = new Date(staff.phaseStartDate);
      const now = new Date();
      weeksAtPhase = Math.floor((now.getTime() - phaseStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    }
    
    // Calculate streak days
    let streakDays = 0;
    const recentSnapshots = await this.getKpiDailySnapshots(staffId);
    for (const snap of recentSnapshots.slice(0, 30)) {
      if (snap.targetMet) streakDays++;
      else break;
    }
    
    // Get current bonus period for projected bonus
    const bonusPeriod = await this.getCurrentBonusPeriod(staffId);
    const projectedBonus = bonusPeriod ? this.safeParseFloat(bonusPeriod.bonusAmount, 0) : 0;
    
    return {
      staffId: staff.id,
      staffName: staff.user?.firstName 
        ? `${staff.user.firstName} ${staff.user.lastName || ""}`.trim()
        : staff.user?.email || "Unknown",
      salesPhase: staff.salesPhase || 1,
      weeksAtPhase,
      dailyLabor: dailySnapshot ? this.safeParseFloat(dailySnapshot.laborRevenue, 0) : 0,
      dailyTarget: staff.dailyLaborTarget ? this.safeParseFloat(staff.dailyLaborTarget, 2000) : 2000,
      weeklyLabor: weeklySnapshot ? this.safeParseFloat(weeklySnapshot.laborRevenue, 0) : 0,
      weeklyTarget: staff.weeklyLaborTarget ? this.safeParseFloat(staff.weeklyLaborTarget, 10000) : 10000,
      closeRate: weeklySnapshot ? this.safeParseFloat(weeklySnapshot.closeRate, 0) : 0,
      streakDays,
      projectedBonus,
    };
  }

  // Calculate and save daily KPI snapshot for a staff member
  async calculateDailyKpiSnapshot(staffId: string, date: string): Promise<KpiDailySnapshot> {
    const staff = await this.getStaffProfile(staffId);
    if (!staff) throw new Error("Staff not found");
    
    // Get time entries for the day
    const timeEntries = await this.getTimeEntries(staffId, date, date);
    const hoursLogged = timeEntries.reduce((sum, e) => sum + this.safeParseFloat(e.hoursWorked, 0), 0);
    
    // Calculate labor revenue (hours * hourly rate or estimate from job completions)
    // Use salaryAmount if available, otherwise fall back to hourlyCostLoaded
    let hourlyRate = 266; // Default: $2000/7.5hrs
    if (staff.salaryAmount) {
      if (staff.salaryType === "hourly") {
        hourlyRate = this.safeParseFloat(staff.salaryAmount, 266);
      } else if (staff.salaryType === "annual") {
        // Convert annual to hourly assuming 2080 hours/year (52 weeks * 40 hours)
        hourlyRate = this.safeParseFloat(staff.salaryAmount, 0) / 2080;
      }
    } else if (staff.hourlyCostLoaded) {
      hourlyRate = this.safeParseFloat(staff.hourlyCostLoaded, 266);
    }
    const laborRevenue = hoursLogged * hourlyRate;
    
    // Count completed jobs
    const allJobs = await this.getJobs();
    const completedJobs = allJobs.filter(j => 
      j.status === "completed" && 
      j.updatedAt && 
      j.updatedAt.toISOString().split("T")[0] === date
    ).length;
    
    const targetLabor = staff.dailyLaborTarget ? this.safeParseFloat(staff.dailyLaborTarget, 2000) : 2000;
    
    return this.upsertKpiDailySnapshot({
      staffId,
      snapshotDate: date,
      laborRevenue: String(laborRevenue),
      hoursLogged: String(hoursLogged),
      jobsCompleted: completedJobs,
      targetLabor: String(targetLabor),
      targetMet: laborRevenue >= targetLabor,
    });
  }

  // Advance tradesman to next sales phase
  async advanceSalesPhase(staffId: string, changedById: string, notes?: string): Promise<void> {
    const staff = await this.getStaffProfile(staffId);
    if (!staff) throw new Error("Staff not found");
    
    const currentPhase = staff.salesPhase || 1;
    if (currentPhase >= 3) throw new Error("Already at maximum phase");
    
    const newPhase = currentPhase + 1;
    const today = new Date().toISOString().split("T")[0];
    
    // Update staff profile
    await this.updateStaffProfile(staffId, {
      salesPhase: newPhase,
      phaseStartDate: today,
    });
    
    // Log the phase change
    await this.createPhaseLogEntry({
      staffId,
      previousPhase: currentPhase,
      newPhase,
      changedById,
      notes,
    });
  }

  // Calculate bonus amount based on sales phase and labor value
  calculateBonusAmount(salesPhase: number, laborValue: number): { tier: string; amount: number } {
    if (salesPhase === 2) {
      if (laborValue <= 12000) return { tier: "base", amount: 0 };
      if (laborValue <= 14000) return { tier: "tier1", amount: 300 };
      if (laborValue <= 16000) return { tier: "tier2", amount: 500 };
      if (laborValue <= 18000) return { tier: "tier3", amount: 750 };
      return { tier: "tier4", amount: 1000 };
    } else if (salesPhase === 3) {
      if (laborValue <= 12000) return { tier: "base", amount: 0 };
      if (laborValue <= 15000) return { tier: "tier1", amount: 400 };
      if (laborValue <= 18000) return { tier: "tier2", amount: 700 };
      if (laborValue <= 22000) return { tier: "tier3", amount: 1000 };
      return { tier: "tier4", amount: 1500 };
    }
    return { tier: "phase1", amount: 0 }; // Phase 1 has no bonus
  }

  // Staff working hours operations
  async getStaffWorkingHours(staffId: string): Promise<UserWorkingHours[]> {
    return await db.select().from(userWorkingHours)
      .where(eq(userWorkingHours.staffId, staffId))
      .orderBy(userWorkingHours.dayOfWeek);
  }

  async setStaffWorkingHours(staffId: string, hours: InsertUserWorkingHours[]): Promise<UserWorkingHours[]> {
    // Delete existing hours for this staff member
    await db.delete(userWorkingHours).where(eq(userWorkingHours.staffId, staffId));
    
    // Insert new hours
    if (hours.length > 0) {
      const hoursWithStaffId = hours.map(h => ({ ...h, staffId }));
      await db.insert(userWorkingHours).values(hoursWithStaffId);
    }
    
    return this.getStaffWorkingHours(staffId);
  }

  async getStaffAvailability(staffId: string, date: string): Promise<{ isAvailable: boolean; startTime?: string; endTime?: string }> {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay(); // 0=Sunday, 1=Monday, etc.
    
    // Check if there's a time-off request for this date
    const timeOff = await db.select().from(staffTimeOff)
      .where(and(
        eq(staffTimeOff.staffId, staffId),
        lte(staffTimeOff.startDate, date),
        gte(staffTimeOff.endDate, date),
        eq(staffTimeOff.status, "approved")
      ));
    
    if (timeOff.length > 0) {
      return { isAvailable: false };
    }
    
    // Check working hours for this day
    const [workingDay] = await db.select().from(userWorkingHours)
      .where(and(
        eq(userWorkingHours.staffId, staffId),
        eq(userWorkingHours.dayOfWeek, dayOfWeek)
      ));
    
    if (!workingDay) {
      // Default availability: Mon-Fri, 7:00-15:30
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      return {
        isAvailable: isWeekday,
        startTime: isWeekday ? "07:00" : undefined,
        endTime: isWeekday ? "15:30" : undefined,
      };
    }
    
    return {
      isAvailable: workingDay.isWorkingDay,
      startTime: workingDay.isWorkingDay ? (workingDay.startTime || undefined) : undefined,
      endTime: workingDay.isWorkingDay ? (workingDay.endTime || undefined) : undefined,
    };
  }

  // =====================
  // MULTI-TENANT OPERATIONS
  // =====================

  // Organization operations
  async getOrganizations(): Promise<Organization[]> {
    return db.select().from(organizations).orderBy(desc(organizations.createdAt));
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    return org;
  }

  async getOwnerOrganization(): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.isOwner, true));
    return org;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(organizations).values(org).returning();
    return created;
  }

  async updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [updated] = await db
      .update(organizations)
      .set({ ...org, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return updated;
  }

  async deleteOrganization(id: string): Promise<boolean> {
    await db.delete(organizations).where(eq(organizations.id, id));
    return true;
  }

  // Subscription operations
  async getOrganizationSubscription(organizationId: string): Promise<OrganizationSubscription | undefined> {
    const [sub] = await db.select().from(organizationSubscriptions)
      .where(eq(organizationSubscriptions.organizationId, organizationId));
    return sub;
  }

  async createOrganizationSubscription(sub: InsertOrganizationSubscription): Promise<OrganizationSubscription> {
    const [created] = await db.insert(organizationSubscriptions).values(sub).returning();
    return created;
  }

  async updateOrganizationSubscription(id: string, sub: Partial<InsertOrganizationSubscription>): Promise<OrganizationSubscription | undefined> {
    const [updated] = await db
      .update(organizationSubscriptions)
      .set({ ...sub, updatedAt: new Date() })
      .where(eq(organizationSubscriptions.id, id))
      .returning();
    return updated;
  }

  // Member operations
  async getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    return db.select().from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId))
      .orderBy(desc(organizationMembers.joinedAt));
  }

  async getOrganizationMember(organizationId: string, userId: string): Promise<OrganizationMember | undefined> {
    const [member] = await db.select().from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      ));
    return member;
  }

  async getUserMemberships(userId: string): Promise<OrganizationMember[]> {
    return db.select().from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));
  }

  async createOrganizationMember(member: InsertOrganizationMember): Promise<OrganizationMember> {
    const [created] = await db.insert(organizationMembers).values(member).returning();
    return created;
  }

  async updateOrganizationMember(id: string, member: Partial<InsertOrganizationMember>): Promise<OrganizationMember | undefined> {
    const [updated] = await db
      .update(organizationMembers)
      .set({ ...member, updatedAt: new Date() })
      .where(eq(organizationMembers.id, id))
      .returning();
    return updated;
  }

  async deleteOrganizationMember(id: string): Promise<boolean> {
    await db.delete(organizationMembers).where(eq(organizationMembers.id, id));
    return true;
  }

  // Auth identity operations
  async getAuthIdentities(userId: string): Promise<AuthIdentity[]> {
    return db.select().from(authIdentities)
      .where(eq(authIdentities.userId, userId));
  }

  async getAuthIdentityByIdentifier(type: string, identifier: string): Promise<AuthIdentity | undefined> {
    const [identity] = await db.select().from(authIdentities)
      .where(and(
        eq(authIdentities.type, type),
        eq(authIdentities.identifier, identifier.toLowerCase())
      ));
    return identity;
  }

  async createAuthIdentity(identity: InsertAuthIdentity): Promise<AuthIdentity> {
    const [created] = await db.insert(authIdentities).values({
      ...identity,
      identifier: identity.identifier.toLowerCase(),
    }).returning();
    return created;
  }

  async updateAuthIdentity(id: string, identity: Partial<InsertAuthIdentity>): Promise<AuthIdentity | undefined> {
    const updateData: any = { ...identity, updatedAt: new Date() };
    if (identity.identifier) {
      updateData.identifier = identity.identifier.toLowerCase();
    }
    const [updated] = await db
      .update(authIdentities)
      .set(updateData)
      .where(eq(authIdentities.id, id))
      .returning();
    return updated;
  }

  async deleteAuthIdentity(id: string): Promise<boolean> {
    await db.delete(authIdentities).where(eq(authIdentities.id, id));
    return true;
  }

  // Verification code operations
  async createVerificationCode(code: InsertVerificationCode): Promise<VerificationCode> {
    const [created] = await db.insert(verificationCodes).values(code).returning();
    return created;
  }

  async getVerificationCode(code: string, email?: string, phone?: string): Promise<VerificationCode | undefined> {
    let conditions = [eq(verificationCodes.code, code)];
    if (email) {
      conditions.push(eq(verificationCodes.email, email.toLowerCase()));
    }
    if (phone) {
      conditions.push(eq(verificationCodes.phone, phone));
    }
    
    const [result] = await db.select().from(verificationCodes)
      .where(and(...conditions))
      .orderBy(desc(verificationCodes.createdAt));
    return result;
  }

  async markVerificationCodeUsed(id: string): Promise<void> {
    await db.update(verificationCodes)
      .set({ usedAt: new Date() })
      .where(eq(verificationCodes.id, id));
  }

  async cleanupExpiredCodes(): Promise<void> {
    await db.delete(verificationCodes)
      .where(lte(verificationCodes.expiresAt, new Date()));
  }

  // Invite operations
  async getOrganizationInvites(organizationId: string): Promise<OrganizationInvite[]> {
    return db.select().from(organizationInvites)
      .where(eq(organizationInvites.organizationId, organizationId))
      .orderBy(desc(organizationInvites.createdAt));
  }

  async getInviteByCode(code: string): Promise<OrganizationInvite | undefined> {
    const [invite] = await db.select().from(organizationInvites)
      .where(eq(organizationInvites.inviteCode, code));
    return invite;
  }

  async createOrganizationInvite(invite: InsertOrganizationInvite): Promise<OrganizationInvite> {
    const [created] = await db.insert(organizationInvites).values({
      ...invite,
      email: invite.email?.toLowerCase(),
    }).returning();
    return created;
  }

  async acceptInvite(id: string, userId: string): Promise<OrganizationInvite | undefined> {
    const [updated] = await db.update(organizationInvites)
      .set({ acceptedAt: new Date(), acceptedBy: userId })
      .where(eq(organizationInvites.id, id))
      .returning();
    return updated;
  }

  async deleteOrganizationInvite(id: string): Promise<boolean> {
    await db.delete(organizationInvites).where(eq(organizationInvites.id, id));
    return true;
  }

  // =====================
  // CLIENT PORTAL METHODS
  // =====================

  // Client operations
  async getClients(organizationId: string): Promise<Client[]> {
    return db.select().from(clients)
      .where(eq(clients.organizationId, organizationId))
      .orderBy(clients.lastName, clients.firstName);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByEmail(organizationId: string, email: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients)
      .where(and(
        eq(clients.organizationId, organizationId),
        eq(clients.email, email.toLowerCase())
      ));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [created] = await db.insert(clients).values({
      ...client,
      email: client.email ? client.email.toLowerCase() : null,
    }).returning();
    return created;
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const updateData: any = { ...client, updatedAt: new Date() };
    if (client.email !== undefined) {
      updateData.email = client.email ? client.email.toLowerCase() : null;
    }
    const [updated] = await db.update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();
    return updated;
  }

  async deleteClient(id: string): Promise<boolean> {
    await db.delete(clients).where(eq(clients.id, id));
    return true;
  }

  // Client portal account operations
  async getClientPortalAccount(id: string): Promise<ClientPortalAccount | undefined> {
    const [account] = await db.select().from(clientPortalAccounts)
      .where(eq(clientPortalAccounts.id, id));
    return account;
  }

  async getClientPortalAccountByEmail(email: string): Promise<ClientPortalAccount | undefined> {
    const [account] = await db.select().from(clientPortalAccounts)
      .where(eq(clientPortalAccounts.email, email.toLowerCase()));
    return account;
  }

  async getClientPortalAccountByClientId(clientId: string): Promise<ClientPortalAccount | undefined> {
    const [account] = await db.select().from(clientPortalAccounts)
      .where(eq(clientPortalAccounts.clientId, clientId));
    return account;
  }

  async createClientPortalAccount(account: InsertClientPortalAccount): Promise<ClientPortalAccount> {
    const [created] = await db.insert(clientPortalAccounts).values({
      ...account,
      email: account.email.toLowerCase(),
    }).returning();
    return created;
  }

  async updateClientPortalAccount(id: string, account: Partial<InsertClientPortalAccount>): Promise<ClientPortalAccount | undefined> {
    const updateData: any = { ...account, updatedAt: new Date() };
    if (account.email) {
      updateData.email = account.email.toLowerCase();
    }
    const [updated] = await db.update(clientPortalAccounts)
      .set(updateData)
      .where(eq(clientPortalAccounts.id, id))
      .returning();
    return updated;
  }

  async deleteClientPortalAccount(id: string): Promise<boolean> {
    await db.delete(clientPortalAccounts).where(eq(clientPortalAccounts.id, id));
    return true;
  }

  // Client portal verification operations
  async createClientPortalVerificationCode(portalAccountId: string | null, email: string, purpose: string): Promise<ClientPortalVerificationCode> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const [created] = await db.insert(clientPortalVerificationCodes).values({
      portalAccountId,
      email: email.toLowerCase(),
      code,
      purpose,
      expiresAt,
    }).returning();

    return created;
  }

  async verifyClientPortalCode(email: string, code: string, purpose: string): Promise<ClientPortalVerificationCode | undefined> {
    const [result] = await db.select().from(clientPortalVerificationCodes)
      .where(and(
        eq(clientPortalVerificationCodes.email, email.toLowerCase()),
        eq(clientPortalVerificationCodes.code, code),
        eq(clientPortalVerificationCodes.purpose, purpose),
        gte(clientPortalVerificationCodes.expiresAt, new Date())
      ))
      .orderBy(desc(clientPortalVerificationCodes.createdAt));

    if (result && !result.usedAt) {
      await db.update(clientPortalVerificationCodes)
        .set({ usedAt: new Date() })
        .where(eq(clientPortalVerificationCodes.id, result.id));
      return result;
    }
    return undefined;
  }

  // Client portal session operations
  async createPortalSession(id: string, clientId: string, portalAccountId: string, expiresAt: Date, userAgent?: string, ipAddress?: string): Promise<void> {
    await db.insert(clientPortalSessions).values({
      id,
      clientId,
      portalAccountId,
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
    });
  }

  async getPortalSession(id: string): Promise<{ clientId: string; expiresAt: Date; revokedAt: Date | null } | undefined> {
    const [session] = await db.select({
      clientId: clientPortalSessions.clientId,
      expiresAt: clientPortalSessions.expiresAt,
      revokedAt: clientPortalSessions.revokedAt,
    }).from(clientPortalSessions)
      .where(eq(clientPortalSessions.id, id));
    return session;
  }

  async revokePortalSession(id: string): Promise<void> {
    await db.update(clientPortalSessions)
      .set({ revokedAt: new Date() })
      .where(eq(clientPortalSessions.id, id));
  }

  async revokeAllPortalSessions(clientId: string): Promise<void> {
    await db.update(clientPortalSessions)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(clientPortalSessions.clientId, clientId),
        isNull(clientPortalSessions.revokedAt)
      ));
  }

  async cleanupExpiredPortalSessions(): Promise<void> {
    await db.delete(clientPortalSessions)
      .where(lt(clientPortalSessions.expiresAt, new Date()));
  }

  // Job milestone operations
  async getJobMilestones(jobId: string): Promise<JobMilestone[]> {
    return db.select().from(jobMilestones)
      .where(eq(jobMilestones.jobId, jobId))
      .orderBy(jobMilestones.sortOrder);
  }

  async getMilestone(id: string): Promise<JobMilestone | undefined> {
    const [milestone] = await db.select().from(jobMilestones)
      .where(eq(jobMilestones.id, id));
    return milestone;
  }

  async getMilestoneWithDetails(id: string): Promise<JobMilestoneWithDetails | undefined> {
    const milestone = await this.getMilestone(id);
    if (!milestone) return undefined;

    const payments = await db.select().from(milestonePayments)
      .where(eq(milestonePayments.milestoneId, id))
      .orderBy(desc(milestonePayments.createdAt));

    const media = await db.select().from(milestoneMedia)
      .where(eq(milestoneMedia.milestoneId, id))
      .orderBy(desc(milestoneMedia.createdAt));

    return { ...milestone, payments, media };
  }

  async createMilestone(milestone: InsertJobMilestone): Promise<JobMilestone> {
    const [created] = await db.insert(jobMilestones).values(milestone).returning();
    return created;
  }

  async updateMilestone(id: string, milestone: Partial<InsertJobMilestone>): Promise<JobMilestone | undefined> {
    const [updated] = await db.update(jobMilestones)
      .set({ ...milestone, updatedAt: new Date() })
      .where(eq(jobMilestones.id, id))
      .returning();
    return updated;
  }

  async completeMilestone(id: string, completedById: string): Promise<JobMilestone | undefined> {
    const [updated] = await db.update(jobMilestones)
      .set({
        status: "completed",
        progressPercent: 100,
        completedAt: new Date(),
        completedById,
        updatedAt: new Date(),
      })
      .where(eq(jobMilestones.id, id))
      .returning();
    return updated;
  }

  async deleteMilestone(id: string): Promise<boolean> {
    await db.delete(jobMilestones).where(eq(jobMilestones.id, id));
    return true;
  }

  // Milestone payment operations
  async getMilestonePayments(milestoneId: string): Promise<MilestonePayment[]> {
    return db.select().from(milestonePayments)
      .where(eq(milestonePayments.milestoneId, milestoneId))
      .orderBy(desc(milestonePayments.createdAt));
  }

  async getMilestonePayment(id: string): Promise<MilestonePayment | undefined> {
    const [payment] = await db.select().from(milestonePayments)
      .where(eq(milestonePayments.id, id));
    return payment;
  }

  async getPendingPaymentsByJob(jobId: string): Promise<MilestonePayment[]> {
    const milestonesForJob = await db.select({ id: jobMilestones.id })
      .from(jobMilestones)
      .where(eq(jobMilestones.jobId, jobId));

    if (milestonesForJob.length === 0) return [];

    const milestoneIds = milestonesForJob.map(m => m.id);

    return db.select().from(milestonePayments)
      .where(and(
        inArray(milestonePayments.milestoneId, milestoneIds),
        inArray(milestonePayments.status, ["pending", "requested"])
      ))
      .orderBy(desc(milestonePayments.createdAt));
  }

  async createMilestonePayment(payment: InsertMilestonePayment): Promise<MilestonePayment> {
    const [created] = await db.insert(milestonePayments).values(payment).returning();
    return created;
  }

  async updateMilestonePayment(id: string, payment: Partial<InsertMilestonePayment>): Promise<MilestonePayment | undefined> {
    const [updated] = await db.update(milestonePayments)
      .set({ ...payment, updatedAt: new Date() })
      .where(eq(milestonePayments.id, id))
      .returning();
    return updated;
  }

  async approveMilestonePayment(id: string): Promise<MilestonePayment | undefined> {
    const [updated] = await db.update(milestonePayments)
      .set({
        status: "approved",
        approvedByClientAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(milestonePayments.id, id))
      .returning();
    return updated;
  }

  async recordMilestonePaymentPaid(id: string, paymentMethod: string, paymentReference?: string): Promise<MilestonePayment | undefined> {
    const [updated] = await db.update(milestonePayments)
      .set({
        status: "paid",
        paidAt: new Date(),
        paymentMethod,
        paymentReference,
        updatedAt: new Date(),
      })
      .where(eq(milestonePayments.id, id))
      .returning();
    return updated;
  }

  // Milestone media operations
  async getMilestoneMedia(milestoneId: string): Promise<MilestoneMedia[]> {
    return db.select().from(milestoneMedia)
      .where(eq(milestoneMedia.milestoneId, milestoneId))
      .orderBy(desc(milestoneMedia.createdAt));
  }

  async getJobMedia(jobId: string): Promise<MilestoneMedia[]> {
    return db.select().from(milestoneMedia)
      .where(eq(milestoneMedia.jobId, jobId))
      .orderBy(desc(milestoneMedia.createdAt));
  }

  async getMediaByDate(jobId: string, workDate: string): Promise<MilestoneMedia[]> {
    return db.select().from(milestoneMedia)
      .where(and(
        eq(milestoneMedia.jobId, jobId),
        eq(milestoneMedia.workDate, workDate)
      ))
      .orderBy(desc(milestoneMedia.createdAt));
  }

  async createMilestoneMedia(media: InsertMilestoneMedia): Promise<MilestoneMedia> {
    const [created] = await db.insert(milestoneMedia).values(media).returning();
    return created;
  }

  async updateMilestoneMedia(id: string, media: Partial<InsertMilestoneMedia>): Promise<MilestoneMedia | undefined> {
    const [updated] = await db.select().from(milestoneMedia)
      .where(eq(milestoneMedia.id, id));
    
    if (!updated) return undefined;

    const [result] = await db.update(milestoneMedia)
      .set(media)
      .where(eq(milestoneMedia.id, id))
      .returning();
    return result;
  }

  async deleteMilestoneMedia(id: string): Promise<boolean> {
    await db.delete(milestoneMedia).where(eq(milestoneMedia.id, id));
    return true;
  }

  // Client portal specific operations
  async getClientJobsForPortal(clientId: string): Promise<Job[]> {
    return db.select().from(jobs)
      .where(eq(jobs.clientId, clientId))
      .orderBy(desc(jobs.createdAt));
  }

  async getJobMilestonesForPortal(jobId: string): Promise<JobMilestoneWithDetails[]> {
    const milestoneList = await db.select().from(jobMilestones)
      .where(eq(jobMilestones.jobId, jobId))
      .orderBy(jobMilestones.sortOrder);

    const milestonesWithDetails: JobMilestoneWithDetails[] = await Promise.all(
      milestoneList.map(async (milestone) => {
        const payments = await db.select().from(milestonePayments)
          .where(eq(milestonePayments.milestoneId, milestone.id))
          .orderBy(desc(milestonePayments.createdAt));

        const media = await db.select().from(milestoneMedia)
          .where(and(
            eq(milestoneMedia.milestoneId, milestone.id),
            eq(milestoneMedia.visibleToClient, true)
          ))
          .orderBy(desc(milestoneMedia.createdAt));

        return { ...milestone, payments, media };
      })
    );

    return milestonesWithDetails;
  }
}

export const storage = new DatabaseStorage();
