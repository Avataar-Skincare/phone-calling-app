import { useEffect, useState, type ReactNode } from "react";
import { Linking, View } from "react-native";
import { router } from "expo-router";

import * as SimDialer from "@modules/sim-dialer";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { GOOGLE_SHARE_STEPS, TEXT } from "@/features/setup/texts";
import { useSetupCheck } from "@/features/setup/useSetupCheck";
import { hasRequired, type IssueId, type StartupIssue } from "@/lib/startupCheck";
import { useSettingsStore } from "@/store/settings.store";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";

function close() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

function Card({ title, tone, children }: { title: string; tone?: "amber"; children: ReactNode }) {
  const c = useColors();
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: c.line,
        padding: SPACE.lg,
        gap: SPACE.md,
      }}
    >
      <AppText variant="heading" tone={tone}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

/**
 * "Before you start" (ADR 0011). Opens by itself when phone access or call logs are missing, or the
 * phone is hiding call logs. Required items block Continue. The hidden-log warning has Skip, which
 * stays quiet for 24 hours. Recording tips never block.
 */
export default function SetupCheckScreen() {
  const { issues, refresh } = useSetupCheck();
  const skip = useSettingsStore((s) => s.skipHiddenLogWarning);
  const [busy, setBusy] = useState(false);
  // Android may refuse the prompt silently once it was denied for good, so after one try that did
  // not help (or when it is known to be blocked) the only button is Open settings.
  const [needSettings, setNeedSettings] = useState(false);

  useEffect(() => {
    SimDialer.getPermissions()
      .then((r) => setNeedSettings(!r.granted && !r.canAskAgain && r.status === "denied"))
      .catch(() => {});
  }, []);

  const list: StartupIssue[] = issues ?? [];
  const has = (id: IssueId) => list.some((x) => x.id === id);
  const blocked = hasRequired(list);

  async function allow() {
    setBusy(true);
    try {
      await SimDialer.requestPermissions();
      await SimDialer.startTracking();
      refresh();
      const caps = await SimDialer.getCapabilities().catch(() => null);
      if (!caps || !caps.canDirectDial || !caps.canChooseSim || !caps.canReadCallLog) setNeedSettings(true);
    } finally {
      setBusy(false);
    }
  }

  function onContinue() {
    // Going on with the warning showing counts as skipping it, so it does not come back at once.
    if (has("hidden_log")) skip();
    close();
  }

  /** Allow (or Open settings once the phone will not ask again) for a missing permission. */
  const allowButtons = () => (
    <>
      {needSettings ? (
        <>
          <AppText tone="amber">{TEXT.stillMissing}</AppText>
          <Button title={TEXT.openSettings} onPress={() => void Linking.openSettings()} />
        </>
      ) : (
        <Button title={TEXT.allow} loading={busy} onPress={() => void allow()} />
      )}
    </>
  );

  return (
    <Screen scroll>
      <AppText variant="title" style={{ fontSize: 30 }}>
        {TEXT.title}
      </AppText>

      {issues === null ? null : (
        <View style={{ gap: SPACE.lg }}>
          {has("phone") ? (
            <Card title={TEXT.phoneTitle} tone="amber">
              <AppText>{TEXT.phoneBody}</AppText>
              {allowButtons()}
            </Card>
          ) : null}

          {has("call_log") ? (
            <Card title={TEXT.callLogTitle} tone="amber">
              <AppText>{TEXT.callLogBody}</AppText>
              {has("phone") ? null : allowButtons()}
            </Card>
          ) : null}

          {has("hidden_log") ? (
            <Card title={TEXT.hiddenTitle} tone="amber">
              <AppText>{TEXT.hiddenBody}</AppText>
              <AppText tone="muted">{TEXT.hiddenSteps}</AppText>
              <Button title={TEXT.openSettings} onPress={() => void Linking.openSettings()} />
              <Button title={TEXT.checkAgain} kind="secondary" onPress={refresh} />
              <Button title={TEXT.skip} kind="plain" onPress={onContinue} />
            </Card>
          ) : null}

          {has("recordings_google") ? (
            <Card title={TEXT.recordingsTitle}>
              <AppText tone="muted">{GOOGLE_SHARE_STEPS}</AppText>
            </Card>
          ) : null}
        </View>
      )}

      <View style={{ flex: 1 }} />
      <Button title={TEXT.continue} disabled={issues === null || blocked} onPress={onContinue} />
    </Screen>
  );
}
