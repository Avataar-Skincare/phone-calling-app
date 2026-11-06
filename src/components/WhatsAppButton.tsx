import { Alert, Linking, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";

import { whatsAppUrl } from "@/lib/phone";
import { useColors } from "@/theme/tokens";

/** Material Design Icons "whatsapp" (Apache-2.0). */
const WHATSAPP_PATH =
  "M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.2 8.2 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24M8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18s.21-1.07.15-1.18c-.07-.1-.23-.16-.48-.27-.25-.14-1.47-.74-1.69-.82-.23-.08-.37-.12-.56.12-.16.25-.64.81-.78.97-.15.17-.29.19-.53.07-.26-.13-1.06-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.24-.01-.39.11-.5.11-.11.27-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.11-.56-1.35-.77-1.84-.2-.48-.4-.42-.56-.43h-.47";
const WHATSAPP_GREEN = "#25D366";

interface Props {
  phone: string | null | undefined;
  /** Spoken label, e.g. "WhatsApp Asha Rao". */
  label: string;
  size?: number;
}

/** Round WhatsApp button: opens a WhatsApp chat with the number so the agent can text them. */
export function WhatsAppButton({ phone, label, size = 46 }: Props) {
  const c = useColors();
  const url = whatsAppUrl(phone);
  const disabled = !url;
  return (
    <Pressable
      onPress={() => {
        if (!url) return;
        Linking.openURL(url).catch(() =>
          Alert.alert("Couldn't open WhatsApp", "Check that WhatsApp is installed on this phone."),
        );
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: disabled ? c.line : WHATSAPP_GREEN,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" accessible={false}>
        <Path d={WHATSAPP_PATH} fill={disabled ? c.muted : "#FFFFFF"} />
      </Svg>
    </Pressable>
  );
}
