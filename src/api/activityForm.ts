import { api } from "./client";
import type { ActivityFormConfig, ActivityFormPayload } from "@/types/compass";

/** Stages the agent can pick for this opportunity and the fields each stage asks for. */
export function getActivityFormConfig(opportunityId: string) {
  return api.get<ActivityFormConfig>(
    `/opportunities/${encodeURIComponent(opportunityId)}/activity-form/config`,
  );
}

/**
 * Save a call outcome: stage change, call activity, follow-up task, in one Compass transaction.
 * Same endpoint the Compass web "Activity Form" uses.
 */
export function submitActivityForm(opportunityId: string, payload: ActivityFormPayload) {
  return api.post<unknown>(`/opportunities/${encodeURIComponent(opportunityId)}/activity-form`, payload);
}
