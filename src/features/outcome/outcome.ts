/**
 * Call outcome rules: which fields a stage needs, validation, and the payload sent to
 * POST /opportunities/:id/activity-form. Pure functions, covered by outcome.test.ts.
 *
 * Mirrors the Compass web Activity Form (OpportunityActivityFormModal) so an outcome saved from
 * the app is identical to one saved on the web, plus the call details the app knows.
 */
import { callDurations, formatDuration, type CallSession } from "@/lib/callState";
import { formatWhen } from "@/lib/time";
import type { ActivityFormConfig, ActivityFormPayload, FormField, StageFormConfig } from "@/types/compass";

/** Field values as typed. Datetime fields hold an ISO string. */
export type FieldValues = Record<string, string>;

/** Key used for errors that belong to the stage picker rather than a field. */
export const STAGE_ERROR = "_stage";

/** A datetime this far in the past is still accepted (the agent took a moment to tap Save). */
const PAST_SLACK_MS = 2 * 60 * 1000;

export function stageForm(config: ActivityFormConfig, stageCode: string | null): StageFormConfig | null {
  if (!stageCode) return null;
  return config.form_configs[stageCode] ?? null;
}

export function fieldsFor(config: ActivityFormConfig, stageCode: string | null): FormField[] {
  const f = stageForm(config, stageCode);
  return f ? [...f.top_level_fields, ...f.sub_form_fields] : [];
}

/** Stages in pipeline order. */
export function orderedStages(config: ActivityFormConfig) {
  return [...config.available_stages].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Stage to pre-select. Only when the phone knows the customer didn't answer (iOS) and the
 * department has a "not_connected" stage; otherwise the agent chooses deliberately.
 */
export function suggestStage(
  config: ActivityFormConfig,
  session: Pick<CallSession, "connected">,
): string | null {
  if (session.connected === false && config.available_stages.some((s) => s.code === "not_connected")) {
    return "not_connected";
  }
  return null;
}

/** True when saving this stage would record nothing at all in Compass. */
export function recordsNothing(config: ActivityFormConfig, stageCode: string): boolean {
  return stageCode === config.current_stage_code && !stageForm(config, stageCode)?.activity_type_code;
}

/** Field and stage errors, keyed by field key (or STAGE_ERROR). Empty object = valid. */
export function validateOutcome(
  config: ActivityFormConfig,
  stageCode: string | null,
  values: FieldValues,
  now: number,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const stage = config.available_stages.find((s) => s.code === stageCode);
  if (!stageCode || !stage) {
    errors[STAGE_ERROR] = "Pick the stage that describes this call.";
    return errors;
  }
  if (recordsNothing(config, stageCode)) {
    errors[STAGE_ERROR] =
      `The lead is already in ${stage.label}, so saving it again records nothing in Compass. Pick the stage that describes this call.`;
    return errors;
  }

  for (const f of fieldsFor(config, stageCode)) {
    const v = (values[f.key] ?? "").trim();
    if (!v) {
      if (f.required) errors[f.key] = `${f.label} is required.`;
      continue;
    }
    if (f.type === "number" && !Number.isFinite(Number(v))) {
      errors[f.key] = "Enter a number.";
    } else if (f.type === "dropdown" && f.options && !f.options.includes(v)) {
      errors[f.key] = "Pick one of the options.";
    } else if (f.type === "datetime") {
      const t = Date.parse(v);
      if (Number.isNaN(t)) errors[f.key] = "Pick a date and time.";
      else if (t < now - PAST_SLACK_MS) errors[f.key] = "Pick a time in the future.";
    }
  }
  return errors;
}

/** Call details stored on the Compass activity, all as strings (Compass shows them as-is). */
export function callMetadata(s: CallSession): Record<string, string> {
  const { totalSeconds, talkSeconds } = callDurations(s);
  const meta: Record<string, string> = {
    call_source: "mobile_app",
    call_platform: s.platform,
    call_answered: s.connected === true ? "yes" : s.connected === false ? "no" : "unknown",
  };
  const started = s.startedAt ?? s.tappedAt;
  meta.call_started_at = new Date(started).toISOString();
  if (s.endedAt !== null) meta.call_ended_at = new Date(s.endedAt).toISOString();
  if (totalSeconds !== null) meta.call_duration_seconds = String(totalSeconds);
  if (talkSeconds !== null) meta.call_talk_seconds = String(talkSeconds);
  if (s.endApproximate) meta.call_end_estimated = "yes";
  return meta;
}

/** One-line summary, used as the stage-change reason when the stage logs no activity. */
export function callSummary(s: CallSession, now: number = Date.now()): string {
  const { totalSeconds, talkSeconds } = callDurations(s);
  const parts = ["Call from Compass Dialer", formatWhen(s.startedAt ?? s.tappedAt, now)];
  const length =
    talkSeconds !== null ? `talked ${formatDuration(talkSeconds)}` : formatDuration(totalSeconds);
  if (length) parts.push(length);
  if (s.connected === true) parts.push("answered");
  if (s.connected === false) parts.push("not answered");
  return parts.filter(Boolean).join(" · ");
}

function pick(fields: FormField[], values: FieldValues): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const f of fields) {
    const v = (values[f.key] ?? "").trim();
    if (!v) continue;
    out[f.key] = f.type === "number" ? Number(v) : f.type === "datetime" ? new Date(v).toISOString() : v;
  }
  return out;
}

export function buildPayload(args: {
  config: ActivityFormConfig;
  stageCode: string;
  values: FieldValues;
  session: CallSession;
  userId: string;
  note?: string;
  now?: number;
}): ActivityFormPayload {
  const { config, stageCode, values, session, userId } = args;
  const form = stageForm(config, stageCode);
  const note = args.note?.trim() || "";
  const payload: ActivityFormPayload = { stage_code: stageCode, submitted_by_user_id: userId };

  const top = form ? pick(form.top_level_fields, values) : {};
  const sub = form ? pick(form.sub_form_fields, values) : {};
  if (Object.keys(top).length) payload.top_level_data = top;

  if (form?.activity_type_code) {
    // The stage logs an activity: call details ride along on it.
    payload.sub_form_data = { ...sub, ...callMetadata(session) };
    if (note) payload.concerns_raised = note;
  } else {
    // No activity for this stage: the summary becomes the stage-change reason.
    if (Object.keys(sub).length) payload.sub_form_data = sub;
    payload.concerns_raised = [note, callSummary(session, args.now)].filter(Boolean).join("\n");
  }
  return payload;
}
