import { useMemo, useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import type { Option } from "../viewConfig";

type Props = {
  visible: boolean;
  title: string;
  options: Option[];
  onClose: () => void;
  /** Offer "Type to search..." when the list is long (Compass searchable dropdowns). */
  searchable?: boolean;
} & (
  | { mode: "single"; value: string; onChange: (v: string) => void; clearLabel?: string }
  | { mode: "multi"; value: string[]; onChange: (v: string[]) => void }
);

/** Single- or multi-select list in a bottom sheet. */
export function PickerSheet(props: Props) {
  const c = useColors();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string[]>(props.mode === "multi" ? props.value : []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? props.options.filter((o) => o.label.toLowerCase().includes(q)) : props.options;
  }, [props.options, query]);

  const isOn = (v: string) => (props.mode === "multi" ? draft.includes(v) : props.value === v);

  function press(v: string) {
    if (props.mode === "single") {
      props.onChange(v);
      props.onClose();
    } else {
      setDraft((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]));
    }
  }

  const footer =
    props.mode === "multi" ? (
      <View style={{ flexDirection: "row", gap: SPACE.md }}>
        <Button title="Clear" kind="secondary" style={{ flex: 1 }} onPress={() => setDraft([])} />
        <Button
          title="Apply"
          style={{ flex: 1 }}
          onPress={() => {
            props.onChange(draft);
            props.onClose();
          }}
        />
      </View>
    ) : props.clearLabel && props.value ? (
      <Button
        title={props.clearLabel}
        kind="secondary"
        onPress={() => {
          props.onChange("");
          props.onClose();
        }}
      />
    ) : undefined;

  return (
    <Sheet visible={props.visible} title={props.title} onClose={props.onClose} footer={footer}>
      {props.searchable ? (
        <View style={{ padding: SPACE.lg, paddingBottom: SPACE.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.sm,
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: RADIUS.md,
              backgroundColor: c.surface,
              paddingHorizontal: SPACE.md,
            }}
          >
            <Icon name="search" color={c.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Type to search..."
              placeholderTextColor={c.muted}
              autoCorrect={false}
              accessibilityLabel={`Search ${props.title}`}
              style={{ flex: 1, paddingVertical: SPACE.md, fontSize: 16, color: c.ink }}
            />
          </View>
        </View>
      ) : null}
      <FlatList
        data={shown}
        keyExtractor={(o) => o.value}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <AppText tone="muted" style={{ padding: SPACE.lg }}>
            No results found
          </AppText>
        }
        renderItem={({ item }) => {
          const on = isOn(item.value);
          return (
            <Pressable
              onPress={() => press(item.value)}
              accessibilityRole={props.mode === "multi" ? "checkbox" : "radio"}
              accessibilityState={{ checked: on }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: SPACE.md,
                paddingHorizontal: SPACE.lg,
                paddingVertical: SPACE.md,
                backgroundColor: pressed ? c.accentSoft : "transparent",
              })}
            >
              <AppText style={{ flex: 1, fontWeight: on ? "600" : "400" }} tone={on ? "accent" : "ink"}>
                {item.label}
              </AppText>
              {on ? <Icon name="check" color={c.accent} /> : null}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}
