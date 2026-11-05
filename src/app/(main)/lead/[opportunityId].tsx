import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/api/client";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { StagePill } from "@/components/StagePill";
import { StateView } from "@/components/StateView";
import { useCallLead } from "@/features/calling/useCallLead";
import { formatSource, fullName } from "@/features/leads/leadItem";
import { useOpportunity } from "@/features/leads/useLeadQueries";
import { formatPhone, toE164 } from "@/lib/phone";
import { formatWhen, isOverdue } from "@/lib/time";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import type { ActivityItem } from "@/types/compass";

type Params = { opportunityId: string; phone?: string; taskType?: string; dueAt?: string; taskId?: string };

const MAX_ACTIVITIES = 20;

/** The note an agent or system attached to an activity, if any. */
function activityNote(a: ActivityItem): string | null {
  const d = a.data ?? {};
  const note = d.notes ?? d.notes_comments ?? d.select_outcome ?? d.disposition_code;
  if (typeof note === "string" && note.trim()) return note.trim();
  const label = a.type?.label;
  return a.title && a.title !== label ? a.title : null;
}

export default function LeadScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const params = useLocalSearchParams<Params>();
  const query = useOpportunity(params.opportunityId);
  const callLead = useCallLead();
  const [refreshing, setRefreshing] = useState(false);

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
  const dialable = !!toE164(phone);
  const name = fullName(lead?.first_name, lead?.last_name);
  const overdue = isOverdue(params.dueAt);

  const details: [string, string | null | undefined][] = [
    ["Source", formatSource(lead?.lead_source)],
    ["Department", opp.department?.label],
    ["Owner", opp.owner?.name],
    ["City", lead?.city],
    ["Email", lead?.email],
    ["Lead score", lead?.lead_score != null ? String(lead.lead_score) : null],
    ["Created", formatWhen(opp.created_at)],
  ];
  const activities = opp.activities.slice(0, MAX_ACTIVITIES);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: c.bg }}>
      {back}
      <ScrollView
        contentContainerStyle={{ padding: SPACE.lg, paddingTop: 0, gap: SPACE.lg, paddingBottom: SPACE.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={c.accent}
            onRefresh={async () => {
              setRefreshing(true);
              await query.refetch();
              setRefreshing(false);
            }}
          />
        }
      >
        {/* Identity */}
        <View style={{ gap: SPACE.sm }}>
          <AppText variant="title">{name}</AppText>
          <StagePill stage={opp.stage} />
        </View>

        {/* Call card */}
        <View
          style={{
            backgroundColor: c.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: c.line,
            padding: SPACE.lg,
            gap: SPACE.md,
          }}
        >
          <AppText variant="label" tone="muted">
            Phone
          </AppText>
          <AppText selectable style={{ fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
            {formatPhone(phone)}
          </AppText>
          {params.taskType ? (
            <AppText tone={overdue ? "red" : "muted"} style={{ fontWeight: overdue ? "600" : "400" }}>
              {params.taskType}
              {params.dueAt ? ` · ${overdue ? "overdue since" : "due"} ${formatWhen(params.dueAt)}` : ""}
            </AppText>
          ) : null}
          <Button
            title={dialable ? "Call" : "No number to call"}
            disabled={!dialable}
            onPress={() =>
              void callLead({
                name,
                phone,
                opportunityId: String(opp.id),
                leadId: lead ? String(lead.id) : null,
                taskId: params.taskId || null,
              })
            }
          />
        </View>

        {/* Details */}
        <View
          style={{ backgroundColor: c.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.line }}
        >
          {details
            .filter(([, v]) => !!v)
            .map(([k, v], i) => (
              <View
                key={k}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: SPACE.lg,
                  paddingHorizontal: SPACE.lg,
                  paddingVertical: SPACE.md,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: c.line,
                }}
              >
                <AppText tone="muted">{k}</AppText>
                <AppText style={{ flexShrink: 1, textAlign: "right" }}>{v}</AppText>
              </View>
            ))}
        </View>

        {/* Recent activity */}
        <View style={{ gap: SPACE.sm }}>
          <AppText variant="heading">Recent activity</AppText>
          {activities.length === 0 ? (
            <AppText tone="muted">Nothing logged on this lead yet.</AppText>
          ) : (
            activities.map((a) => {
              const note = activityNote(a);
              return (
                <View
                  key={String(a.id)}
                  style={{
                    backgroundColor: c.surface,
                    borderRadius: RADIUS.md,
                    borderWidth: 1,
                    borderColor: c.line,
                    padding: SPACE.md,
                    gap: 2,
                  }}
                >
                  <AppText variant="label">{a.type?.label ?? a.title ?? "Activity"}</AppText>
                  <AppText variant="small" tone="muted">
                    {[formatWhen(a.occurred_at), a.added_by?.name].filter(Boolean).join(" · ")}
                  </AppText>
                  {note ? (
                    <AppText variant="small" numberOfLines={3} style={{ marginTop: 2 }}>
                      {note}
                    </AppText>
                  ) : null}
                </View>
              );
            })
          )}
          {opp.total_activities > MAX_ACTIVITIES ? (
            <AppText variant="small" tone="muted">
              Showing the latest {MAX_ACTIVITIES}. The full history is in Compass.
            </AppText>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
