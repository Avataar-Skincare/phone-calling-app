import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";

import { AppText } from "@/components/AppText";
import { useCallStore } from "@/store/call.store";
import { useOutcomeQueue } from "@/store/outcomeQueue.store";
import { useAuthStore } from "@/store/auth.store";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";

/**
 * Status strips on the home screen:
 *  - the call in progress, or the ended call whose outcome still has to be recorded
 *  - outcomes saved on the phone that haven't reached Compass yet
 */
export function CallBanner() {
  const c = useColors();
  const session = useCallStore((s) => s.session);
  const userId = useAuthStore((s) => s.session?.user.id);
  // Select the stored array itself; filtering inside the selector would return a new array on
  // every render, which zustand treats as a change and re-renders forever.
  const items = useOutcomeQueue((s) => s.items);
  const queued = useMemo(() => items.filter((i) => i.userId === String(userId)), [items, userId]);
  const failed = queued.filter((i) => i.status === "failed").length;

  return (
    <>
      {session ? (
        <Strip
          tone={session.status === "ended" ? "amber" : "accent"}
          title={
            session.status === "ended" ? `Record the call to ${session.name}` : `Calling ${session.name}`
          }
          detail={
            session.status === "ended"
              ? "Save how it went before your next call."
              : session.status === "in_call"
                ? "On the call"
                : "Dialing…"
          }
          action={session.status === "ended" ? "Record" : undefined}
          onPress={session.status === "ended" ? () => router.push("/outcome") : undefined}
          bg={session.status === "ended" ? c.amberSoft : c.accentSoft}
        />
      ) : null}
      {queued.length > 0 ? (
        <Strip
          tone={failed ? "red" : "muted"}
          title={
            failed
              ? `${failed} ${failed === 1 ? "outcome" : "outcomes"} couldn't be saved`
              : `${queued.length} ${queued.length === 1 ? "outcome" : "outcomes"} waiting to send`
          }
          detail={failed ? "Open to see why." : "They'll be sent when Compass is reachable."}
          action="View"
          onPress={() => router.push("/pending")}
          bg={failed ? c.redSoft : c.surface}
        />
      ) : null}
    </>
  );
}

function Strip(props: {
  tone: "accent" | "amber" | "red" | "muted";
  title: string;
  detail: string;
  action?: string;
  onPress?: () => void;
  bg: string;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={props.onPress}
      disabled={!props.onPress}
      accessibilityRole={props.onPress ? "button" : undefined}
      accessibilityLiveRegion="polite"
      style={{
        marginHorizontal: SPACE.lg,
        marginTop: SPACE.md,
        padding: SPACE.md,
        paddingLeft: SPACE.lg,
        borderRadius: RADIUS.md,
        borderWidth: props.bg === c.surface ? 1 : 0,
        borderColor: c.line,
        backgroundColor: props.bg,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" tone={props.tone === "muted" ? "ink" : props.tone}>
          {props.title}
        </AppText>
        <AppText variant="small" tone="muted">
          {props.detail}
        </AppText>
      </View>
      {props.action ? (
        <AppText variant="label" tone={props.tone === "muted" ? "accent" : props.tone}>
          {props.action}
        </AppText>
      ) : null}
    </Pressable>
  );
}
