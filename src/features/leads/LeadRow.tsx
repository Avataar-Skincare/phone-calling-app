import { memo } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/AppText";
import { CallButton } from "@/components/CallButton";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Icon } from "@/components/icons";
import { Badge, StagePill } from "@/components/StagePill";
import { formatDateIN } from "@/lib/format";
import { maskPhone, toE164 } from "@/lib/phone";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import { taskStatusLabel, type LeadItem } from "./leadItem";
import { ACTIVITY_OPTIONS, type RowKind } from "./viewConfig";

interface Props {
  item: LeadItem;
  kind: RowKind;
  onOpen: (item: LeadItem) => void;
  onCall: (item: LeadItem) => void;
  /** Task views: Compass's "Mark as completed" tick. */
  onComplete?: (item: LeadItem) => void;
}

/** "Label value" pair in a row card (a Compass table column). */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <AppText variant="small" tone="muted" numberOfLines={1}>
      {label} <AppText variant="small">{value}</AppText>
    </AppText>
  );
}

/**
 * One Smart View row. Shows the same columns as the Compass table for that view:
 *  - lead views: Lead Name, Lead Score, Opportunity Stage, Lead Source, Owner, Created On, Modified On
 *  - CS Missed Inbound: the same plus Missed Call Date
 *  - Important Customers: Lead (+ phone), Stage, Owner, Last High-Intent Activity
 *  - task views: Task Id, Subject (+ lead), Status, Opportunity Stage, Due Date, Created By, Task Owner
 */
export const LeadRow = memo(function LeadRow({ item, kind, onOpen, onCall, onComplete }: Props) {
  const c = useColors();
  const callable = !!toE164(item.phone);

  let body;
  if (kind === "task" && item.task) {
    const status = taskStatusLabel(item.task);
    body = (
      <>
        <AppText variant="small" tone="muted">
          T{item.task.id}
          {item.task.type ? ` · ${item.task.type}` : ""}
        </AppText>
        <AppText variant="label" numberOfLines={2} style={{ fontSize: 15 }}>
          {item.task.title || item.task.type || "Task"}
        </AppText>
        <AppText variant="small" tone="accent" numberOfLines={1}>
          {item.name} · {maskPhone(item.phone)}
        </AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, alignItems: "center" }}>
          <Badge
            label={status}
            tone={status === "overdue" ? "red" : status === "completed" ? "green" : "amber"}
          />
          <StagePill stage={item.stage} />
        </View>
        <Field label="Due" value={formatDateIN(item.task.dueAt)} />
        <Field label="Created by" value={item.task.createdBy ?? "—"} />
        <Field label="Task owner" value={item.task.assignedTo ?? "—"} />
      </>
    );
  } else if (kind === "important") {
    const activity = item.importantActivity;
    const label = activity
      ? (ACTIVITY_OPTIONS.find((o) => o.value === activity.code)?.label ?? activity.code)
      : null;
    body = (
      <>
        <AppText variant="heading" tone="accent" numberOfLines={1} style={{ fontSize: 16 }}>
          {item.name}
        </AppText>
        <AppText variant="small" tone="muted">
          {maskPhone(item.phone)}
        </AppText>
        <StagePill stage={item.stage} />
        <Field label="Owner" value={item.owner ?? "—"} />
        <Field
          label="Last high-intent activity"
          value={label && activity ? `${label} · ${formatDateIN(activity.occurredAt)}` : "—"}
        />
      </>
    );
  } else {
    body = (
      <>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: SPACE.sm }}>
          <AppText variant="heading" tone="accent" numberOfLines={1} style={{ fontSize: 16, flexShrink: 1 }}>
            {item.name}
          </AppText>
          {item.leadScore !== null ? (
            <AppText variant="small" tone="muted">
              Score {item.leadScore}
            </AppText>
          ) : null}
        </View>
        <AppText variant="small" tone="muted">
          {maskPhone(item.phone)}
        </AppText>
        <StagePill stage={item.stage} />
        <Field label="Lead source" value={item.source ?? "—"} />
        <Field label="Owner" value={item.owner ?? "—"} />
        {kind === "csMissed" ? <Field label="Missed call" value={formatDateIN(item.missedCallAt)} /> : null}
        <Field label="Created" value={formatDateIN(item.createdAt)} />
        <Field label="Modified" value={formatDateIN(item.updatedAt)} />
      </>
    );
  }

  return (
    <Pressable
      onPress={() => onOpen(item)}
      disabled={!item.opportunityId}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, open lead`}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: SPACE.md,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: RADIUS.md,
        padding: SPACE.md,
        paddingLeft: SPACE.lg,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>{body}</View>
      <View style={{ alignItems: "center", gap: SPACE.md }}>
        <View style={{ flexDirection: "row", gap: SPACE.sm }}>
          <CallButton label={`Call ${item.name}`} disabled={!callable} onPress={() => onCall(item)} />
          <WhatsAppButton label={`WhatsApp ${item.name}`} phone={item.phone} />
        </View>
        {kind === "task" && item.task?.status === "pending" && onComplete ? (
          <Pressable
            onPress={() => onComplete(item)}
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
    </Pressable>
  );
});
