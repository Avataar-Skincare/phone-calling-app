import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { changeOpportunityStage } from "@/api/opportunities";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import type { OpportunityDetail } from "@/types/compass";

/** Compass "Change Stage": pick a stage of this department, optional reason, POST /opportunities/:id/stage. */
export function ChangeStageSheet({
  opp,
  visible,
  onClose,
}: {
  opp: OpportunityDetail;
  visible: boolean;
  onClose: () => void;
}) {
  const c = useColors();
  const qc = useQueryClient();
  const [stageId, setStageId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const stages = [...(opp.available_stages ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const current = opp.stage ? String(opp.stage.id) : null;

  const save = useMutation({
    mutationFn: () => changeOpportunityStage(String(opp.id), stageId!, reason.trim() || undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["opportunity", String(opp.id)] });
      void qc.invalidateQueries({ queryKey: ["smart-views"] });
      close();
    },
  });

  function close() {
    setStageId(null);
    setReason("");
    save.reset();
    onClose();
  }

  return (
    <Sheet
      visible={visible}
      title="Change Stage"
      onClose={close}
      footer={
        <View style={{ gap: SPACE.sm }}>
          {save.error ? (
            <AppText tone="red" variant="small">
              {save.error.message}
            </AppText>
          ) : null}
          <Button
            title="Update Stage"
            loading={save.isPending}
            disabled={!stageId || stageId === current}
            onPress={() => save.mutate()}
          />
        </View>
      }
    >
      <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 2 }}>
        {stages.length === 0 ? (
          <AppText tone="muted">No stages available for this department.</AppText>
        ) : (
          stages.map((s) => {
            const id = String(s.id);
            const selected = (stageId ?? current) === id;
            return (
              <Pressable
                key={id}
                onPress={() => setStageId(id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: SPACE.md,
                  paddingHorizontal: SPACE.sm,
                  borderRadius: RADIUS.sm,
                  backgroundColor: selected ? c.surface : "transparent",
                }}
              >
                <AppText style={{ flex: 1 }}>
                  {s.label}
                  {s.stage_type === "inactive" ? " (inactive)" : ""}
                </AppText>
                {selected ? <Icon name="check" color={c.accent} /> : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Reason (optional)"
        placeholderTextColor={c.muted}
        multiline
        accessibilityLabel="Reason"
        style={{
          marginTop: SPACE.md,
          minHeight: 64,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: RADIUS.sm,
          padding: SPACE.md,
          color: c.ink,
          textAlignVertical: "top",
        }}
      />
    </Sheet>
  );
}
