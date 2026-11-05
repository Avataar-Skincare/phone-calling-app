import { api } from "./client";
import type { SendOtpResponse, VerifyOtpResponse } from "@/types/compass";

/**
 * POST /auth/send-otp. The number must belong to an existing Compass user (404 otherwise).
 * Compass sends a 4-digit code by SMS and WhatsApp, valid for 5 minutes.
 */
export function sendOtp(phoneNumber: string) {
  return api.post<SendOtpResponse>("/auth/send-otp", { phoneNumber }, { anon: true });
}

/** POST /auth/verify-otp. Returns a 15-hour JWT and the Compass user. */
export function verifyOtp(token: string, otp: string) {
  return api.post<VerifyOtpResponse>("/auth/verify-otp", { token, otp }, { anon: true });
}
