# Developer Quickstart: Remove Multi-Organization Support

**Feature**: Remove Multi-Organization Support  
**Date**: Tuesday, Feb 24, 2026

---

## Overview

This guide helps developers understand and implement the multi-organization removal changes. This is a significant architectural change that affects the database schema, backend API, and frontend code.

---

## Prerequisites

Before starting:

1. **Database Backup**
   ```bash
   pg_dump $DATABASE_URL > backup_pre_org_removal.sql
   ```

2. **Verify Current State**
   ```bash
   npm run test:env
   # All tests should pass before starting
   ```

3. **Understand the Changes**
   - Read `spec.md` for feature requirements
   - Read `data-model.md` for schema changes
   - Read `contracts/api-changes.md` for API modifications

---

## Implementation Phases

### Phase 1: Database Migration (Safe to run independently)

**File**: `server/db/migrations/XXX_remove_organizations.sql`

#### Step 1.1: Create app_settings table

```sql
-- Create new global settings table
CREATE TABLE app_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Company info (from organizations)
  company_name VARCHAR(255) NOT NULL DEFAULT 'My Company',
  company_address TEXT,
  company_phone VARCHAR(50),
  company_email VARCHAR(255),
  company_website VARCHAR(255),
  timezone VARCHAR(50) DEFAULT 'Australia/Brisbane',
  
  -- Business settings (from organization_settings)
  auto_convert_approved_quotes BOOLEAN NOT NULL DEFAULT true,
  auto_create_job_from_invoice BOOLEAN NOT NULL DEFAULT true,
  default_tax_rate DECIMAL(5,2) DEFAULT 10,
  default_payment_terms_days INTEGER DEFAULT 14,
  
  -- Numbering prefixes
  quote_number_prefix VARCHAR(10) DEFAULT 'Q-',
  invoice_number_prefix VARCHAR(10) DEFAULT 'INV-',
  job_number_prefix VARCHAR(10) DEFAULT 'J-',
  
  -- Terms
  default_quote_terms TEXT,
  default_invoice_terms TEXT,
  
  -- Features (from subscription tier)
  features_enabled TEXT[] DEFAULT ARRAY['jobs', 'schedule', 'quotes', 'invoices', 'time_tracking', 'vehicles', 'checklists'],
  
  -- Limits (optional)
  max_users INTEGER,
  max_jobs_per_month INTEGER,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create single settings record
INSERT INTO app_settings (company_name)
SELECT name FROM organizations WHERE is_owner = true LIMIT 1;

-- If no owner org, use first org
INSERT INTO app_settings (company_name)
SELECT name FROM organizations ORDER BY created_at LIMIT 1
WHERE NOT EXISTS (SELECT 1 FROM app_settings);

-- If still no record, create default
INSERT INTO app_settings DEFAULT VALUES
WHERE NOT EXISTS (SELECT 1 FROM app_settings);
```

#### Step 1.2: Migrate settings data

```sql
-- Copy organization settings to app_settings
UPDATE app_settings
SET 
  auto_convert_approved_quotes = os.auto_convert_approved_quotes,
  auto_create_job_from_invoice = os.auto_create_job_from_invoice,
  default_tax_rate = os.default_tax_rate,
  default_payment_terms_days = os.default_payment_terms_days,
  quote_number_prefix = os.quote_number_prefix,
  invoice_number_prefix = os.invoice_number_prefix,
  job_number_prefix = os.job_number_prefix,
  default_quote_terms = os.default_quote_terms,
  default_invoice_terms = os.default_invoice_terms
FROM organization_settings os
JOIN organizations o ON os.organization_id = o.id
WHERE o.is_owner = true OR o.id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1);
```

#### Step 1.3: Remove organization columns

```sql
-- Remove organization_id from clients
ALTER TABLE clients DROP COLUMN organization_id;

-- Remove organization_id from quotes
ALTER TABLE quotes DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from invoices
ALTER TABLE invoices DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from vehicles
ALTER TABLE vehicles DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from checklist_templates
ALTER TABLE checklist_templates DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from terms_templates
ALTER TABLE terms_templates DROP COLUMN IF EXISTS organization_id;
```

#### Step 1.4: Drop organization tables

```sql
-- Drop in correct order (child tables first)
DROP TABLE IF EXISTS organization_invites;
DROP TABLE IF EXISTS organization_members;
DROP TABLE IF EXISTS organization_settings;
DROP TABLE IF EXISTS organization_subscriptions;
DROP TABLE IF EXISTS organization_counters;
DROP TABLE IF EXISTS organizations;
```

#### Step 1.5: Clean up indexes

```sql
-- Remove organization-related indexes
DROP INDEX IF EXISTS idx_clients_org;
DROP INDEX IF EXISTS idx_terms_templates_org;
DROP INDEX IF EXISTS idx_invite_org;
DROP INDEX IF EXISTS idx_member_org;
DROP INDEX IF EXISTS idx_sub_org;
DROP INDEX IF EXISTS idx_settings_org;
DROP INDEX IF EXISTS idx_counter_org;
```

---

### Phase 2: Schema Code Updates

#### Step 2.1: Create new settings model

**File**: `shared/models/settings.ts`

```typescript
import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Company Information
  companyName: varchar("company_name", { length: 255 }).notNull().default("My Company"),
  companyAddress: text("company_address"),
  companyPhone: varchar("company_phone", { length: 50 }),
  companyEmail: varchar("company_email", { length: 255 }),
  companyWebsite: varchar("company_website", { length: 255 }),
  timezone: varchar("timezone", { length: 50 }).default("Australia/Brisbane"),
  
  // Business Settings
  autoConvertApprovedQuotes: boolean("auto_convert_approved_quotes").notNull().default(true),
  autoCreateJobFromInvoice: boolean("auto_create_job_from_invoice").notNull().default(true),
  defaultTaxRate: decimal("default_tax_rate", { precision: 5, scale: 2 }).default("10"),
  defaultPaymentTermsDays: integer("default_payment_terms_days").default(14),
  
  // Numbering Prefixes
  quoteNumberPrefix: varchar("quote_number_prefix", { length: 10 }).default("Q-"),
  invoiceNumberPrefix: varchar("invoice_number_prefix", { length: 10 }).default("INV-"),
  jobNumberPrefix: varchar("job_number_prefix", { length: 10 }).default("J-"),
  
  // Default Terms
  defaultQuoteTerms: text("default_quote_terms"),
  defaultInvoiceTerms: text("default_invoice_terms"),
  
  // Feature Flags
  featuresEnabled: text("features_enabled").array().default(sql`ARRAY['jobs', 'schedule', 'quotes', 'invoices', 'time_tracking', 'vehicles', 'checklists']::text[]`),
  
  // Limits
  maxUsers: integer("max_users"),
  maxJobsPerMonth: integer("max_jobs_per_month"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schema
export const insertAppSettingsSchema = createInsertSchema(appSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  defaultTaxRate: z.string().optional(),
});

// Types
export type AppSettings = typeof appSettings.$inferSelect;
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
```

#### Step 2.2: Update shared/schema.ts

Remove organization imports:
```typescript
// REMOVE this line:
export * from "./models/organizations";

// ADD this line:
export * from "./models/settings";

// REMOVE organization table imports (keep auth tables if needed):
import {
  organizations,
  termsTemplates,
  organizationCounters,
} from "./models/organizations";

// REPLACE with:
import { termsTemplates } from "./models/organizations"; // Only if still needed
import { appSettings } from "./models/settings";
```

#### Step 2.3: Simplify organizations model

**File**: `shared/models/organizations.ts`

Keep only auth-related tables, remove organization tables:

```typescript
// Remove everything except:
// - authIdentities
// - verificationCodes
// - termsTemplates (if still needed, or move to separate file)
// - TIER_CONFIG (if still needed for reference)
```

---

### Phase 3: Backend Updates

#### Step 3.1: Remove organization module

```bash
rm -rf server/modules/organizations/
```

#### Step 3.2: Update routes/index.ts

Remove organization routes registration:
```typescript
// REMOVE:
import { registerOrganizationsRoutes } from "../modules/organizations/routes";

// REMOVE from registerRoutes():
registerOrganizationsRoutes(app);
```

#### Step 3.3: Simplify middleware

**File**: `server/middleware/index.ts`

Remove or simplify:

```typescript
// REMOVE: withOrganization middleware entirely
// REMOVE: requireFeature, checkUserLimit, checkJobLimit (or simplify)
// UPDATE: requireSuperAdmin to check user role

export const requireSuperAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Check user role directly (from user record or JWT)
    const user = await authStorage.getUser(userId);
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch (err) {
    console.error("Error checking admin access:", err);
    res.status(500).json({ message: "Failed to verify admin access" });
  }
};
```

#### Step 3.4: Update storage layer

**File**: `server/storage.ts`

Remove organization methods (see research.md for full list).

Add app settings methods:

```typescript
// App settings operations
getAppSettings(): Promise<AppSettings | undefined>;
updateAppSettings(settings: Partial<InsertAppSettings>): Promise<AppSettings | undefined>;

// Implementation:
async getAppSettings(): Promise<AppSettings | undefined> {
  const results = await db.select().from(appSettings).limit(1);
  return results[0];
}

async updateAppSettings(settings: Partial<InsertAppSettings>): Promise<AppSettings | undefined> {
  const existing = await this.getAppSettings();
  if (!existing) {
    const inserted = await db.insert(appSettings).values(settings).returning();
    return inserted[0];
  }
  
  const updated = await db
    .update(appSettings)
    .set({ ...settings, updatedAt: new Date() })
    .where(eq(appSettings.id, existing.id))
    .returning();
  return updated[0];
}
```

#### Step 3.5: Create settings routes

**File**: `server/modules/settings/routes.ts`

```typescript
import type { Express } from "express";
import { storage, isAuthenticated, requireSuperAdmin } from "../../routes/shared";
import { insertAppSettingsSchema } from "@shared/schema";

export function registerSettingsRoutes(app: Express): void {
  // Get settings
  app.get("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const settings = await storage.getAppSettings();
      if (!settings) {
        return res.status(404).json({ message: "Settings not found" });
      }
      res.json(settings);
    } catch (err: any) {
      console.error("Error fetching settings:", err);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Update settings
  app.patch("/api/settings", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const validated = insertAppSettingsSchema.partial().parse(req.body);
      const updated = await storage.updateAppSettings(validated);
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating settings:", err);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });
}
```

---

### Phase 4: Frontend Updates

#### Step 4.1: Update auth hook

**File**: `client/src/hooks/use-auth.tsx`

Remove organization from auth state:

```typescript
// BEFORE:
interface AuthState {
  user: User | null;
  memberships: OrganizationMembership[];
  currentOrganization: Organization | null;
}

// AFTER:
interface AuthState {
  user: User | null;
  role: string | null;
}
```

#### Step 4.2: Update admin page

**File**: `client/src/pages/admin.tsx`

Replace organization management with settings management:

```typescript
// Use TanStack Query for settings
const { data: settings } = useQuery({
  queryKey: ["/api/settings"],
});

// Update settings mutation
const updateSettings = useMutation({
  mutationFn: (data: Partial<AppSettings>) => 
    apiRequest("PATCH", "/api/settings", data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
  },
});
```

---

### Phase 5: Testing

#### Step 5.1: Update test fixtures

Remove organization creation from test setup:

```typescript
// BEFORE:
const org = await storage.createOrganization({ name: "Test Org", slug: "test-org" });
const member = await storage.createOrganizationMember({ userId: user.id, organizationId: org.id, role: "owner" });

// AFTER:
// No organization needed
```

#### Step 5.2: Update API tests

Update tests to use new endpoints:

```typescript
// BEFORE:
const res = await request(app).get(`/api/organizations/${org.id}/settings`);

// AFTER:
const res = await request(app).get("/api/settings");
```

#### Step 5.3: Run tests

```bash
npm run test:env
```

Fix any failing tests.

---

## Verification Checklist

- [ ] Database migration runs successfully
- [ ] All organization tables removed
- [ ] app_settings table created with data
- [ ] No organizationId columns remain
- [ ] Backend starts without errors
- [ ] Organization module removed
- [ ] Middleware simplified
- [ ] Settings endpoints work
- [ ] Frontend builds successfully
- [ ] Auth flow works
- [ ] Admin settings page works
- [ ] All tests pass

---

## Rollback Instructions

If issues occur:

1. **Stop the application**

2. **Restore database**:
   ```bash
   psql $DATABASE_URL < backup_pre_org_removal.sql
   ```

3. **Revert code**:
   ```bash
   git checkout main
   # or revert to previous commit
   ```

4. **Redeploy**:
   ```bash
   npm run build
   npm run dev
   ```

---

## Common Issues

### Issue: Foreign key constraint errors

**Cause**: Trying to drop tables in wrong order

**Fix**: Ensure migration drops child tables before parent tables

### Issue: Missing data after migration

**Cause**: Settings not migrated properly

**Fix**: Check that app_settings record exists with:
```sql
SELECT * FROM app_settings;
```

### Issue: Tests fail with 404

**Cause**: Still calling old organization endpoints

**Fix**: Update test URLs to new endpoints

### Issue: Frontend crashes on login

**Cause**: Auth hook still expecting organization data

**Fix**: Update auth hook to handle new response format

---

## Support

For questions or issues:
1. Check this quickstart guide
2. Review the specification documents
3. Check the constitution for coding standards
4. Run tests to identify specific failures
