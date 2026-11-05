import { useQuery } from "@tanstack/react-query";
import { getActivityFormConfig } from "@/api/activityForm";
import { queryClient } from "@/api/queryClient";

const STALE_MS = 10 * 60_000;
const key = (opportunityId: string) => ["activity-form", opportunityId] as const;

export function useActivityFormConfig(opportunityId: string | null | undefined) {
  return useQuery({
    queryKey: key(opportunityId ?? ""),
    queryFn: () => getActivityFormConfig(opportunityId!),
    enabled: !!opportunityId,
    staleTime: STALE_MS,
    // Keep it for the whole call, even if no screen is using it meanwhile.
    gcTime: 60 * 60_000,
  });
}

/**
 * Fetch the form while the agent is still on the call, so the outcome sheet opens instantly and
 * still works if the network drops before the call ends.
 */
export function prefetchActivityFormConfig(opportunityId: string | null | undefined) {
  if (!opportunityId) return;
  void queryClient.prefetchQuery({
    queryKey: key(opportunityId),
    queryFn: () => getActivityFormConfig(opportunityId),
    staleTime: STALE_MS,
    gcTime: 60 * 60_000,
  });
}
