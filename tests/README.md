# Test suite

Two layers, run separately so hermetic checks stay hermetic:

## `npm test` — unit + coverage (default, no external state)

Runs Vitest against pure library code:

- `src/lib/gpa-engine.test.ts` — full edge-case suite for the GPA/SGPA/CGPA
  rules (F blocks, Incomplete blocks, RETAKE archives, empty semesters,
  zero-credit safety, rounding).
- `src/lib/validators.test.ts` — all shared Zod schemas.
- `src/lib/pagination.test.ts` — cursor encode/decode + size caps.
- `src/lib/constants.test.ts` — grade-point invariants + role enum.
- `src/lib/utils.test.ts` — `cn()` class-name merger.

Coverage floor: **80 %** lines/statements/functions/branches, enforced on the
pure `src/lib/*.ts` surface only (`gpa-engine`, `validators`, `pagination`,
`constants`, `utils`). Server-function wrappers, PDF helpers, and Supabase
side-effect modules are excluded so the floor stays meaningful.

Break any of those rules (e.g. remove the F-blocks-semester check in
`isSemesterBlocked`) and the suite fails — verified by mutation.

## `npm run test:e2e` — Playwright user journeys (live DB)

Runs the Python-Playwright scripts in `tests/e2e/`:

- `blocked_result.py` — signs in, opens `/results`, asserts the "Please
  immediate contact to Department Head" banner is visible above the fold.
- `payment_webhook.py` — opens `/payments`, clicks Pay Now, verifies **no**
  PAID row appears before the sandbox gateway posts the webhook, then
  confirms the row flips to PAID after `Simulate success`.

These are **live-DB** tests (Lovable Cloud does not give us a second isolated
DB). They require an injected browser session — sign in through the preview
once with the target student, then run. Missing session or missing test
fixtures exit with code 77 (skipped, not failed).

Set `E2E_BASE_URL` to point at a different host; defaults to
`http://localhost:8080`.
