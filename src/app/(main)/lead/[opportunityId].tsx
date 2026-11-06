import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/api/client";
import { AppText } from "@/components/AppText";
import { Chip } from "@/components/Chip";
import { StateView } from "@/components/StateView";
import { CallBanner } from "@/features/calling/CallBanner";
import { useCallLead } from "@/features/calling/useCallLead";
import { fullName } from "@/features/leads/leadItem";
import { useOpportunity } from "@/features/leads/useLeadQueries";
import { ChangeStageSheet } from "@/features/opportunity/ChangeStageSheet";
import { OverviewTab } from "@/features/opportunity/OverviewTab";
import { ProfilePanel } from "@/features/opportunity/ProfilePanel";
import {
  ActivitiesTab,
  AppointmentsTab,
  CallsTab,
  PurchaseHistoryTab,
  StageHistoryTab,
  TasksTab,
} from "@/features/opportunity/Tabs";
import { formatWhen, isOverdue } from "@/lib/time";
import { SPACE, useColors } from "@/theme/tokens";

type Params = { opportunityId: string; phone?: string; taskType?: string; dueAt?: string; taskId?: string };

const TABS = [
  "Overview",
  "Activities",
  "Tasks",
  "Calls",
  "Stage History",
  "Purchase History",
  "Appointments",
] as const;
type Tab = (typeof TABS)[number];

export default function LeadScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const params = useLocalSearchParams<Params>();
  const query = useOpportunity(params.opportunityId);
  const callLead = useCallLead();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("Overview");
  const [stageOpen, setStageOpen] = useState(false);

  const lostAccess =
    query.error instanceof ApiError && (query.error.status === 403 || query.error.status === 404);

  // A lead that is no longer the agent's must also drop out of the lists.
  useEffect(() => {
    if (lostAccess) void qc.invalidateQueries({ queryKey: ["smart-views"] });
  }, [lostAccess, qc]);

  const back = (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Back to leads"
      hitSlop={10}
      style={{ paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, alignSelf: "flex-start" }}
    >
      <AppText variant="label" tone="accent" style={{ fontSize: 16 }}>
        ‹ Leads
      </AppText>
    </Pressable>
  );

  if (query.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        {back}
        <StateView kind="loading" />
      </SafeAreaView>
    );
  }

  if (lostAccess) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        {back}
        <StateView
          kind="empty"
          title="This lead isn't assigned to you any more"
          message="It may have been reassigned in Compass. Your lists have been refreshed."
        />
      </SafeAreaView>
    );
  }

  if (query.error || !query.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        {back}
        <StateView
          kind="error"
          title="Couldn't load this lead"
          message={query.error?.message}
          onRetry={() => void query.refetch()}
        />
      </SafeAreaView>
    );
  }

  const opp = query.data;
  const lead = opp.lead;
  // The list row carries the lead's primary number; the detail endpoint only has the first stored one.
  const phone = params.phone || lead?.phone || null;
  const name = fullName(lead?.first_name, lead?.last_name);
  const overdue = isOverdue(params.dueAt);
  const call = () =>
    void callLead({
      name,
      phone,
      opportunityId: String(opp.id),
      leadId: lead ? String(lead.id) : null,
      taskId: params.taskId || null,
    });

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: c.bg }}>
      {back}
      <CallBanner />
      <ScrollView
        contentContainerStyle={{ padding: SPACE.lg, paddingTop: 0, gap: SPACE.lg, paddingBottom: SPACE.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={c.accent}
            onRefresh={async () => {
              setRefreshing(true);
              await qc.invalidateQueries({ queryKey: ["opportunity", String(opp.id)] });
              setRefreshing(false);
            }}
          />
        }
      >
        {/* Header */}
        <View style={{ gap: 4 }}>
          <AppText variant="small" tone="muted" style={{ letterSpacing: 1 }}>
            OPPORTUNITY DETAILS · {(opp.department?.label ?? "").toUpperCase()}
          </AppText>
          <AppText variant="heading">{opp.opportunity_name ?? name}</AppText>
          {params.taskType ? (
            <AppText tone={overdue ? "red" : "muted"} style={{ fontWeight: overdue ? "600" : "400" }}>
              {params.taskType}
              {params.dueAt ? ` · ${overdue ? "overdue since" : "due"} ${formatWhen(params.dueAt)}` : ""}
            </AppText>
          ) : null}
        </View>

        <ProfilePanel opp={opp} phone={phone} onCall={call} onChangeStage={() => setStageOpen(true)} />

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: SPACE.sm }}
        >
          {TABS.map((t) => (
            <Chip
              key={t}
              label={t}
              selected={tab === t}
              onPress={() => setTab(t)}
              accessibilityRole="button"
            />
          ))}
        </ScrollView>

        {tab === "Overview" ? <OverviewTab opp={opp} /> : null}
        {tab === "Activities" ? <ActivitiesTab opp={opp} /> : null}
        {tab === "Tasks" ? <TasksTab opp={opp} /> : null}
        {tab === "Calls" ? <CallsTab opp={opp} /> : null}
        {tab === "Stage History" ? <StageHistoryTab opp={opp} /> : null}
        {tab === "Purchase History" ? <PurchaseHistoryTab opp={opp} /> : null}
        {tab === "Appointments" ? <AppointmentsTab opp={opp} /> : null}
      </ScrollView>
      <ChangeStageSheet opp={opp} visible={stageOpen} onClose={() => setStageOpen(false)} />
    </SafeAreaView>
  );
}
