import { createFileRoute } from "@tanstack/react-router";

/** Placeholder — notices endpoints. */
export const Route = createFileRoute("/api/notices/")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ error: "Not implemented", resource: "notices" }, { status: 501 }),
    },
  },
});
