import { Text, type TextProps } from "react-native";
import { TYPE, useColors } from "@/theme/tokens";

type Variant = keyof typeof TYPE;
type Tone = "ink" | "muted" | "accent" | "red" | "amber" | "accentInk";

export function AppText({
  variant = "body",
  tone = "ink",
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const c = useColors();
  return <Text {...rest} style={[TYPE[variant], { color: c[tone] }, style]} />;
}
