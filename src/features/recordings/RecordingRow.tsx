import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";

import * as SimDialer from "@modules/sim-dialer";
import type { RecordingFile } from "@modules/sim-dialer";
import { AppText } from "@/components/AppText";
import { Sheet } from "@/components/Sheet";
import { formatFileSize } from "@/lib/format";
import { matchRecording, recordingProblem, recordingWindow } from "@/lib/recordingMatch";
import { formatTimeIST } from "@/lib/time";
import type { FinishedCall } from "@/store/callLog.store";
import { useSettingsStore } from "@/store/settings.store";
import { SPACE, useColors } from "@/theme/tokens";
import { isUploadInFlight, uploadRecording } from "./uploadRecording";

/** The dialer saves the file a moment after the call: look again a few times before giving up. */
const RESCAN_EVERY_MS = 5_000;
const RESCAN_TIMES = 6;
/** "Choose file" lists audio from the last two hours. */
const PICK_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Whether the recording row applies to a call: Android calls where someone answered. */
export function canUploadRecording(call: FinishedCall): boolean {
  return Platform.OS === "android" && SimDialer.isNativeDialerAvailable && call.answered !== false;
}

/**
 * Part of the call summary card (ADR 0007): finds the phone dialer's recording of the call in the
 * folder the agent picked in Settings, and uploads it to Compass on one tap.
 */
export function RecordingRow({ call }: { call: FinishedCall }) {
  const c = useColors();
  const folder = useSettingsStore((s) => s.recordingsFolder);
  const recording = call.recording;
  const [files, setFiles] = useState<RecordingFile[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [pickable, setPickable] = useState<RecordingFile[]>([]);

  const done = recording?.status === "uploaded";
  const folderUri = folder?.uri;
  const { tappedAt, endedAt, phone } = call;

  // Look for the file, again every few seconds until found (it is written just after the call).
  useEffect(() => {
    if (!folderUri || done) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let round = 0;
    const scan = async () => {
      const { from, to } = recordingWindow({ tappedAt, endedAt });
      const found = await SimDialer.listRecordings(folderUri, from, to).catch(() => []);
      if (cancelled) return;
      setFiles(found);
      const { best } = matchRecording({ tappedAt, endedAt, phone }, found);
      if (!best && ++round < RESCAN_TIMES) timer = setTimeout(() => void scan(), RESCAN_EVERY_MS);
    };
    void scan();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [folderUri, done, tappedAt, endedAt, phone]);

  const openPicker = useCallback(async () => {
    if (!folderUri) return;
    const now = Date.now();
    setPickable(await SimDialer.listRecordings(folderUri, now - PICK_WINDOW_MS, now).catch(() => []));
    setPicking(true);
  }, [folderUri]);

  const link = { fontSize: 13 } as const;
  const action = (title: string, onPress: () => void, label = title) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={10}>
      <AppText variant="label" tone="accent" style={link}>
        {title}
      </AppText>
    </Pressable>
  );
  const row = (children: React.ReactNode) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, marginTop: SPACE.xs }}>
      {children}
    </View>
  );

  if (recording?.status === "uploaded") {
    return row(
      <AppText variant="small" tone="accent" style={{ flex: 1 }}>
        Recording uploaded ✓
      </AppText>,
    );
  }

  if (recording?.status === "uploading" && isUploadInFlight(call.id)) {
    return row(
      <>
        <ActivityIndicator size="small" color={c.accent} />
        <AppText variant="small" tone="muted" style={{ flex: 1 }}>
          Uploading…
        </AppText>
      </>,
    );
  }

  if (recording) {
    // Failed, or an upload that was cut short by the app closing: same fix, try again.
    const retryFile: RecordingFile = {
      uri: recording.fileUri,
      name: recording.fileName,
      sizeBytes: recording.sizeBytes,
      lastModified: 0,
      mimeType: recording.contentType,
    };
    return row(
      <>
        <AppText variant="small" tone="red" style={{ flex: 1 }}>
          {recording.status === "failed" && recording.error ? recording.error : "Upload didn't finish."}
        </AppText>
        {action("Retry", () => void uploadRecording(call.id, retryFile))}
      </>,
    );
  }

  if (!folder) {
    return row(
      <Pressable
        onPress={() => router.push("/settings")}
        accessibilityRole="link"
        accessibilityLabel="Set your recordings folder"
        hitSlop={8}
        style={{ flex: 1 }}
      >
        <AppText variant="small" tone="accent" style={{ textDecorationLine: "underline" }}>
          Set your recordings folder to upload call recordings
        </AppText>
      </Pressable>,
    );
  }

  if (files === null) return null; // first look not finished yet

  const { best } = matchRecording({ tappedAt, endedAt, phone }, files);
  const picker = (
    <Sheet visible={picking} title="Choose a recording" onClose={() => setPicking(false)}>
      <ScrollView>
        {pickable.length === 0 ? (
          <AppText tone="muted" style={{ padding: SPACE.lg }}>
            No audio files in this folder from the last 2 hours.
          </AppText>
        ) : (
          pickable.map((f) => {
            const problem = recordingProblem(f);
            return (
              <Pressable
                key={f.uri}
                disabled={!!problem}
                onPress={() => {
                  setPicking(false);
                  void uploadRecording(call.id, f);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Upload ${f.name}`}
                style={{
                  padding: SPACE.lg,
                  gap: 2,
                  borderBottomWidth: 1,
                  borderBottomColor: c.line,
                  opacity: problem ? 0.5 : 1,
                }}
              >
                <AppText numberOfLines={1}>{f.name}</AppText>
                <AppText variant="small" tone="muted">
                  {problem ?? `${formatTimeIST(f.lastModified)} · ${formatFileSize(f.sizeBytes)}`}
                </AppText>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Sheet>
  );

  if (best) {
    return (
      <>
        {row(
          <>
            <AppText variant="small" tone="muted" style={{ flex: 1 }}>
              {`Recording found · ${formatTimeIST(best.lastModified)} · ${formatFileSize(best.sizeBytes)}`}
            </AppText>
            {action("Upload", () => void uploadRecording(call.id, best), "Upload recording")}
          </>,
        )}
        {picker}
      </>
    );
  }

  return (
    <>
      {row(
        <>
          <AppText variant="small" tone="muted" style={{ flex: 1 }}>
            No recording found
          </AppText>
          {action("Choose file", () => void openPicker())}
        </>,
      )}
      {picker}
    </>
  );
}
