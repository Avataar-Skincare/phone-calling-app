import { useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";

import { sendOtp } from "@/api/auth";
import { ApiError } from "@/api/client";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { ErrorNote } from "@/components/ErrorNote";
import { Screen } from "@/components/Screen";
import { isTestingBackend } from "@/config/env";
import { toIndianMobile } from "@/lib/phone";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";

export default function LoginScreen() {
  const c = useColors();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phone = toIndianMobile(input);

  async function onSend() {
    if (!phone || sending) return;
    setSending(true);
    setError(null);
    try {
      const { token } = await sendOtp(phone);
      router.push({ pathname: "/otp", params: { phone, token } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setError("This number isn't registered in Compass. Ask your admin to add it, then try again.");
      } else {
        setError(e instanceof Error ? e.message : "Couldn't send the code. Try again.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: "center", gap: SPACE.xl }}>
        <View style={{ gap: SPACE.sm }}>
          <AppText variant="label" tone="accent" style={{ letterSpacing: 1.2, textTransform: "uppercase" }}>
            Compass Dialer{isTestingBackend ? " · Testing" : ""}
          </AppText>
          <AppText variant="title">Log in with your Compass number</AppText>
          <AppText tone="muted">We'll send a 4-digit code by SMS and WhatsApp.</AppText>
        </View>

        <View style={{ gap: SPACE.sm }}>
          <AppText variant="label" tone="muted" nativeID="phoneLabel">
            Mobile number
          </AppText>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: error ? c.red : c.line,
              borderRadius: RADIUS.md,
              backgroundColor: c.surface,
              paddingHorizontal: SPACE.lg,
              minHeight: 56,
            }}
          >
            <AppText tone="muted" style={{ fontSize: 18, marginRight: SPACE.sm }}>
              +91
            </AppText>
            <TextInput
              testID="login-phone"
              accessibilityLabelledBy="phoneLabel"
              value={input}
              onChangeText={(t) => {
                setInput(t);
                if (error) setError(null);
              }}
              placeholder="98711 07094"
              placeholderTextColor={c.muted}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              maxLength={16}
              autoFocus
              returnKeyType="send"
              onSubmitEditing={onSend}
              style={{ flex: 1, fontSize: 18, color: c.ink, paddingVertical: SPACE.md, letterSpacing: 0.5 }}
            />
          </View>
          {input.length >= 10 && !phone ? (
            <AppText variant="small" tone="red">
              Enter a valid 10-digit Indian mobile number.
            </AppText>
          ) : null}
        </View>

        <ErrorNote message={error} />

        <Button title="Send code" onPress={onSend} disabled={!phone} loading={sending} />
      </View>
    </Screen>
  );
}
