import type { Express } from "express";
import { z } from "zod";
import { storage, isAuthenticated, requirePermission } from "../../routes/shared";
import { userPermissions, type UserPermission } from "@shared/schema";
import { insertRoleSchema } from "./model";

const createRoleBodySchema = insertRoleSchema.pick({
  name: true,
  description: true,
});

const setPermissionsBodySchema = z.object({
  permissions: z.array(z.string()),
});

/** Permission metadata for UI: display name, description, category */
const PERMISSION_META: Record<
  UserPermission,
  { displayName: string; description: string; category: string }
> = {
  view_dashboard: { displayName: "View Dashboard", description: "Can view the dashboard overview", category: "Dashboard" },
  view_jobs: { displayName: "View Jobs", description: "Can view job listings and job details", category: "Jobs" },
  create_jobs: { displayName: "Create Jobs", description: "Can create new jobs", category: "Jobs" },
  edit_jobs: { displayName: "Edit Jobs", description: "Can modify existing jobs", category: "Jobs" },
  delete_jobs: { displayName: "Delete Jobs", description: "Can delete jobs", category: "Jobs" },
  view_quotes: { displayName: "View Quotes", description: "Can view quote listings and details", category: "Quotes" },
  create_quotes: { displayName: "Create Quotes", description: "Can create new quotes", category: "Quotes" },
  edit_quotes: { displayName: "Edit Quotes", description: "Can modify existing quotes", category: "Quotes" },
  delete_quotes: { displayName: "Delete Quotes", description: "Can delete quotes", category: "Quotes" },
  view_invoices: { displayName: "View Invoices", description: "Can view invoice listings and details", category: "Invoices" },
  create_invoices: { displayName: "Create Invoices", description: "Can create new invoices", category: "Invoices" },
  edit_invoices: { displayName: "Edit Invoices", description: "Can modify existing invoices", category: "Invoices" },
  delete_invoices: { displayName: "Delete Invoices", description: "Can delete invoices", category: "Invoices" },
  view_schedule: { displayName: "View Schedule", description: "Can view the schedule calendar", category: "Schedule" },
  manage_schedule: { displayName: "Manage Schedule", description: "Can create and edit schedule entries", category: "Schedule" },
  view_activities: { displayName: "View Activities", description: "Can view activities", category: "Activities" },
  view_users: { displayName: "View Users", description: "Can view team members and staff", category: "Users" },
  create_users: { displayName: "Create Users", description: "Can create staff profiles", category: "Users" },
  edit_users: { displayName: "Edit Users", description: "Can modify staff profiles", category: "Users" },
  delete_users: { displayName: "Delete Users", description: "Can remove staff", category: "Users" },
  view_clients: { displayName: "View Clients", description: "Can view client listings and details", category: "Clients" },
  create_clients: { displayName: "Create Clients", description: "Can create new clients", category: "Clients" },
  edit_clients: { displayName: "Edit Clients", description: "Can modify existing clients", category: "Clients" },
  delete_clients: { displayName: "Delete Clients", description: "Can delete clients", category: "Clients" },
  view_reports: { displayName: "View Reports", description: "Can view reports and dashboards", category: "Reports" },
  admin_settings: { displayName: "Admin Settings", description: "Can access settings and role management", category: "Settings" },
};

const CATEGORIES = [
  "Dashboard", "Jobs", "Quotes", "Invoices", "Schedule", "Activities",
  "Users", "Clients", "Reports", "Settings",
];

export function registerRolesRoutes(app: Express): void {
  app.get("/api/roles", isAuthenticated, requirePermission("admin_settings"), async (_req, res) => {
    try {
      const list = await storage.getRoles();
      res.json(list);
    } catch (err: unknown) {
      console.error("Error fetching roles:", err);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.get("/api/roles/:id", isAuthenticated, requirePermission("admin_settings"), async (req, res) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) return res.status(404).json({ message: "Role not found" });
      res.json(role);
    } catch (err: unknown) {
      console.error("Error fetching role:", err);
      res.status(500).json({ message: "Failed to fetch role" });
    }
  });

  app.post("/api/roles", isAuthenticated, requirePermission("admin_settings"), async (req, res) => {
    try {
      const parsed = createRoleBodySchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.errors[0]?.message ?? "Invalid input";
        return res.status(400).json({ message: msg });
      }
      const existing = await storage.getRoleByName(parsed.data.name);
      if (existing) {
        return res.status(409).json({ message: "A role with this name already exists" });
      }
      const role = await storage.createRole(parsed.data);
      res.status(201).json(role);
    } catch (err: unknown) {
      console.error("Error creating role:", err);
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  app.patch("/api/roles/:id", isAuthenticated, requirePermission("admin_settings"), async (req, res) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) return res.status(404).json({ message: "Role not found" });
      if (role.isSystem) {
        return res.status(403).json({ message: "Cannot modify system role" });
      }
      const parsed = createRoleBodySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.errors[0]?.message ?? "Invalid input";
        return res.status(400).json({ message: msg });
      }
      if (Object.keys(parsed.data).length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }
      if (parsed.data.name !== undefined) {
        const existing = await storage.getRoleByName(parsed.data.name);
        if (existing && existing.id !== role.id) {
          return res.status(409).json({ message: "A role with this name already exists" });
        }
      }
      const updated = await storage.updateRole(role.id, parsed.data);
      res.json(updated);
    } catch (err: unknown) {
      console.error("Error updating role:", err);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", isAuthenticated, requirePermission("admin_settings"), async (req, res) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) return res.status(404).json({ message: "Role not found" });
      if (role.isSystem) {
        return res.status(403).json({ message: "Cannot delete system role" });
      }
      const profiles = await storage.getStaffProfiles();
      const roleName = role.name;
      const assigned = profiles.some((p) => (p.roles ?? []).includes(roleName));
      if (assigned) {
        return res.status(409).json({ message: "Role is assigned to one or more staff members" });
      }
      await storage.deleteRole(role.id);
      res.status(204).send();
    } catch (err: unknown) {
      console.error("Error deleting role:", err);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  app.get("/api/permissions", isAuthenticated, requirePermission("admin_settings"), async (_req, res) => {
    try {
      const permissions = (userPermissions as readonly string[]).map((key) => ({
        key,
        ...PERMISSION_META[key as UserPermission],
      }));
      res.json({ permissions, categories: CATEGORIES });
    } catch (err: unknown) {
      console.error("Error fetching permissions:", err);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  app.get("/api/roles/:id/permissions", isAuthenticated, requirePermission("admin_settings"), async (req, res) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) return res.status(404).json({ message: "Role not found" });
      const permissions = await storage.getRolePermissions(role.id);
      res.json({ roleId: role.id, permissions });
    } catch (err: unknown) {
      console.error("Error fetching role permissions:", err);
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });

  app.put("/api/roles/:id/permissions", isAuthenticated, requirePermission("admin_settings"), async (req, res) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) return res.status(404).json({ message: "Role not found" });
      const parsed = setPermissionsBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid permissions" });
      }
      const valid = parsed.data.permissions.filter((p): p is UserPermission =>
        userPermissions.includes(p as UserPermission)
      );
      await storage.setRolePermissions(role.id, valid);
      const permissions = await storage.getRolePermissions(role.id);
      res.json({ roleId: role.id, permissions });
    } catch (err: unknown) {
      console.error("Error setting role permissions:", err);
      res.status(500).json({ message: "Failed to set role permissions" });
    }
  });
}
