import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { getDepartments, getOpportunity } from "@/api/opportunities";
import { getSmartViewCounts, getSmartViewDefinitions, getSmartViewPage } from "@/api/smartViews";
import { useAuthStore } from "@/store/auth.store";
import type { DepartmentCode, SmartViewDef } from "@/types/compass";
import { mergePages, toLeadItem } from "./leadItem";

export const leadKeys = {
  definitions: ["smart-views", "definitions"] as const,
  departments: ["departments"] as const,
  counts: (dept: DepartmentCode) => ["smart-views", "counts", dept] as const,
  view: (view: string, search: string) => ["smart-views", "data", view, search] as const,
  opportunity: (id: string) => ["opportunity", id] as const,
};

/**
 * The agent's department code ("sales" | "cs") from user.departmentId.
 * `null` when the user has no department or one outside Sales and CS (e.g. "Central");
 * `canSwitch` is then true and the home screen lets them choose Sales or CS.
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
  // Smart Views exist only for Sales and CS. Users with no department, or one outside those two
  // (e.g. "Central" admins), pick which department's lists to work.
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

export function useSmartViewLeads(view: SmartViewDef | null, search: string) {
  const query = useInfiniteQuery({
    queryKey: leadKeys.view(view?.key ?? "", search),
    queryFn: ({ pageParam }) => getSmartViewPage(view!.key, pageParam, search),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.total_pages ? last.meta.page + 1 : undefined),
    enabled: view !== null,
  });
  const items = useMemo(
    () =>
      view
        ? mergePages((query.data?.pages ?? []).map((p) => p.data.map((r) => toLeadItem(r, view.type))))
        : [],
    [query.data, view],
  );
  const total = query.data?.pages[0]?.meta.total ?? 0;
  return { ...query, items, total };
}

export function useOpportunity(id: string | undefined) {
  return useQuery({
    queryKey: leadKeys.opportunity(id ?? ""),
    queryFn: () => getOpportunity(id!),
    enabled: !!id,
  });
}
