/**
 * One shape for every Smart View row. Lead views and task views return different JSON;
 * the screens only ever see LeadItem. Carries every column Compass web shows for the row.
 * Pure functions, covered by leadItem.test.ts.
 */
import { formatSourceName, leadDisplayName } from "@/lib/format";
import type { CodeLabel, LeadViewRow, SmartViewType, TaskViewRow } from "@/types/compass";

export interface LeadTask {
  id: string;
  type: string | null;
  title: string | null;
  status: string;
  dueAt: string | null;
  createdBy: string | null;
  assignedTo: string | null;
}

export interface LeadItem {
  /** Unique within one list: task id for task views, opportunity id for lead views. */
  key: string;
  leadId: string | null;
  opportunityId: string | null;
  name: string;
  phone: string | null;
  stage: CodeLabel | null;
  /** As stored in Compass (with Compass's display alias), or null. */
  source: string | null;
  leadScore: number | null;
  owner: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** cs_missed_inbound only */
  missedCallAt: string | null;
  /** important_customers only */
  importantActivity: { code: string; occurredAt: string } | null;
  task: LeadTask | null;
}

const str = (v: string | number | null | undefined): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);

/** Kept for callers that only need a name: Compass's display rule without the phone fallback. */
export function fullName(first: string | null | undefined, last: string | null | undefined): string {
  const name = leadDisplayName(first, last);
  return name === "Unknown Lead" ? "Unnamed lead" : name;
}

/** Compass shows sources as stored (with one alias). Null when missing. */
export function formatSource(source: string | null | undefined): string | null {
  return source?.trim() ? formatSourceName(source.trim()) : null;
}

export function toLeadItem(row: LeadViewRow | TaskViewRow, type: SmartViewType): LeadItem {
  if (type === "task") {
    const t = row as TaskViewRow;
    return {
      key: `t-${t.id}`,
      leadId: str(t.lead?.id),
      opportunityId: str(t.opportunity_id),
      name: leadDisplayName(t.lead?.first_name, t.lead?.last_name, t.lead?.primary_phone),
      phone: str(t.lead?.primary_phone),
      stage: t.opportunity_stage ?? null,
      source: null,
      leadScore: null,
      owner: t.assigned_to?.name ?? null,
      createdAt: t.created_at ?? null,
      updatedAt: null,
      missedCallAt: null,
      importantActivity: null,
      task: {
        id: String(t.id),
        type: t.task_type?.label ?? null,
        title: t.title ?? null,
        status: t.status,
        dueAt: t.due_at ?? null,
        createdBy: t.created_by?.name ?? null,
        assignedTo: t.assigned_to?.name ?? null,
      },
    };
  }

  const l = row as LeadViewRow;
  const opportunityId = str(l.opportunity_id);
  return {
    key: `o-${opportunityId ?? str(l.id) ?? "unknown"}`,
    leadId: str(l.id),
    opportunityId,
    name: leadDisplayName(l.first_name, l.last_name, l.primary_phone),
    phone: str(l.primary_phone),
    stage: l.opportunity_stage ?? l.lead_stage ?? null,
    source: formatSource(l.lead_source),
    leadScore: l.lead_score ?? null,
    owner: l.owner?.name ?? null,
    createdAt: l.created_at ?? null,
    updatedAt: l.updated_at ?? null,
    missedCallAt: l.cs_missed_at ?? null,
    importantActivity: l.last_important_activity
      ? { code: l.last_important_activity.code, occurredAt: l.last_important_activity.occurred_at }
      : null,
    task: null,
  };
}

/** Flatten infinite-query pages and drop rows that repeat (a row can shift pages between fetches). */
export function mergePages(pages: LeadItem[][]): LeadItem[] {
  const seen = new Set<string>();
  const out: LeadItem[] = [];
  for (const page of pages) {
    for (const item of page) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      out.push(item);
    }
  }
  return out;
}

/** Compass task status badge: "overdue" when pending and past due. */
export function taskStatusLabel(task: Pick<LeadTask, "status" | "dueAt">, now: number = Date.now()): string {
  if (task.status === "pending" && task.dueAt && Date.parse(task.dueAt) < now) return "overdue";
  return task.status;
}
