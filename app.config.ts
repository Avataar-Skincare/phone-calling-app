import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic config layered on top of app.json.
 *
 * APP_ID is the Android package and iOS bundle identifier. Settle it BEFORE the first EAS build:
 * changing it afterwards creates a brand-new app identity in Play Console and App Store Connect.
 *
 * COMPASS_API_URL is the Compass backend base URL including the `/api` prefix. EAS profiles set
 * EXPO_PUBLIC_COMPASS_API_URL (see eas.json); local runs fall back to Compass testing.
 */
const APP_ID = "com.avataarskin.dialer";
const COMPASS_API_URL = process.env.EXPO_PUBLIC_COMPASS_API_URL ?? "https://test-leads.avataarskin.com/api";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Compass Dialer",
  slug: config.slug ?? "phone-calling-app",
  android: {
    ...config.android,
    package: APP_ID,
  },
  ios: {
    ...config.ios,
    bundleIdentifier: APP_ID,
  },
  extra: {
    ...config.extra,
    compassApiUrl: COMPASS_API_URL,
  },
});
