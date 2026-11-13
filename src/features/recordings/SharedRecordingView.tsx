import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import type { SharedRecording } from "@modules/sim-dialer";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { formatCallDuration } from "@/lib/format";
import { recordingErrorMessage } from "@/lib/recordingMessages";
import { recordingProblem } from "@/lib/recordingMatch";
import { matchSharedRecording, recordingTimeFromName } from "@/lib/sharedRecordingMatch";
import { formatWhen } from "@/lib/time";
import { useAuthStore } from "@/store/auth.store";
import { useCallLog, type FinishedCall } from "@/store/callLog.store";
import { SPACE, useColors } from "@/theme/tokens";
import { isUploadInFlight, uploadRecording } from "./uploadRecording";

const CLOSE_AFTER_UPLOAD_MS = 2_000;

/** The shared file's own problem (copy failed, wrong type, empty, too big), or null. */
function fileProblem(file: SharedRecording): string | null {
  if (file.error === "too_big") return "This recording is over 25 MB, too large to upload.";
  if (file.error === "unreadable") return "Could not read the shared file.";
  return recordingProblem(file);
}

function callLine(call: FinishedCall): string {
  const seconds = Math.round((call.endedAt - (call.startedAt ?? call.tappedAt)) / 1000);
  return `${formatWhen(call.endedAt)} · ${formatCallDuration(seconds)}`;
}

/**
 * Body of the Upload call recording screen for a file shared from the phone's Phone app (ADR 0010):
 * works out which call it is for (`matchSharedRecording`), lets the agent pick another, and uses the
 * same `uploadRecording` as the folder flow. The upload result lives on the call (`recording`).
 */
export function SharedRecordingView({ file, onClose }: { file: SharedRecording; onClose: () => void }) {
  const c = useColors();
  const userId = useAuthStore((s) => s.session?.user.id);
  const calls = useCallLog((s) => s.calls);
  const [now] = useState(() => Date.now());
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);

  const { best, candidates } = useMemo(
    () =>
      matchSharedRecording(
        recordingTimeFromName(file.name),
        calls,
        now,
        userId === undefined ? null : String(userId),
      ),
    [file.name, calls, now, userId],
  );
  const target = candidates.find((x) => x.id === chosenId) ?? best;
  const problem = fileProblem(file);

  // What happened to this very file on the chosen call.
  const rec = target?.recording && target.recording.fileUri === file.uri ? target.recording : undefined;
  const phase: "idle" | "uploading" | "uploaded" | "failed" = !rec
    ? "idle"
    : rec.status === "uploaded"
      ? "uploaded"
      : rec.status === "uploading" && target && isUploadInFlight(target.id)
        ? "uploading"
        : "failed";

  useEffect(() => {
    if (phase !== "uploaded") return;
    const t = setTimeout(onClose, CLOSE_AFTER_UPLOAD_MS);
    return () => clearTimeout(t);
  }, [phase, onClose]);

  const upload = () => {
    if (!target) return;
    void uploadRecording(target.id, {
      uri: file.uri,
      name: file.name,
      sizeBytes: file.sizeBytes,
      lastModified: file.sharedAt,
      mimeType: file.mimeType,
    });
  };

  const waitingForCompass = !!target && !target.activityId && target.status !== "failed";

  const callList = (
    <View style={{ gap: SPACE.sm }}>
      {candidates.length === 0 ? (
        <AppText tone="muted">No calls from the last 2 days.</AppText>
      ) : (
        candidates.map((call) => (
          <Pressable
            key={call.id}
            accessibilityRole="button"
            accessibilityLabel={`Choose call to ${call.name}, ${formatWhen(call.endedAt)}`}
            onPress={() => {
              setChosenId(call.id);
              setChoosing(false);
            }}
            style={{
              padding: SPACE.lg,
              gap: 2,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor: c.surface,
            }}
          >
            <AppText variant="heading">{`Call to ${call.name}`}</AppText>
            <AppText variant="small" tone="muted">
              {callLine(call)}
            </AppText>
          </Pressable>
        ))
      )}
    </View>
  );

  const body = () => {
    if (problem) {
      return (
        <AppText variant="heading" tone="red">
          {recordingErrorMessage(problem)}
        </AppText>
      );
    }
    if (phase === "uploaded") {
      return (
        <>
          <AppText variant="heading" tone="accent">
            Uploaded. Thank you!
          </AppText>
          <Button title="Done" accessibilityLabel="Done" onPress={onClose} />
        </>
      );
    }
    if (phase === "uploading") {
      return (
        <View style={{ alignItems: "center", gap: SPACE.lg, paddingVertical: SPACE.xl }}>
          <ActivityIndicator size="large" color={c.accent} />
          <AppText variant="heading">Uploading. Please wait.</AppText>
        </View>
      );
    }
    if (phase === "failed" && target) {
      return (
        <>
          <AppText variant="heading" tone="red">
            {recordingErrorMessage(rec?.status === "failed" ? rec.error : null)}
          </AppText>
          <Button title="Try again" onPress={upload} />
        </>
      );
    }
    if (choosing || !target) {
      return (
        <>
          <AppText variant="heading">Which call is this recording for?</AppText>
          {callList}
        </>
      );
    }
    return (
      <>
        <AppText tone="muted">This recording is for:</AppText>
        <View style={{ gap: 2 }}>
          <AppText variant="heading">{`Call to ${target.name}`}</AppText>
          <AppText tone="muted">{callLine(target)}</AppText>
        </View>
        <Button title="Upload" accessibilityLabel="Upload" loading={waitingForCompass} onPress={upload} />
        {candidates.length > 1 ? (
          <Button title="Choose another call" kind="secondary" onPress={() => setChoosing(true)} />
        ) : null}
      </>
    );
  };

  return (
    <>
      <View style={{ gap: SPACE.lg, marginTop: SPACE.lg }}>{body()}</View>
      <View style={{ flex: 1 }} />
      {phase === "uploading" || phase === "uploaded" ? null : (
        <Button title="Skip" kind="secondary" accessibilityLabel="Skip" onPress={onClose} />
      )}
    </>
  );
}
