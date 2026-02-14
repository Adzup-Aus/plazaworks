# Plaza Works

Full-stack tradie/job management app: jobs, schedule, quotes, invoices, clients, KPI dashboard, client portal, and more.

---

## Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL with Drizzle ORM |
| **Frontend** | React 18, Vite, TypeScript |
| **Routing** | Wouter |
| **Server state** | TanStack Query (React Query) |
| **UI** | Radix UI (shadcn-style), Tailwind CSS |
| **Auth** | Session-based (express-session); optional Replit auth |
| **Tests** | Vitest, Supertest |

The backend is modular: each feature lives under `server/modules/<name>/` with `routes.ts` and `model.ts`. Shared schema and types live in `shared/` and are consumed by both server and client. See **SPECKIT_CONSTITUTION.md** for full structure and conventions.

---

## Prerequisites

- **Node.js** 18+ (or 20+ recommended)
- **PostgreSQL** (local or hosted)
- **npm** (or pnpm/yarn)

---

## Run locally

### 1. Clone and install

```bash
git clone https://github.com/abdabdii/plazaworks.git
cd plazaworks
npm install
```

### 2. Environment variables

Create a `.env` file in the project root:

```env
# Required for the app and for tests that use the DB
DATABASE_URL=postgresql://user:password@localhost:5432/plazaworks

# Optional: defaults below
PORT=5000
SESSION_SECRET=your-session-secret-change-in-production
```

- **`DATABASE_URL`** — Required. PostgreSQL connection string (e.g. `postgresql://user:password@localhost:5432/dbname`).
- **`PORT`** — Port for the server (default: `5000`).
- **`SESSION_SECRET`** — Secret for session signing. Use a strong random value in production.

### 3. Database

Create the database and run Drizzle migrations:

```bash
# Create the DB (if needed) via psql or your DB tool, then:
npm run db:push
```

### 4. Start the dev server

```bash
npm run dev
```

- Backend and Vite dev server run together.
- App: **http://localhost:5000** (or the port you set in `PORT`).
- API: **http://localhost:5000/api/...**

---

## Other commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build client (Vite) and server for production; output in `dist/`. |
| `npm run start` | Run production server (run `npm run build` first). |
| `npm run check` | TypeScript check. |
| `npm run test` | Run Vitest in watch mode (backend tests). |
| `npm run test:run` | Run tests once (no `.env`; DB tests skipped without `DATABASE_URL`). |
| `npm run test:env` | Run tests with `.env` loaded (use for full test run with DB). |
| `npm run db:push` | Push Drizzle schema to the database. |

---

## Project layout (high level)

```
├── client/                 # React frontend (Vite)
│   └── src/
│       ├── App.tsx         # Routes, auth gate, layout
│       ├── pages/          # Screen components
│       ├── components/    # UI (including ui/ primitives)
│       ├── hooks/
│       └── lib/
├── server/                 # Express backend
│   ├── index.ts            # Entry, createApp
│   ├── routes.ts           # Re-exports registerRoutes
│   ├── routes/             # shared.ts, schemas.ts, index.ts
│   ├── modules/            # Feature modules (auth, jobs, quotes, …)
│   ├── middleware/
│   ├── __tests__/          # API and storage tests
│   └── ...
├── shared/                 # Shared types and schema
│   ├── schema.ts           # Single entry (re-exports models)
│   └── models/             # Domain models (auth, organizations, jobs, …)
├── script/
│   └── build.ts            # Build script (Vite + esbuild)
├── SPECKIT_CONSTITUTION.md # Backend/frontend structure and rules
└── .env                    # Local env (create from example above)
```

For detailed conventions (modules, tests, verification), see **SPECKIT_CONSTITUTION.md**.
