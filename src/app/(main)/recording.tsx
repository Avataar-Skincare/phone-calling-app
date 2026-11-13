import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { RecordingPickerSheet } from "@/features/recordings/RecordingPickerSheet";
import { SharedRecordingView } from "@/features/recordings/SharedRecordingView";
import { useCallRecording } from "@/features/recordings/useCallRecording";
import { formatFileSize } from "@/lib/format";
import { recordingErrorMessage } from "@/lib/recordingMessages";
import { formatTimeIST } from "@/lib/time";
import { useSharedRecording } from "@/store/sharedRecording.store";
import { SPACE, useColors } from "@/theme/tokens";

const CLOSE_AFTER_UPLOAD_MS = 2_000;

function close() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/**
 * Upload call recording (ADR 0007, 0010). Two ways in:
 *  - after an answered Android call (`RecordingPrompt`, `callId`): choose folder, find the file, upload;
 *  - a recording shared from the phone's Phone app (`SharedRecordingWatcher`, `shared=1`): match it to
 *    a call, upload.
 * Skip closes it; the summary card row stays as the fallback.
 */
export default function RecordingScreen() {
  const { callId, shared } = useLocalSearchParams<{ callId?: string; shared?: string }>();
  if (shared === "1") return <SharedRecordingScreen />;
  return <CallRecordingScreen callId={String(callId ?? "")} />;
}

function SharedRecordingScreen() {
  const file = useSharedRecording((s) => s.file);
  const clear = useSharedRecording((s) => s.clear);
  // Leaving the screen any way (Done, Skip, swipe down) forgets the file.
  useEffect(() => clear, [clear]);
  const done = () => {
    clear();
    close();
  };

  return (
    <Screen scroll>
      <AppText variant="title" style={{ fontSize: 30 }}>
        Upload call recording
      </AppText>
      {file ? <SharedRecordingView key={`${file.uri}-${file.sharedAt}`} file={file} onClose={done} /> : null}
    </Screen>
  );
}

function CallRecordingScreen({ callId }: { callId: string }) {
  const c = useColors();
  const r = useCallRecording(callId);
  const { call, phase } = r;

  useEffect(() => {
    if (phase !== "uploaded") return;
    const t = setTimeout(close, CLOSE_AFTER_UPLOAD_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const waitingForCompass = !!call && !call.activityId && call.status !== "failed";
  const uploading = phase === "uploading";

  const body = () => {
    if (!call) return <AppText tone="muted">This call was not found.</AppText>;

    switch (phase) {
      case "uploaded":
        return (
          <>
            <AppText variant="heading" tone="accent">
              Uploaded. Thank you!
            </AppText>
            <Button title="Done" accessibilityLabel="Done" onPress={close} />
          </>
        );
      case "uploading":
        return (
          <View style={{ alignItems: "center", gap: SPACE.lg, paddingVertical: SPACE.xl }}>
            <ActivityIndicator size="large" color={c.accent} />
            <AppText variant="heading">Uploading. Please wait.</AppText>
          </View>
        );
      case "failed": {
        const retryFile = r.retryFile;
        return (
          <>
            <AppText variant="heading" tone="red">
              {recordingErrorMessage(r.error)}
            </AppText>
            {retryFile ? <Button title="Try again" onPress={() => void r.upload(retryFile)} /> : null}
          </>
        );
      }
      case "no_folder":
        return (
          <>
            <AppText variant="heading">
              First, choose the folder where your phone saves call recordings.
            </AppText>
            <Button title="Choose folder" onPress={() => void r.chooseFolder()} />
            <AppText variant="small" tone="muted">
              Samsung: Recordings › Call. Xiaomi: MIUI › sound_recorder › call_rec.
            </AppText>
            <AppText variant="small" tone="muted">
              Google Phone: open the call in Recents, tap the recording, tap Share, choose Compass Dialer.
            </AppText>
          </>
        );
      case "looking":
        return (
          <View style={{ alignItems: "center", gap: SPACE.lg, paddingVertical: SPACE.xl }}>
            <ActivityIndicator size="large" color={c.accent} />
            <AppText variant="heading">Looking for the recording…</AppText>
          </View>
        );
      case "found": {
        const best = r.best;
        if (!best) return null;
        return (
          <>
            <AppText variant="heading" tone="accent">
              Recording found
            </AppText>
            <AppText tone="muted">{`${formatTimeIST(best.lastModified)} · ${formatFileSize(best.sizeBytes)}`}</AppText>
            <Button
              title="Upload"
              loading={waitingForCompass}
              onPress={() => void r.upload(best)}
              accessibilityLabel="Upload"
            />
          </>
        );
      }
      case "not_found":
        return (
          <>
            <AppText variant="heading">Recording not found.</AppText>
            <AppText tone="muted">Is call recording on in your phone?</AppText>
            <Button title="Choose file" onPress={() => void r.openPicker()} />
            <Button title="Look again" kind="secondary" onPress={r.lookAgain} />
          </>
        );
    }
  };

  return (
    <Screen scroll>
      <AppText variant="title" style={{ fontSize: 30 }}>
        Upload call recording
      </AppText>
      {call ? (
        <View style={{ gap: 2 }}>
          <AppText variant="heading">{`Call to ${call.name}`}</AppText>
          <AppText tone="muted">{formatTimeIST(call.endedAt)}</AppText>
        </View>
      ) : null}

      <View style={{ gap: SPACE.lg, marginTop: SPACE.lg }}>{body()}</View>

      <View style={{ flex: 1 }} />
      {uploading || phase === "uploaded" ? null : (
        <Button title="Skip" kind="secondary" accessibilityLabel="Skip" onPress={close} />
      )}

      <RecordingPickerSheet
        visible={r.picking}
        files={r.pickable}
        onPick={(f) => void r.upload(f)}
        onClose={() => r.setPicking(false)}
      />
    </Screen>
  );
}
