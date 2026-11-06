import type { CallLogRequest } from "@/lib/callLog";
import { api } from "./client";

/** What POST /activities/log replies. On failure it is still HTTP 200, with activity_id null. */
export interface LogActivityResponse {
  lead_id: string | null;
  activity_id: string | null;
  lead_created: boolean;
  message: string;
}

/** Log a "Manual Outbound Call" activity (ADR 0005). Check `activity_id`, not the status code. */
export function logCallActivity(body: CallLogRequest) {
  return api.post<LogActivityResponse>("/activities/log", body);
}
