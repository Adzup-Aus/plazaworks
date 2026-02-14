import type { Express } from "express";
import {
  storage,
  isAuthenticated,
  getUserId,
  requireSuperAdmin,
  requireUserId,
} from "../../routes/shared";

export function registerOrganizationsRoutes(app: Express): void {
  app.get("/api/organizations", isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const orgs = await storage.getOrganizations();
      res.json(orgs);
    } catch (err: any) {
      console.error("Error fetching organizations:", err);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  app.get("/api/organizations/:id", isAuthenticated, async (req, res) => {
    try {
      const org = await storage.getOrganization(req.params.id);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }
      res.json(org);
    } catch (err: any) {
      console.error("Error fetching organization:", err);
      res.status(500).json({ message: "Failed to fetch organization" });
    }
  });

  app.post("/api/organizations", isAuthenticated, async (req: any, res) => {
    try {
      const { name, slug, type, email, phone, address, timezone } = req.body;

      if (!name || !slug) {
        return res.status(400).json({ message: "Name and slug are required" });
      }

      const existing = await storage.getOrganizationBySlug(slug);
      if (existing) {
        return res.status(400).json({ message: "Slug already in use" });
      }

      const org = await storage.createOrganization({
        name,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        type: type || "customer",
        email,
        phone,
        address,
        timezone: timezone || "Australia/Brisbane",
        isActive: true,
        isOwner: false,
      });

      await storage.createOrganizationSubscription({
        organizationId: org.id,
        tier: "starter",
        status: "active",
        maxUsers: 3,
        maxJobs: 50,
        features: ["jobs", "schedule", "basic_reports"],
      });

      const userId = getUserId(req);
      if (userId) {
        await storage.createOrganizationMember({
          organizationId: org.id,
          userId,
          role: "owner",
          isLocked: true,
          joinedAt: new Date(),
          isActive: true,
        });
      }

      res.status(201).json(org);
    } catch (err: any) {
      console.error("Error creating organization:", err);
      res.status(500).json({ message: "Failed to create organization" });
    }
  });

  app.patch("/api/organizations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { name, email, phone, address, timezone, isActive } = req.body;

      const updated = await storage.updateOrganization(req.params.id, {
        name,
        email,
        phone,
        address,
        timezone,
        isActive,
      });

      if (!updated) {
        return res.status(404).json({ message: "Organization not found" });
      }

      res.json(updated);
    } catch (err: any) {
      console.error("Error updating organization:", err);
      res.status(500).json({ message: "Failed to update organization" });
    }
  });

  app.get("/api/organizations/:id/subscription", isAuthenticated, async (req, res) => {
    try {
      const sub = await storage.getOrganizationSubscription(req.params.id);
      if (!sub) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      res.json(sub);
    } catch (err: any) {
      console.error("Error fetching subscription:", err);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  app.patch("/api/organizations/:id/subscription", isAuthenticated, async (req, res) => {
    try {
      const { tier, maxUsers, maxJobs, features } = req.body;

      const existing = await storage.getOrganizationSubscription(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      const updated = await storage.updateOrganizationSubscription(existing.id, {
        tier,
        maxUsers,
        maxJobs,
        features,
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Error updating subscription:", err);
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  app.get("/api/organizations/:id/members", isAuthenticated, async (req, res) => {
    try {
      const members = await storage.getOrganizationMembers(req.params.id);
      res.json(members);
    } catch (err: any) {
      console.error("Error fetching members:", err);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.post("/api/organizations/:id/members", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, role } = req.body;

      if (!userId || !role) {
        return res.status(400).json({ message: "UserId and role are required" });
      }

      const existing = await storage.getOrganizationMember(req.params.id, userId);
      if (existing) {
        return res.status(400).json({ message: "User is already a member" });
      }

      const member = await storage.createOrganizationMember({
        organizationId: req.params.id,
        userId,
        role,
        invitedBy: requireUserId(req),
        invitedAt: new Date(),
        joinedAt: new Date(),
        isActive: true,
      });

      res.status(201).json(member);
    } catch (err: any) {
      console.error("Error adding member:", err);
      res.status(500).json({ message: "Failed to add member" });
    }
  });

  app.patch("/api/organizations/:orgId/members/:memberId", isAuthenticated, async (req, res) => {
    try {
      const { role, isActive } = req.body;

      const updated = await storage.updateOrganizationMember(req.params.memberId, {
        role,
        isActive,
      });

      if (!updated) {
        return res.status(404).json({ message: "Member not found" });
      }

      res.json(updated);
    } catch (err: any) {
      console.error("Error updating member:", err);
      res.status(500).json({ message: "Failed to update member" });
    }
  });

  app.delete("/api/organizations/:orgId/members/:memberId", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteOrganizationMember(req.params.memberId);
      res.status(204).send();
    } catch (err: any) {
      console.error("Error removing member:", err);
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  app.get("/api/organizations/:id/invites", isAuthenticated, async (req, res) => {
    try {
      const invites = await storage.getOrganizationInvites(req.params.id);
      res.json(invites);
    } catch (err: any) {
      console.error("Error fetching invites:", err);
      res.status(500).json({ message: "Failed to fetch invites" });
    }
  });

  app.post("/api/organizations/:id/invites", isAuthenticated, async (req: any, res) => {
    try {
      const { email, phone, role } = req.body;

      if (!email && !phone) {
        return res.status(400).json({ message: "Email or phone is required" });
      }

      const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      const invite = await storage.createOrganizationInvite({
        organizationId: req.params.id,
        email: email?.toLowerCase(),
        phone,
        role: role || "staff",
        inviteCode,
        invitedBy: requireUserId(req),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      res.status(201).json({
        ...invite,
        inviteCode,
      });
    } catch (err: any) {
      console.error("Error creating invite:", err);
      res.status(500).json({ message: "Failed to create invite" });
    }
  });

  app.post("/api/invites/:code/accept", async (req: any, res) => {
    try {
      const invite = await storage.getInviteByCode(req.params.code);

      if (!invite) {
        return res.status(404).json({ message: "Invalid invite code" });
      }

      if (invite.acceptedAt) {
        return res.status(400).json({ message: "Invite has already been used" });
      }

      if (invite.expiresAt && new Date() > invite.expiresAt) {
        return res.status(400).json({ message: "Invite has expired" });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const existing = await storage.getOrganizationMember(invite.organizationId, userId);
      if (existing) {
        return res.status(400).json({ message: "You are already a member of this organization" });
      }

      await storage.acceptInvite(invite.id, userId);

      const member = await storage.createOrganizationMember({
        organizationId: invite.organizationId,
        userId,
        role: invite.role,
        invitedBy: invite.invitedBy,
        invitedAt: invite.createdAt,
        joinedAt: new Date(),
        isActive: true,
      });

      const org = await storage.getOrganization(invite.organizationId);

      res.json({
        message: "Invite accepted",
        member,
        organization: org,
      });
    } catch (err: any) {
      console.error("Error accepting invite:", err);
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  app.delete("/api/organizations/:orgId/invites/:inviteId", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteOrganizationInvite(req.params.inviteId);
      res.status(204).send();
    } catch (err: any) {
      console.error("Error deleting invite:", err);
      res.status(500).json({ message: "Failed to delete invite" });
    }
  });

  // Organization settings (plan: organizations includes org settings)
  app.get("/api/organizations/:orgId/settings", isAuthenticated, async (req, res) => {
    try {
      let settings = await storage.getOrganizationSettings(req.params.orgId);
      if (!settings) {
        settings = await storage.createOrganizationSettings({
          organizationId: req.params.orgId,
        });
      }
      res.json(settings);
    } catch (err: any) {
      console.error("Error fetching organization settings:", err);
      res.status(500).json({ message: "Failed to fetch organization settings" });
    }
  });

  app.patch("/api/organizations/:orgId/settings", isAuthenticated, async (req, res) => {
    try {
      let settings = await storage.getOrganizationSettings(req.params.orgId);
      if (!settings) {
        settings = await storage.createOrganizationSettings({
          ...req.body,
          organizationId: req.params.orgId,
        });
      } else {
        settings = await storage.updateOrganizationSettings(req.params.orgId, req.body);
      }
      res.json(settings);
    } catch (err: any) {
      console.error("Error updating organization settings:", err);
      res.status(500).json({ message: "Failed to update organization settings" });
    }
  });
}
