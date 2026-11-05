import { useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { StateView } from "@/components/StateView";
import { flushOutcomeQueue } from "@/features/outcome/saveOutcome";
import { formatWhen } from "@/lib/time";
import { useAuthStore } from "@/store/auth.store";
import { useOutcomeQueue } from "@/store/outcomeQueue.store";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";

/** Outcomes saved on the phone that haven't reached Compass yet, with retry and discard. */
export default function PendingScreen() {
  const c = useColors();
  const userId = useAuthStore((s) => s.session?.user.id);
  const all = useOutcomeQueue((s) => s.items);
  const items = all.filter((i) => i.userId === String(userId));
  const [retrying, setRetrying] = useState(false);

  async function retryAll() {
    setRetrying(true);
    useOutcomeQueue.getState().makeAllDue();
    await flushOutcomeQueue();
    setRetrying(false);
  }

  function discard(id: string, leadName: string) {
    Alert.alert(
      "Discard this outcome?",
      `The outcome for ${leadName} will not be saved to Compass. Enter it on the web if you still need it.`,
      [
        { text: "Keep it", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => useOutcomeQueue.getState().remove(id) },
      ],
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        hitSlop={10}
        style={{ paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, alignSelf: "flex-start" }}
      >
        <AppText variant="label" tone="accent" style={{ fontSize: 16 }}>
          ‹ Leads
        </AppText>
      </Pressable>
      <View style={{ paddingHorizontal: SPACE.lg, gap: SPACE.sm }}>
        <AppText variant="title">Waiting to send</AppText>
        <AppText tone="muted">
          These outcomes are saved on your phone. They're sent to Compass automatically when it can be
          reached.
        </AppText>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.sm, flexGrow: 1 }}
        ListEmptyComponent={
          <StateView kind="empty" title="All sent" message="Every outcome has reached Compass." />
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: c.surface,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: item.status === "failed" ? c.red : c.line,
              padding: SPACE.lg,
              gap: 4,
            }}
          >
            <AppText variant="label">{item.leadName}</AppText>
            <AppText variant="small" tone="muted">
              Recorded {formatWhen(item.createdAt)} · {item.attempts}{" "}
              {item.attempts === 1 ? "attempt" : "attempts"}
            </AppText>
            {item.lastError ? (
              <AppText variant="small" tone={item.status === "failed" ? "red" : "muted"}>
                {item.status === "failed" ? "Compass refused it: " : "Last try: "}
                {item.lastError}
              </AppText>
            ) : null}
            <Pressable
              onPress={() => discard(item.id, item.leadName)}
              accessibilityRole="button"
              hitSlop={8}
              style={{ alignSelf: "flex-start", marginTop: SPACE.xs }}
            >
              <AppText variant="label" tone="red">
                Discard
              </AppText>
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          items.length ? (
            <Button title="Retry now" onPress={retryAll} loading={retrying} style={{ marginTop: SPACE.md }} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
