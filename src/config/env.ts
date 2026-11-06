import Constants from "expo-constants";

/**
 * Compass base URL, including the `/api` prefix and without a trailing slash.
 *
 * Precedence:
 *   1. EXPO_PUBLIC_COMPASS_API_URL (set per EAS profile in eas.json, or in a local .env)
 *   2. app.config.ts `extra.compassApiUrl`
 *   3. Compass
 *
 * test-leads.avataarskin.com and compass.avataarskin.com are the same Compass (one server, one
 * database), so every profile uses compass.avataarskin.com.
 */
const DEFAULT_URL = "https://compass.avataarskin.com/api";

const extra = (Constants.expoConfig?.extra ?? {}) as { compassApiUrl?: string };

export const env = {
  compassApiUrl: (process.env.EXPO_PUBLIC_COMPASS_API_URL ?? extra.compassApiUrl ?? DEFAULT_URL).replace(
    /\/+$/,
    "",
  ),
};

/** True when the app points at Compass testing, so screens can show a small "Testing" badge. */
export const isTestingBackend = env.compassApiUrl.includes("test-");
