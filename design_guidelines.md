# Plaza Works Job Management App - Design Guidelines

## Design Approach
**Selected System:** Linear-inspired design system with Asana's clarity for data-heavy interfaces
**Rationale:** This is a utility-focused productivity tool requiring exceptional usability for diverse user roles (plumbers to managers) with information-dense views (job lists, schedules, user management). Clean, professional aesthetic that works equally well on desktop for office staff and mobile for field workers.

---

## Core Design Principles
1. **Clarity Over Decoration** - Every element serves a functional purpose
2. **Role-Aware Hierarchy** - Information organized by user role and task priority
3. **Scannable Data** - Dense information presented in digestible chunks
4. **Action-Oriented** - Primary actions always obvious and accessible
5. **Professional Utility** - Trustworthy aesthetic appropriate for trade business

---

## Typography System

**Font Families:**
- Primary: Inter (via Google Fonts CDN) - UI, headings, body text
- Monospace: JetBrains Mono - data tables, IDs, timestamps

**Type Scale:**
- Page Headers: text-3xl font-bold (30px)
- Section Headers: text-xl font-semibold (20px)
- Card Titles: text-base font-semibold (16px)
- Body Text: text-sm font-normal (14px)
- Meta/Labels: text-xs font-medium uppercase tracking-wide (12px)
- Table Data: text-sm font-normal (14px)

---

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, and 8 consistently
- Component padding: p-4 to p-6
- Section spacing: gap-4 to gap-6
- Page margins: px-6 py-8
- Card spacing: p-6

**Grid Structure:**
- Main container: max-w-7xl mx-auto
- Two-column layouts: grid grid-cols-1 lg:grid-cols-3, with 2:1 or 1:2 ratios
- Card grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4

**Application Shell:**
- Left sidebar navigation (240px fixed width on desktop, hidden on mobile)
- Top bar with user menu, role indicator, notifications (h-16)
- Main content area with consistent padding
- Mobile: Bottom tab bar for primary navigation

---

## Component Library

### Navigation
- **Sidebar:** Fixed left panel with logo, role-based menu items, icon+label format
- **Top Bar:** Search, quick actions, user profile dropdown, notification badge
- **Mobile Nav:** Sticky bottom tabs with icons for primary sections

### Data Display
- **Job Cards:** Compact cards showing client name, job type, status badge, assigned workers, next action
- **Tables:** Striped rows, sticky headers, sortable columns, row hover states, inline actions
- **Status Badges:** Rounded-full px-3 py-1 text-xs font-medium
- **Calendar View:** Week/month grid, job blocks with truncated titles, drag-capable cells

### Forms
- **Input Fields:** Consistent height (h-10), rounded borders, clear labels above, helper text below
- **Dropdowns:** Custom styled selects matching input aesthetic
- **Multi-select:** Pill-style selected items with remove buttons
- **Form Layouts:** Single column on mobile, two-column on desktop for related fields

### Overlays
- **Modals:** Centered, max-w-2xl, with header, scrollable content, sticky footer actions
- **Slide-overs:** Right-side panel (w-96) for quick edits and detail views
- **Dropdowns:** Subtle shadow, rounded corners, clean list items

### Feedback
- **Toast Notifications:** Top-right corner, auto-dismiss after 5s, icon + message + close
- **Loading States:** Skeleton screens for lists, spinner for actions
- **Empty States:** Centered illustration placeholder, helpful CTA, subtle background

---

## Authentication Pages

**Login Page:**
- Centered card (max-w-md) with Plaza Works logo
- Clerk authentication component
- Clean, minimal background
- "Job Management System" subtitle
- Role selection after login if multiple roles assigned

**Layout:** Full-height centered flex container, subtle gradient background

---

## Key Application Views

### Dashboard
- Quick stats cards in 3-column grid: Active Jobs, Today's Schedule, Pending Actions
- Recent activity feed
- Upcoming jobs list with mini calendar preview

### Job List
- Filterable table/card hybrid view
- Filter pills for status, role, date range
- Search bar prominent at top
- Each job shows: client, address, status, assigned workers, next milestone
- Quick actions: Edit, Schedule, View Details

### Job Creation Form
- Multi-step if needed, or single scrollable form
- Clear section breaks with subtle dividers
- Autosave indication
- Validation errors inline and at form level
- Sticky bottom action bar with Cancel/Save Draft/Create buttons

### Calendar Schedule
- Week view default, month view option
- Time slots on Y-axis, dates on X-axis
- Job blocks show job type icon + client name
- Worker avatars/initials in assigned slots
- Click to view details, drag to reschedule (future)

### User Management
- Table view with role badges
- Quick filters: By Role, By Employment Type
- Inline permission editing via dropdown
- Add User button prominent in top-right

---

## Icons
**Library:** Heroicons (via CDN)
- Navigation: outline style
- Inline actions: mini solid style
- Status indicators: solid style
- Empty states: outline style at larger sizes

---

## Spacing & Rhythm
- Consistent section padding: py-8
- Card spacing: mt-6 between major sections
- Form field spacing: space-y-4
- Table row height: h-12
- Buttons: h-10 standard, h-8 compact

---

## Responsive Behavior
- Mobile (base): Single column, stacked navigation, full-width cards
- Tablet (md:): Two-column layouts where appropriate, visible sidebar
- Desktop (lg:): Three-column grids, full application shell, increased spacing

---

## Accessibility
- All interactive elements: min 44×44px touch targets
- Form labels: always visible, never placeholder-only
- Focus indicators: visible ring on all interactive elements
- ARIA labels for icon-only buttons
- Keyboard navigation fully supported

---

## Images
**Hero/Marketing:** Not applicable - this is an internal application
**User Avatars:** Circular, 40px default size, initials fallback
**Empty States:** Simple line illustrations or icons at 64-96px size

---

This system prioritizes data density without overwhelming users, maintains consistency across all user roles, and supports the technical team's modular architecture approach.