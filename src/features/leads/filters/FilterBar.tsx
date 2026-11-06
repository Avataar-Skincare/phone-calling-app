import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Icon } from "@/components/icons";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import type { CompassRole } from "@/types/compass";
import { useOwnerOptions, useSourceOptions, useStageOptions } from "../useLeadQueries";
import {
  ACTIVITY_OPTIONS,
  DATE_TYPE_OPTIONS,
  multiLabel,
  POST_VC_DEFAULT_STAGES,
  scheduleLabel,
  scheduleOptions,
  STATUS_OPTIONS,
  TASK_TYPE_OPTIONS,
  visibleControls,
  type FilterControl,
  type Filters,
  type Option,
  type ViewConfig,
} from "../viewConfig";
import { PickerSheet } from "./PickerSheet";
import { ScheduleSheet } from "./ScheduleSheet";

interface Props {
  config: ViewConfig;
  role: CompassRole;
  filters: Filters;
  /** Search box text is local until debounced by the parent. */
  searchText: string;
  onSearchText: (t: string) => void;
  onChange: (patch: Partial<Filters>) => void;
}

const labelOf = (options: Option[], value: string, placeholder: string) =>
  options.find((o) => o.value === value)?.label ?? (value || placeholder);

/** Compass's filter bar for a Smart View, as a search box plus a scrolling row of chips. */
export function FilterBar({ config, role, filters, searchText, onSearchText, onChange }: Props) {
  const c = useColors();
  const controls = visibleControls(config, role);
  const [open, setOpen] = useState<FilterControl | null>(null);

  const stageOptions = useStageOptions(
    controls.includes("stage") || controls.includes("stages") ? config.stageOptions : undefined,
  );
  const sourceOptions = useSourceOptions(controls.includes("source"), config.sourceFilter);
  const ownerOptions = useOwnerOptions(controls.includes("owner"));
  const schedules = scheduleOptions(role);

  if (!controls.length) return null;

  const chip = (control: FilterControl, label: string, active: boolean) => (
    <Pressable
      key={control}
      onPress={() => setOpen(control)}
      accessibilityRole="button"
      accessibilityLabel={`${chipName[control]}: ${label}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingLeft: SPACE.md,
        paddingRight: SPACE.sm,
        paddingVertical: SPACE.sm,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: active ? c.accent : c.line,
        backgroundColor: active ? c.accentSoft : c.surface,
      }}
    >
      <AppText variant="label" tone={active ? "accent" : "ink"} numberOfLines={1} style={{ maxWidth: 220 }}>
        {label}
      </AppText>
      <Icon name="chevronDown" size={16} color={active ? c.accent : c.muted} />
    </Pressable>
  );

  const chips = controls
    .filter((ctl) => ctl !== "search")
    .map((ctl) => {
      switch (ctl) {
        case "stages":
          return chip(
            ctl,
            multiLabel(
              filters.stages.length ? filters.stages : POST_VC_DEFAULT_STAGES,
              stageOptions,
              "Select Stages",
            ),
            true,
          );
        case "stage":
          return chip(ctl, labelOf(stageOptions, filters.stage, "All Stages"), !!filters.stage);
        case "source":
          return chip(ctl, labelOf(sourceOptions, filters.source, "All Sources"), !!filters.source);
        case "owner":
          return chip(ctl, labelOf(ownerOptions, filters.owner, "Any Owner"), !!filters.owner);
        case "dateType":
          return chip(ctl, labelOf(DATE_TYPE_OPTIONS, filters.dateType, "Last Activity"), true);
        case "schedule":
          return chip(ctl, scheduleLabel(filters), filters.schedule !== "all_time" && !!filters.schedule);
        case "taskType":
          return chip(
            ctl,
            labelOf(TASK_TYPE_OPTIONS, filters.taskType || "all", "All Task Types"),
            !!filters.taskType && filters.taskType !== "all",
          );
        case "status":
          return chip(ctl, labelOf(STATUS_OPTIONS, filters.status, "Pending and Overdue"), true);
        case "activities":
          return chip(ctl, multiLabel(filters.activities, ACTIVITY_OPTIONS, "All Activities"), true);
        default:
          return null;
      }
    });

  return (
    <View style={{ gap: SPACE.sm }}>
      {controls.includes("search") ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.sm,
            marginHorizontal: SPACE.lg,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: RADIUS.md,
            backgroundColor: c.surface,
            paddingHorizontal: SPACE.md,
          }}
        >
          <Icon name="search" color={c.muted} />
          <TextInput
            value={searchText}
            onChangeText={onSearchText}
            placeholder={config.kind === "task" ? "Search Tasks" : "Search Leads"}
            placeholderTextColor={c.muted}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search leads"
            style={{ flex: 1, paddingVertical: SPACE.md, fontSize: 16, color: c.ink }}
          />
        </View>
      ) : null}

      {chips.some(Boolean) ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: SPACE.sm, paddingHorizontal: SPACE.lg }}
        >
          {chips}
        </ScrollView>
      ) : null}

      {open === "stages" ? (
        <PickerSheet
          visible
          mode="multi"
          title="Stages"
          options={stageOptions}
          value={filters.stages.length ? filters.stages : POST_VC_DEFAULT_STAGES}
          onChange={(v) => onChange({ stages: v })}
          onClose={() => setOpen(null)}
          searchable
        />
      ) : null}
      {open === "activities" ? (
        <PickerSheet
          visible
          mode="multi"
          title="Activities"
          options={ACTIVITY_OPTIONS}
          value={filters.activities}
          onChange={(v) => onChange({ activities: v })}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === "stage" ? (
        <PickerSheet
          visible
          mode="single"
          title="Stage"
          options={stageOptions}
          value={filters.stage}
          clearLabel="All Stages"
          onChange={(v) => onChange({ stage: v })}
          onClose={() => setOpen(null)}
          searchable={stageOptions.length > 8}
        />
      ) : null}
      {open === "source" ? (
        <PickerSheet
          visible
          mode="single"
          title="Lead Source"
          options={sourceOptions}
          value={filters.source}
          clearLabel="All Sources"
          onChange={(v) => onChange({ source: v })}
          onClose={() => setOpen(null)}
          searchable
        />
      ) : null}
      {open === "owner" ? (
        <PickerSheet
          visible
          mode="single"
          title="Owner"
          options={ownerOptions}
          value={filters.owner}
          clearLabel="Any Owner"
          onChange={(v) => onChange({ owner: v })}
          onClose={() => setOpen(null)}
          searchable
        />
      ) : null}
      {open === "dateType" ? (
        <PickerSheet
          visible
          mode="single"
          title="Date field"
          options={DATE_TYPE_OPTIONS}
          value={filters.dateType}
          onChange={(v) => onChange({ dateType: v })}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === "taskType" ? (
        <PickerSheet
          visible
          mode="single"
          title="Task Type"
          options={TASK_TYPE_OPTIONS}
          value={filters.taskType || "all"}
          onChange={(v) => onChange({ taskType: v })}
          onClose={() => setOpen(null)}
          searchable
        />
      ) : null}
      {open === "status" ? (
        <PickerSheet
          visible
          mode="single"
          title="Status"
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={(v) => onChange({ status: v })}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === "schedule" ? (
        <ScheduleSheet
          visible
          options={schedules}
          schedule={filters.schedule}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onChange={(v) => onChange(v)}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </View>
  );
}

const chipName: Record<FilterControl, string> = {
  search: "Search",
  stages: "Stages",
  stage: "Stage",
  source: "Lead Source",
  owner: "Owner",
  dateType: "Date field",
  schedule: "Date range",
  taskType: "Task Type",
  status: "Status",
  activities: "Activities",
};
