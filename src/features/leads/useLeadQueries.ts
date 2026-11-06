import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { getDepartments, getOpportunity } from "@/api/opportunities";
import {
  getOwnerOptions,
  getSmartViewCounts,
  getSmartViewDefinitions,
  getSmartViewPage,
  getSourceOptions,
  getStageOptions,
} from "@/api/smartViews";
import { formatSourceName } from "@/lib/format";
import { useAuthStore } from "@/store/auth.store";
import type { CompassRole, DepartmentCode, SmartViewDef } from "@/types/compass";
import { mergePages, toLeadItem } from "./leadItem";
import { buildViewQuery, type Filters, type Option, type StageOptions, type ViewConfig } from "./viewConfig";

export const leadKeys = {
  definitions: ["smart-views", "definitions"] as const,
  departments: ["departments"] as const,
  counts: (dept: DepartmentCode) => ["smart-views", "counts", dept] as const,
  view: (query: Record<string, string>) => ["smart-views", "data", query] as const,
  stages: (department?: string) => ["options", "stages", department ?? "active"] as const,
  sources: ["options", "sources"] as const,
  owners: ["options", "owners"] as const,
  opportunity: (id: string) => ["opportunity", id] as const,
};

/**
 * The user's department code ("sales" | "cs"), or null when they have none or another one
 * (e.g. "Central"). Compass shows both department tabs to everyone; this picks the default.
 */
export function useUserDepartment() {
  const departmentId = useAuthStore((s) => s.session?.user.departmentId ?? null);
  const query = useQuery({
    queryKey: leadKeys.departments,
    queryFn: getDepartments,
    staleTime: Infinity,
    enabled: departmentId !== null,
  });
  const code = useMemo<DepartmentCode | null>(() => {
    if (departmentId === null) return null;
    const d = query.data?.find((x) => String(x.id) === String(departmentId));
    return d?.code === "sales" || d?.code === "cs" ? d.code : null;
  }, [query.data, departmentId]);
  const isLoading = departmentId !== null && query.isLoading;
  const canSwitch = !isLoading && code === null;
  return { code, canSwitch, isLoading, error: query.error };
}

export function useSmartViewDefinitions(department: DepartmentCode | null) {
  const query = useQuery({
    queryKey: leadKeys.definitions,
    queryFn: getSmartViewDefinitions,
    staleTime: Infinity,
  });
  const views = useMemo<SmartViewDef[]>(
    () => (department ? (query.data ?? []).filter((v) => v.department === department) : []),
    [query.data, department],
  );
  return { ...query, views };
}

export function useSmartViewCounts(department: DepartmentCode | null) {
  return useQuery({
    queryKey: leadKeys.counts(department ?? "sales"),
    queryFn: () => {
      // Backstop: refetch() ignores `enabled`; never ask Compass for counts without a department.
      if (!department) throw new Error("Department not known yet");
      return getSmartViewCounts(department);
    },
    enabled: department !== null,
    // Counts are a nice-to-have and the endpoint computes every view at once; for admins on
    // testing it can take 60 s and time out. Don't hammer it: one try, refresh at most each minute.
    retry: false,
    staleTime: 60_000,
  });
}

/** One Smart View with its filters, paged like Compass ("Rows per page"). */
export function useSmartViewLeads(
  def: SmartViewDef | null,
  config: ViewConfig | null,
  filters: Filters,
  role: CompassRole,
  pageSize: number,
) {
  const baseQuery = useMemo(
    () => (def && config ? buildViewQuery(config, filters, role, 1, pageSize) : null),
    [def, config, filters, role, pageSize],
  );
  const query = useInfiniteQuery({
    queryKey: leadKeys.view(baseQuery ?? {}),
    queryFn: ({ pageParam }) => getSmartViewPage({ ...baseQuery!, page: String(pageParam) }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.total_pages ? last.meta.page + 1 : undefined),
    enabled: baseQuery !== null,
  });
  const items = useMemo(
    () =>
      def ? mergePages((query.data?.pages ?? []).map((p) => p.data.map((r) => toLeadItem(r, def.type)))) : [],
    [query.data, def],
  );
  const total = query.data?.pages[0]?.meta.total ?? 0;
  return { ...query, items, total, request: baseQuery };
}

/** Stage options for a view's stage filter. */
export function useStageOptions(source: StageOptions | undefined) {
  const department = source?.from === "department" ? source.department : undefined;
  const query = useQuery({
    queryKey: leadKeys.stages(department),
    queryFn: () => getStageOptions(department),
    staleTime: 10 * 60_000,
    enabled: !!source && source.from !== "fixed",
  });
  return useMemo<Option[]>(() => {
    if (!source) return [];
    if (source.from === "fixed") return source.options;
    return (query.data ?? []).map((s) => ({ value: s.code, label: s.label }));
  }, [source, query.data]);
}

/** Lead source options, optionally narrowed (Landing Page Leads shows only /landing/ sources). */
export function useSourceOptions(enabled: boolean, filter?: RegExp) {
  const query = useQuery({
    queryKey: leadKeys.sources,
    queryFn: getSourceOptions,
    staleTime: 10 * 60_000,
    enabled,
  });
  return useMemo<Option[]>(
    () =>
      (query.data ?? [])
        .map((s) => s.source_name)
        .filter((name) => !!name && (!filter || filter.test(name)))
        .map((name) => ({ value: name, label: formatSourceName(name) })),
    [query.data, filter],
  );
}

/** Owner options: never loaded for agents; a team lead only sees their own team. */
export function useOwnerOptions(enabled: boolean) {
  const user = useAuthStore((s) => s.session?.user);
  const query = useQuery({
    queryKey: leadKeys.owners,
    queryFn: getOwnerOptions,
    staleTime: 10 * 60_000,
    enabled: enabled && user?.role !== "agent",
  });
  return useMemo<Option[]>(
    () =>
      (query.data ?? [])
        .filter((a) => user?.role !== "tl" || String(a.team_id ?? "") === String(user?.teamId ?? ""))
        .map((a) => ({ value: String(a.id), label: a.name })),
    [query.data, user?.role, user?.teamId],
  );
}

export function useOpportunity(id: string | undefined) {
  return useQuery({
    queryKey: leadKeys.opportunity(id ?? ""),
    queryFn: () => getOpportunity(id!),
    enabled: !!id,
  });
}
