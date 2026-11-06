/**
 * Response shapes for the Compass opportunity page (web: features/opportunities/pages/
 * OpportunityDetail.tsx). Fields are optional/nullable where Compass may omit them.
 */
import type { CodeLabel, IdName, PageMeta } from "./compass";

export interface StageHistoryEntry {
  id: string | number;
  from_stage: { id: string | number; label: string } | null;
  to_stage: { id: string | number; label: string } | null;
  changed_by: IdName | null;
  changed_at: string;
  reason: string | null;
}

export interface AvailableStage {
  id: string | number;
  department_stage_id?: string | number;
  code: string;
  label: string;
  stage_type: string;
  sort_order: number;
}

export interface LeadSourcesResponse {
  lead_sources: { source: string; campaign_name: string | null }[];
}

export interface HautAiEntry {
  activity_id: string | number;
  date: string;
  overall_skin_score: number | string | null;
  concerns: { name: string; score: number; analysis: string | null }[];
}

export interface SalesOverview {
  haut_ai: HautAiEntry[];
  last_add_to_cart: {
    activity_id: string | number;
    date: string;
    product_name: string | null;
    number_of_sessions: string | number | null;
  } | null;
  recent_photos: { date: string; url: string }[];
  skin_analysis_report: string | null;
}

export interface CsOverview {
  complaints: {
    activity_id: string | number;
    date: string;
    complaint_type: string | null;
    notes: string | null;
    ptc_received: string | null;
  }[];
  escalated_status: "Yes" | "No";
  address: string | null;
  postal_code?: string | null;
  rm_name: string | null;
}

export interface WhatsAppMessage {
  direction: "inbound" | "outbound" | string;
  message_text: string | null;
  status?: string | null;
  occurred_at: string;
}

export interface VirtualConsultation {
  consultation_id?: string | number;
  consultation_date: string | null;
  doctor_name: string | null;
  consultation_type: string | null;
  services_recommended: string | null;
  prescription_report: string | null;
}

export interface PackageDetail {
  product_name: string | null;
  total_sessions: number | string | null;
  completed_sessions: number | string | null;
  remaining_sessions: number | string | null;
}

export interface RecentService {
  last_completed_session: {
    product_name: string | null;
    session_date: string | null;
    completed_sessions: number | string | null;
    total_sessions: number | string | null;
  } | null;
  next_appointment: {
    product_name: string | null;
    appointment_date: string | null;
    status: string | null;
  } | null;
}

export interface SessionRow {
  session_id: string | number | null;
  session_status: string | null;
  appointment_date: string | null;
  rating: number | string | null;
  therapist_assigned: string | null;
  service_name: string | null;
}

export interface CallRow {
  id: string | number;
  call_id?: string | null;
  direction: "inbound" | "outbound" | "missed" | "unknown" | string;
  phone?: string | null;
  agent: IdName | null;
  system_disposition: string | null;
  disposition_code: string | null;
  talk_time_seconds: number | string | null;
  call_result?: string | null;
  recording_url: string | null;
  notes?: string | null;
  has_analysis?: boolean;
  started_at: string | null;
  ended_at?: string | null;
}

export interface Order {
  order_id: string;
  user_name?: string | null;
  order_date: string | null;
  formatted_address: string | null;
  payable_amount: number | string | null;
  amount_paid: number | string | null;
  left_amount: number | string | null;
  payment_status: string | null;
  items?: {
    order_detail_id?: string | number;
    product_name: string | null;
    item_price: number | string | null;
    sessions_taken: number | string | null;
  }[];
}

export interface Appointment {
  session_id: string | number | null;
  client_id: string | number | null;
  address: string | null;
  service_name: string | null;
  session_status: string | null;
  appointment_date: string | null;
  therapist_assigned: string | null;
}

export interface OpportunityTask {
  id: string | number;
  title: string | null;
  description: string | null;
  status: string;
  priority: "high" | "medium" | "low" | string | null;
  due_at: string | null;
  completed_at: string | null;
  task_type: CodeLabel | null;
  assigned_to: IdName | null;
}

export type Paged<T> = { data: T[]; meta: PageMeta };
