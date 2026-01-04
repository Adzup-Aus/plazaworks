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
  staffProfiles,
  jobs,
  scheduleEntries,
  pcItems,
  notifications,
  clientAccessTokens,
  quotes,
  invoices,
  lineItems,
  payments,
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
}

export const storage = new DatabaseStorage();
