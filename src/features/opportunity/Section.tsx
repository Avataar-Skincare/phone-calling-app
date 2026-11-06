import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Icon } from "@/components/icons";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";

/** Compass OverviewSection: a bordered card with a title and a chevron, open by default. */
export function Section({
  title,
  children,
  collapsible = true,
}: {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
}) {
  const c = useColors();
  const [open, setOpen] = useState(true);
  return (
    <View
      style={{ backgroundColor: c.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.line }}
    >
      <Pressable
        onPress={() => collapsible && setOpen((o) => !o)}
        disabled={!collapsible}
        accessibilityRole={collapsible ? "button" : "header"}
        accessibilityState={collapsible ? { expanded: open } : undefined}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: SPACE.lg,
        }}
      >
        <AppText variant="heading" style={{ fontSize: 16 }}>
          {title}
        </AppText>
        {collapsible ? (
          <View style={{ transform: [{ rotate: open ? "0deg" : "-90deg" }] }}>
            <Icon name="chevronDown" color={c.muted} />
          </View>
        ) : null}
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.lg, gap: SPACE.sm }}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

/** Label on the left, value on the right (Compass's two-column property rows). */
export function Row({
  label,
  value,
  divider = true,
}: {
  label: string;
  value: ReactNode;
  divider?: boolean;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        gap: SPACE.lg,
        paddingVertical: SPACE.sm,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: c.line,
      }}
    >
      <AppText tone="muted" style={{ flexShrink: 0 }}>
        {label}
      </AppText>
      {typeof value === "string" || typeof value === "number" ? (
        <AppText style={{ flexShrink: 1, textAlign: "right" }}>{String(value)}</AppText>
      ) : (
        <View style={{ flexShrink: 1, alignItems: "flex-end" }}>{value}</View>
      )}
    </View>
  );
}

/** One record of a Compass table, shown as a small bordered block of rows. */
export function Record({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View
      style={{ borderWidth: 1, borderColor: c.line, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md }}
    >
      {children}
    </View>
  );
}

/** Loading / error / empty line inside a section (Compass's italic empty texts). */
export function SectionState({
  loading,
  error,
  empty,
  emptyText,
  loadingText,
}: {
  loading?: boolean;
  error?: Error | null;
  empty?: boolean;
  emptyText: string;
  loadingText?: string;
}) {
  const c = useColors();
  if (loading)
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
        <ActivityIndicator color={c.accent} size="small" />
        {loadingText ? <AppText tone="muted">{loadingText}</AppText> : null}
      </View>
    );
  if (error)
    return (
      <AppText tone="red" variant="small">
        {error.message || "Couldn't load this section."}
      </AppText>
    );
  if (empty)
    return (
      <AppText tone="muted" style={{ fontStyle: "italic" }}>
        {emptyText}
      </AppText>
    );
  return null;
}
