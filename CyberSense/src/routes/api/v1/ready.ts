import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/ready")({
  server: {
    handlers: {
      GET: async () => Response.json({ status: "ready" }),
    },
  },
});
