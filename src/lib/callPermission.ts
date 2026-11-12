/**
 * Call-log access is required to call from the app on Android (ADR 0008): without it the app
 * can't tell talk time from ringing time. Pure rule, covered by callPermission.test.ts.
 */

/**
 * True when the permissions screen must be shown before this call.
 * @param platform        `Platform.OS`
 * @param nativeAvailable the sim-dialer native module is present (false in Expo Go)
 * @param canReadCallLog  from `getCapabilities()`; null when it couldn't be read
 */
export function mustAskForCallLog(
  platform: string,
  nativeAvailable: boolean,
  canReadCallLog: boolean | null,
): boolean {
  return platform === "android" && nativeAvailable && canReadCallLog !== true;
}
