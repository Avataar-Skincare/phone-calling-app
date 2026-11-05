import { ActivityIndicator, View } from "react-native";
import { SPACE, useColors } from "@/theme/tokens";
import { AppText } from "./AppText";
import { Button } from "./Button";

interface Props {
  kind: "loading" | "empty" | "error";
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/** Centered loading / empty / error state for lists and screens. */
export function StateView({ kind, title, message, onRetry }: Props) {
  const c = useColors();
  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE.xxl, gap: SPACE.md }}
    >
      {kind === "loading" ? <ActivityIndicator color={c.accent} /> : null}
      {title ? (
        <AppText variant="heading" style={{ textAlign: "center" }}>
          {title}
        </AppText>
      ) : null}
      {message ? (
        <AppText tone="muted" style={{ textAlign: "center" }}>
          {message}
        </AppText>
      ) : null}
      {kind === "error" && onRetry ? <Button title="Try again" kind="secondary" onPress={onRetry} /> : null}
    </View>
  );
}
