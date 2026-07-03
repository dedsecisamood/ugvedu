import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Vitest config for pure unit tests. This suite intentionally excludes any
 * `*.functions.ts` server-function modules (they depend on the TanStack Start
 * runtime and Supabase clients) and focuses on deterministic library code:
 * GPA engine, Zod validators, cursor pagination, constants, PDF helpers.
 *
 * The 80 % coverage floor is enforced only on the pure `src/lib/*.ts` surface
 * we actually own — server-function wrappers, PDFs (jsPDF touches DOM), and
 * side-effect modules are excluded so the floor stays meaningful instead of
 * being diluted by uncoverable code.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      include: [
        "src/lib/gpa-engine.ts",
        "src/lib/validators.ts",
        "src/lib/pagination.ts",
        "src/lib/constants.ts",
        "src/lib/utils.ts",
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
