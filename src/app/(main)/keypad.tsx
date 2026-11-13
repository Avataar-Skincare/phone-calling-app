import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";

import { claimWithCap } from "@/api/mobileDialer";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/icons";
import { Screen } from "@/components/Screen";
import { CallBanner } from "@/features/calling/CallBanner";
import { useCallLead } from "@/features/calling/useCallLead";
import { claimMessage, type ClaimTone } from "@/lib/claimMessage";
import { dialTarget, MAX_DIAL_LENGTH, pressKey, sanitizeDialInput } from "@/lib/dialInput";
import { formatPhone } from "@/lib/phone";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0", "back"] as const;

/**
 * Keypad dial (ADR 0009): paste or type a number, tap Call. Compass is asked to move the lead to
 * the agent first (3 s at most), then the normal call flow dials, logs and uploads as for a list
 * call. The call always goes ahead, whatever the claim says.
 */
export default function KeypadScreen() {
  const c = useColors();
  const callLead = useCallLead();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: ClaimTone } | null>(null);

  const target = dialTarget(value);
  const edit = (next: string) => {
    setValue(next);
    setMessage(null);
  };

  const call = async () => {
    if (!target || busy) return;
    setBusy(true);
    try {
      const phone = sanitizeDialInput(value).trim();
      const result = await claimWithCap(phone);
      setMessage(claimMessage(result));
      const claim = result === "error" ? null : result;
      await callLead({
        name: claim?.lead_name ?? formatPhone(target.e164),
        phone: target.e164,
        opportunityId: claim?.opportunity_id ?? null,
        leadId: claim?.lead_id ?? null,
        taskId: null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        hitSlop={10}
        style={{ alignSelf: "flex-start" }}
      >
        <AppText variant="label" tone="accent" style={{ fontSize: 16 }}>
          ‹ Leads
        </AppText>
      </Pressable>
      <AppText variant="title">Keypad</AppText>

      <CallBanner />

      <View style={{ gap: SPACE.sm }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.surface,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: c.line,
            paddingHorizontal: SPACE.lg,
          }}
        >
          <TextInput
            value={value}
            onChangeText={(t) => edit(sanitizeDialInput(t))}
            keyboardType="phone-pad"
            placeholder="Paste or type a number"
            placeholderTextColor={c.muted}
            maxLength={MAX_DIAL_LENGTH * 2} // room for a paste with stray characters; cleaned on change
            selectTextOnFocus={false}
            accessibilityLabel="Phone number"
            style={{ flex: 1, fontSize: 26, paddingVertical: SPACE.lg, color: c.ink }}
          />
          {value ? (
            <Pressable
              onPress={() => edit("")}
              accessibilityRole="button"
              accessibilityLabel="Clear number"
              hitSlop={10}
            >
              <Icon name="close" size={22} color={c.muted} />
            </Pressable>
          ) : null}
        </View>
        <AppText variant="small" tone={target ? "accent" : "muted"}>
          {target ? target.display : "Enter a 10-digit mobile number"}
        </AppText>
        {message ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              backgroundColor:
                message.tone === "accent" ? c.accentSoft : message.tone === "amber" ? c.amberSoft : c.redSoft,
              borderRadius: RADIUS.md,
              padding: SPACE.md,
            }}
          >
            <AppText variant="label" tone={message.tone}>
              {message.text}
            </AppText>
          </View>
        ) : null}
      </View>

      <View
        style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: SPACE.sm }}
      >
        {KEYS.map((k) => (
          <Pressable
            key={k}
            onPress={() => edit(pressKey(value, k))}
            accessibilityRole="button"
            accessibilityLabel={k === "back" ? "Backspace" : `Key ${k}`}
            style={({ pressed }) => ({
              width: "32%",
              height: 56,
              borderRadius: RADIUS.md,
              backgroundColor: pressed ? c.accentSoft : c.surface,
              borderWidth: 1,
              borderColor: c.line,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <AppText variant="title" style={{ fontSize: 24 }}>
              {k === "back" ? "⌫" : k}
            </AppText>
          </Pressable>
        ))}
      </View>

      <Button
        title="Call"
        accessibilityLabel="Call number"
        disabled={!target}
        loading={busy}
        onPress={() => void call()}
      />
    </Screen>
  );
}
