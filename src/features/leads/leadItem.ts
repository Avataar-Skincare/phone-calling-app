/**
 * One shape for every Smart View row. Lead views and task views return different JSON;
 * the screens only ever see LeadItem. Pure functions, covered by leadItem.regression.ts.
 */
import type { CodeLabel, LeadViewRow, SmartViewType, TaskViewRow } from "@/types/compass";

export interface LeadItem {
  /** Unique within one list: task id for task views, opportunity id for lead views. */
  key: string;
  leadId: string | null;
  opportunityId: string | null;
  name: string;
  phone: string | null;
  stage: CodeLabel | null;
  source: string | null;
  task: { id: string; type: string | null; dueAt: string | null } | null;
}

const str = (v: string | number | null | undefined): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);

export function fullName(first: string | null | undefined, last: string | null | undefined): string {
  const name = [first, last]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");
  return name || "Unnamed lead";
}

/** "facebook_lead_ads" → "Facebook lead ads". */
export function formatSource(source: string | null | undefined): string | null {
  const s = source?.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function toLeadItem(row: LeadViewRow | TaskViewRow, type: SmartViewType): LeadItem {
  if (type === "task") {
    const t = row as TaskViewRow;
    return {
      key: `t-${t.id}`,
      leadId: str(t.lead?.id),
      opportunityId: str(t.opportunity_id),
      name: fullName(t.lead?.first_name, t.lead?.last_name),
      phone: str(t.lead?.primary_phone),
      stage: t.opportunity_stage ?? null,
      source: null,
      task: { id: String(t.id), type: t.task_type?.label ?? null, dueAt: t.due_at ?? null },
    };
  }

  const l = row as LeadViewRow;
  const opportunityId = str(l.opportunity_id);
  return {
    key: `o-${opportunityId ?? str(l.id) ?? "unknown"}`,
    leadId: str(l.id),
    opportunityId,
    name: fullName(l.first_name, l.last_name),
    phone: str(l.primary_phone),
    stage: l.opportunity_stage ?? l.lead_stage ?? null,
    source: formatSource(l.lead_source),
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
