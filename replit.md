# Plaza Works Job Management App

## Overview
A multi-tenant SaaS job management system designed for trade businesses. Initially developed for Plaza Works (plumbing/renovation), its purpose has expanded to support multiple businesses through a subscription-based model. The system provides comprehensive tools for job management, scheduling, client interaction, financial tracking (quotes, invoices, payments), checklist management, productivity analysis, capacity planning, and KPI monitoring. The business vision is to provide an all-in-one solution for trade companies to streamline operations, enhance productivity, and manage their workforce effectively.

## User Preferences
I want to develop this application iteratively.
I prefer to use simple language.
Ask before making major changes.
Do not make changes to the `replit_integrations/auth/` folder.

## System Architecture
The application follows a client-server architecture.
The UI/UX design utilizes React, TypeScript, Tailwind CSS, and shadcn/ui for a modern, responsive, and component-based frontend.
The backend is built with Node.js and Express, providing RESTful API endpoints for data management.
Data persistence is handled by PostgreSQL, accessed via Drizzle ORM.
Authentication primarily uses passwordless OTP (email/SMS), with email/password and Replit Auth (Google, GitHub) as backups and fallbacks.
The system implements a multi-tenant SaaS architecture with three access levels: App owner (super-admin), Primary business admin, and SaaS customers with tiered subscriptions (Starter, Professional, Scale).
Key features include:
- **Authentication & Authorization**: Multi-method authentication and a robust role-based access control system with custom permissions and feature gating middleware based on subscription tiers.
- **Organization Management**: CRUD operations for organizations, member management with role-based access, and an invite system.
- **Job & Schedule Management**: Comprehensive job CRUD, multi-day scheduling with staff assignment, status tracking, and availability checks.
- **Client & Financial Management**: Secure client portal, quotes with line items, invoices with tax calculation and payment tracking, and quote-to-job conversion.
- **Checklist Management**: Flexible checklist system with template builders.
- **Time Tracking**: Detailed time logging and billable hours tracking.
- **Workforce Management**: Staff capacity planning, time-off management, and enhanced staff profiles with compensation and working hours configuration.
- **Performance Monitoring**: KPI dashboard with real-time tracking, traffic light indicators, daily/weekly/monthly snapshots, configurable targets, alerts, and bonus tracking based on sales phase progression.
- **Email Integration**: Resend integration for transactional emails (quote notifications, invoices, OTP login, job completion).

## Recent Changes
- Added Quote Revision System:
  - Revisions create new quote entries instead of editing existing ones, preserving full audit trail
  - Revision dialog requires a "reason for change" field to document why changes were needed
  - Revision history viewer shows all versions with revision numbers and reasons
  - Fields tracked: revisionNumber, parentQuoteId, isLatestRevision, supersededByQuoteId
  - Revision creation copies all related entities (line items, custom sections, payment schedules)
- Enhanced Payment Recording:
  - Recording invoice payment now automatically accepts linked quote and converts to job
  - Frontend shows toast notification when quote is converted to job on payment
- Quote Wizard Improvements:
  - Milestone price now required when using per-milestone pricing (form-level validation)
  - Price label changed from "Price (Optional)" to "Price"
  - Step 4 reordered: Custom Sections now appears before Terms of Trade
- Added Invoice Payment Links feature:
  - When a quote is converted to a job, an invoice is automatically created with a unique payment link token
  - Public payment page at /pay/:token allows clients to view invoice and pay deposit without authentication
  - Payment schedules from quote are linked to invoice for tracking deposit and milestone payments
  - Deposit amount is set as initial amountDue on invoice (not full total)
  - Payment recording validates amount, updates invoice status (paid/partial), and marks deposit schedule as paid
- Added read-only QuoteView page with edit warning dialog for non-draft quotes
- Added Terms Templates feature for reusable quote sections:
  - Settings page (/settings) for managing templates with rich text editor
  - Template dropdown in quote wizard Step 4 (Custom Sections) to apply saved templates
  - termsTemplates table with name, content, organizationId, and createdById fields
  - API routes with Zod validation for CRUD operations
- Removed job type as a user input from all forms (job form, quote form, jobs list filters) - field kept in schema for backward compatibility
- Added inline client creation dialog in quote wizard - users can create new clients without leaving the wizard
- Integrated Resend email service with pre-built templates
- Added unified numbering system for jobs and invoices:
  - organizationCounters table for sequential number reservation per organization
  - Jobs table updated with jobNumber, jobName, suburb, referenceNumber, quoteId, invoiceId fields
  - Quotes table updated with referenceNumber field
  - Invoices table updated with referenceNumber, clientId, paymentLinkToken fields
  - invoicePayments table for tracking individual milestone payments against a single invoice
  - numberingService.ts for number reservation, job name generation, and payment link tokens

## External Dependencies
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect), custom passwordless OTP (email/SMS)
- **Frontend UI Components**: shadcn/ui
- **State Management**: TanStack Query
- **Routing**: wouter (frontend), Express (backend)
- **Styling**: Tailwind CSS