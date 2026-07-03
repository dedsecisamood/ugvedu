import { createFileRoute } from "@tanstack/react-router";

/** Placeholder — students endpoints. */
export const Route = createFileRoute("/api/students/")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ error: "Not implemented", resource: "students" }, { status: 501 }),
    },
  },
});
