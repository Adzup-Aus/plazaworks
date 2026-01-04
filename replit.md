# Plaza Works Job Management App

## Overview
A job management system for Plaza Works, a plumbing/renovation company. Building all 5 phases to replace their existing Fergus system.

## Current State
**Phase 3 In Progress** - Quotes, Invoices & Payments:

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

### Phase 3 In Progress - Quotes, Invoices & Payments:
- Quote management with line items, numbering (Q2024-0001), and status tracking
- Invoice management with numbering (INV2024-0001), tax calculations, and payment tracking
- Quote-to-job conversion workflow
- Invoice generation from jobs/quotes
- Payment recording (bank transfer, cash, cheque) with automatic invoice status updates
- **Note: Stripe integration dismissed by user** - can be added later if needed

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
- **Phase 2**: Client portal, PC items, notifications
- **Phase 3**: Quotes, invoices, payments
- **Phase 4**: Vehicle management, checklists, photo uploads
- **Phase 5**: Productivity tracking, backcosting, capacity dashboard
