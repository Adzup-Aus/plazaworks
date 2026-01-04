# Plaza Works Job Management App

## Overview
A job management system for Plaza Works, a plumbing/renovation company. Building all 5 phases to replace their existing Fergus system.

## Current State
**Phase 6 (KPI Module) Complete** - All 6 phases now implemented!

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

### Phase 5 Complete - Productivity, Backcosting & Capacity:
- **Time Tracking**: Staff can log hours worked on jobs with categories (labor, travel, admin, break, training)
- **Billable Hours**: Track billable vs non-billable time with hourly rates
- **Productivity Metrics**: View staff utilization rates and hours worked
- **Job Backcosting**: Compare quoted amounts vs actual costs (labor, materials, subcontractors)
- **Cost Entries**: Record materials, equipment, and other expenses against jobs
- **Profit Analysis**: Calculate gross profit and profit margins per job
- **Capacity Planning**: View staff weekly capacity and scheduled hours
- **Time Off Management**: Request, approve, and reject leave requests
- **Staff Availability**: Configure weekly working hours per staff member

### Phase 6 Complete - KPI Module:
- **KPI Dashboard**: Real-time performance tracking with daily/weekly/monthly views
- **Traffic Light Status**: Green/Amber/Red indicators for target achievement
- **Daily Snapshots**: Track labor revenue, hours logged, jobs completed per staff
- **Weekly Snapshots**: Labor revenue, close rates, days target met
- **Monthly Snapshots**: Team-level revenue and profit tracking
- **KPI Targets**: Configurable targets by team configuration (1P+1A, 2P+2A, 3P+2A)
- **KPI Alerts**: Automated alerts for underperformance with acknowledgment workflow
- **Bonus Tracking**: Calculate bonuses based on sales phase and labor value
- **Sales Phase Progression**: 3-phase system (Learning, Growing, Full Performer)
- **Phase Checklist**: Track requirements for phase advancement

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
- **job_time_entries** - Time logged by staff on jobs
- **job_cost_entries** - Material and expense costs for jobs
- **staff_capacity_rules** - Weekly working hours per staff member
- **staff_time_off** - Leave requests with approval workflow
- **kpi_daily_snapshots** - Daily KPI metrics per staff
- **kpi_weekly_snapshots** - Weekly KPI metrics per staff
- **kpi_monthly_snapshots** - Monthly team-level KPI metrics
- **kpi_targets** - Target configurations by team size
- **kpi_alerts_log** - Underperformance alerts
- **tradesman_bonus_periods** - Bonus tracking and approval
- **phase_progression_checklist** - Phase advancement requirements
- **user_phase_log** - Sales phase change history

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

### Time Tracking (Phase 5)
- `GET /api/time-entries` - List time entries (with filters for staffId, dateFrom, dateTo)
- `GET /api/jobs/:jobId/time-entries` - Get time entries for a job
- `POST /api/jobs/:jobId/time-entries` - Log time for a job
- `PATCH /api/time-entries/:id` - Update time entry
- `DELETE /api/time-entries/:id` - Delete time entry

### Cost Entries (Phase 5)
- `GET /api/jobs/:jobId/cost-entries` - Get cost entries for a job
- `POST /api/jobs/:jobId/cost-entries` - Add cost entry to job
- `PATCH /api/cost-entries/:id` - Update cost entry
- `DELETE /api/cost-entries/:id` - Delete cost entry

### Capacity & Time Off (Phase 5)
- `GET /api/capacity-rules` - List all capacity rules
- `GET /api/capacity-rules/:staffId` - Get capacity rule for staff
- `POST /api/capacity-rules` - Create/update capacity rule
- `DELETE /api/capacity-rules/:id` - Delete capacity rule
- `GET /api/time-off` - List time off requests
- `POST /api/time-off` - Create time off request
- `POST /api/time-off/:id/approve` - Approve time off
- `POST /api/time-off/:id/reject` - Reject time off
- `DELETE /api/time-off/:id` - Delete time off request

### Analytics (Phase 5)
- `GET /api/productivity/metrics` - Staff productivity metrics
- `GET /api/backcosting` - All job backcosting summaries
- `GET /api/jobs/:jobId/backcosting` - Single job backcosting summary
- `GET /api/capacity` - Staff capacity view for a week

## All Phases Complete
The job management system is now feature-complete with all 5 phases implemented.
