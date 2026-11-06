import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import { AppText } from "./AppText";
import { Icon } from "./icons";

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Bottom sheet used for every filter picker (Compass's dropdowns, on a phone). */
export function Sheet({ visible, title, onClose, children, footer }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: c.bg,
            borderTopLeftRadius: RADIUS.lg,
            borderTopRightRadius: RADIUS.lg,
            maxHeight: "80%",
            paddingBottom: insets.bottom + SPACE.md,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: SPACE.lg,
              borderBottomWidth: 1,
              borderBottomColor: c.line,
            }}
          >
            <AppText variant="heading">{title}</AppText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
              <Icon name="close" color={c.muted} size={22} />
            </Pressable>
          </View>
          <View style={{ flexShrink: 1 }}>{children}</View>
          {footer ? (
            <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.md }}>{footer}</View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
