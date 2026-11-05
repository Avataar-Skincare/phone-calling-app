import { TextInput, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Chip } from "@/components/Chip";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import type { FormField } from "@/types/compass";
import { DateTimeField } from "./DateTimeField";

interface Props {
  field: FormField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

/** Renders one Compass form field by its type: text, number, dropdown or datetime. */
export function FieldInput({ field, value, error, onChange }: Props) {
  const c = useColors();
  const inputStyle = {
    borderWidth: 1,
    borderColor: error ? c.red : c.line,
    borderRadius: RADIUS.md,
    backgroundColor: c.surface,
    color: c.ink,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    fontSize: 16,
  } as const;
  const labelId = `field-${field.key}`;

  return (
    <View style={{ gap: SPACE.sm }}>
      <AppText variant="label" nativeID={labelId}>
        {field.label}
        {field.required ? <AppText tone="red"> *</AppText> : null}
      </AppText>

      {field.type === "dropdown" && field.options ? (
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}
        >
          {field.options.map((o) => (
            <Chip key={o} label={o} selected={value === o} onPress={() => onChange(value === o ? "" : o)} />
          ))}
        </View>
      ) : field.type === "datetime" ? (
        <DateTimeField value={value} onChange={onChange} />
      ) : (
        <TextInput
          testID={`field-${field.key}`}
          accessibilityLabelledBy={labelId}
          value={value}
          onChangeText={onChange}
          keyboardType={field.type === "number" ? "decimal-pad" : "default"}
          multiline={field.type === "text"}
          placeholder={field.type === "number" ? "0" : undefined}
          placeholderTextColor={c.muted}
          style={[inputStyle, field.type === "text" ? { minHeight: 80, textAlignVertical: "top" } : null]}
        />
      )}

      {error ? (
        <AppText variant="small" tone="red" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
