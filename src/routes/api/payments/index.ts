import { createFileRoute } from "@tanstack/react-router";

/** Placeholder — payments endpoints. */
export const Route = createFileRoute("/api/payments/")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ error: "Not implemented", resource: "payments" }, { status: 501 }),
    },
  },
});
