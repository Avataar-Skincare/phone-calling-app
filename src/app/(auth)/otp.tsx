import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { sendOtp, verifyOtp } from "@/api/auth";
import { ApiError } from "@/api/client";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { ErrorNote } from "@/components/ErrorNote";
import { OtpInput } from "@/components/OtpInput";
import { Screen } from "@/components/Screen";
import { signIn } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { SPACE } from "@/theme/tokens";

const OTP_LENGTH = 4;
const RESEND_AFTER_S = 30;

export default function OtpScreen() {
  const params = useLocalSearchParams<{ phone: string; token: string }>();
  const phone = params.phone ?? "";
  const [token, setToken] = useState(params.token ?? "");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_AFTER_S);
  const lastTried = useRef("");

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify(otp: string) {
    if (verifying || otp.length !== OTP_LENGTH) return;
    lastTried.current = otp;
    setVerifying(true);
    setError(null);
    setInfo(null);
    try {
      const res = await verifyOtp(token, otp);
      // The root layout switches to the main screens as soon as the session exists.
      await signIn(res);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && /expired/i.test(e.message)) {
        setError("This code has expired. Tap Resend code to get a new one.");
      } else if (e instanceof ApiError && e.status === 400) {
        setError("That code isn't right. Check the SMS or WhatsApp message and try again.");
      } else {
        setError(e instanceof Error ? e.message : "Couldn't verify the code. Try again.");
      }
      setCode("");
    } finally {
      setVerifying(false);
    }
  }

  // Submit automatically once all digits are in (typed, pasted or autofilled).
  useEffect(() => {
    if (code.length === OTP_LENGTH && code !== lastTried.current) void verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function resend() {
    if (wait > 0 || resending) return;
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await sendOtp(phone);
      setToken(res.token);
      setCode("");
      lastTried.current = "";
      setWait(RESEND_AFTER_S);
      setInfo("New code sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't resend the code. Try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: "center", gap: SPACE.xl }}>
        <View style={{ gap: SPACE.sm }}>
          <AppText variant="title">Enter the code</AppText>
          <AppText tone="muted">
            Sent to {formatPhone(phone)} by SMS and WhatsApp. It's valid for 5 minutes.
          </AppText>
        </View>

        <OtpInput value={code} onChange={setCode} length={OTP_LENGTH} disabled={verifying} />

        <ErrorNote message={error} />
        {info ? <AppText tone="accent">{info}</AppText> : null}

        <View style={{ gap: SPACE.md }}>
          <Button
            title="Verify"
            onPress={() => verify(code)}
            disabled={code.length !== OTP_LENGTH}
            loading={verifying}
          />
          <Button
            title={wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
            kind="secondary"
            onPress={resend}
            disabled={wait > 0}
            loading={resending}
          />
          <Button title="Change number" kind="plain" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}
