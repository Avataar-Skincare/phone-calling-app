import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { PAGE_SIZES } from "@/api/smartViews";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/icons";
import { StateView } from "@/components/StateView";
import { isTestingBackend } from "@/config/env";
import { CallBanner } from "@/features/calling/CallBanner";
import { useCallLead } from "@/features/calling/useCallLead";
import { FilterBar } from "@/features/leads/filters/FilterBar";
import { PickerSheet } from "@/features/leads/filters/PickerSheet";
import type { LeadItem } from "@/features/leads/leadItem";
import { LeadRow } from "@/features/leads/LeadRow";
import {
  useSmartViewCounts,
  useSmartViewDefinitions,
  useSmartViewLeads,
  useUserDepartment,
} from "@/features/leads/useLeadQueries";
import { defaultFilters, nextSort, viewConfig, type Filters } from "@/features/leads/viewConfig";
import { ViewTabs } from "@/features/leads/ViewTabs";
import { useDebounced } from "@/hooks/useDebounced";
import { useAuthStore } from "@/store/auth.store";
import { useViewFilters } from "@/store/viewFilters.store";
import { SPACE, useColors } from "@/theme/tokens";
import type { DepartmentCode } from "@/types/compass";

const DEPARTMENTS: { code: DepartmentCode; label: string }[] = [
  { code: "sales", label: "Sales" },
  { code: "cs", label: "Customer Support" },
];

/** Smart Views, as on Compass: department tabs, view sub-tabs, filters, sort, page size. */
export default function HomeScreen() {
  const c = useColors();
  const user = useAuthStore((s) => s.session?.user);
  const role = user?.role ?? "agent";
  const callLead = useCallLead();

  // ── Department (Compass shows both tabs to everyone; default = the user's own) ──
  const userDept = useUserDepartment();
  const storedDept = useViewFilters((s) => s.department) as DepartmentCode | null;
  const setDepartment = useViewFilters((s) => s.setDepartment);
  const department: DepartmentCode | null = userDept.isLoading
    ? null
    : (storedDept ?? userDept.code ?? "sales");

  const defs = useSmartViewDefinitions(department);
  const counts = useSmartViewCounts(department);

  // ── Sub-tab (remembered per department) ──
  const selectedByDept = useViewFilters((s) => s.selectedView);
  const selectView = useViewFilters((s) => s.selectView);
  const view = useMemo(
    () =>
      defs.views.find((v) => v.key === (department ? selectedByDept[department] : undefined)) ??
      defs.views[0] ??
      null,
    [defs.views, department, selectedByDept],
  );
  const config = useMemo(() => (view ? viewConfig(view.key, view.type) : null), [view]);

  // ── Filters for this view (defaults per role, overridden by what the agent picked) ──
  const stored = useViewFilters((s) => (view ? s.byView[view.key] : undefined));
  const patch = useViewFilters((s) => s.patch);
  const pageSize = useViewFilters((s) => s.pageSize);
  const setPageSize = useViewFilters((s) => s.setPageSize);
  const filters = useMemo<Filters>(
    () =>
      config ? { ...defaultFilters(config, role), ...stored } : defaultFilters(viewConfig("none"), role),
    [config, role, stored],
  );
  const change = useCallback(
    (p: Partial<Filters>) => {
      if (view) patch(view.key, p);
    },
    [view, patch],
  );

  // Search is typed locally and applied after the agent stops typing (400 ms).
  const [searchText, setSearchText] = useState(filters.search);
  const viewKey = view?.key;
  const appliedSearch = filters.search;
  // Switching views: that view's stored search becomes the box's text (reset during render, not in an effect).
  const [searchView, setSearchView] = useState(viewKey);
  if (searchView !== viewKey) {
    setSearchView(viewKey);
    setSearchText(appliedSearch);
  }
  const debounced = useDebounced(searchText, 400);
  useEffect(() => {
    if (debounced !== appliedSearch) change({ search: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const list = useSmartViewLeads(view, config, filters, role, pageSize);

  // Counts change as tasks close; refresh them whenever this screen comes back into view.
  // refetch() bypasses the query's `enabled` flag, so only call it once the department is known.
  const { refetch: refetchCounts } = counts;
  useFocusEffect(
    useCallback(() => {
      if (department) void refetchCounts();
    }, [department, refetchCounts]),
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([list.refetch(), counts.refetch()]);
    setRefreshing(false);
  }, [list, counts]);

  const [sheet, setSheet] = useState<"sort" | "pageSize" | null>(null);

  const openLead = useCallback((item: LeadItem) => {
    if (!item.opportunityId) return;
    router.push({
      pathname: "/lead/[opportunityId]",
      params: {
        opportunityId: item.opportunityId,
        phone: item.phone ?? "",
        taskType: item.task?.type ?? "",
        dueAt: item.task?.dueAt ?? "",
        taskId: item.task?.id ?? "",
      },
    });
  }, []);

  // Calling stays on the list; the outcome form opens when the call ends.
  const onCall = useCallback(
    (item: LeadItem) =>
      void callLead({
        name: item.name,
        phone: item.phone,
        opportunityId: item.opportunityId,
        leadId: item.leadId,
        taskId: item.task?.id ?? null,
      }),
    [callLead],
  );

  const firstName = user?.name?.split(" ")[0] ?? "";
  const initials = (user?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const activeSort = config?.sortFields.find((f) => f.value === (filters.sortBy || config.defaultSortBy));
  const activeOrder = filters.sortOrder || config?.defaultSortOrder || "DESC";

  // ── Body ──
  let body: ReactNode;
  if (userDept.isLoading || defs.isLoading) {
    body = <StateView kind="loading" />;
  } else if (defs.error || userDept.error) {
    body = (
      <StateView
        kind="error"
        title="Couldn't load your lists"
        message={(defs.error ?? userDept.error)?.message}
        onRetry={() => void defs.refetch()}
      />
    );
  } else if (!view || !config) {
    body = (
      <StateView kind="empty" title="No lists" message="Compass has no Smart Views for this department." />
    );
  } else {
    body = (
      <FlatList
        data={list.items}
        keyExtractor={(i) => i.key}
        renderItem={({ item }) => (
          <LeadRow item={item} kind={config.kind} onOpen={openLead} onCall={onCall} />
        )}
        contentContainerStyle={{ padding: SPACE.lg, paddingTop: SPACE.sm, gap: SPACE.sm, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, flexWrap: "wrap" }}>
            <AppText variant="small" tone="muted" style={{ flex: 1 }}>
              Showing {list.items.length} of {list.total.toLocaleString("en-IN")}
            </AppText>
            {activeSort ? (
              <Pressable
                onPress={() => setSheet("sort")}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${activeSort.label}, ${activeOrder === "ASC" ? "ascending" : "descending"}`}
                hitSlop={6}
                style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
              >
                <Icon name="sort" size={16} color={c.muted} />
                <AppText variant="small" tone="accent">
                  {activeSort.label}
                </AppText>
                <Icon name={activeOrder === "ASC" ? "arrowUp" : "arrowDown"} size={14} color={c.accent} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setSheet("pageSize")}
              accessibilityRole="button"
              accessibilityLabel={`Rows per page ${pageSize}`}
              hitSlop={6}
            >
              <AppText variant="small" tone="accent">
                {pageSize} / page
              </AppText>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator color={c.accent} style={{ marginVertical: SPACE.lg }} />
          ) : null
        }
        ListEmptyComponent={
          list.isLoading ? (
            <StateView kind="loading" />
          ) : list.error ? (
            <StateView
              kind="error"
              title="Couldn't load leads"
              message={list.error.message || "Failed to load data"}
              onRetry={() => void list.refetch()}
            />
          ) : (
            <StateView
              kind="empty"
              title={config.kind === "task" ? "No tasks found" : "No records found"}
              message="Change the filters or pull down to refresh."
            />
          )
        }
      />
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: SPACE.lg,
          paddingTop: SPACE.sm,
          gap: SPACE.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <AppText variant="small" tone="muted">
            {firstName ? `Hi ${firstName}` : "Compass Dialer"}
            {isTestingBackend ? " · Testing" : ""}
          </AppText>
          <AppText variant="title" style={{ fontSize: 24 }}>
            Smart Views
          </AppText>
        </View>
        <Pressable
          onPress={() => router.push("/keypad")}
          accessibilityRole="button"
          accessibilityLabel="Keypad"
          hitSlop={8}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c.accentSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="dialpad" size={20} color={c.accent} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
          accessibilityLabel="Account and settings"
          hitSlop={8}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c.accentSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AppText variant="label" tone="accent">
            {initials}
          </AppText>
        </Pressable>
      </View>

      <CallBanner />

      {/* Department tabs */}
      <View
        style={{ flexDirection: "row", gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md }}
      >
        {DEPARTMENTS.map((d) => {
          const on = department === d.code;
          return (
            <Pressable
              key={d.code}
              onPress={() => setDepartment(d.code)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{
                paddingHorizontal: SPACE.md,
                paddingVertical: SPACE.sm,
                borderBottomWidth: 2,
                borderBottomColor: on ? c.accent : "transparent",
              }}
            >
              <AppText variant="label" tone={on ? "accent" : "muted"} style={{ fontSize: 15 }}>
                {d.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* View sub-tabs + description */}
      {defs.views.length > 0 ? (
        <View style={{ paddingTop: SPACE.sm, gap: SPACE.sm }}>
          <ViewTabs
            views={defs.views}
            counts={counts.data}
            selected={view?.key ?? null}
            onSelect={(k) => {
              if (department) selectView(department, k);
            }}
          />
          {view?.description ? (
            <AppText variant="small" tone="muted" style={{ paddingHorizontal: SPACE.lg }}>
              {view.description}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {/* Filters */}
      {view && config ? (
        <View style={{ paddingTop: SPACE.sm }}>
          <FilterBar
            config={config}
            role={role}
            filters={filters}
            searchText={searchText}
            onSearchText={setSearchText}
            onChange={change}
          />
        </View>
      ) : null}

      <View style={{ flex: 1 }}>{body}</View>

      {sheet === "sort" && config ? (
        <PickerSheet
          visible
          mode="single"
          title="Sort by"
          options={config.sortFields.map((f) => {
            const on = f.value === (filters.sortBy || config.defaultSortBy);
            return {
              value: f.value,
              label: on ? `${f.label} (${activeOrder === "ASC" ? "↑" : "↓"})` : f.label,
            };
          })}
          value={filters.sortBy || config.defaultSortBy}
          onChange={(field) => change(nextSort(filters, field, config))}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "pageSize" ? (
        <PickerSheet
          visible
          mode="single"
          title="Rows per page"
          options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
          value={String(pageSize)}
          onChange={(v) => setPageSize(Number(v))}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}
