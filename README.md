# University of Global Village, Barishal — Student Portal

Production-grade full-stack scaffold. **Infrastructure only** — no pages yet.

---

## Stack (as actually built)

> The original brief specified Next.js + Prisma + NextAuth. This project runs
> on the Lovable platform, which ships **TanStack Start (Vite + React 19)**
> and **Lovable Cloud** (managed Postgres + auth + storage). The equivalent
> scaffold was built on that stack — same architectural goals, different
> primitives. See "Assumptions" below.

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | TanStack Start v1 (Vite 7, React 19) | File-based routing, SSR-capable, edge runtime |
| Language | TypeScript **strict** | `strict: true`, no implicit any, no unused locals |
| Styling | Tailwind CSS v4 | CSS-first config in `src/styles.css` (`@theme`, OKLCH tokens) |
| UI kit | shadcn/ui + lucide-react | Radix primitives under `src/components/ui/` |
| Backend | Lovable Cloud (Supabase under the hood) | Postgres + auth + RLS + storage, no external account needed |
| Server code | `createServerFn` + TanStack server routes (`src/routes/api/*`) | App-internal RPC + HTTP endpoints |
| Auth | Cloud Auth (email/password + Google) | JWT sessions, role-based via `user_roles` table |
| DB access | `@supabase/supabase-js` | Publishable key on client, service role only in server modules |
| Server state | TanStack Query v5 | Wired in `src/router.tsx` |
| Forms | React Hook Form + Zod | Shared schemas in `src/lib/validators.ts` |

---

## Folder architecture

```
src/
  routes/                    # File-based routing (TanStack Router)
    __root.tsx               # Root layout + <head> metadata
    index.tsx                # / (landing placeholder)
    api/
      health.ts              # GET /api/health — DB-connectivity check
      results/index.ts       # /api/results   (placeholder)
      courses/index.ts       # /api/courses   (placeholder)
      notices/index.ts       # /api/notices   (placeholder)
      payments/index.ts      # /api/payments  (placeholder)
      students/index.ts      # /api/students  (placeholder)
  components/
    ui/                      # shadcn primitives ONLY — do not edit ad hoc
    shared/                  # Composed reusable app components (empty; see README)
  lib/
    constants.ts             # GRADE_POINTS, GRADE_COLOR_TOKEN, ROLES, APP_NAME
    validators.ts            # Zod primitives (uuid, email, password, role, pagination)
    utils.ts                 # cn() and misc helpers
  types/
    index.ts                 # Shared cross-module TS interfaces
  integrations/supabase/     # AUTO-GENERATED — do not edit
    client.ts                #   browser client (publishable key)
    client.server.ts         #   admin client (service role, server-only)
    auth-middleware.ts       #   requireSupabaseAuth for server fns
    auth-attacher.ts         #   attaches bearer token to server-fn calls
    types.ts                 #   generated DB types
  hooks/                     # Custom React hooks
  styles.css                 # Tailwind v4 entry + design tokens
supabase/
  migrations/                # AUTO-GENERATED SQL migrations
```

### Route groups (built as pathless layouts, not `(parens)`)

TanStack Router uses `_authenticated/` (underscore prefix) for pathless
layout routes rather than Next's `(auth)` / `(dashboard)` convention.
When protected pages are added, they'll live under
`src/routes/_authenticated/` — the integration-managed layout there gates
the whole subtree.

---

## Design tokens (`src/styles.css`)

All colors defined as CSS variables in `oklch`, mapped to Tailwind utilities
via `@theme inline`. **Never hardcode hex or `text-white`/`bg-black` in a
component** — extend the token system instead.

| Token | Utility | Intent |
| --- | --- | --- |
| `--navy` | `bg-navy`, `text-navy` | Dark navy sidebar (~#0B1F3A) |
| `--gold` | `bg-gold`, `text-gold` | CTA / accent (~#F5B301) |
| `--sidebar` | shadcn sidebar variants | Pinned to navy |
| `--grade-a` | `bg-grade-a` | green — A |
| `--grade-a-minus` / `--grade-b-minus` | `bg-grade-a-minus` | slate — A- / B- |
| `--grade-b` | `bg-grade-b` | blue — B / B+ |
| `--grade-c` | `bg-grade-c` | amber — C variants |
| `--grade-d` | `bg-grade-d` | orange — D |
| `--grade-f` | `bg-grade-f` | red — F |

`GRADE_COLOR_TOKEN` in `src/lib/constants.ts` maps letter grades → token names.

---

## Database

### Role system

Roles live in `public.user_roles` — **never** on `profiles`. This prevents
privilege escalation via a `PATCH /profiles` request. Access is checked
via a `SECURITY DEFINER` function to avoid RLS recursion:

```sql
public.has_role(_user_id uuid, _role app_role) returns boolean
```

Enum values: `student` (default on signup), `department_head`, `admin`.

### Tables

- `public.profiles` — 1:1 with `auth.users`. Users read/update own; admins read all.
- `public.user_roles` — users read own; admins read all; writes are service-role only.
- Auto-provisioned on signup via `handle_new_user()` trigger on `auth.users`.

### Adding domain tables

Every new `public` table must, in this exact order:

1. `CREATE TABLE public.<name>(...)`
2. `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<name> TO authenticated;`
3. `GRANT ALL ON public.<name> TO service_role;`
4. `ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;`
5. `CREATE POLICY ...`

RLS without GRANTs = permission errors from the Data API.

---

## Health check

`GET /api/health` performs a real round-trip to Postgres (SELECT against
`public.profiles`) and returns:

```json
{ "status": "ok", "db": "connected", "latency_ms": 42, "timestamp": "..." }
```

Returns HTTP 503 on any DB or config failure with a diagnostic `error` field.

---

## Environment

Env is managed by the Lovable Cloud runtime — **there is no `.env.example`
to commit**. The active `.env` is auto-populated:

| Var | Where read | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser | Client bundle only |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser | Safe to expose |
| `SUPABASE_URL` | Server | Server functions / routes |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Server-side anon-scoped client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Injected at runtime; never in code |

`NEXTAUTH_SECRET` / `NEXTAUTH_URL` / `DATABASE_URL` do not apply — auth
sessions and DB connections are managed by Cloud.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Vite dev server (auto-restarted by the platform) |
| `bun run build` | Production build |
| `bun run build:dev` | Dev-mode build (used by preview) |
| `bun run preview` | Preview the production build |
| `bun run lint` | ESLint |
| `bun run format` | Prettier write |
| `bunx tsgo --noEmit` | Strict typecheck (no emit) |

---

## Assumptions

Every deviation from the original brief, and every default I picked without
asking. **Correct anything before we move on to schema design.**

1. **Framework substitution.** Next.js App Router + Prisma + NextAuth are not
   supported in this environment. Built on TanStack Start + Lovable Cloud
   instead. Same rigor, different primitives (server fns instead of `/app/api`
   route handlers; RLS + SQL migrations instead of Prisma).
2. **`src/routes/(auth)` and `(dashboard)` groups.** Not created — TanStack
   uses `_authenticated/` (pathless layout). The protected layout will be
   created together with the first auth-gated page.
3. **Auth methods.** Defaulted to email/password + Google OAuth (Lovable Cloud
   defaults). Not yet configured on the provider side — I'll wire that up when
   the sign-in page is built.
4. **Role names.** Used `student` / `department_head` / `admin` exactly as
   specified, in a Postgres enum `public.app_role`. New signups get `student`
   by default via a DB trigger.
5. **Prisma / DATABASE_URL / seed.ts.** Not applicable — Postgres is managed,
   migrations are SQL under `supabase/migrations/`. If you want seed data,
   it should also be a migration (safer than a runtime `seed.ts`).
6. **Husky pre-commit + lint-staged.** Not installed — git state is managed
   by the platform, commit hooks aren't reachable. ESLint + Prettier still run
   via `bun run lint` / `bun run format` and in CI-style build checks.
7. **`.env.example`.** Not committed. Env is injected by Cloud (see table above).
8. **`.gitignore`.** Already present and covers `node_modules`, `.env*`, build
   outputs. No Prisma-generated client to ignore.
9. **`/lib/db.ts` singleton.** Replaced by the auto-generated
   `src/integrations/supabase/client.ts` (browser) and `client.server.ts`
   (admin). Both use a proxy pattern that lazy-initializes exactly once per
   runtime — same intent as the Prisma singleton.
10. **Package versions.** React 19.2, TanStack Router/Start 1.170.x,
    Tailwind 4.2, Zod 3.24, React Hook Form 7.71, TanStack Query 5.101,
    `@supabase/supabase-js` 2.110, TypeScript 5.8.
11. **Dev port.** Vite default (8080 in this sandbox; localhost may differ
    locally).
12. **Naming conventions.** `snake_case` for DB columns, `camelCase` for TS,
    `PascalCase` for React components, kebab-case route filenames. Table names
    plural (`profiles`, `user_roles`).
13. **Grade scale.** Standard US 4.0 scale with `A / A- / B+ / B / B- / C+ / C / C- / D / F`.
    Confirm if UGV uses a different scale.
14. **`department` and `student_id`** live on `profiles` as free-text for now
    (`student_id` is UNIQUE). If departments become an entity, they'll move
    to a `departments` table with an FK.

---

## Next up

1. Confirm assumptions above.
2. Design the domain schema: `departments`, `courses`, `enrollments`,
   `semesters`, `results`, `notices`, `payments`.
3. Build the auth pages under `_authenticated/` and the sign-in flow.

---

## Demo dataset (seed)

Rebuild the demo dataset any time with:

```bash
npm run db:reset        # local (needs $DATABASE_URL)
# On Lovable Cloud: run scripts/seed.sql via the SQL runner.
```

**Contents** — see `scripts/seed.sql`:

- **Departments**: CSE, EEE (BBA left in place).
- **Semesters**: 1st Spring 2025 → 4th Spring 2026 (4th is current).
- **15 students** across CSE (8) and EEE (7), spread over sems 1–4:
  - `12521076` *Reshan* — **BLOCKED** by F in `0613-1103` Structured Programming.
  - `12521079` *Nusrat Jahan* — **CLEAN** semester (SGPA 3.20).
  - `12521080` *Fahim Hasan* — **RETAKE**: failed `0613-1103` in sem 1,
    re-enrolled in sem 2 (new grade B). Sem 2 SGPA 2.98.
  - `12521081` *Rifat Islam* — **INCOMPLETE (I)** in `0611-1303`, sem 3 BLOCKED.
  - Remaining 11 students have normal generated results.
- **1 department head** (`head.cse@ugv.edu.bd`, CSE) and **1 admin**
  (`admin@ugv.edu.bd`). All demo passwords: `DemoPass123!`.
- **5 notices** — 1 pinned university-wide, 2 dept-scoped (CSE / EEE), 2 general.
- **Payments** — every student has a semester payment; one **PAID**,
  one **OVERDUE** (Reshan), one **PARTIAL** (Fahim).

### Retake policy (assumption — confirm with UGV registrar)

**REPLACE**: when a course is retaken, the new grade fully replaces the old
for CGPA math. The original failing enrollment row is retained for the audit
trail with `enrollments.status = 'RETAKE'` and is **excluded** from SGPA/CGPA
sums. The alternative — keep the F in CGPA and add the new grade alongside —
is not implemented; flip the seed and the SGPA aggregation query in
`scripts/seed.sql` if UGV's actual policy differs.

### GPA verification (spot check)

Credit-weighted SGPA = `Σ(credits × grade_point) / Σ(credits)`.
Example — Nusrat, semester 2:

| Course | Cr | Letter | GP | Points |
|---|---:|---|---:|---:|
| 0611-1201 Data Structures | 3 | A | 3.75 | 11.25 |
| 0611-1202 DS Sessional | 1 | A- | 3.50 | 3.50 |
| 0611-1203 OOP | 3 | B | 3.00 | 9.00 |
| 0611-1204 Math II | 3 | B- | 2.75 | 8.25 |
| **Total** | **10** | | | **32.00** |

SGPA = 32.00 / 10 = **3.20** ✓ (matches `semester_results.sgpa`).
