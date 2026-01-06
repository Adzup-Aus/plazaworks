# Plaza Works Job Management App

## Overview
A multi-tenant SaaS job management system designed for trade businesses. Initially developed for Plaza Works (plumbing/renovation), its purpose has expanded to support multiple businesses through a subscription-based model. The system provides comprehensive tools for job management, scheduling, client interaction, financial tracking (quotes, invoices, payments), vehicle and checklist management, productivity analysis, backcosting, capacity planning, and KPI monitoring. The business vision is to provide an all-in-one solution for trade companies to streamline operations, enhance productivity, and manage their workforce effectively.

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
- **Asset & Checklist Management**: Vehicle fleet management with assignments and maintenance tracking, and a flexible checklist system with template builders.
- **Time & Cost Tracking**: Detailed time logging, billable hours tracking, job backcosting against actual costs, and profit analysis.
- **Workforce Management**: Staff capacity planning, time-off management, and enhanced staff profiles with compensation and working hours configuration.
- **Performance Monitoring**: KPI dashboard with real-time tracking, traffic light indicators, daily/weekly/monthly snapshots, configurable targets, alerts, and bonus tracking based on sales phase progression.

## External Dependencies
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect), custom passwordless OTP (email/SMS)
- **Frontend UI Components**: shadcn/ui
- **State Management**: TanStack Query
- **Routing**: wouter (frontend), Express (backend)
- **Styling**: Tailwind CSS