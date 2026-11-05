import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SPACE, useColors } from "@/theme/tokens";

/** Full-screen container with safe areas, app background and keyboard handling. */
export function Screen({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
  const c = useColors();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, padding: SPACE.xl, gap: SPACE.lg }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, padding: SPACE.xl, gap: SPACE.lg }}>{children}</View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
