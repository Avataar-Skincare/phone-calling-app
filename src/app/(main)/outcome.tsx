import { useEffect, useMemo, useState } from "react";
import { Alert, BackHandler, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { ErrorNote } from "@/components/ErrorNote";
import { StateView } from "@/components/StateView";
import { FieldInput } from "@/features/outcome/FieldInput";
import {
  buildPayload,
  fieldsFor,
  orderedStages,
  STAGE_ERROR,
  stageForm,
  suggestStage,
  validateOutcome,
  type FieldValues,
} from "@/features/outcome/outcome";
import { saveOutcome } from "@/features/outcome/saveOutcome";
import { useActivityFormConfig } from "@/features/outcome/useActivityFormConfig";
import { callDurations, formatDuration } from "@/lib/callState";
import { formatWhen } from "@/lib/time";
import { useAuthStore } from "@/store/auth.store";
import { useCallStore } from "@/store/call.store";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";

/**
 * Call outcome sheet. Opens by itself when a call ends and can't be skipped: the agent saves an
 * outcome, or confirms the call didn't happen. Built from Compass's own form config, so it always
 * matches the Activity Form on the web.
 */
export default function OutcomeScreen() {
  const c = useColors();
  const session = useCallStore((s) => s.session);
  const clearCall = useCallStore((s) => s.clear);
  const userId = useAuthStore((s) => s.session?.user.id);
  const config = useActivityFormConfig(session?.opportunityId);

  const [picked, setPicked] = useState<string | null>(null);
  const [values, setValues] = useState<FieldValues>({});
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<{ status: number; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Nothing to record (saved, discarded, or opened by mistake): leave.
  const open = !!session && session.status === "ended";
  useEffect(() => {
    if (!open && router.canGoBack()) router.back();
  }, [open]);

  // The hardware back button must not dismiss an unsaved outcome.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  const stageCode = picked ?? (config.data && session ? suggestStage(config.data, session) : null);
  const fields = useMemo(
    () => (config.data ? fieldsFor(config.data, stageCode) : []),
    [config.data, stageCode],
  );
  const stages = useMemo(() => (config.data ? orderedStages(config.data) : []), [config.data]);

  if (!session || !open) return null;

  const { totalSeconds, talkSeconds } = callDurations(session);
  const callLine = [
    formatWhen(session.startedAt ?? session.tappedAt),
    talkSeconds !== null ? `talked ${formatDuration(talkSeconds)}` : formatDuration(totalSeconds),
    session.connected === true ? "answered" : session.connected === false ? "not answered" : null,
    session.endApproximate ? "end time estimated" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function discard() {
    Alert.alert("Discard this call?", "Nothing will be saved to Compass for it.", [
      { text: "Keep it", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: clearCall },
    ]);
  }

  async function onSave() {
    if (!config.data || !session || userId === undefined || !session.opportunityId) return;
    const now = Date.now();
    const found = validateOutcome(config.data, stageCode, values, now);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;

    setSaving(true);
    const payload = buildPayload({
      config: config.data,
      stageCode: stageCode!,
      values,
      session,
      userId: String(userId),
      note,
      now,
    });
    const result = await saveOutcome({
      opportunityId: session.opportunityId,
      leadName: session.name,
      userId: String(userId),
      payload,
    });
    setSaving(false);

    if (result.kind === "rejected") {
      setServerError({ status: result.status, message: result.message });
      return;
    }
    clearCall();
    if (result.kind === "queued") {
      Alert.alert(
        "Saved on your phone",
        "Compass couldn't be reached. The outcome will be sent automatically when you're back online.",
      );
    }
  }

  // ── Body ──
  let body;
  if (!session.opportunityId) {
    body = (
      <StateView
        kind="empty"
        title="This call isn't linked to a lead"
        message="It can't be saved to Compass. Discard it to continue."
      />
    );
  } else if (config.isLoading) {
    body = <StateView kind="loading" message="Loading the form…" />;
  } else if (config.error || !config.data) {
    body = (
      <StateView
        kind="error"
        title="Couldn't load the form"
        message={`${config.error?.message ?? ""} You can't call another lead until this call is saved or discarded.`}
        onRetry={() => void config.refetch()}
      />
    );
  } else {
    const form = stageForm(config.data, stageCode);
    const lostLead = serverError && (serverError.status === 403 || serverError.status === 404);
    body = (
      <ScrollView
        contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Stage */}
        <View style={{ gap: SPACE.sm }}>
          <AppText variant="heading">New stage</AppText>
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}
          >
            {stages.map((s) => (
              <Chip
                key={s.code}
                label={s.code === config.data!.current_stage_code ? `${s.label} (now)` : s.label}
                selected={stageCode === s.code}
                onPress={() => {
                  setPicked(s.code);
                  setErrors({});
                }}
              />
            ))}
          </View>
          {errors[STAGE_ERROR] ? (
            <AppText variant="small" tone="red" accessibilityRole="alert">
              {errors[STAGE_ERROR]}
            </AppText>
          ) : null}
          {form?.sub_form_name ? (
            <AppText variant="small" tone="muted">
              Logs "{form.sub_form_name}" in Compass.
            </AppText>
          ) : null}
        </View>

        {/* Stage fields */}
        {fields.map((f) => (
          <FieldInput
            key={f.key}
            field={f}
            value={values[f.key] ?? ""}
            error={errors[f.key]}
            onChange={(v) => {
              setValues((prev) => ({ ...prev, [f.key]: v }));
              if (errors[f.key]) setErrors(({ [f.key]: _, ...rest }) => rest);
            }}
          />
        ))}

        {/* Free note */}
        {stageCode ? (
          <View style={{ gap: SPACE.sm }}>
            <AppText variant="label" nativeID="outcome-note">
              Anything else (optional)
            </AppText>
            <TextInput
              testID="outcome-note"
              accessibilityLabelledBy="outcome-note"
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Concerns raised, context for the next call"
              placeholderTextColor={c.muted}
              style={{
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: RADIUS.md,
                backgroundColor: c.surface,
                color: c.ink,
                padding: SPACE.md,
                fontSize: 16,
                minHeight: 64,
                textAlignVertical: "top",
              }}
            />
          </View>
        ) : null}

        {serverError ? (
          <ErrorNote
            message={
              lostLead
                ? "This lead isn't assigned to you any more, so Compass won't accept the outcome. Discard the call to continue."
                : serverError.message
            }
          />
        ) : null}

        <View style={{ gap: SPACE.md, paddingBottom: SPACE.xxl }}>
          {lostLead ? null : <Button title="Save to Compass" onPress={onSave} loading={saving} />}
        </View>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          paddingHorizontal: SPACE.lg,
          paddingTop: SPACE.md,
          paddingBottom: SPACE.md,
          gap: 2,
          borderBottomWidth: 1,
          borderBottomColor: c.line,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SPACE.md,
          }}
        >
          <AppText variant="title" style={{ fontSize: 22, flexShrink: 1 }}>
            How did the call go?
          </AppText>
          <Pressable onPress={discard} accessibilityRole="button" hitSlop={8}>
            <AppText variant="label" tone="muted">
              Didn't call
            </AppText>
          </Pressable>
        </View>
        <AppText variant="label">{session.name}</AppText>
        <AppText variant="small" tone="muted">
          {callLine}
        </AppText>
      </View>
      <View style={{ flex: 1 }}>{body}</View>
    </SafeAreaView>
  );
}
