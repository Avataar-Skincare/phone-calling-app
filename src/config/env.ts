import Constants from "expo-constants";

/**
 * Compass base URL, including the `/api` prefix and without a trailing slash.
 *
 * Precedence:
 *   1. EXPO_PUBLIC_COMPASS_API_URL (set per EAS profile in eas.json, or in a local .env)
 *   2. app.config.ts `extra.compassApiUrl`
 *   3. Compass testing
 */
const TESTING_URL = "https://test-leads.avataarskin.com/api";

const extra = (Constants.expoConfig?.extra ?? {}) as { compassApiUrl?: string };

export const env = {
  compassApiUrl: (process.env.EXPO_PUBLIC_COMPASS_API_URL ?? extra.compassApiUrl ?? TESTING_URL).replace(
    /\/+$/,
    "",
  ),
};

/** True when the app points at Compass testing, so screens can show a small "Testing" badge. */
export const isTestingBackend = env.compassApiUrl.includes("test-");
