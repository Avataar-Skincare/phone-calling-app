import { api } from "./client";
import type {
  DepartmentCode,
  LeadViewRow,
  Paginated,
  SmartViewCounts,
  SmartViewDef,
  TaskViewRow,
} from "@/types/compass";

/** Compass web's page sizes ("Rows per page"). */
export const PAGE_SIZES = [20, 50, 100] as const;
export const PAGE_SIZE = 20;

/** All tabs, both departments. Static on the server, so cached for the whole session. */
export function getSmartViewDefinitions() {
  return api.get<SmartViewDef[]>("/smart-views/definitions");
}

/** Row totals for every view in a department (server defaults, not the current filters). */
export function getSmartViewCounts(department: DepartmentCode) {
  return api.get<SmartViewCounts>("/smart-views/counts", { department });
}

/** One page of a view. `query` comes from buildViewQuery() and matches Compass web exactly. */
export function getSmartViewPage(query: Record<string, string>) {
  return api.get<Paginated<LeadViewRow | TaskViewRow>>("/smart-views/data", query);
}

// ── Filter options ──────────────────────────────────────────

/** With a department: its whole pipeline in order. Without: all active stages by label. */
export function getStageOptions(department?: DepartmentCode) {
  return api.get<{ id: string | number; code: string; label: string }[]>(
    "/smart-views/opportunity-stages",
    department ? { department } : undefined,
  );
}

export function getSourceOptions() {
  return api.get<{ source_name: string }[]>("/settings/sources/dropdown");
}

export interface OwnerOption {
  id: string | number;
  name: string;
  role?: string;
  team_id?: string | number | null;
  department_id?: string | number | null;
}

/** Not used for agents (they only ever see their own leads). */
export function getOwnerOptions() {
  return api.get<OwnerOption[]>("/agents/dropdown");
}
