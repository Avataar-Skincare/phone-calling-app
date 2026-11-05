/** Shapes returned by the Compass API (leadsquared-avataar-server). */

export type CompassRole = "administrator" | "supervisor" | "tl" | "agent";

/** `user` object from POST /auth/verify-otp. */
export interface CompassUser {
  id: string | number;
  name: string;
  email: string | null;
  phone: string;
  role: CompassRole;
  teamId: string | number | null;
  departmentId: string | number | null;
  telephonyExtension: string | null;
}

export interface SendOtpResponse {
  token: string;
}

export interface VerifyOtpResponse {
  token: string;
  user: CompassUser;
}

export type DepartmentCode = "sales" | "cs";

/** GET /opportunities/departments */
export interface Department {
  id: string | number;
  code: string;
  label: string;
}

export interface CodeLabel {
  code: string;
  label: string;
}

export interface IdName {
  id: string | number;
  name: string;
}

// ── Smart Views ─────────────────────────────────────────────

export type SmartViewType = "lead" | "task";

/** GET /smart-views/definitions */
export interface SmartViewDef {
  key: string;
  label: string;
  department: DepartmentCode;
  type: SmartViewType;
  description?: string;
}

/** GET /smart-views/counts?department= → { [viewKey]: total } */
export type SmartViewCounts = Record<string, number>;

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

/** Row of a lead-type view (hot_leads, warm_leads, important_customers, …). */
export interface LeadViewRow {
  id: string | number | null; // lead id
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  city?: string | null;
  primary_phone: string | null;
  lead_source: string | null;
  lead_stage?: CodeLabel | null;
  lead_score?: number | null;
  opportunity_id: string | number | null;
  opportunity_stage: CodeLabel | null;
  owner: IdName | null;
  created_at?: string | null;
  updated_at?: string | null;
  cs_missed_at?: string | null;
}

/** Row of a task-type view (first_call_tasks, hot_and_warm_tasks, …). */
export interface TaskViewRow {
  id: string | number; // task id
  title: string | null;
  description?: string | null;
  status: string;
  priority?: string | null;
  due_at: string | null;
  completed_at?: string | null;
  task_type: CodeLabel | null;
  lead: {
    id: string | number | null;
    first_name: string | null;
    last_name: string | null;
    primary_phone: string | null;
  } | null;
  assigned_to: (IdName & { extension?: string | null }) | null;
  opportunity_id: string | number | null;
  opportunity_stage: CodeLabel | null;
  department: CodeLabel | null;
  created_at?: string | null;
}

// ── Opportunity detail ──────────────────────────────────────

export interface ActivityItem {
  id: string | number;
  type: CodeLabel | null;
  title: string | null;
  score: number;
  data: Record<string, unknown> | null;
  added_by_type: string;
  added_by: IdName | null;
  occurred_at: string;
  created_at: string;
}

/** GET /opportunities/:id */
export interface OpportunityDetail {
  id: string | number;
  opportunity_name: string | null;
  department: (CodeLabel & { id: string | number }) | null;
  stage: (CodeLabel & { id: string | number; stage_type: string }) | null;
  owner: IdName | null;
  lead: {
    id: string | number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    city: string | null;
    lead_score: number | null;
    lead_source: string | null;
    /** First stored number, not necessarily the primary one. */
    phone: string | null;
  } | null;
  created_at: string;
  updated_at: string;
  activities: ActivityItem[];
  total_activities: number;
}

// ── Opportunity activity form (call outcome) ────────────────

export type FormFieldType = "text" | "number" | "datetime" | "dropdown";

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options: string[] | null;
}

export interface StageFormConfig {
  sub_form_name: string | null;
  /** null = choosing this stage logs no activity, only the stage change. */
  activity_type_code: string | null;
  top_level_fields: FormField[];
  sub_form_fields: FormField[];
}

export interface FormStage {
  id: string | number;
  code: string;
  label: string;
  stage_type: string;
  sort_order: number;
}

/** GET /opportunities/:id/activity-form/config */
export interface ActivityFormConfig {
  opportunity_id: string | number;
  opportunity_name: string | null;
  department_code: string;
  department_label: string;
  current_stage_code: string;
  lead_data: {
    lead_id: string | number;
    first_name: string | null;
    email: string | null;
    phone_number: string | null;
    whatsapp_number: string | null;
    gender: string | null;
    city: string | null;
  };
  available_stages: FormStage[];
  form_configs: Record<string, StageFormConfig>;
}

/** POST /opportunities/:id/activity-form */
export interface ActivityFormPayload {
  stage_code: string;
  submitted_by_user_id: string;
  concerns_raised?: string;
  top_level_data?: Record<string, string | number>;
  sub_form_data?: Record<string, string | number>;
}

/** Error body NestJS returns for HttpException. */
export interface NestErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}
