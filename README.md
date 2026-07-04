# UGV Student Portal

A student portal for University of Global Village (UGV), Barishal. Think results, courses, notices, and payments, all in one place for students, department heads, and admins.

**Current status:** infrastructure is done. No actual pages yet. This is the foundation, not the house.

---

## What's inside

The original plan was Next.js + Prisma + NextAuth. That's not what got built. This runs on **Lovable**, so the stack looks like this instead:

| Layer | Tech |
|---|---|
| Framework | TanStack Start (Vite + React 19) |
| Language | TypeScript, strict mode on |
| Styling | Tailwind CSS v4 |
| UI components | shadcn/ui + lucide-react icons |
| Backend | Lovable Cloud (Postgres + auth + storage, powered by Supabase) |
| Server logic | TanStack server functions and API routes |
| Auth | Email/password + Google login |
| Data fetching | TanStack Query |
| Forms | React Hook Form + Zod |

Same end goal as the original brief, just built with different tools since Next.js and Prisma aren't part of this environment.

---

## Folder structure

```
src/
  routes/                 # Pages and API routes (file-based)
    api/
      health.ts           # GET /api/health - checks the database is alive
      results/            # placeholder
      courses/            # placeholder
      notices/            # placeholder
      payments/           # placeholder
      students/           # placeholder
  components/
    ui/                   # shadcn components, don't hand-edit these
    shared/                # reusable app components (empty for now)
  lib/
    constants.ts          # grade points, roles, app name
    validators.ts          # Zod validation rules
    utils.ts              # small helper functions
  types/                  # shared TypeScript types
  integrations/supabase/  # auto-generated, don't touch by hand
  hooks/                  # custom React hooks
  styles.css              # design tokens and Tailwind setup
supabase/
  migrations/             # database migration files (auto-generated)
```

Protected pages (the ones only logged-in users can see) will live under `src/routes/_authenticated/` once they're built.

---

## Design system

Colors are set up as design tokens in `src/styles.css`, not hardcoded hex values. Main ones:

- **Navy** - sidebar background
- **Gold** - buttons and highlights
- **Grade colors** - A is green, B is blue, C is amber, D is orange, F is red

If you're adding UI, use the existing tokens (`bg-navy`, `text-gold`, etc.) instead of typing in a hex code. Keeps things consistent.

---

## Database

### Roles

There are three roles: `student`, `department_head`, and `admin`. New signups get `student` automatically.

Roles are kept in their own table (`user_roles`), separate from user profiles. This is on purpose — it stops someone from sneaking themselves admin access through a profile update.

### Main tables so far

- `profiles` - one row per user, holds name, department, student ID, etc.
- `user_roles` - who has what role

More tables (courses, results, notices, payments) are planned next.

### Adding a new table

Every new table needs to go through this checklist, in order:
1. Create the table
2. Grant permissions to logged-in users
3. Grant full permissions to the backend service
4. Turn on Row Level Security
5. Add security policies

Skipping step 4 or 5 means either broken permissions or a wide-open table. Neither is good.

---

## Health check

`GET /api/health` pings the database and tells you if it's alive:

```json
{ "status": "ok", "db": "connected", "latency_ms": 42, "timestamp": "..." }
```

If the database is down, it returns a 503 with an error message instead of failing silently.

---

## Environment variables

No `.env.example` file here — Lovable Cloud handles this automatically. For reference, here's what exists behind the scenes:

| Variable | Used where |
|---|---|
| `VITE_SUPABASE_URL` | Browser |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser |
| `SUPABASE_URL` | Server |
| `SUPABASE_PUBLISHABLE_KEY` | Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only, injected at runtime, never in code |

---

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Starts the dev server |
| `bun run build` | Builds for production |
| `bun run preview` | Preview the production build locally |
| `bun run lint` | Runs ESLint |
| `bun run format` | Formats code with Prettier |
| `bunx tsgo --noEmit` | Type-checks without building |

---

## Demo data

There's a seed dataset for testing, covering:

- 2 departments (CSE, EEE)
- 15 students spread across 4 semesters
- A few tricky test cases on purpose:
  - One student blocked by a failing grade
  - One student who retook a failed course and passed the second time
  - One student with an incomplete grade
  - The rest are just normal, clean records
- 1 department head and 1 admin account
- 5 notices (mix of pinned, department-specific, and general)
- 3 payment states: paid, overdue, and partially paid

All demo accounts use the password `DemoPass123!`

To rebuild the demo data locally:
```bash
npm run db:reset
```
On Lovable Cloud, run `scripts/seed.sql` through the SQL runner instead.

### A note on retakes

If a student fails a course and retakes it, the new grade replaces the old one in their CGPA. The failing attempt still shows up in their record for audit purposes, it's just excluded from the GPA math. This is an assumption — worth confirming with the actual UGV registrar policy before going live.

---

## What's built vs. what's next

**Done:**
- Project scaffolding, database setup, auth wiring, health check endpoint, demo data

**Not done yet:**
- Actual pages (dashboard, results, courses, notices, payments)
- Sign-in / sign-up screens
- Schema for courses, enrollments, semesters, and results

---

## A few assumptions worth double-checking

- Grading uses a standard 4.0 scale (A through F). Confirm this matches UGV's real scale.
- Auth is email/password + Google for now. Not yet turned on with the provider.
- Department and student ID are plain text fields on the profile for now. If departments need their own table later, that's a quick migration away.


MADE for fun
