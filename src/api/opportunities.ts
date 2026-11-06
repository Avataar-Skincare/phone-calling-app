import { api } from "./client";
import type { ActivityItem, Department, OpportunityDetail } from "@/types/compass";
import type {
  Appointment,
  CallRow,
  CsOverview,
  LeadSourcesResponse,
  OpportunityTask,
  Order,
  PackageDetail,
  Paged,
  RecentService,
  SalesOverview,
  SessionRow,
  VirtualConsultation,
  WhatsAppMessage,
} from "@/types/opportunityPage";

const id = (v: string | number) => encodeURIComponent(String(v));

/** [{ id, code: "sales" | "cs" | …, label }]. Used to turn user.departmentId into a code. */
export function getDepartments() {
  return api.get<Department[]>("/opportunities/departments");
}

/**
 * The opportunity page's main payload: lead, stage, owner, department, available stages,
 * stage history and the latest 50 activities. 403 when the agent can no longer see it.
 */
export function getOpportunity(opportunityId: string) {
  return api.get<OpportunityDetail>(`/opportunities/${id(opportunityId)}`);
}

// ── Overview cards ──────────────────────────────────────────

export const getLeadSources = (oppId: string) =>
  api.get<LeadSourcesResponse>(`/opportunities/${id(oppId)}/lead-sources`);
/** Sales only: Last Add to Cart, Haut AI and Photos. */
export const getSalesOverview = (oppId: string) =>
  api.get<SalesOverview>(`/opportunities/${id(oppId)}/sales-overview`);
/** CS only: Basic Info and Complaint Status. */
export const getCsOverview = (oppId: string) =>
  api.get<CsOverview>(`/opportunities/${id(oppId)}/cs-overview`);
export const getRecentWhatsApp = (oppId: string) =>
  api.get<{ messages: WhatsAppMessage[] }>(`/opportunities/${id(oppId)}/recent-whatsapp`);

export const getVirtualConsultations = (leadId: string) =>
  api.get<{ data: VirtualConsultation[] }>(`/leads/${id(leadId)}/virtual-consultations`);
export const getPackageDetails = (leadId: string) =>
  api.get<{ packages: PackageDetail[] }>(`/leads/${id(leadId)}/package-details`);
export const getRecentService = (leadId: string) =>
  api.get<{ data: RecentService }>(`/leads/${id(leadId)}/recent-service`);
export const getLatestSessions = (leadId: string) =>
  api.get<{ data: SessionRow[] }>(`/leads/${id(leadId)}/latest-sessions`);

// ── Tabs ────────────────────────────────────────────────────

/** All of the lead's activities (every department), newest first. */
export const getLeadActivities = (leadId: string) =>
  api.get<{ activities: ActivityItem[]; total_activities: number }>(`/leads/${id(leadId)}`);

export const getOpportunityCalls = (oppId: string, page: number, limit: number) =>
  api.get<Paged<CallRow>>(`/ameyo/opportunities/${id(oppId)}/calls`, { page, limit });

export const getPurchaseHistory = (leadId: string) =>
  api.get<{ data: Order[] }>(`/leads/${id(leadId)}/purchase-history`);

export const getAppointments = (leadId: string, page: number, limit = 10) =>
  api.get<Paged<Appointment>>(`/leads/${id(leadId)}/appointments`, { page, limit });

/** status: pending | completed | cancelled | "" (all). Same request as the web Tasks tab. */
export const getOpportunityTasks = (oppId: string, status: string) =>
  api.get<Paged<OpportunityTask>>("/tasks", {
    opportunity_id: oppId,
    status,
    sort_by: "due_at",
    sort_order: "ASC",
    limit: 50,
  });

// ── Changes ─────────────────────────────────────────────────

/** Change Stage (left panel). Compass checks the agent may edit this opportunity. */
export const changeOpportunityStage = (oppId: string, stageId: string | number, reason?: string) =>
  api.post<OpportunityDetail>(`/opportunities/${id(oppId)}/stage`, {
    opportunity_stage_id: String(stageId),
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
  });

/** Mark a task done (Tasks tab and task Smart Views). */
export const completeTask = (taskId: string | number) =>
  api.post<unknown>(`/tasks/${id(taskId)}/update`, { status: "completed" });
