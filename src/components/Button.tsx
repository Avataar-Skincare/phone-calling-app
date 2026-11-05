import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import { AppText } from "./AppText";

interface Props extends Omit<PressableProps, "style" | "children"> {
  title: string;
  kind?: "primary" | "secondary" | "plain";
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, kind = "primary", loading, disabled, style, ...rest }: Props) {
  const c = useColors();
  const isDisabled = disabled || loading;
  const bg = kind === "primary" ? c.accent : kind === "secondary" ? c.surface : "transparent";
  const fg = kind === "primary" ? "accentInk" : "accent";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          minHeight: 50,
          borderRadius: RADIUS.md,
          paddingHorizontal: SPACE.xl,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          borderWidth: kind === "secondary" ? 1 : 0,
          borderColor: c.line,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={kind === "primary" ? c.accentInk : c.accent} />
      ) : (
        <AppText variant="label" tone={fg} style={{ fontSize: 16 }}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}
