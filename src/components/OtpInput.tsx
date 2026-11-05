import { useRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import { AppText } from "./AppText";

interface Props {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  disabled?: boolean;
}

/**
 * Boxed OTP field backed by one hidden TextInput, so paste and SMS autofill
 * (iOS oneTimeCode, Android sms-otp) fill all boxes at once.
 */
export function OtpInput({ value, onChange, length = 4, disabled }: Props) {
  const c = useColors();
  const ref = useRef<TextInput>(null);

  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      accessibilityLabel="One-time code"
      style={{ alignSelf: "flex-start" }}
    >
      <View style={{ flexDirection: "row", gap: SPACE.md }}>
        {Array.from({ length }, (_, i) => {
          const active = i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              style={{
                width: 56,
                height: 64,
                borderRadius: RADIUS.md,
                borderWidth: active ? 2 : 1,
                borderColor: active ? c.accent : c.line,
                backgroundColor: c.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText style={{ fontSize: 26, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                {value[i] ?? ""}
              </AppText>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        testID="otp-input"
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus
        editable={!disabled}
        caretHidden
        contextMenuHidden
        underlineColorAndroid="transparent"
        selectionColor="transparent"
        // Invisible but still focusable: the boxes above show the digits.
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          opacity: 0.011,
          color: "transparent",
          backgroundColor: "transparent",
        }}
      />
    </Pressable>
  );
}
