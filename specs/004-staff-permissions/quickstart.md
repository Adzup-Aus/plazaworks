# Quickstart: Using the Permission System

This guide shows developers how to use the permission system in both backend and frontend code.

## Backend Usage

### 1. Add Permission Check to a Route

```typescript
import { requirePermission, requireAnyPermission } from "../middleware/permissions";

// Single permission required
app.get("/api/jobs", 
  isAuthenticated, 
  requirePermission("view_jobs"), 
  async (req, res) => {
    // Only users with view_jobs can access
    const jobs = await storage.getJobs();
    res.json(jobs);
  }
);

// Any of multiple permissions
app.post("/api/quotes", 
  isAuthenticated, 
  requireAnyPermission("create_quotes", "admin_settings"), 
  async (req, res) => {
    // Users with create_quotes OR admin_settings can access
    const quote = await storage.createQuote(req.body);
    res.json(quote);
  }
);

// All permissions required
app.delete("/api/jobs/:id", 
  isAuthenticated, 
  requireAllPermissions("delete_jobs", "view_jobs"), 
  async (req, res) => {
    // Users must have BOTH delete_jobs AND view_jobs
    await storage.deleteJob(req.params.id);
    res.json({ success: true });
  }
);
```

### 2. Check Permission Programmatically

```typescript
import { checkPermission, getUserPermissions } from "../routes/shared";

app.patch("/api/jobs/:id", isAuthenticated, async (req, res) => {
  const userId = getUserId(req);
  
  // Check if user can edit this specific job
  const canEdit = await checkPermission(userId, "edit_jobs");
  if (!canEdit) {
    return res.status(403).json({ message: "Permission denied" });
  }
  
  // Proceed with update
  const job = await storage.updateJob(req.params.id, req.body);
  res.json(job);
});
```

### 3. Permission-Aware Response

```typescript
app.get("/api/jobs/:id", isAuthenticated, async (req, res) => {
  const userId = getUserId(req);
  const job = await storage.getJob(req.params.id);
  
  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }
  
  // Include permission flags in response for UI
  const permissions = await getUserPermissions(userId);
  res.json({
    ...job,
    _permissions: {
      canEdit: permissions.includes("edit_jobs"),
      canDelete: permissions.includes("delete_jobs"),
    }
  });
});
```

## Frontend Usage

### 1. Using the usePermissions Hook

```typescript
import { usePermissions } from "@/hooks/use-permissions";

function JobsPage() {
  const { 
    hasPermission, 
    hasAnyPermission, 
    isAdmin,
    canView,
    canCreate,
    canEdit,
    canDelete 
  } = usePermissions();

  // Check single permission
  if (hasPermission("create_jobs")) {
    // Show create button
  }

  // Check any permission
  if (hasAnyPermission("edit_jobs", "delete_jobs")) {
    // Show actions dropdown
  }

  // Use resource helpers
  if (canCreate("jobs")) {
    // Show create button for jobs
  }

  return (
    <div>
      {canCreate("jobs") && <Button>Create Job</Button>}
      
      <JobsList 
        onEdit={canEdit("jobs") ? handleEdit : undefined}
        onDelete={canDelete("jobs") ? handleDelete : undefined}
      />
    </div>
  );
}
```

### 2. Using the PermissionGate Component

```typescript
import { PermissionGate } from "@/components/permission-gate";

function JobDetails({ job }) {
  return (
    <div>
      <h1>{job.title}</h1>
      
      {/* Single permission */}
      <PermissionGate permission="edit_jobs">
        <Button>Edit Job</Button>
      </PermissionGate>
      
      {/* Multiple permissions (any) */}
      <PermissionGate permissions={["edit_jobs", "delete_jobs"]}>
        <ActionsDropdown job={job} />
      </PermissionGate>
      
      {/* Multiple permissions (all required) */}
      <PermissionGate 
        permissions={["edit_jobs", "view_jobs"]} 
        requireAll
      >
        <AdvancedEdit job={job} />
      </PermissionGate>
      
      {/* With fallback */}
      <PermissionGate 
        permission="delete_jobs"
        fallback={<span>Contact admin to delete</span>}
      >
        <Button variant="destructive">Delete Job</Button>
      </PermissionGate>
    </div>
  );
}
```

### 3. Permission-Aware Navigation

```typescript
import { filterNavByPermissions } from "@/lib/permissions";

function AppSidebar() {
  const { permissions, isAdmin } = usePermissions();
  
  const allNavItems = [
    { title: "Jobs", url: "/jobs", permission: "view_jobs" },
    { title: "Quotes", url: "/quotes", permission: "view_quotes" },
    { title: "Invoices", url: "/invoices", permission: "view_invoices" },
    // ... more items
  ];
  
  // Filter nav items based on permissions
  const visibleNavItems = filterNavByPermissions(allNavItems, permissions, isAdmin);
  
  return (
    <Sidebar>
      {visibleNavItems.map(item => (
        <NavItem key={item.url} {...item} />
      ))}
    </Sidebar>
  );
}
```

### 4. Route-Level Permission Guards

```typescript
import { PermissionRedirect } from "@/components/permission-redirect";

function AuthenticatedRouter() {
  return (
    <Switch>
      {/* Dashboard with special permission check */}
      <Route path="/">
        <PermissionRedirect 
          permission="view_dashboard" 
          fallback="/jobs"
        >
          <Dashboard />
        </PermissionRedirect>
      </Route>
      
      {/* Standard permission-guarded routes */}
      <Route path="/jobs">
        <PermissionRedirect permission="view_jobs" fallback="/">
          <Jobs />
        </PermissionRedirect>
      </Route>
      
      <Route path="/jobs/new">
        <PermissionRedirect permission="create_jobs" fallback="/jobs">
          <JobForm />
        </PermissionRedirect>
      </Route>
      
      {/* ... other routes */}
    </Switch>
  );
}
```

## Permission Reference

### Available Permissions

| Permission | Description |
|------------|-------------|
| `view_dashboard` | View the Overview dashboard (also requires admin OR this permission) |
| `view_jobs` | View the Jobs list and details |
| `create_jobs` | Create new jobs (implies view_jobs) |
| `edit_jobs` | Edit existing jobs (implies view_jobs) |
| `delete_jobs` | Delete jobs (implies view_jobs) |
| `view_quotes` | View quotes section |
| `create_quotes` | Create quotes (implies view_quotes) |
| `edit_quotes` | Edit quotes (implies view_quotes) |
| `delete_quotes` | Delete quotes (implies view_quotes) |
| `view_invoices` | View invoices section |
| `create_invoices` | Create invoices (implies view_invoices) |
| `edit_invoices` | Edit invoices (implies view_invoices) |
| `delete_invoices` | Delete invoices (implies view_invoices) |
| `view_schedule` | View the schedule |
| `manage_schedule` | Create/edit/delete schedule entries (implies view_schedule) |
| `view_activities` | View activities section |
| `view_users` | View team/staff list |
| `create_users` | Invite/create users (implies view_users) |
| `edit_users` | Edit user profiles (implies view_users) |
| `delete_users` | Deactivate/delete users (implies view_users) |
| `view_clients` | View clients list |
| `create_clients` | Create clients (implies view_clients) |
| `edit_clients` | Edit clients (implies view_clients) |
| `delete_clients` | Delete clients (implies view_clients) |
| `view_reports` | View reports, KPI, productivity, capacity dashboards |
| `admin_settings` | Access admin settings and super admin features |

### Implicit Permissions

When you grant these permissions, the user automatically gets the implied permission:

| Granted Permission | Implied Permission |
|-------------------|-------------------|
| `create_jobs` | `view_jobs` |
| `edit_jobs` | `view_jobs` |
| `delete_jobs` | `view_jobs` |
| `create_quotes` | `view_quotes` |
| `edit_quotes` | `view_quotes` |
| `delete_quotes` | `view_quotes` |
| `create_invoices` | `view_invoices` |
| `edit_invoices` | `view_invoices` |
| `delete_invoices` | `view_invoices` |
| `manage_schedule` | `view_schedule` |
| `create_users` | `view_users` |
| `edit_users` | `view_users` |
| `delete_users` | `view_users` |
| `create_clients` | `view_clients` |
| `edit_clients` | `view_clients` |
| `delete_clients` | `view_clients` |

## Common Patterns

### Pattern 1: Show/Hide Action Buttons

```typescript
function JobActions({ job }) {
  const { canEdit, canDelete } = usePermissions();
  
  return (
    <div className="flex gap-2">
      {canEdit("jobs") && (
        <Button onClick={() => editJob(job)}>Edit</Button>
      )}
      {canDelete("jobs") && (
        <Button variant="destructive" onClick={() => deleteJob(job)}>
          Delete
        </Button>
      )}
    </div>
  );
}
```

### Pattern 2: Conditional Table Columns

```typescript
function JobsTable({ jobs }) {
  const { hasPermission } = usePermissions();
  
  const columns = [
    { key: "title", title: "Title" },
    { key: "status", title: "Status" },
    // Only show actions column if user has edit or delete permission
    ...(hasPermission("edit_jobs") || hasPermission("delete_jobs")
      ? [{ key: "actions", title: "Actions" }]
      : []
    ),
  ];
  
  return <DataTable columns={columns} data={jobs} />;
}
```

### Pattern 3: Form Field Disable

```typescript
function JobForm({ job }) {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("edit_jobs");
  
  return (
    <form>
      <Input 
        name="title" 
        defaultValue={job?.title}
        disabled={!canEdit}
      />
      <Textarea 
        name="description"
        defaultValue={job?.description}
        disabled={!canEdit}
      />
      {canEdit && <Button type="submit">Save</Button>}
    </form>
  );
}
```

### Pattern 4: Backend Field-Level Control

```typescript
app.patch("/api/jobs/:id", isAuthenticated, async (req, res) => {
  const userId = getUserId(req);
  const updates: Partial<Job> = {};
  
  // Check permission for each field
  if (req.body.status && await checkPermission(userId, "edit_jobs")) {
    updates.status = req.body.status;
  }
  
  if (req.body.assignedToId && await checkPermission(userId, "manage_schedule")) {
    updates.assignedToId = req.body.assignedToId;
  }
  
  // Only update allowed fields
  const job = await storage.updateJob(req.params.id, updates);
  res.json(job);
});
```

## Testing Permissions

### Backend Test Example

```typescript
// server/__tests__/api.permissions.test.ts
describe("Permission enforcement", () => {
  it("should return 403 for jobs without view_jobs permission", async () => {
    const user = await createTestUser({ permissions: [] });
    const agent = await loginAs(user);
    
    const res = await agent.get("/api/jobs");
    
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Permission denied");
  });
  
  it("should allow access with view_jobs permission", async () => {
    const user = await createTestUser({ permissions: ["view_jobs"] });
    const agent = await loginAs(user);
    
    const res = await agent.get("/api/jobs");
    
    expect(res.status).toBe(200);
  });
  
  it("should allow access for admin role", async () => {
    const user = await createTestUser({ roles: ["admin"] });
    const agent = await loginAs(user);
    
    const res = await agent.get("/api/jobs");
    
    expect(res.status).toBe(200);
  });
});
```

### Frontend Test Example

```typescript
// client/src/hooks/use-permissions.test.ts
describe("usePermissions", () => {
  it("should return true for hasPermission when permission exists", () => {
    mockAuth({ permissions: ["view_jobs", "create_jobs"] });
    
    const { result } = renderHook(() => usePermissions());
    
    expect(result.current.hasPermission("view_jobs")).toBe(true);
    expect(result.current.hasPermission("delete_jobs")).toBe(false);
  });
  
  it("should imply view permission when create permission exists", () => {
    mockAuth({ permissions: ["create_jobs"] });
    
    const { result } = renderHook(() => usePermissions());
    
    expect(result.current.hasPermission("view_jobs")).toBe(true);
  });
});
```

## Troubleshooting

### Issue: User has permission but still can't access

1. Check if user has `isActive: true` in staff profile
2. Verify permission is spelled correctly (case-sensitive)
3. Check if implied permission is being applied
4. Verify user is not cached with old permissions (re-login)

### Issue: Navigation item not showing

1. Check if permission is in user's permissions array
2. Verify `filterNavByPermissions` is being called
3. Check if `isAdmin` flag is correctly passed

### Issue: Backend returns 403 unexpectedly

1. Check middleware order: `isAuthenticated` must come before `requirePermission`
2. Verify permission string matches exactly
3. Check if admin role check is working correctly
