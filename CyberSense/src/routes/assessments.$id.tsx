import { createFileRoute } from "@tanstack/react-router";
import { AssessmentShell } from "@/components/sentinel/shell";
import { getAssessmentFn } from "@/lib/sentinel/api";

export const Route = createFileRoute("/assessments/$id")({
  loader: async ({ params }) => getAssessmentFn({ data: { id: params.id } }),
  component: AssessmentShell,
});
