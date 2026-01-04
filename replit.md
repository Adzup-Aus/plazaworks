# Plaza Works Job Management App

## Overview
A job management system for Plaza Works, a plumbing/renovation company. Building all 5 phases to replace their existing Fergus system.

## Current State
**Phase 4 Complete** - Vehicle Management, Checklists & Photos

### Phase 1 Complete - Foundation:
- User authentication via Replit Auth (Google, GitHub, email/password)
- User management with roles (Plumber, Plumbing Manager, Project Manager, Carpenter, Waterproofer, Tiler, Electrician, Admin)
- Employment type tracking (Permanent/Contractor)
- Custom permissions per user (independent of role)
- Job CRUD with status tracking
- Basic scheduling calendar showing jobs by date

### Phase 2 Complete - Client Portal & Notifications:
- Client portal with secure token-based access
- PC items tracking for jobs
- Notification center for system alerts

### Phase 3 Complete - Quotes, Invoices & Payments:
- Quote management with line items, numbering (Q2026-XXXX), and status tracking
- Invoice management with numbering (INV2026-XXXX), tax calculations, and payment tracking
- Quote-to-job conversion workflow
- Invoice generation from jobs/quotes via API routes
- Payment recording (bank transfer, cash, cheque) with automatic invoice status updates
- Client portal displays invoices with payment information
- **Note: Stripe integration dismissed by user** - can be added later if needed

### Phase 4 Complete - Vehicle Management, Checklists & Photos:
- Vehicle fleet management with status tracking (available, in_use, maintenance, retired)
- Vehicle-to-staff assignment with automatic status updates
- Pre-start checklists with template builder for vehicles and jobs
- Checklist item types: checkbox, text, number, photo
- Checklist execution with run history tracking
- Job photos gallery with upload functionality
- Vehicle maintenance tracking with scheduling
- Fleet management page with filtering and search
- Checklists page with templates and run history tabs

## Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)
- **Routing**: wouter (frontend), Express (backend)
- **State Management**: TanStack Query

## Project Structure
```
├── client/src/
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── app-sidebar.tsx
│   │   ├── theme-provider.tsx
│   │   └── theme-toggle.tsx
│   ├── hooks/             # Custom React hooks
│   │   ├── use-auth.ts    # Authentication hook
│   │   └── use-toast.ts
│   ├── lib/               # Utility functions
│   ├── pages/             # Route pages
│   │   ├── landing.tsx    # Public landing page
│   │   ├── dashboard.tsx  # Main dashboard
│   │   ├── jobs.tsx       # Job list
│   │   ├── job-form.tsx   # Job create/edit
│   │   ├── schedule.tsx   # Calendar view
│   │   └── team.tsx       # Team management
│   └── App.tsx            # Root component
├── server/
│   ├── replit_integrations/auth/  # Auth module
│   ├── db.ts              # Database connection
│   ├── routes.ts          # API endpoints
│   └── storage.ts         # Data access layer
└── shared/
    ├── schema.ts          # Drizzle schemas + types
    └── models/auth.ts     # Auth-related schemas
```

## Database Schema
- **users** - Auth users (managed by Replit Auth)
- **sessions** - Session storage
- **staff_profiles** - Extended user info with roles/permissions
- **jobs** - Job records with client info and status
- **schedule_entries** - Job scheduling assignments
- **quotes** - Quote records with line items
- **quote_line_items** - Individual quote items
- **invoices** - Invoice records with payment tracking
- **invoice_line_items** - Individual invoice items
- **payments** - Payment records for invoices
- **vehicles** - Company vehicle fleet
- **vehicle_assignments** - Vehicle-to-staff assignments
- **checklist_templates** - Reusable checklist templates
- **checklist_template_items** - Template items with types
- **checklist_runs** - Executed checklists
- **checklist_run_items** - Individual run item responses
- **job_photos** - Photos attached to jobs
- **vehicle_maintenance** - Vehicle maintenance records

## API Endpoints
All endpoints require authentication except login/logout.

### Auth
- `GET /api/login` - Initiate login flow
- `GET /api/logout` - Logout
- `GET /api/auth/user` - Get current user

### Staff
- `GET /api/staff` - List all staff profiles
- `GET /api/staff/:id` - Get staff profile
- `PATCH /api/staff/:id` - Update roles/permissions

### Jobs
- `GET /api/jobs` - List jobs (optional `?status=` filter)
- `GET /api/jobs/:id` - Get job
- `POST /api/jobs` - Create job
- `PATCH /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job

### Schedule
- `GET /api/schedule` - List schedule entries
- `POST /api/schedule` - Create entry
- `PATCH /api/schedule/:id` - Update entry
- `DELETE /api/schedule/:id` - Delete entry

### Vehicles (Phase 4)
- `GET /api/vehicles` - List all vehicles
- `GET /api/vehicles/:id` - Get vehicle details
- `POST /api/vehicles` - Create vehicle
- `PATCH /api/vehicles/:id` - Update vehicle
- `DELETE /api/vehicles/:id` - Delete vehicle
- `POST /api/vehicles/:id/assign` - Assign vehicle to staff
- `POST /api/vehicles/:id/return` - Return vehicle from assignment

### Checklists (Phase 4)
- `GET /api/checklist-templates` - List templates
- `POST /api/checklist-templates` - Create template
- `GET /api/checklist-templates/:id/items` - Get template items
- `POST /api/checklist-templates/:id/items` - Add template item
- `GET /api/checklist-runs` - List checklist runs
- `POST /api/checklist-runs` - Start checklist run
- `PATCH /api/checklist-runs/:id` - Update run status

### Job Photos (Phase 4)
- `GET /api/jobs/:id/photos` - List job photos
- `POST /api/jobs/:id/photos` - Add photo to job
- `DELETE /api/photos/:id` - Delete photo

### Vehicle Maintenance (Phase 4)
- `GET /api/vehicles/:id/maintenance` - List maintenance records
- `POST /api/vehicles/:id/maintenance` - Schedule maintenance
- `PATCH /api/maintenance/:id` - Update maintenance record

## User Roles
- `plumber` - Field plumber
- `plumbing_manager` - Manages plumbing team
- `project_manager` - Manages projects
- `carpenter` - Carpentry work
- `waterproofer` - Waterproofing specialist
- `tiler` - Tiling work
- `electrician` - Electrical work
- `admin` - Full system access

## Job Statuses
- `pending` - Awaiting scheduling
- `scheduled` - Scheduled for work
- `in_progress` - Work in progress
- `on_hold` - Temporarily paused
- `completed` - Work finished
- `cancelled` - Job cancelled

## Key Implementation Details

### Schedule Entry Creation
The POST /api/schedule endpoint automatically populates `staffId` from the authenticated user's staff profile. Frontend only needs to send:
- jobId
- scheduledDate
- notes (optional)

### Staff Profile Auto-Creation
When an authenticated user accesses staff-related endpoints, a staff profile is automatically created with default role "plumber" if one doesn't exist.

### Validation
All API mutations use Zod validation:
- `insertJobSchema` for job creation
- `insertScheduleEntrySchema` for schedule entries (with backend-injected staffId)
- `updateStaffSchema` for staff profile updates

## Future Phases
- **Phase 5**: Productivity tracking, backcosting, capacity dashboard
