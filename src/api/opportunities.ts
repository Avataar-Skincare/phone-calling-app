import { api } from "./client";
import type { Department, OpportunityDetail } from "@/types/compass";

/** [{ id, code: "sales" | "cs", label }]. Used to turn user.departmentId into a code. */
export function getDepartments() {
  return api.get<Department[]>("/opportunities/departments");
}

/**
 * Lead screen data: lead, stage, owner, department and the latest 50 activities.
 * Compass returns 403 when the opportunity is no longer owned by (or visible to) the agent.
 */
export function getOpportunity(id: string) {
  return api.get<OpportunityDetail>(`/opportunities/${encodeURIComponent(id)}`);
}
