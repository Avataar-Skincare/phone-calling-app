import { useCallback, useState } from "react";
import { Alert, Linking, Platform, Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Constants from "expo-constants";

import * as SimDialer from "@modules/sim-dialer";
import { useSettingsStore } from "@/store/settings.store";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { isTestingBackend } from "@/config/env";
import { useUserDepartment } from "@/features/leads/useLeadQueries";
import { signOut } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { formatWhen } from "@/lib/time";
import { useAuthStore } from "@/store/auth.store";
import { useCallStore } from "@/store/call.store";
import { useOutcomeQueue } from "@/store/outcomeQueue.store";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";

const ROLE_LABEL: Record<string, string> = {
  administrator: "Administrator",
  supervisor: "Supervisor",
  tl: "Team lead",
  agent: "Agent",
};

export default function SettingsScreen() {
  const c = useColors();
  const session = useAuthStore((s) => s.session);
  const dept = useUserDepartment();
  const calling = useCallingSettings();
  if (!session) return null;
  const { user, expiresAt } = session;

  const rows: [string, string][] = [
    ["Name", user.name],
    ["Number", formatPhone(user.phone)],
    ["Role", ROLE_LABEL[user.role] ?? user.role],
    ["Department", dept.code === "cs" ? "Customer Support" : dept.code === "sales" ? "Sales" : "All"],
    ["Session ends", formatWhen(expiresAt)],
    ["Compass", isTestingBackend ? "Testing" : "Production"],
    ["App version", Constants.expoConfig?.version ?? "—"],
  ];

  return (
    <Screen scroll>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        hitSlop={10}
        style={{ alignSelf: "flex-start" }}
      >
        <AppText variant="label" tone="accent" style={{ fontSize: 16 }}>
          ‹ Leads
        </AppText>
      </Pressable>
      <AppText variant="title">Account</AppText>

      <View
        style={{ backgroundColor: c.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.line }}
      >
        {rows.map(([k, v], i) => (
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

      {Platform.OS === "android" && SimDialer.isNativeDialerAvailable ? (
        <CallingSection {...calling} />
      ) : null}

      <Button title="Log out" kind="secondary" onPress={confirmLogout} />
    </Screen>
  );
}

/** Android calling setup: permission state and which SIM to call from. Reloaded on focus. */
function useCallingSettings() {
  const [perm, setPerm] = useState<SimDialer.PermissionResponse | null>(null);
  const [sims, setSims] = useState<SimDialer.Sim[]>([]);

  const reload = useCallback(async () => {
    if (Platform.OS !== "android") return;
    const p = await SimDialer.getPermissions().catch(() => null);
    setPerm(p);
    setSims(await SimDialer.listSims().catch(() => []));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { perm, sims, reload };
}

function CallingSection({ perm, sims, reload }: ReturnType<typeof useCallingSettings>) {
  const c = useColors();
  const simId = useSettingsStore((s) => s.simId);
  const setSimId = useSettingsStore((s) => s.setSimId);

  const granted = perm?.granted ?? false;
  const blocked = !!perm && !perm.granted && !perm.canAskAgain && perm.status === "denied";

  async function fix() {
    if (blocked) {
      await Linking.openSettings();
      return;
    }
    await SimDialer.requestPermissions();
    await SimDialer.startTracking();
    await reload();
  }

  const options: { id: string | null; label: string }[] = [{ id: null, label: "Phone's default" }, ...sims];
  // A saved SIM that is no longer in the phone falls back to the default.
  const selected = simId && sims.some((s) => s.id === simId) ? simId : null;

  return (
    <View style={{ gap: SPACE.md }}>
      <AppText variant="heading">Calling</AppText>
      <View
        style={{
          backgroundColor: c.surface,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: c.line,
          padding: SPACE.lg,
          gap: SPACE.sm,
        }}
      >
        <AppText variant="label">Phone permissions</AppText>
        <AppText tone={granted ? "accent" : "amber"}>
          {granted
            ? "Allowed. Calls start straight away and the app tracks when they end."
            : "Not allowed. Calls open the dialer with the number filled in, and call tracking is limited."}
        </AppText>
        {!granted ? (
          <Button title={blocked ? "Open Settings" : "Allow"} kind="secondary" onPress={() => void fix()} />
        ) : null}
      </View>

      {sims.length > 1 ? (
        <View
          style={{ backgroundColor: c.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.line }}
        >
          <AppText variant="label" style={{ padding: SPACE.lg, paddingBottom: SPACE.sm }}>
            Call from
          </AppText>
          {options.map((o) => {
            const on = o.id === selected;
            return (
              <Pressable
                key={o.id ?? "default"}
                onPress={() => setSimId(o.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.md,
                  paddingHorizontal: SPACE.lg,
                  paddingVertical: SPACE.md,
                  borderTopWidth: 1,
                  borderTopColor: c.line,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: on ? c.accent : c.line,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {on ? (
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent }} />
                  ) : null}
                </View>
                <AppText>{o.label}</AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Log out, unless that would strand work: an unsaved call outcome, or outcomes still waiting to
 * reach Compass (they are sent with the agent's session, so they'd sit until the same agent logs
 * back in).
 */
function confirmLogout() {
  const userId = useAuthStore.getState().session?.user.id;
  const waiting = useOutcomeQueue.getState().items.filter((i) => i.userId === String(userId)).length;
  const call = useCallStore.getState().session;

  if (call) {
    Alert.alert(
      "Finish your last call first",
      `Record or discard the call to ${call.name} before logging out.`,
      [
        { text: "OK", style: "cancel" },
        { text: "Record outcome", onPress: () => router.push("/outcome") },
      ],
    );
    return;
  }
  if (waiting > 0) {
    Alert.alert(
      "Outcomes still waiting to send",
      `${waiting} ${waiting === 1 ? "outcome hasn't" : "outcomes haven't"} reached Compass yet. They'll be sent the next time you log in on this phone.`,
      [
        { text: "Stay logged in", style: "cancel" },
        { text: "Log out anyway", style: "destructive", onPress: () => void signOut() },
      ],
    );
    return;
  }
  void signOut();
}
