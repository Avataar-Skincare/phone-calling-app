import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import type { Option } from "../viewConfig";

interface Props {
  visible: boolean;
  options: Option[];
  schedule: string;
  dateFrom: string;
  dateTo: string;
  onClose: () => void;
  onChange: (v: { schedule: string; dateFrom: string; dateTo: string }) => void;
}

/** YYYY-MM-DD on the phone's calendar (the server reads it as an IST day). */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => (s ? new Date(`${s}T00:00:00`) : new Date());

/** Compass's date dropdown: presets, then "Custom Range" with From / To and Apply. */
export function ScheduleSheet(p: Props) {
  const c = useColors();
  const [from, setFrom] = useState(p.dateFrom);
  const [to, setTo] = useState(p.dateTo);
  const [iosPicking, setIosPicking] = useState<"from" | "to" | null>(null);

  function pick(which: "from" | "to") {
    const current = parse(which === "from" ? from : to);
    const set = (d: Date) => (which === "from" ? setFrom(ymd(d)) : setTo(ymd(d)));
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        // Fires only when a date is picked (not on dismiss).
        onValueChange: (_e, d) => set(d),
      });
    } else {
      setIosPicking((w) => (w === which ? null : which));
    }
  }

  return (
    <Sheet visible={p.visible} title="Date range" onClose={p.onClose}>
      <View style={{ padding: SPACE.lg, gap: SPACE.sm }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
          {p.options.map((o) => {
            const on = p.schedule === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  p.onChange({ schedule: o.value, dateFrom: "", dateTo: "" });
                  p.onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={{
                  paddingHorizontal: SPACE.md,
                  paddingVertical: SPACE.sm,
                  borderRadius: RADIUS.pill,
                  borderWidth: 1,
                  borderColor: on ? c.accent : c.line,
                  backgroundColor: on ? c.accentSoft : c.surface,
                }}
              >
                <AppText variant="label" tone={on ? "accent" : "ink"}>
                  {o.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <AppText variant="label" tone="muted" style={{ marginTop: SPACE.md }}>
          Custom Range
        </AppText>
        <View style={{ flexDirection: "row", gap: SPACE.md }}>
          {(["from", "to"] as const).map((w) => (
            <Pressable
              key={w}
              onPress={() => pick(w)}
              accessibilityRole="button"
              accessibilityLabel={w === "from" ? "From date" : "To date"}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: iosPicking === w ? c.accent : c.line,
                borderRadius: RADIUS.md,
                backgroundColor: c.surface,
                padding: SPACE.md,
                gap: 2,
              }}
            >
              <AppText variant="small" tone="muted">
                {w === "from" ? "From" : "To"}
              </AppText>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <AppText>{(w === "from" ? from : to) || "Pick a date"}</AppText>
                <Icon name="chevronDown" color={c.muted} />
              </View>
            </Pressable>
          ))}
        </View>
        {Platform.OS === "ios" && iosPicking ? (
          <DateTimePicker
            value={parse(iosPicking === "from" ? from : to)}
            mode="date"
            display="inline"
            onValueChange={(_, d) => (iosPicking === "from" ? setFrom : setTo)(ymd(d))}
          />
        ) : null}
        <Button
          title="Apply"
          disabled={!from || !to}
          onPress={() => {
            p.onChange({ schedule: "custom", dateFrom: from, dateTo: to });
            p.onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
