import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import * as SimDialer from "@modules/sim-dialer";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { startCall } from "@/features/calling/callFlow";
import { useSettingsStore } from "@/store/settings.store";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";

type Params = { name: string; phone: string; opportunityId?: string; leadId?: string; taskId?: string };

/**
 * Android only, shown once before the first call. Explains the two phone permissions, asks for
 * them, then places the call the agent tapped. Declining still works: the dialer opens with the
 * number filled in and the agent presses call themselves.
 */
export default function PermissionsScreen() {
  const c = useColors();
  const p = useLocalSearchParams<Params>();
  const markSeen = useSettingsStore((s) => s.markPermissionIntroSeen);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    SimDialer.getPermissions()
      .then((r) => setBlocked(!r.granted && !r.canAskAgain && r.status === "denied"))
      .catch(() => {});
  }, []);

  async function continueToCall() {
    markSeen();
    router.back();
    if (!p.phone) return;
    await startCall({
      name: p.name ?? "Lead",
      phone: p.phone,
      opportunityId: p.opportunityId || null,
      leadId: p.leadId || null,
      taskId: p.taskId || null,
    }).catch(() => {});
  }

  async function allow() {
    setBusy(true);
    try {
      await SimDialer.requestPermissions();
      await SimDialer.startTracking();
    } finally {
      setBusy(false);
    }
    await continueToCall();
  }

  const points: [string, string][] = [
    ["Make phone calls", "So a tap on a number starts the call straight away, from your SIM."],
    [
      "Phone status",
      "So the app knows when the call ends and can ask you how it went. It never reads your call log or contacts.",
    ],
  ];

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: "center", gap: SPACE.xl }}>
        <View style={{ gap: SPACE.sm }}>
          <AppText variant="title">Allow calling from the app</AppText>
          <AppText tone="muted">Android will ask for two permissions.</AppText>
        </View>

        <View style={{ gap: SPACE.md }}>
          {points.map(([title, body]) => (
            <View
              key={title}
              style={{
                backgroundColor: c.surface,
                borderRadius: RADIUS.md,
                borderWidth: 1,
                borderColor: c.line,
                padding: SPACE.lg,
                gap: 4,
              }}
            >
              <AppText variant="label">{title}</AppText>
              <AppText tone="muted">{body}</AppText>
            </View>
          ))}
        </View>

        {blocked ? (
          <AppText tone="amber">
            These permissions were turned off earlier. Turn on "Phone" for Compass Dialer in Settings, then
            come back.
          </AppText>
        ) : null}

        <View style={{ gap: SPACE.md }}>
          {blocked ? (
            <Button title="Open Settings" onPress={() => void Linking.openSettings()} />
          ) : (
            <Button title="Allow" onPress={allow} loading={busy} />
          )}
          <Button title="Not now, use the dialer" kind="plain" onPress={continueToCall} />
        </View>
      </View>
    </Screen>
  );
}
