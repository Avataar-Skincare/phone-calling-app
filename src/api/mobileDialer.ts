import { raceTimeout } from "@/lib/raceTimeout";
import { api } from "./client";

/** POST /mobile-dialer/claim reply (ADR 0009). */
export interface ClaimResult {
  status: "claimed" | "already_owner" | "created" | "no_opportunity" | "not_sales";
  lead_id: string | null;
  lead_name: string | null;
  lead_created: boolean;
  opportunity_id: string | null;
  previous_owner_user_id: string | null;
  previous_owner_name: string | null;
  changed: boolean;
}

/** How long the keypad waits for Compass before dialing anyway. */
export const CLAIM_CAP_MS = 3000;

/** Move the lead with this number to the calling agent (Sales only, enforced by Compass). */
export function claimByPhone(phone: string) {
  return api.post<ClaimResult>("/mobile-dialer/claim", { phone });
}

/** `claimByPhone` that never throws and never takes longer than `ms`: "error" on any failure. */
export function claimWithCap(phone: string, ms = CLAIM_CAP_MS): Promise<ClaimResult | "error"> {
  return raceTimeout<ClaimResult, "error">(claimByPhone(phone), ms, "error");
}
