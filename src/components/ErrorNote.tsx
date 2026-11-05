import { View } from "react-native";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import { AppText } from "./AppText";

/** Inline error message under a form. Renders nothing when there is no message. */
export function ErrorNote({ message }: { message: string | null | undefined }) {
  const c = useColors();
  if (!message) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: c.redSoft, borderRadius: RADIUS.sm, padding: SPACE.md }}
    >
      <AppText variant="small" tone="red">
        {message}
      </AppText>
    </View>
  );
}
