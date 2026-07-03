import { createFileRoute } from "@tanstack/react-router";

/** Placeholder — courses endpoints. */
export const Route = createFileRoute("/api/courses/")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ error: "Not implemented", resource: "courses" }, { status: 501 }),
    },
  },
});
