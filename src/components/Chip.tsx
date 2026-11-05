import { Pressable } from "react-native";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import { AppText } from "./AppText";

interface Props {
  label: string;
  selected?: boolean;
  onPress: () => void;
  accessibilityRole?: "radio" | "button";
  hint?: string;
}

/** Selectable pill, used for stages, dropdown options and quick times. */
export function Chip({ label, selected = false, onPress, accessibilityRole = "radio", hint }: Props) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityRole === "radio" ? { checked: selected } : undefined}
      accessibilityHint={hint}
      hitSlop={4}
      style={({ pressed }) => ({
        paddingHorizontal: SPACE.md,
        paddingVertical: SPACE.sm,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: selected ? c.accent : c.line,
        backgroundColor: selected ? c.accentSoft : c.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <AppText
        variant="label"
        tone={selected ? "accent" : "ink"}
        style={{ fontWeight: selected ? "700" : "500" }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
