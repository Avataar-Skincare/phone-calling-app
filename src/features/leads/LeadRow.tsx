import { memo } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/AppText";
import { CallButton } from "@/components/CallButton";
import { StagePill } from "@/components/StagePill";
import { maskPhone, toE164 } from "@/lib/phone";
import { formatWhen, isOverdue } from "@/lib/time";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import type { LeadItem } from "./leadItem";

interface Props {
  item: LeadItem;
  onOpen: (item: LeadItem) => void;
  onCall: (item: LeadItem) => void;
}

export const LeadRow = memo(function LeadRow({ item, onOpen, onCall }: Props) {
  const c = useColors();
  const overdue = isOverdue(item.task?.dueAt);
  const due = formatWhen(item.task?.dueAt);
  const meta = [maskPhone(item.phone), item.task?.type ?? item.source].filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={() => onOpen(item)}
      disabled={!item.opportunityId}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, open lead`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
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
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="heading" numberOfLines={1} style={{ fontSize: 16 }}>
          {item.name}
        </AppText>
        <AppText variant="small" tone="muted" numberOfLines={1}>
          {meta}
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, flexWrap: "wrap" }}>
          <StagePill stage={item.stage} />
          {due ? (
            <AppText
              variant="small"
              tone={overdue ? "red" : "muted"}
              style={{ fontWeight: overdue ? "600" : "400" }}
            >
              {overdue ? `Overdue · ${due}` : `Due ${due}`}
            </AppText>
          ) : null}
        </View>
      </View>
      <CallButton label={`Call ${item.name}`} disabled={!toE164(item.phone)} onPress={() => onCall(item)} />
    </Pressable>
  );
});
