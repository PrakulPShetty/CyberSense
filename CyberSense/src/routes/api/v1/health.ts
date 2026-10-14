import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/health")({
  server: {
    handlers: {
      GET: async () => Response.json({ status: "ok", service: "sentinel-x", time: new Date().toISOString() }),
    },
  },
});
