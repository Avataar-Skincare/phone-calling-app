import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { AppText } from "@/components/AppText";
import { StateView } from "@/components/StateView";
import { isTestingBackend } from "@/config/env";
import { CallBanner } from "@/features/calling/CallBanner";
import { useCallLead } from "@/features/calling/useCallLead";
import type { LeadItem } from "@/features/leads/leadItem";
import { LeadRow } from "@/features/leads/LeadRow";
import {
  useSmartViewCounts,
  useSmartViewDefinitions,
  useSmartViewLeads,
  useUserDepartment,
} from "@/features/leads/useLeadQueries";
import { ViewTabs } from "@/features/leads/ViewTabs";
import { useDebounced } from "@/hooks/useDebounced";
import { useAuthStore } from "@/store/auth.store";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import type { DepartmentCode } from "@/types/compass";

export default function HomeScreen() {
  const c = useColors();
  const user = useAuthStore((s) => s.session?.user);
  const callLead = useCallLead();

  // Department: the agent's own, or a Sales/CS switch for users without one.
  const userDept = useUserDepartment();
  const [pickedDept, setPickedDept] = useState<DepartmentCode>("sales");
  const canSwitchDept = userDept.canSwitch;
  const department: DepartmentCode | null = canSwitchDept ? pickedDept : userDept.code;

  const defs = useSmartViewDefinitions(department);
  const counts = useSmartViewCounts(department);

  // Falls back to the first tab when nothing is picked yet or the picked tab no longer exists.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedView = useMemo(
    () => defs.views.find((v) => v.key === selectedKey) ?? defs.views[0] ?? null,
    [defs.views, selectedKey],
  );

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim(), 400);
  const list = useSmartViewLeads(selectedView, search);

  // Counts change as tasks close; refresh them whenever the list screen comes back into view.
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

  // ── Body states ──
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
  } else if (!department) {
    body = (
      <StateView
        kind="empty"
        title="No department set"
        message="Your Compass account has a department that this app doesn't recognise. Ask your admin to check it."
      />
    );
  } else if (defs.views.length === 0) {
    body = (
      <StateView kind="empty" title="No lists" message="Compass has no Smart Views for your department." />
    );
  } else {
    body = (
      <FlatList
        data={list.items}
        keyExtractor={(i) => i.key}
        renderItem={({ item }) => <LeadRow item={item} onOpen={openLead} onCall={onCall} />}
        contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.sm, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        ListHeaderComponent={
          list.items.length > 0 ? (
            <AppText variant="small" tone="muted" style={{ marginBottom: SPACE.xs }}>
              {list.total} {list.total === 1 ? "lead" : "leads"}
              {search ? ` matching "${search}"` : ""}
            </AppText>
          ) : null
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
              message={list.error.message}
              onRetry={() => void list.refetch()}
            />
          ) : (
            <StateView
              kind="empty"
              title={search ? "No matches" : "No leads here right now"}
              message={
                search ? `Nothing in ${selectedView?.label} matches "${search}".` : "Pull down to refresh."
              }
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
            My leads
          </AppText>
        </View>
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

      {/* Department switch (only for users without a department) */}
      {canSwitchDept ? (
        <View
          style={{ flexDirection: "row", gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md }}
        >
          {(["sales", "cs"] as const).map((d) => {
            const on = department === d;
            return (
              <Pressable
                key={d}
                onPress={() => {
                  setPickedDept(d);
                  setSelectedKey(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: SPACE.sm,
                  borderRadius: RADIUS.sm,
                  borderWidth: 1,
                  borderColor: on ? c.accent : c.line,
                  backgroundColor: on ? c.accentSoft : c.surface,
                }}
              >
                <AppText variant="label" tone={on ? "accent" : "muted"}>
                  {d === "sales" ? "Sales" : "Customer Support"}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Search */}
      <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.md }}>
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search name or number"
          placeholderTextColor={c.muted}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search leads"
          style={{
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: RADIUS.md,
            paddingHorizontal: SPACE.lg,
            paddingVertical: SPACE.md,
            fontSize: 16,
            color: c.ink,
          }}
        />
      </View>

      {/* Tabs */}
      {defs.views.length > 0 ? (
        <View style={{ paddingTop: SPACE.md }}>
          <ViewTabs
            views={defs.views}
            counts={counts.data}
            selected={selectedView?.key ?? null}
            onSelect={(k) => setSelectedKey(k)}
          />
        </View>
      ) : null}

      <View style={{ flex: 1 }}>{body}</View>
    </SafeAreaView>
  );
}
