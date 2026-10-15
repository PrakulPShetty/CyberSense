import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Security section shell.
 *
 * Kept as a pure layout like `/accessibility`: the index page lives in
 * `security.index.tsx` and the saved-check detail page in `security.$id.tsx`.
 * Without this `<Outlet />` the nested `/security/$id` route never renders.
 */
export const Route = createFileRoute("/security")({
  component: () => <Outlet />,
});
