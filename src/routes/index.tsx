import { createFileRoute, Link } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="max-w-xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">
          Scaffold ready
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {APP_NAME}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Infrastructure is wired up: design tokens, role system, auth backend,
          and API scaffolding are in place. Pages will be built next.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            to="/api/health"
            className="inline-flex items-center justify-center rounded-md bg-navy px-4 py-2 text-sm font-medium text-navy-foreground transition-opacity hover:opacity-90"
          >
            Check /api/health
          </Link>
        </div>
      </div>
    </div>
  );
}
