import { useQuery } from "@tanstack/react-query";
import { useMatch } from "@tanstack/react-router";
import { getAssessmentFn, listAssessmentsFn, listControlsFn, listSimulationsFn, historyFn } from "./api.ts";
import type { AssessmentSummary, TwinSnapshot } from "./types.ts";

export function useAssessment(id: string) {
  const match = useMatch({ from: "/assessments/$id", shouldThrow: false });
  const initial = match?.loaderData as TwinSnapshot | undefined;
  return useQuery({
    queryKey: ["assessment", id],
    queryFn: () => getAssessmentFn({ data: { id } }),
    enabled: Boolean(id),
    initialData: initial?.assessmentId === id ? initial : undefined,
  });
}

export function useAssessments(initial?: AssessmentSummary[]) {
  return useQuery({
    queryKey: ["assessments"],
    queryFn: () => listAssessmentsFn(),
    initialData: initial,
  });
}

export function useControls() {
  return useQuery({
    queryKey: ["controls"],
    queryFn: () => listControlsFn(),
  });
}

export function useSimulations(assessmentId: string) {
  return useQuery({
    queryKey: ["simulations", assessmentId],
    queryFn: () => listSimulationsFn({ data: { assessmentId } }),
    enabled: Boolean(assessmentId),
  });
}

export type HistoryRow = {
  id: string;
  timestamp: string;
  score: number;
  band: string;
  criticalPaths: number;
  publicAssets: number;
  momentum: TwinSnapshot["momentum"];
};

export function useHistory(initial?: HistoryRow[]) {
  return useQuery({
    queryKey: ["history"],
    queryFn: () => historyFn(),
    initialData: initial,
  });
}
