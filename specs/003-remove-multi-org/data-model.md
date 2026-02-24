# Data Model: Remove Multi-Organization Support

**Feature**: Remove Multi-Organization Support  
**Date**: Tuesday, Feb 24, 2026

---

## Entity Changes Summary

### Tables Being Removed

| Table | Reason |
|-------|--------|
| `organizations` | Multi-tenancy no longer needed |
| `organizationSubscriptions` | Subscription tiers not needed for single tenant |
| `organizationMembers` | Direct user access without org membership |
| `organizationInvites` | Org-specific invites no longer applicable |
| `organizationSettings` | Converted to global `appSettings` |
| `organizationCounters` | Converted to global counters |

### Tables Being Modified (Remove organizationId)

| Table | Change |
|-------|--------|
| `clients` | Remove `organizationId` NOT NULL column |
| `quotes` | Remove `organizationId` nullable column |
| `invoices` | Remove `organizationId` nullable column |
| `vehicles` | Remove `organizationId` nullable column |
| `checklistTemplates` | Remove `organizationId` nullable column |
| `termsTemplates` | Remove `organizationId` nullable column |

### New Tables

| Table | Purpose |
|-------|---------|
| `appSettings` | Global application settings |

### Tables Unchanged

| Table | Reason |
|-------|--------|
| `authIdentities` | Not org-specific |
| `verificationCodes` | Not org-specific |
| `staffProfiles` | User-scoped, not org-scoped |
| `jobs` | Already org-agnostic |
| `activities` | Filter parameter, not FK |
| All other business entities | No org dependency |

---

## Detailed Schema Changes

### New Table: `appSettings`

Replaces `organizationSettings` with global application settings.

```typescript
// shared/models/settings.ts

export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Company Information (from organizations table)
  companyName: varchar("company_name", { length: 255 }).notNull().default("My Company"),
  companyAddress: text("company_address"),
  companyPhone: varchar("company_phone", { length: 50 }),
  companyEmail: varchar("company_email", { length: 255 }),
  companyWebsite: varchar("company_website", { length: 255 }),
  timezone: varchar("timezone", { length: 50 }).default("Australia/Brisbane"),
  
  // Business Settings (from organizationSettings)
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
  
  // Feature Flags (replaces subscription tier checking)
  featuresEnabled: text("features_enabled").array().default(sql`ARRAY['jobs', 'schedule', 'quotes', 'invoices', 'time_tracking', 'vehicles', 'checklists', 'kpi', 'backcosting']::text[]`),
  
  // Limits (optional, can be null for unlimited)
  maxUsers: integer("max_users"),
  maxJobsPerMonth: integer("max_jobs_per_month"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### Modified Table: `clients`

**Before**:
```typescript
organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
```

**After**:
- Remove `organizationId` column entirely
- Keep all other columns unchanged

### Modified Table: `quotes`

**Before**:
```typescript
organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
```

**After**:
- Remove `organizationId` column entirely
- `quoteNumber` remains unique globally

### Modified Table: `invoices`

**Before**:
```typescript
organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
```

**After**:
- Remove `organizationId` column entirely
- `invoiceNumber` remains unique globally

### Modified Table: `vehicles`

**Before**:
```typescript
organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
```

**After**:
- Remove `organizationId` column entirely

### Modified Table: `checklistTemplates`

**Before**:
```typescript
organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
```

**After**:
- Remove `organizationId` column entirely

### Modified Table: `termsTemplates`

**Before**:
```typescript
organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
```

**After**:
- Remove `organizationId` column entirely

---

## Migration Data Mapping

### Organization → AppSettings

| Source (organizations) | Target (appSettings) | Notes |
|------------------------|----------------------|-------|
| `name` | `companyName` | Primary org name becomes company name |
| `address` | `companyAddress` | |
| `phone` | `companyPhone` | |
| `email` | `companyEmail` | |
| `website` | `companyWebsite` | |
| `timezone` | `timezone` | |

### OrganizationSettings → AppSettings

| Source (organizationSettings) | Target (appSettings) | Notes |
|-------------------------------|----------------------|-------|
| `autoConvertApprovedQuotes` | `autoConvertApprovedQuotes` | |
| `autoCreateJobFromInvoice` | `autoCreateJobFromInvoice` | |
| `defaultTaxRate` | `defaultTaxRate` | |
| `defaultPaymentTermsDays` | `defaultPaymentTermsDays` | |
| `quoteNumberPrefix` | `quoteNumberPrefix` | |
| `invoiceNumberPrefix` | `invoiceNumberPrefix` | |
| `jobNumberPrefix` | `jobNumberPrefix` | |
| `defaultQuoteTerms` | `defaultQuoteTerms` | |
| `defaultInvoiceTerms` | `defaultInvoiceTerms` | |

### OrganizationSubscription → AppSettings

| Source (organizationSubscriptions) | Target (appSettings) | Notes |
|------------------------------------|----------------------|-------|
| `tier` | `featuresEnabled` | Convert tier to feature array |
| `maxUsers` | `maxUsers` | NULL if unlimited |
| `maxJobs` | `maxJobsPerMonth` | NULL if unlimited |

**Tier to Features Mapping**:
- `starter` → `['jobs', 'schedule', 'basic_reports']`
- `professional` → `['jobs', 'schedule', 'quotes', 'invoices', 'time_tracking', 'vehicles', 'checklists', 'reports']`
- `scale` → `['jobs', 'schedule', 'quotes', 'invoices', 'time_tracking', 'vehicles', 'checklists', 'kpi', 'backcosting', 'capacity_planning', 'reports']`

### OrganizationCounters → AppSettings

Counters will be handled differently - instead of per-organization counters, we'll use a simpler approach:
- Quote/Invoice/Job numbers will be globally unique
- Continue using the numbering service but without org prefix
- Alternatively, store current counter values in `appSettings` as `lastQuoteNumber`, `lastInvoiceNumber`, etc.

---

## Entity Relationships (After)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   appSettings   │     │     users       │     │ authIdentities  │
│  (1 record)     │     │   (1 per user)  │     │  (1 per auth)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  staffProfiles  │     │     clients     │     │      jobs       │
│ (user details)  │     │  (customer data)│     │  (work items)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ scheduleEntries │     │     quotes      │     │    invoices     │
│   (calendar)    │     │  (estimates)    │     │   (billing)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Key Changes**:
- No organization boundary between entities
- All data is globally accessible to authenticated users
- User roles determine access permissions

---

## Validation Rules

### appSettings

- `companyName`: Required, max 255 chars
- `defaultTaxRate`: Optional, 0-100, defaults to 10
- `defaultPaymentTermsDays`: Optional, positive integer, defaults to 14
- `timezone`: Optional, valid timezone string, defaults to "Australia/Brisbane"
- `featuresEnabled`: Array of valid feature strings

### Removed Validation

- No organization membership validation required
- No subscription tier validation required
- No organization-scoped uniqueness constraints

---

## Indexes to be Modified

### Remove Organization Indexes

```sql
-- From clients table
DROP INDEX "idx_clients_org";

-- From termsTemplates table  
DROP INDEX "idx_terms_templates_org";
```

### Keep/Modify Indexes

All other indexes remain unchanged (no org dependency).

---

## Data Integrity Considerations

### During Migration

1. **Foreign Key Constraints**: Must drop in correct order (child tables first)
2. **Data Loss Prevention**: All data from dependent tables preserved
3. **Uniqueness**: Global uniqueness constraints still apply (quote numbers, invoice numbers)
4. **Defaults**: New appSettings record created with sensible defaults if no org data exists

### Post-Migration

1. **No Orphaned Records**: All records have valid references
2. **Global Uniqueness**: Quote/Invoice numbers unique across entire system
3. **Settings Availability**: Exactly one appSettings record exists
