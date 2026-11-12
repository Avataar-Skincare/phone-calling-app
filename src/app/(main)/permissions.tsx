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
 * Android only. Shown before a call whenever call-log access is missing (ADR 0008): explains the
 * three phone permissions and asks for them. The call is placed only once call-log access is
 * granted; there is no "use the dialer instead" way round it, because without the call log the
 * app can't tell talk time from ringing time.
 */
export default function PermissionsScreen() {
  const c = useColors();
  const p = useLocalSearchParams<Params>();
  const markSeen = useSettingsStore((s) => s.markPermissionIntroSeen);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    SimDialer.getPermissions()
      .then((r) => setBlocked(!r.granted && !r.canAskAgain && r.status === "denied"))
      .catch(() => {});
  }, []);

  async function placeCall() {
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
    let granted = false;
    try {
      const r = await SimDialer.requestPermissions();
      await SimDialer.startTracking();
      const caps = await SimDialer.getCapabilities().catch(() => null);
      granted = caps?.canReadCallLog === true;
      if (!granted) {
        setRefused(true);
        setBlocked(!r.canAskAgain);
      }
    } finally {
      setBusy(false);
    }
    if (granted) await placeCall();
  }

  const points: [string, string][] = [
    ["Make phone calls", "So a tap on a number starts the call straight away, from your SIM."],
    ["Phone status", "So the app knows when the call starts and ends."],
    [
      "Call logs",
      "So the app can see how long the client talked, for calls you place from this app only. It doesn't read your contacts or other calls.",
    ],
  ];

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: "center", gap: SPACE.xl }}>
        <View style={{ gap: SPACE.sm }}>
          <AppText variant="title">Allow calling from the app</AppText>
          <AppText tone="muted">
            Call-log access is required to make calls from this app. Android will ask for three permissions.
          </AppText>
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
            Turn on "Phone" and "Call logs" for Compass Dialer in Settings, then come back. Calls can't be
            made from the app without them.
          </AppText>
        ) : refused ? (
          <AppText tone="amber">
            Call logs weren't allowed, so the call can't be made. Tap Allow to try again.
          </AppText>
        ) : null}

        <View style={{ gap: SPACE.md }}>
          {blocked ? (
            <Button title="Open Settings" onPress={() => void Linking.openSettings()} />
          ) : (
            <Button title="Allow" onPress={allow} loading={busy} />
          )}
          <Button title="Cancel" kind="plain" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}
