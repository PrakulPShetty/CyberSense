import { createFileRoute } from "@tanstack/react-router";

/**
 * Readiness must be observed, not asserted: this probe runs a real query so a
 * broken database surfaces as 503 instead of a hard-coded 200.
 */
export const Route = createFileRoute("/api/v1/ready")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Dynamic so the database module never enters a client graph.
          const { getSql } = await import("@/lib/db");
          const sql = await getSql();
          await sql.query("select 1 as ok");
          return Response.json({ status: "ready", database: true, checkedAt: new Date().toISOString() });
        } catch (err) {
          return Response.json(
            {
              status: "unavailable",
              database: false,
              error: err instanceof Error ? err.message : "database check failed",
              checkedAt: new Date().toISOString(),
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
