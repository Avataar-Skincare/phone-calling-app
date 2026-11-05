import { View } from "react-native";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import type { CodeLabel } from "@/types/compass";
import { AppText } from "./AppText";

/** Hot stages read warm (amber); everything else uses the neutral accent tint. */
export function StagePill({ stage }: { stage: CodeLabel | null | undefined }) {
  const c = useColors();
  if (!stage) return null;
  const hot = stage.code.startsWith("hot");
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: hot ? c.amberSoft : c.accentSoft,
        borderRadius: RADIUS.pill,
        paddingHorizontal: SPACE.sm,
        paddingVertical: 2,
      }}
    >
      <AppText variant="small" tone={hot ? "amber" : "accent"} style={{ fontSize: 12, fontWeight: "600" }}>
        {stage.label}
      </AppText>
    </View>
  );
}
