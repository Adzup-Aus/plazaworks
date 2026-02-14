# Running Plaza Works locally

This app was exported from Replit. To run it on your machine:

## 1. Prerequisites

- **Node.js** 20.x or 22.x (recommended; Node 18 may work but Vite prefers 20+)
- **Docker** (optional – to run PostgreSQL in a container)

## 2. Run the database with Docker

Start PostgreSQL 16 in the background:

```bash
docker compose up -d db
```

This creates a database `plazaworks` with user `postgres` and password `postgres` on port `5432`. Data is stored in a Docker volume so it persists between restarts.

Stop the database when you're done:

```bash
docker compose down
```

To remove the database and its data:

```bash
docker compose down -v
```

**Port 5432 already in use?** If you have another PostgreSQL (or service) using port 5432, either stop it or change the host port in `docker-compose.yml` (e.g. `"5433:5432"`) and use `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/plazaworks` in your `.env`.

## 3. Environment variables

Copy the example env file and set your database URL:

```bash
cp .env.example .env
```

Edit `.env` and set:

- **`DATABASE_URL`** – PostgreSQL connection string, e.g.  
  `postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME`

If you use the Docker setup above, use:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/plazaworks
```

`PORT` and `SESSION_SECRET` are optional for local dev (defaults: port 5000, dev session secret).

## 4. Install dependencies

```bash
npm install
```

## 5. Create the database and tables

Create the database in PostgreSQL (if it doesn’t exist), then push the Drizzle schema:

```bash
npm run db:push
```

## 6. Start the app

```bash
npm run dev
```

The app will be at **http://localhost:5000** (or the port you set in `PORT`). The dev server runs both the Express API and the Vite frontend.

## Optional: Production build

```bash
npm run build
npm start
```

This serves the built frontend from `dist/` and expects `NODE_ENV=production` and `SESSION_SECRET` set.

## Running tests

- **Watch mode:** `npm run test`
- **Single run:** `npm run test:run`

Tests that hit the database (storage and API tests) run only when **`DATABASE_URL`** is set. Without it, those suites are skipped and only unit tests (e.g. auth-utils) run. To run the full suite locally, ensure your `.env` includes `DATABASE_URL` (same as for the app) and run the commands above.

In CI, run `npm run test:run` (optionally with coverage). Set `DATABASE_URL` in the CI environment if you want storage and API tests to run; otherwise only unit tests run.
