import { useEffect, useRef } from "react";
import { Pressable, ScrollView } from "react-native";
import { AppText } from "@/components/AppText";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import type { SmartViewCounts, SmartViewDef } from "@/types/compass";

interface Props {
  views: SmartViewDef[];
  counts: SmartViewCounts | undefined;
  selected: string | null;
  onSelect: (key: string) => void;
}

/** Horizontally scrolling Smart View chips with their counts. */
export function ViewTabs({ views, counts, selected, onSelect }: Props) {
  const c = useColors();
  const ref = useRef<ScrollView>(null);

  // Start at the left whenever the set of tabs changes (e.g. switching department).
  useEffect(() => {
    ref.current?.scrollTo({ x: 0, animated: false });
  }, [views]);

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: SPACE.sm, paddingHorizontal: SPACE.lg }}
      accessibilityRole="tablist"
    >
      {views.map((v) => {
        const on = v.key === selected;
        const count = counts?.[v.key];
        return (
          <Pressable
            key={v.key}
            onPress={() => onSelect(v.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{
              paddingHorizontal: SPACE.md,
              paddingVertical: SPACE.sm,
              borderRadius: RADIUS.pill,
              borderWidth: 1,
              borderColor: on ? c.accent : c.line,
              backgroundColor: on ? c.accent : c.surface,
            }}
          >
            <AppText variant="label" tone={on ? "accentInk" : "ink"}>
              {v.label}
              {typeof count === "number" ? (
                <AppText variant="label" tone={on ? "accentInk" : "muted"} style={{ fontWeight: "400" }}>
                  {`  ${count}`}
                </AppText>
              ) : null}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
