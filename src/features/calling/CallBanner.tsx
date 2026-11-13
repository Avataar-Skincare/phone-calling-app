import { useMemo } from "react";
import { Alert, Pressable, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Icon } from "@/components/icons";
import { formatDuration } from "@/lib/callState";
import { useAuthStore } from "@/store/auth.store";
import { useCallLog, type FinishedCall } from "@/store/callLog.store";
import { useCallStore } from "@/store/call.store";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import { RecordingRow, canUploadRecording } from "@/features/recordings/RecordingRow";
import { discardFailedCalls, retryAllCalls } from "./sendCalls";

/**
 * Strip under the header:
 *  - while a call is live: "Calling Asha Rao"
 *  - right after it ends, while its times are worked out: "Call to Asha Rao ended"
 *  - then a summary of the last call (talk time, ringing, total) until the agent closes it
 *  - calls that haven't reached Compass yet (offline, or refused), with Retry
 */
export function CallBanner() {
  return (
    <>
      <CallStatus />
      <UnsentCalls />
    </>
  );
}

function CallStatus() {
  const c = useColors();
  const session = useCallStore((s) => s.session);
  const userId = useAuthStore((s) => s.session?.user.id);
  const last = useCallLog((s) => s.calls[0]);
  const dismiss = useCallLog((s) => s.dismiss);

  if (session) {
    const ended = session.status === "ended";
    return (
      <View accessibilityLiveRegion="polite" style={{ ...strip, backgroundColor: c.accentSoft }}>
        <AppText variant="label" tone="accent">
          {ended ? `Call to ${session.name} ended` : `Calling ${session.name}`}
        </AppText>
        <AppText variant="small" tone="muted">
          {ended ? "Getting call details…" : session.status === "in_call" ? "On the call" : "Dialing…"}
        </AppText>
      </View>
    );
  }

  if (!last || last.dismissed || (last.userId !== null && last.userId !== String(userId))) return null;
  const { title, detail, tone } = summary(last);
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ ...strip, backgroundColor: tone === "accent" ? c.accentSoft : c.amberSoft }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="label" tone={tone}>
            {title}
          </AppText>
          <AppText variant="small" tone="muted">
            {detail}
          </AppText>
        </View>
        <Pressable
          onPress={() => dismiss(last.id)}
          accessibilityRole="button"
          accessibilityLabel="Close call summary"
          hitSlop={10}
        >
          <Icon name="close" color={c.muted} />
        </Pressable>
      </View>
      {canUploadRecording(last) ? <RecordingRow call={last} /> : null}
    </View>
  );
}

/** Calls not in Compass yet: retried automatically; refused ones need the agent. */
function UnsentCalls() {
  const c = useColors();
  const userId = useAuthStore((s) => s.session?.user.id);
  // Select the array itself; filtering inside the selector would re-render forever.
  const calls = useCallLog((s) => s.calls);
  const mine = useMemo(() => calls.filter((x) => x.userId === String(userId)), [calls, userId]);
  const failed = mine.filter((x) => x.status === "failed");
  // Only once a send has failed: a call being sent right now isn't worth a strip.
  const waiting = mine.filter((x) => x.status === "pending" && x.attempts > 0);
  if (!failed.length && !waiting.length) return null;

  const n = failed.length || waiting.length;
  const calls_ = `${n} ${n === 1 ? "call" : "calls"}`;
  const onPress = () =>
    failed.length
      ? Alert.alert(
          `${calls_} not saved to Compass`,
          failed[0]!.lastError ?? "Compass refused the call log.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Discard", style: "destructive", onPress: discardFailedCalls },
            { text: "Retry", onPress: () => void retryAllCalls() },
          ],
        )
      : void retryAllCalls();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLiveRegion="polite"
      style={{
        ...strip,
        backgroundColor: failed.length ? c.redSoft : c.surface,
        borderWidth: failed.length ? 0 : 1,
        borderColor: c.line,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" tone={failed.length ? "red" : "ink"}>
          {failed.length ? `${calls_} couldn't be saved to Compass` : `${calls_} waiting to save to Compass`}
        </AppText>
        <AppText variant="small" tone="muted">
          {failed.length ? "Tap to see why." : "They'll be saved when Compass is reachable."}
        </AppText>
      </View>
      <AppText variant="label" tone={failed.length ? "red" : "accent"}>
        {failed.length ? "View" : "Retry"}
      </AppText>
    </Pressable>
  );
}

const strip = {
  marginHorizontal: SPACE.lg,
  marginTop: SPACE.md,
  padding: SPACE.md,
  paddingLeft: SPACE.lg,
  borderRadius: RADIUS.md,
  gap: 2,
} as const;

/** What the summary card says about a finished call. Exported for tests. */
export function summary(call: FinishedCall): { title: string; detail: string; tone: "accent" | "amber" } {
  const total = formatDuration(call.totalDurationSeconds);
  if (call.answered === true && call.talkTimeSeconds !== null) {
    return {
      title: `Call to ${call.name} · Connected`,
      detail: `Talk time ${formatDuration(call.talkTimeSeconds)} · Ringing ${formatDuration(call.ringTimeSeconds)} · Total ${total}`,
      tone: "accent",
    };
  }
  if (call.answered === false) {
    return { title: `Call to ${call.name} · Not answered`, detail: `Rang for ${total}`, tone: "amber" };
  }
  return {
    title: `Call to ${call.name} ended`,
    detail: `Lasted ${total}. Talk time isn't available${call.platform === "android" ? ": allow Call logs for Compass Dialer in Settings" : ""}.`,
    tone: "amber",
  };
}
