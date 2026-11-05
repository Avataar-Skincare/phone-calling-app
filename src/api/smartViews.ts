import { api } from "./client";
import type {
  DepartmentCode,
  LeadViewRow,
  Paginated,
  SmartViewCounts,
  SmartViewDef,
  TaskViewRow,
} from "@/types/compass";

export const PAGE_SIZE = 25;

/** All tabs, both departments. Static on the server, so it is cached for the whole session. */
export function getSmartViewDefinitions() {
  return api.get<SmartViewDef[]>("/smart-views/definitions");
}

/** Row totals for every view in a department, already scoped to the agent. */
export function getSmartViewCounts(department: DepartmentCode) {
  return api.get<SmartViewCounts>("/smart-views/counts", { department });
}

/** One page of a view. Compass applies the agent's ownership scope. */
export function getSmartViewPage(view: string, page: number, search?: string) {
  return api.get<Paginated<LeadViewRow | TaskViewRow>>("/smart-views/data", {
    view,
    page,
    limit: PAGE_SIZE,
    search: search?.trim() || undefined,
  });
}
