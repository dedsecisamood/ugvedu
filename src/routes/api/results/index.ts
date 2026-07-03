import { createFileRoute } from "@tanstack/react-router";

/** Placeholder — results endpoints will be implemented once the schema is designed. */
export const Route = createFileRoute("/api/results/")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ error: "Not implemented", resource: "results" }, { status: 501 }),
    },
  },
});
