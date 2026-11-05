import { useState } from "react";
import { Platform, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { followUpPresets } from "@/lib/followUp";
import { formatWhen } from "@/lib/time";
import { SPACE } from "@/theme/tokens";

interface Props {
  /** ISO string or "" */
  value: string;
  onChange: (iso: string) => void;
}

/**
 * Follow-up time: quick presets plus a full picker.
 * Android opens the system date picker, then the time picker. iOS shows an inline picker.
 */
export function DateTimeField({ value, onChange }: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  // "Now" is fixed when the field opens, so presets and limits don't shift while the agent types.
  const [openedAt] = useState(() => Date.now());
  const presets = followUpPresets(openedAt);
  const defaultStart = new Date(openedAt + 60 * 60_000);
  const current = value ? new Date(value) : null;
  const minimumDate = new Date(openedAt);

  function openAndroid() {
    const start = current ?? defaultStart;
    DateTimePickerAndroid.open({
      value: start,
      mode: "date",
      minimumDate,
      onChange: (e, date) => {
        if (e.type !== "set" || !date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: "time",
          onChange: (e2, time) => {
            if (e2.type !== "set" || !time) return;
            const merged = new Date(date);
            merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
            onChange(merged.toISOString());
          },
        });
      },
    });
  }

  return (
    <View style={{ gap: SPACE.sm }}>
      <AppText tone={current ? "ink" : "muted"} style={{ fontWeight: current ? "600" : "400" }}>
        {current ? formatWhen(current) : "Not set"}
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
        {presets.map((p) => (
          <Chip
            key={p.label}
            label={p.label}
            selected={current?.getTime() === p.at}
            onPress={() => onChange(new Date(p.at).toISOString())}
          />
        ))}
      </View>
      <Button
        title={Platform.OS === "ios" && iosOpen ? "Done" : "Pick date and time"}
        kind="secondary"
        onPress={() => (Platform.OS === "android" ? openAndroid() : setIosOpen((o) => !o))}
      />
      {Platform.OS === "ios" && iosOpen ? (
        <DateTimePicker
          value={current ?? defaultStart}
          mode="datetime"
          display="inline"
          minimumDate={minimumDate}
          onChange={(_, date) => {
            if (date) onChange(date.toISOString());
          }}
        />
      ) : null}
    </View>
  );
}
