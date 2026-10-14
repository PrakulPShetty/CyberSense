import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Accessibility section shell (Track D).
 *
 * A sibling tree to `/assessments/*` on purpose: these results are page
 * accessibility facts from a real browser + axe-core run, and they are never
 * folded into the SENTINEL-X cyber risk score.
 */
export const Route = createFileRoute("/accessibility")({
  component: () => <Outlet />,
});
