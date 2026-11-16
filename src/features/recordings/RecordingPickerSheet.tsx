import { Pressable, ScrollView } from "react-native";

import type { RecordingFile } from "@modules/sim-dialer";
import { AppText } from "@/components/AppText";
import { Sheet } from "@/components/Sheet";
import { formatFileSize } from "@/lib/format";
import { recordingProblem } from "@/lib/recordingMatch";
import { formatTimeIST } from "@/lib/time";
import { SPACE, useColors } from "@/theme/tokens";

/** "Choose a recording": the folder's audio files from the last 2 hours. */
export function RecordingPickerSheet({
  visible,
  files,
  onPick,
  onClose,
}: {
  visible: boolean;
  files: RecordingFile[];
  onPick: (file: RecordingFile) => void;
  onClose: () => void;
}) {
  const c = useColors();
  return (
    <Sheet visible={visible} title="Choose a recording" onClose={onClose}>
      <ScrollView>
        {files.length === 0 ? (
          <AppText tone="muted" style={{ padding: SPACE.lg }}>
            No audio files in this folder from the last 2 hours.
          </AppText>
        ) : (
          files.map((f) => {
            const problem = recordingProblem(f);
            return (
              <Pressable
                key={f.uri}
                disabled={!!problem}
                onPress={() => {
                  onClose();
                  onPick(f);
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
}
