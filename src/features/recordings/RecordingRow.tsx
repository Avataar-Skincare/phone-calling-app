import { ActivityIndicator, Pressable, View } from "react-native";
import { router } from "expo-router";

import { AppText } from "@/components/AppText";
import { formatFileSize } from "@/lib/format";
import { recordingErrorMessage } from "@/lib/recordingMessages";
import { formatTimeIST } from "@/lib/time";
import type { FinishedCall } from "@/store/callLog.store";
import { SPACE, useColors } from "@/theme/tokens";
import { RecordingPickerSheet } from "./RecordingPickerSheet";
import { canUploadRecording, useCallRecording } from "./useCallRecording";

export { canUploadRecording };

/**
 * Part of the call summary card (ADR 0007): finds the phone dialer's recording of the call in the
 * folder the agent picked, and uploads it to Compass on one tap. The Upload call recording screen
 * (`/recording`) opens by itself after a call; this row is the fallback for later.
 */
export function RecordingRow({ call }: { call: FinishedCall }) {
  const c = useColors();
  const r = useCallRecording(call.id);

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

  if (r.phase === "uploaded") {
    return row(
      <AppText variant="small" tone="accent" style={{ flex: 1 }}>
        Recording uploaded ✓
      </AppText>,
    );
  }

  if (r.phase === "uploading") {
    return row(
      <>
        <ActivityIndicator size="small" color={c.accent} />
        <AppText variant="small" tone="muted" style={{ flex: 1 }}>
          Uploading…
        </AppText>
      </>,
    );
  }

  if (r.phase === "failed") {
    const retryFile = r.retryFile;
    return row(
      <>
        <AppText variant="small" tone="red" style={{ flex: 1 }}>
          {recordingErrorMessage(r.error)}
        </AppText>
        {retryFile ? action("Retry", () => void r.upload(retryFile)) : null}
      </>,
    );
  }

  if (r.phase === "no_folder") {
    return row(
      <Pressable
        onPress={() => router.push("/settings")}
        accessibilityRole="link"
        accessibilityLabel="Choose recordings folder"
        hitSlop={8}
        style={{ flex: 1 }}
      >
        <AppText variant="small" tone="accent" style={{ textDecorationLine: "underline" }}>
          Choose recordings folder
        </AppText>
      </Pressable>,
    );
  }

  if (r.files === null) return null; // first look not finished yet

  const picker = (
    <RecordingPickerSheet
      visible={r.picking}
      files={r.pickable}
      onPick={(f) => void r.upload(f)}
      onClose={() => r.setPicking(false)}
    />
  );

  if (r.best) {
    const best = r.best;
    return (
      <>
        {row(
          <>
            <AppText variant="small" tone="muted" style={{ flex: 1 }}>
              {`Recording found · ${formatTimeIST(best.lastModified)} · ${formatFileSize(best.sizeBytes)}`}
            </AppText>
            {action("Upload", () => void r.upload(best), "Upload recording")}
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
            Recording not found
          </AppText>
          {action("Choose file", () => void r.openPicker())}
        </>,
      )}
      {picker}
    </>
  );
}
