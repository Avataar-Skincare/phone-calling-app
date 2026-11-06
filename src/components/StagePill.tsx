import { View } from "react-native";
import { stageTone } from "@/lib/format";
import { RADIUS, SPACE, useTone, type Tone } from "@/theme/tokens";
import type { CodeLabel } from "@/types/compass";
import { AppText } from "./AppText";

/** Stage badge in Compass's stage colours (warm amber, hot orange, cold cyan, paid green…). */
export function StagePill({
  stage,
  stageType,
}: {
  stage: CodeLabel | null | undefined;
  stageType?: string | null;
}) {
  const tone = useTone(stageTone(stage?.code, stageType));
  if (!stage) return null;
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: tone.bg,
        borderRadius: RADIUS.pill,
        paddingHorizontal: SPACE.sm,
        paddingVertical: 2,
      }}
    >
      <AppText variant="small" style={{ fontSize: 12, fontWeight: "600", color: tone.fg }}>
        {stage.label}
      </AppText>
    </View>
  );
}

/** Small coloured badge for statuses (Inbound/Outbound, Paid/Partial, overdue…). */
export function Badge({ label, tone }: { label: string; tone: Tone }) {
  const t = useTone(tone);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: t.bg,
        borderRadius: RADIUS.pill,
        paddingHorizontal: SPACE.sm,
        paddingVertical: 2,
      }}
    >
      <AppText variant="small" style={{ fontSize: 12, fontWeight: "600", color: t.fg }}>
        {label}
      </AppText>
    </View>
  );
}
