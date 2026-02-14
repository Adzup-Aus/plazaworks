import type {
  Organization,
  InsertOrganization,
  OrganizationSubscription,
  InsertOrganizationSubscription,
  OrganizationMember,
  InsertOrganizationMember,
  AuthIdentity,
  InsertAuthIdentity,
  VerificationCode,
  InsertVerificationCode,
  OrganizationInvite,
  InsertOrganizationInvite,
} from "@shared/schema";
import {
  organizations,
  organizationSubscriptions,
  organizationMembers,
  authIdentities,
  verificationCodes,
  organizationInvites,
} from "@shared/schema";
import { eq, and, desc, lte } from "drizzle-orm";
import { db } from "../db";

export class AuthTenantRepository {
  constructor(private db: typeof db) {}

  async getOrganizations(): Promise<Organization[]> {
    return this.db.select().from(organizations).orderBy(desc(organizations.createdAt));
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await this.db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [org] = await this.db.select().from(organizations).where(eq(organizations.slug, slug));
    return org;
  }

  async getOwnerOrganization(): Promise<Organization | undefined> {
    const [org] = await this.db.select().from(organizations).where(eq(organizations.isOwner, true));
    return org;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await this.db.insert(organizations).values(org).returning();
    return created;
  }

  async updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [updated] = await this.db
      .update(organizations)
      .set({ ...org, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return updated;
  }

  async deleteOrganization(id: string): Promise<boolean> {
    await this.db.delete(organizations).where(eq(organizations.id, id));
    return true;
  }

  async getOrganizationSubscription(organizationId: string): Promise<OrganizationSubscription | undefined> {
    const [sub] = await this.db
      .select()
      .from(organizationSubscriptions)
      .where(eq(organizationSubscriptions.organizationId, organizationId));
    return sub;
  }

  async createOrganizationSubscription(sub: InsertOrganizationSubscription): Promise<OrganizationSubscription> {
    const [created] = await this.db.insert(organizationSubscriptions).values(sub).returning();
    return created;
  }

  async updateOrganizationSubscription(
    id: string,
    sub: Partial<InsertOrganizationSubscription>
  ): Promise<OrganizationSubscription | undefined> {
    const [updated] = await this.db
      .update(organizationSubscriptions)
      .set({ ...sub, updatedAt: new Date() })
      .where(eq(organizationSubscriptions.id, id))
      .returning();
    return updated;
  }

  async getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    return this.db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId))
      .orderBy(desc(organizationMembers.joinedAt));
  }

  async getOrganizationMember(organizationId: string, userId: string): Promise<OrganizationMember | undefined> {
    const [member] = await this.db
      .select()
      .from(organizationMembers)
      .where(
        and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId))
      );
    return member;
  }

  async getUserMemberships(userId: string): Promise<OrganizationMember[]> {
    return this.db.select().from(organizationMembers).where(eq(organizationMembers.userId, userId));
  }

  async createOrganizationMember(member: InsertOrganizationMember): Promise<OrganizationMember> {
    const [created] = await this.db.insert(organizationMembers).values(member).returning();
    return created;
  }

  async updateOrganizationMember(
    id: string,
    member: Partial<InsertOrganizationMember>
  ): Promise<OrganizationMember | undefined> {
    const [updated] = await this.db
      .update(organizationMembers)
      .set({ ...member, updatedAt: new Date() })
      .where(eq(organizationMembers.id, id))
      .returning();
    return updated;
  }

  async deleteOrganizationMember(id: string): Promise<boolean> {
    await this.db.delete(organizationMembers).where(eq(organizationMembers.id, id));
    return true;
  }

  async getAuthIdentities(userId: string): Promise<AuthIdentity[]> {
    return this.db.select().from(authIdentities).where(eq(authIdentities.userId, userId));
  }

  async getAuthIdentityByIdentifier(type: string, identifier: string): Promise<AuthIdentity | undefined> {
    const [identity] = await this.db
      .select()
      .from(authIdentities)
      .where(
        and(eq(authIdentities.type, type), eq(authIdentities.identifier, identifier.toLowerCase()))
      );
    return identity;
  }

  async createAuthIdentity(identity: InsertAuthIdentity): Promise<AuthIdentity> {
    const [created] = await this.db
      .insert(authIdentities)
      .values({
        ...identity,
        identifier: identity.identifier.toLowerCase(),
      })
      .returning();
    return created;
  }

  async updateAuthIdentity(id: string, identity: Partial<InsertAuthIdentity>): Promise<AuthIdentity | undefined> {
    const updateData: Record<string, unknown> = { ...identity, updatedAt: new Date() };
    if (identity.identifier) {
      updateData.identifier = identity.identifier.toLowerCase();
    }
    const [updated] = await this.db
      .update(authIdentities)
      .set(updateData as any)
      .where(eq(authIdentities.id, id))
      .returning();
    return updated;
  }

  async deleteAuthIdentity(id: string): Promise<boolean> {
    await this.db.delete(authIdentities).where(eq(authIdentities.id, id));
    return true;
  }

  async createVerificationCode(code: InsertVerificationCode): Promise<VerificationCode> {
    const [created] = await this.db.insert(verificationCodes).values(code).returning();
    return created;
  }

  async getVerificationCode(code: string, email?: string, phone?: string): Promise<VerificationCode | undefined> {
    const conditions = [eq(verificationCodes.code, code)];
    if (email) {
      conditions.push(eq(verificationCodes.email, email.toLowerCase()));
    }
    if (phone) {
      conditions.push(eq(verificationCodes.phone, phone));
    }
    const [result] = await this.db
      .select()
      .from(verificationCodes)
      .where(and(...conditions))
      .orderBy(desc(verificationCodes.createdAt));
    return result;
  }

  async markVerificationCodeUsed(id: string): Promise<void> {
    await this.db
      .update(verificationCodes)
      .set({ usedAt: new Date() })
      .where(eq(verificationCodes.id, id));
  }

  async cleanupExpiredCodes(): Promise<void> {
    await this.db.delete(verificationCodes).where(lte(verificationCodes.expiresAt, new Date()));
  }

  async getOrganizationInvites(organizationId: string): Promise<OrganizationInvite[]> {
    return this.db
      .select()
      .from(organizationInvites)
      .where(eq(organizationInvites.organizationId, organizationId))
      .orderBy(desc(organizationInvites.createdAt));
  }

  async getInviteByCode(code: string): Promise<OrganizationInvite | undefined> {
    const [invite] = await this.db
      .select()
      .from(organizationInvites)
      .where(eq(organizationInvites.inviteCode, code));
    return invite;
  }

  async createOrganizationInvite(invite: InsertOrganizationInvite): Promise<OrganizationInvite> {
    const [created] = await this.db
      .insert(organizationInvites)
      .values({
        ...invite,
        email: invite.email?.toLowerCase(),
      })
      .returning();
    return created;
  }

  async acceptInvite(id: string, userId: string): Promise<OrganizationInvite | undefined> {
    const [updated] = await this.db
      .update(organizationInvites)
      .set({ acceptedAt: new Date(), acceptedBy: userId })
      .where(eq(organizationInvites.id, id))
      .returning();
    return updated;
  }

  async deleteOrganizationInvite(id: string): Promise<boolean> {
    await this.db.delete(organizationInvites).where(eq(organizationInvites.id, id));
    return true;
  }
}
