# Speckit Constitution

This document defines the **backend and frontend structure** and **mandatory rules** for adding or changing features. All contributors and tooling MUST follow it.

**Canonical source:** `SPECKIT_CONSTITUTION.md` in the project root. This file is the spec-kit memory copy and MUST match that structure and content.

---

## 1. Backend structure

### 1.1 Overview

The backend is **modular**. Each feature lives in its own **module folder** under `server/modules/`. Shared data shapes (schema, types) live in `shared/` and are re-exported via `shared/schema.ts`.

```
server/
├── index.ts                 # App entry, creates Express app and registers routes
├── routes.ts                # Thin re-export: registerRoutes from routes/index
├── routes/
│   ├── index.ts             # Registers ALL module routes (single place to wire modules)
│   ├── shared.ts            # Shared: storage, auth helpers, middleware (use in modules)
│   └── schemas.ts           # Shared Zod schemas used across modules
├── modules/                 # Feature modules (one folder per feature)
│   ├── auth/
│   │   ├── routes.ts        # Express routes + registerAuthRoutes(app)
│   │   └── model.ts         # Re-exports from @shared/schema for this feature
│   ├── jobs/
│   │   ├── routes.ts
│   │   └── model.ts
│   ├── schedule/
│   ├── quotes/
│   ├── invoices/
│   ├── clients/
│   ├── ...                  # One folder per feature
│   └── pay/
├── middleware/              # Auth, tenant, feature flags, etc.
├── storage.ts               # Data access layer (uses schema)
├── db.ts                    # Drizzle client + schema
└── __tests__/               # Backend tests (API + storage)

shared/
├── schema.ts                # Single entry: re-exports all models + remaining tables
└── models/                  # One file per domain (used by schema.ts)
    ├── auth.ts
    ├── organizations.ts
    ├── staff.ts
    ├── clients.ts
    ├── jobs.ts
    └── schedule.ts
```

### 1.2 Module folder (required shape)

Every feature **must** use a **module folder** under `server/modules/<featureName>/` with:

| File        | Purpose |
|------------|--------|
| `routes.ts` | Register Express routes for this feature. Export a single function `register<Feature>Routes(app: Express): void`. Use `../../routes/shared` for storage, auth, middleware; use `./model` for schema/types. |
| `model.ts`  | Re-export from `@shared/schema` only what this feature needs (tables, insert schemas, types). Keeps the module self-contained. |

- **Naming:** Folder name is lowercase, e.g. `jobs`, `clientPortal`, `jobPhotos`.
- **Registration:** The feature is wired in `server/routes/index.ts` by importing `register<Feature>Routes` from `../modules/<featureName>/routes` and calling it inside `registerRoutes()`.

### 1.3 Shared layer

- **`server/routes/shared.ts`** – Exports `storage`, `isAuthenticated`, `requireUserId`, `ensureStaffProfile`, `withOrganization`, `clientPortalAuth`, etc. Modules must import these from `../../routes/shared` (or the correct relative path).
- **`server/routes/schemas.ts`** – Shared Zod schemas (e.g. `updateStaffSchema`). Import from `../../routes/schemas` when needed.
- **`shared/schema.ts`** – Re-exports all of `shared/models/*` and defines any remaining tables/relations. Consumers import from `@shared/schema`. New domains should get a file in `shared/models/<domain>.ts` and a re-export (and any local imports) in `shared/schema.ts`.

### 1.4 Data / schema

- **Drizzle** tables, relations, and insert schemas live in `shared/` (either in `shared/schema.ts` or in `shared/models/<domain>.ts`).
- **`shared/models/*.ts`** – One file per domain (auth, organizations, staff, clients, jobs, schedule, etc.). Each exports tables, relations, insert schemas, and types. Cross-model relations that need multiple models can stay in `shared/schema.ts`.
- **`server/modules/<feature>/model.ts`** – Does **not** define new tables; it only re-exports from `@shared/schema` so the feature’s `routes.ts` can import from `./model`.

---

## 2. Rules for new features and modifications

### 2.1 Module structure (mandatory)

When you **add a new backend feature**:

1. **Create a module folder:**  
   `server/modules/<featureName>/`  
   Example: `server/modules/estimates/`.

2. **Add `routes.ts`**  
   - Implement the Express routes.  
   - Export `register<Feature>Routes(app: Express): void`.  
   - Import shared dependencies from `../../routes/shared` (and `../../routes/schemas` if needed).  
   - Import schema/types from `./model`.

3. **Add `model.ts`**  
   - Re-export from `@shared/schema` only the tables, insert schemas, and types this feature needs.  
   - Do not define new tables in `model.ts`; new tables go in `shared/schema.ts` or `shared/models/<domain>.ts`.

4. **Register the module**  
   - In `server/routes/index.ts`:  
     - Add:  
       `import { register<Feature>Routes } from "../modules/<featureName>/routes";`  
     - Call `register<Feature>Routes(app)` inside `registerRoutes()` in the desired order.

If the feature needs **new tables or enums**:

- Add them in `shared/schema.ts` or in a new `shared/models/<domain>.ts` and re-export (and import where needed) in `shared/schema.ts`.  
- Then re-export the relevant symbols in the feature’s `model.ts` from `@shared/schema`.

**You MUST NOT** add new feature routes as loose files under `server/routes/`. All feature routes live under `server/modules/<featureName>/routes.ts`.

### 2.2 Tests (mandatory)

For **every new feature or meaningful modification**:

1. **Write tests**  
   - Prefer **API tests** in `server/__tests__/api.<feature>.test.ts` that call HTTP endpoints (e.g. via `createApp()` or your test harness).  
   - Optionally add **storage tests** in `server/__tests__/storage.<feature>.test.ts` for complex data logic.  
   - Tests should cover:  
     - Happy paths (create, read, update, delete where applicable).  
     - Auth/authorization (e.g. 401 when unauthenticated).  
     - Validation (e.g. 400 for invalid body).

2. **Use the same patterns as existing tests**  
   - Use `describe.runIf(hasDb)` (or your project’s equivalent) so tests that need a DB are skipped when `DATABASE_URL` is not set.  
   - When `DATABASE_URL` is set (e.g. via `.env`), tests should run against that environment.

### 2.3 Verification (mandatory)

After **any** change (new feature or modification):

1. **Run the full test suite with env**  
   ```bash
   npm run test:env
   ```  
   This runs Vitest with `dotenv` so `DATABASE_URL` and other env vars from `.env` are loaded.

2. **Ensure nothing is broken**  
   - All tests must pass.  
   - If any test fails, fix the regression or adjust the implementation before considering the change done.

**Rule:** Do not merge or ship backend changes that have not passed `npm run test:env` after the change.

---

## 3. Frontend structure

### 3.1 Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React 18 |
| **Build** | Vite (root: `client/`) |
| **Routing** | Wouter (`Switch`, `Route`, `Link`, `useLocation`) |
| **Server state** | TanStack Query (React Query) – `useQuery`, `useMutation`, `queryClient` |
| **UI primitives** | Radix UI (via shadcn-style components) |
| **Styling** | Tailwind CSS + CSS variables (themes) |
| **Icons** | Lucide React |
| **Forms** | React Hook Form + Zod (via `@hookform/resolvers`) where applicable |
| **Types** | Shared types from `@shared/schema` or `@shared/models/*` |

### 3.2 Folder layout

```
client/
├── index.html
├── src/
│   ├── main.tsx              # Entry: createRoot, render <App />
│   ├── App.tsx                # Providers, auth gate, PublicRouter vs AuthenticatedLayout, route tree
│   ├── index.css              # Tailwind + theme CSS variables (light/dark)
│   ├── pages/                 # Route-level components (one per screen)
│   │   ├── landing.tsx
│   │   ├── login.tsx
│   │   ├── dashboard.tsx
│   │   ├── jobs.tsx
│   │   ├── quotes.tsx
│   │   └── ...
│   ├── components/            # Reusable UI
│   │   ├── ui/                # Primitive/building-block components (button, card, input, etc.)
│   │   ├── app-sidebar.tsx
│   │   ├── theme-provider.tsx
│   │   ├── theme-toggle.tsx
│   │   ├── notification-center.tsx
│   │   └── ...
│   ├── hooks/                 # Custom hooks (useAuth, useToast, useMobile, useUpload)
│   └── lib/                   # Utilities and shared config
│       ├── queryClient.ts     # TanStack Query client + apiRequest, getQueryFn
│       ├── utils.ts           # e.g. cn() for class names
│       └── auth-utils.ts
```

### 3.3 Path aliases (Vite)

| Alias | Resolves to |
|-------|-------------|
| `@` | `client/src` |
| `@shared` | `shared` |
| `@assets` | `attached_assets` |

Use `@/...` for anything under `client/src` (e.g. `@/components/ui/button`, `@/hooks/use-auth`, `@/pages/jobs`). Use `@shared/schema` or `@shared/models/<domain>` for types and enums.

### 3.4 App and routing

- **Providers (in order):** `QueryClientProvider` → `ThemeProvider` → `TooltipProvider`. Toaster and layout live inside.
- **Auth gate:** `AppContent` uses `useAuth()`. Public routes (landing, login, register, invite, portal, pay) render `PublicRouter` when unauthenticated or on public paths; otherwise `AuthenticatedLayout` with sidebar and `AuthenticatedRouter`.
- **Routes:** Defined in `App.tsx` in `PublicRouter` and `AuthenticatedRouter`. New screens require a new `Route` and a page component under `client/src/pages/`.
- **Pages:** Default export. Use TanStack Query for data; use `queryKey` as the API path array (e.g. `queryKey: ["/api/jobs"]`) when using the default `getQueryFn` from `lib/queryClient.ts`. For mutations, use `apiRequest(method, url, body)` or `fetch` with `credentials: "include"`.

### 3.5 Data and API

- **Server state:** Use TanStack Query. Prefer `queryKey: ["/api/..."]` to match backend paths so `getQueryFn` works.
- **Types:** Import from `@shared/schema` (e.g. `Job`, `Quote`, `jobStatuses`) or `@shared/models/auth` for `User`/`Session`. Do not redefine backend types in the client.
- **API calls:** Use `apiRequest("GET"|"POST"|"PATCH"|"DELETE", url, body?)` from `@/lib/queryClient` for JSON APIs with credentials. Use `useMutation` + `queryClient.invalidateQueries` after mutations to refresh lists/detail.

### 3.6 Styling and UI

- **Tailwind:** Use utility classes. Use the `cn()` helper from `@/lib/utils` when merging conditional classes.
- **Theming:** Use CSS variables from `index.css` (e.g. `bg-background`, `text-foreground`, `border`, `primary`). Prefer semantic tokens over hard-coded colors.
- **Components:** Use components from `@/components/ui/` for consistency. Add new primitives there when needed; keep feature-specific composition in `components/` or inline in pages.

---

## 4. Frontend conventions (mandatory)

When you **add or change a frontend feature**:

1. **New screen / route**  
   - Add a page component under `client/src/pages/<name>.tsx` (default export).  
   - Add the corresponding `Route` in `App.tsx` in either `PublicRouter` or `AuthenticatedRouter`.  
   - Use a path that matches the backend API and product naming (e.g. `/jobs`, `/quotes/:id`).

2. **Data fetching**  
   - Use **TanStack Query** for all server data. Use `queryKey: ["/api/..."]` for GET-style queries so the default `queryFn` works where applicable.  
   - Invalidate or refetch queries after mutations (e.g. `queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })`).

3. **Imports**  
   - Use path aliases: `@/` for client code, `@shared/` for shared types/schema.  
   - Import types from `@shared/schema` or `@shared/models/*`; do not duplicate backend types.

4. **UI**  
   - Compose from `@/components/ui/` and existing `@/components/`.  
   - Use Tailwind and theme tokens; use `cn()` for conditional classes.

5. **Auth-aware UI**  
   - Use `useAuth()` from `@/hooks/use-auth` when you need the current user, loading state, or logout.  
   - Public routes must work without auth; authenticated routes are already gated in `AppContent`.

**Rule:** New UI that calls a new or changed backend API must align with the backend module and contract. Backend changes that affect the API require corresponding frontend updates and still require `npm run test:env` to pass.

---

## 5. Summary checklist

**Backend (new or modified feature):**

- [ ] Feature lives under `server/modules/<featureName>/` with `routes.ts` and `model.ts`.
- [ ] `routes.ts` exports `register<Feature>Routes(app)` and is registered in `server/routes/index.ts`.
- [ ] `model.ts` only re-exports from `@shared/schema`; no new table definitions in the module.
- [ ] New tables/enums live in `shared/schema.ts` or `shared/models/<domain>.ts` and are re-exported from `shared/schema.ts`.
- [ ] New or updated tests exist in `server/__tests__/` (API and/or storage as appropriate).
- [ ] `npm run test:env` has been run and all tests pass.

**Frontend (new or modified feature):**

- [ ] New screens: page in `client/src/pages/` and `Route` added in `App.tsx` (PublicRouter or AuthenticatedRouter).
- [ ] Data: TanStack Query with `queryKey`/`queryFn`; types from `@shared/schema` or `@shared/models/*`.
- [ ] Imports use `@/` and `@shared/`; UI uses `@/components/ui/` and Tailwind/theme tokens.
- [ ] If the change touches an API, backend tests still pass (`npm run test:env`).

---

## 6. Script reference

| Script | Purpose |
|--------|--------|
| `npm run dev` | Start full-stack dev server (backend + client). |
| `npm run build` | Build client (Vite) and server; output under `dist/`. |
| `npm run test` | Start Vitest in watch mode (backend tests). |
| `npm run test:run` | Run tests once (no env file). |
| `npm run test:run:env` | Run tests once with `dotenv` (loads `.env`). |
| **`npm run test:env`** | **Same as `test:run:env`. Use to verify after backend/full-stack changes.** |

The constitution requires using **`npm run test:env`** after any backend (or API-touching) change to verify that nothing is broken. Frontend-only changes should still be manually verified; if the project adds client-side tests later, extend this requirement to include them.
