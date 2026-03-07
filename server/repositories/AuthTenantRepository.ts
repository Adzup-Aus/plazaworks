import type {
  AuthIdentity,
  InsertAuthIdentity,
  VerificationCode,
  InsertVerificationCode,
  UserInvite,
  InsertUserInvite,
} from "@shared/schema";
import {
  authIdentities,
  verificationCodes,
  userInvites,
} from "@shared/schema";
import { eq, and, desc, lte, gt, isNull, isNotNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@shared/schema";

/**
 * Auth repository: identities, verification codes, user invites.
 * Organization-related methods removed (single-tenant).
 */
export class AuthTenantRepository {
  constructor(private db: NodePgDatabase<typeof schema>) {}

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

  async createUserInvite(invite: InsertUserInvite): Promise<UserInvite> {
    const [created] = await this.db.insert(userInvites).values(invite).returning();
    return created;
  }

  async getUserInviteByToken(token: string): Promise<UserInvite | undefined> {
    const [invite] = await this.db
      .select()
      .from(userInvites)
      .where(eq(userInvites.token, token));
    return invite;
  }

  async listUserInvites(opts?: { status?: "pending" | "used" | "expired" }): Promise<UserInvite[]> {
    const now = new Date();
    if (opts?.status === "pending") {
      return this.db
        .select()
        .from(userInvites)
        .where(and(isNull(userInvites.usedAt), gt(userInvites.expiresAt, now)))
        .orderBy(desc(userInvites.createdAt));
    }
    if (opts?.status === "used") {
      return this.db
        .select()
        .from(userInvites)
        .where(isNotNull(userInvites.usedAt))
        .orderBy(desc(userInvites.createdAt));
    }
    if (opts?.status === "expired") {
      return this.db
        .select()
        .from(userInvites)
        .where(and(isNull(userInvites.usedAt), lte(userInvites.expiresAt, now)))
        .orderBy(desc(userInvites.createdAt));
    }
    return this.db.select().from(userInvites).orderBy(desc(userInvites.createdAt));
  }

  async markUserInviteUsed(id: string): Promise<void> {
    await this.db.update(userInvites).set({ usedAt: new Date() }).where(eq(userInvites.id, id));
  }

  async updateUserInvite(
    id: string,
    data: { token: string; expiresAt: Date; roleId?: string | null }
  ): Promise<UserInvite | undefined> {
    const updateData: Record<string, unknown> = {
      token: data.token,
      expiresAt: data.expiresAt,
    };
    if (data.roleId !== undefined) {
      updateData.roleId = data.roleId;
    }
    const [updated] = await this.db
      .update(userInvites)
      .set(updateData as any)
      .where(eq(userInvites.id, id))
      .returning();
    return updated;
  }
}
