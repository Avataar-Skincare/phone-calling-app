import { useMemo, useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { completeTask } from "@/api/opportunities";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/StagePill";
import { env } from "@/config/env";
import {
  activityGroupLabel,
  formatCallDuration,
  formatDateIN,
  formatLongIN,
  formatRupees,
  formatShortIN,
  taskDueGroup,
} from "@/lib/format";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import type { ActivityItem, OpportunityDetail } from "@/types/compass";
import { PaymentBadge } from "./OverviewTab";
import {
  useAppointments,
  useCalls,
  useLeadActivities,
  useOpportunityTasks,
  usePurchaseHistory,
} from "./queries";
import { Record, Row, SectionState } from "./Section";

const dash = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
/** Compass returns recording links like "/api/ameyo/recording/123"; make them absolute. */
const absolute = (path: string) =>
  /^https?:/.test(path) ? path : `${env.compassApiUrl.replace(/\/api$/, "")}${path}`;

// ── Activities ──────────────────────────────────────────────

/** Drop failed dialer attempts, like Compass (rows with success "0" and their call_id twins). */
function visibleActivities(list: ActivityItem[]): ActivityItem[] {
  const failedCalls = new Set(
    list.filter((a) => String(a.data?.success ?? "") === "0").map((a) => String(a.data?.call_id ?? "")),
  );
  return list.filter(
    (a) =>
      String(a.data?.success ?? "") !== "0" && !(a.data?.call_id && failedCalls.has(String(a.data.call_id))),
  );
}

function activityNote(a: ActivityItem): string | null {
  const d = a.data ?? {};
  const parts = [d.select_outcome, d.notes, d.notes_comments, d.disposition_code, d.message_text]
    .filter((v) => typeof v === "string" && v.trim())
    .map(String);
  return parts.length ? parts.join(" · ") : null;
}

export function ActivitiesTab({ opp }: { opp: OpportunityDetail }) {
  const c = useColors();
  const leadId = opp.lead ? String(opp.lead.id) : null;
  const q = useLeadActivities(String(opp.id), leadId);
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo(() => {
    const out: { label: string; items: ActivityItem[] }[] = [];
    for (const a of visibleActivities(q.data?.activities ?? [])) {
      const label = activityGroupLabel(a.occurred_at);
      const last = out.at(-1);
      if (last?.label === label) last.items.push(a);
      else out.push({ label, items: [a] });
    }
    return out;
  }, [q.data]);

  return (
    <View style={{ gap: SPACE.md }}>
      <SectionState
        loading={q.isLoading}
        loadingText="Loading activities..."
        error={q.error}
        empty={!groups.length}
        emptyText="No activities yet"
      />
      {groups.map((g) => (
        <View key={g.label} style={{ gap: SPACE.sm }}>
          <AppText variant="label" tone="muted" style={{ letterSpacing: 1, textTransform: "uppercase" }}>
            {g.label}
          </AppText>
          {g.items.map((a) => {
            const id = String(a.id);
            const open = expanded === id;
            const note = activityNote(a);
            const recording = (a.data?.recording_url ?? a.data?.ResourceURL) as string | undefined;
            const rows = Object.entries(a.data ?? {}).filter(
              ([, v]) => v !== null && v !== "" && typeof v !== "object",
            );
            return (
              <Pressable
                key={id}
                onPress={() => setExpanded(open ? null : id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                style={{
                  backgroundColor: c.surface,
                  borderRadius: RADIUS.md,
                  borderWidth: 1,
                  borderColor: c.line,
                  padding: SPACE.md,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: "row", gap: SPACE.sm, alignItems: "flex-start" }}>
                  <AppText variant="label" style={{ flex: 1 }}>
                    {a.type?.label ?? "Activity"}
                    {a.title && a.title !== a.type?.label ? `: ${a.title}` : ""}
                  </AppText>
                  {a.score ? <Badge label={`+${a.score}`} tone="green" /> : null}
                </View>
                {note ? <AppText variant="small">{note}</AppText> : null}
                <AppText variant="small" tone="muted">
                  Added by {a.added_by?.name ?? (a.added_by_type === "system" ? "System" : "Integration")} on{" "}
                  {formatShortIN(a.occurred_at)}
                </AppText>
                {recording ? (
                  <Pressable
                    onPress={() => void Linking.openURL(absolute(recording))}
                    accessibilityRole="link"
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Icon name="open" size={14} color={c.accent} />
                    <AppText variant="small" tone="accent">
                      Recording
                    </AppText>
                  </Pressable>
                ) : null}
                {open && rows.length ? (
                  <View style={{ marginTop: SPACE.sm }}>
                    {rows.map(([k, v], i) => (
                      <Row key={k} label={k} value={String(v)} divider={i > 0} />
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Tasks ───────────────────────────────────────────────────

const TASK_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "", label: "All" },
];
const GROUP_ORDER = ["Overdue", "Today", "This Week", "Later"] as const;

export function TasksTab({ opp }: { opp: OpportunityDetail }) {
  const c = useColors();
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const q = useOpportunityTasks(String(opp.id), status);
  const complete = useMutation({
    mutationFn: completeTask,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["opportunity", String(opp.id)] });
      void qc.invalidateQueries({ queryKey: ["smart-views"] });
    },
    onError: (e) => Alert.alert("Couldn't complete the task", e instanceof Error ? e.message : "Try again."),
  });

  const tasks = q.data?.data ?? [];
  const groups = GROUP_ORDER.map((g) => ({
    g,
    items: tasks.filter((t) => taskDueGroup(t.due_at, t.status) === g),
  })).filter((x) => x.items.length);
  const statusLabel = TASK_STATUSES.find((s) => s.value === status)?.label.toLowerCase();

  return (
    <View style={{ gap: SPACE.md }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
        {TASK_STATUSES.map((s) => (
          <Chip
            key={s.label}
            label={s.label}
            selected={status === s.value}
            onPress={() => setStatus(s.value)}
          />
        ))}
      </View>
      <SectionState
        loading={q.isLoading}
        error={q.error}
        empty={!tasks.length}
        emptyText={status ? `No ${statusLabel} tasks for this opportunity` : "No tasks for this opportunity"}
      />
      {groups.map(({ g, items }) => (
        <View key={g} style={{ gap: SPACE.sm }}>
          <AppText
            variant="label"
            tone={g === "Overdue" ? "red" : "muted"}
            style={{ letterSpacing: 1, textTransform: "uppercase" }}
          >
            {g}
          </AppText>
          {items.map((t) => {
            const border = t.priority === "high" ? c.red : t.priority === "low" ? c.accent : c.amber;
            const done = t.status === "completed";
            return (
              <View
                key={String(t.id)}
                style={{
                  flexDirection: "row",
                  gap: SPACE.md,
                  backgroundColor: c.surface,
                  borderRadius: RADIUS.md,
                  borderWidth: 1,
                  borderColor: c.line,
                  borderLeftWidth: 4,
                  borderLeftColor: border,
                  padding: SPACE.md,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="small" tone="muted">
                    {formatDateIN(t.due_at)}
                  </AppText>
                  <AppText variant="label" style={done ? { textDecorationLine: "line-through" } : undefined}>
                    {t.title || t.task_type?.label || "Task"}
                  </AppText>
                  {t.description ? <AppText variant="small">{t.description}</AppText> : null}
                  <AppText variant="small" tone="muted">
                    Assigned to {t.assigned_to?.name ?? "—"}
                  </AppText>
                </View>
                {t.status === "pending" ? (
                  <Pressable
                    onPress={() =>
                      Alert.alert("Mark as completed?", t.title ?? "", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Complete", onPress: () => complete.mutate(t.id) },
                      ])
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Mark as completed"
                    hitSlop={8}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      borderWidth: 1.5,
                      borderColor: c.line,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="check" color={c.muted} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Calls ───────────────────────────────────────────────────

export function CallsTab({ opp }: { opp: OpportunityDetail }) {
  const c = useColors();
  const [page, setPage] = useState(1);
  const q = useCalls(String(opp.id), page, 20);
  const rows = q.data?.data ?? [];
  const meta = q.data?.meta;
  return (
    <View style={{ gap: SPACE.sm }}>
      <SectionState
        loading={q.isLoading}
        loadingText="Loading call history..."
        error={q.error}
        empty={!rows.length}
        emptyText="No calls recorded yet."
      />
      {rows.map((call) => (
        <View
          key={String(call.id)}
          style={{
            backgroundColor: c.surface,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: c.line,
            paddingHorizontal: SPACE.md,
          }}
        >
          <Row
            label={formatShortIN(call.started_at)}
            value={<Badge label={call.direction} tone={call.direction === "missed" ? "red" : "brand"} />}
            divider={false}
          />
          <Row label="Agent" value={dash(call.agent?.name)} />
          <Row label="Disposition" value={dash(call.disposition_code || call.system_disposition)} />
          <Row label="Duration" value={formatCallDuration(call.talk_time_seconds)} />
          {call.recording_url ? (
            <Row
              label="Recording"
              value={
                <Pressable
                  onPress={() => void Linking.openURL(absolute(call.recording_url!))}
                  accessibilityRole="link"
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <AppText tone="accent">Play</AppText>
                  <Icon name="open" size={14} color={c.accent} />
                </Pressable>
              }
            />
          ) : null}
        </View>
      ))}
      {meta && meta.total_pages > 1 ? (
        <Pager page={page} pages={meta.total_pages} onPage={setPage} summary={`${meta.total} calls total`} />
      ) : null}
    </View>
  );
}

// ── Stage history ───────────────────────────────────────────

export function StageHistoryTab({ opp }: { opp: OpportunityDetail }) {
  const c = useColors();
  const rows = opp.stage_history ?? [];
  if (!rows.length)
    return (
      <AppText tone="muted" style={{ fontStyle: "italic" }}>
        No stage history yet.
      </AppText>
    );
  return (
    <View>
      {rows.map((h, i) => (
        <View key={String(h.id)} style={{ flexDirection: "row", gap: SPACE.md }}>
          <View style={{ alignItems: "center", width: 14 }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                marginTop: 4,
                backgroundColor: i === 0 ? c.accent : c.line,
              }}
            />
            {i < rows.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: c.line }} /> : null}
          </View>
          <View style={{ flex: 1, paddingBottom: SPACE.lg, gap: 2 }}>
            <AppText variant="label">
              {h.from_stage
                ? `${h.from_stage.label} → ${h.to_stage?.label ?? "—"}`
                : `Created at ${h.to_stage?.label ?? "—"}`}
            </AppText>
            <AppText variant="small" tone="muted">
              {h.changed_by?.name ?? "System"} · {formatDateIN(h.changed_at)}
            </AppText>
            {h.reason ? (
              <AppText variant="small" style={{ fontStyle: "italic" }}>
                “{h.reason}”
              </AppText>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Purchase history ────────────────────────────────────────

export function PurchaseHistoryTab({ opp }: { opp: OpportunityDetail }) {
  const c = useColors();
  const leadId = opp.lead ? String(opp.lead.id) : null;
  const q = usePurchaseHistory(String(opp.id), leadId);
  const [open, setOpen] = useState<string | null>(null);
  const orders = q.data?.data ?? [];
  return (
    <View style={{ gap: SPACE.sm }}>
      <SectionState
        loading={q.isLoading}
        error={q.error}
        empty={!orders.length}
        emptyText="No purchase history found."
      />
      {orders.map((o) => {
        const expanded = open === o.order_id;
        return (
          <Pressable
            key={o.order_id}
            onPress={() => setOpen(expanded ? null : o.order_id)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            style={{
              backgroundColor: c.surface,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: c.line,
              paddingHorizontal: SPACE.md,
            }}
          >
            <Row label="Order ID" value={`${o.order_id.slice(0, 8)}...`} divider={false} />
            <Row label="Date" value={formatDateIN(o.order_date)} />
            <Row label="Address" value={dash(o.formatted_address)} />
            <Row label="Payable" value={formatRupees(o.payable_amount)} />
            <Row label="Paid" value={formatRupees(o.amount_paid)} />
            <Row label="Left" value={formatRupees(o.left_amount)} />
            <Row label="Status" value={<PaymentBadge status={o.payment_status} />} />
            {expanded ? (
              <View style={{ paddingBottom: SPACE.md, gap: SPACE.sm }}>
                <AppText variant="label" tone="muted">
                  Order Details · {o.order_id}
                </AppText>
                {(o.items ?? []).map((it, i) => (
                  <Record key={String(it.order_detail_id ?? i)}>
                    <Row label="Product" value={dash(it.product_name)} divider={false} />
                    <Row label="Price" value={formatRupees(it.item_price)} />
                    <Row label="Sessions Taken" value={dash(it.sessions_taken)} />
                  </Record>
                ))}
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Appointments ────────────────────────────────────────────

export function AppointmentsTab({ opp }: { opp: OpportunityDetail }) {
  const c = useColors();
  const leadId = opp.lead ? String(opp.lead.id) : null;
  const [page, setPage] = useState(1);
  const q = useAppointments(String(opp.id), leadId, page);
  const rows = q.data?.data ?? [];
  const total = q.data?.meta?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 10));
  return (
    <View style={{ gap: SPACE.sm }}>
      {q.data ? (
        <AppText variant="small" tone="muted">
          {total} appointment{total === 1 ? "" : "s"} found
        </AppText>
      ) : null}
      <SectionState
        loading={q.isLoading}
        error={q.error ? new Error("Failed to load appointments") : null}
        empty={!rows.length}
        emptyText="No appointments found"
      />
      {rows.map((a, i) => (
        <View
          key={String(a.session_id ?? i)}
          style={{
            backgroundColor: c.surface,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: c.line,
            paddingHorizontal: SPACE.md,
          }}
        >
          <Row label="Session ID" value={dash(a.session_id)} divider={false} />
          <Row label="Client ID" value={dash(a.client_id)} />
          <Row label="Service Name" value={dash(a.service_name)} />
          <Row label="Status" value={<Badge label={dash(a.session_status)} tone="brand" />} />
          <Row label="Appointment Date" value={formatLongIN(a.appointment_date)} />
          <Row label="Therapist" value={dash(a.therapist_assigned)} />
          <Row label="Address" value={dash(a.address)} />
        </View>
      ))}
      {pages > 1 ? (
        <Pager page={page} pages={pages} onPage={setPage} summary={`Page ${page} of ${pages}`} />
      ) : null}
    </View>
  );
}

function Pager({
  page,
  pages,
  onPage,
  summary,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
  summary: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
      <AppText variant="small" tone="muted" style={{ flex: 1 }}>
        {summary}
      </AppText>
      <Button title="Previous" kind="secondary" disabled={page <= 1} onPress={() => onPage(page - 1)} />
      <Button title="Next" kind="secondary" disabled={page >= pages} onPress={() => onPage(page + 1)} />
    </View>
  );
}
