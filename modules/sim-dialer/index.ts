/**
 * SimDialer: place calls from the phone's own SIM and observe call state.
 *
 * Native halves: android/.../SimDialerModule.kt and ios/SimDialerModule.swift.
 * When the native module is missing (Expo Go, web, or a build made before this module existed),
 * every function falls back to a plain `tel:` link with no call tracking, so the app still works.
 */
import { requireOptionalNativeModule } from "expo";
import { Linking, Platform } from "react-native";

/**
 * Raw call states.
 * Android: "idle" | "offhook" | "ringing" ("offhook" begins while the outgoing call still rings).
 * iOS:     "dialing" | "connected" | "ended" (outgoing calls only).
 */
export type NativeCallState = "idle" | "offhook" | "ringing" | "dialing" | "connected" | "ended";

export interface CallStateEvent {
  state: NativeCallState;
  /** epoch ms */
  at: number;
  /** iOS only: whether the other side answered. */
  connected?: boolean;
}

export interface PermissionResponse {
  status: "granted" | "denied" | "undetermined";
  granted: boolean;
  canAskAgain: boolean;
}

export interface DialerCapabilities {
  platform: "android" | "ios" | "fallback";
  /** Android with CALL_PHONE: the call starts without the dialer screen. */
  canDirectDial: boolean;
  /** Call-state events are being delivered. */
  canTrack: boolean;
  /** Android with READ_PHONE_STATE: listSims() returns the phone's SIMs. */
  canChooseSim: boolean;
}

export interface Sim {
  id: string;
  label: string;
}

/** "direct" = call placed; "dialer" = dialer opened with the number, agent taps call. */
export type PlaceCallResult = "direct" | "dialer";

interface NativeSimDialer {
  addListener(event: "callState", listener: (e: CallStateEvent) => void): { remove: () => void };
  getPermissions(): Promise<PermissionResponse>;
  requestPermissions(): Promise<PermissionResponse>;
  capabilities(): Promise<DialerCapabilities>;
  startTracking(): Promise<boolean>;
  getCallState(): Promise<NativeCallState | "unknown">;
  listSims(): Promise<Sim[]>;
  placeCall(number: string, simId: string | null): Promise<PlaceCallResult>;
}

const native = requireOptionalNativeModule<NativeSimDialer>("SimDialer");

/** False in Expo Go / builds without the module: calls still work, but nothing is tracked. */
export const isNativeDialerAvailable = native !== null;

const GRANTED: PermissionResponse = { status: "granted", granted: true, canAskAgain: true };

export function getPermissions(): Promise<PermissionResponse> {
  return native ? native.getPermissions() : Promise.resolve(GRANTED);
}

export function requestPermissions(): Promise<PermissionResponse> {
  return native ? native.requestPermissions() : Promise.resolve(GRANTED);
}

export function getCapabilities(): Promise<DialerCapabilities> {
  return native
    ? native.capabilities()
    : Promise.resolve({ platform: "fallback", canDirectDial: false, canTrack: false, canChooseSim: false });
}

/** Start call-state events (Android 12+ needs READ_PHONE_STATE first). Returns whether tracking is on. */
export function startTracking(): Promise<boolean> {
  return native ? native.startTracking() : Promise.resolve(false);
}

export function getCallState(): Promise<NativeCallState | "unknown"> {
  return native ? native.getCallState() : Promise.resolve("unknown");
}

export function listSims(): Promise<Sim[]> {
  return native && Platform.OS === "android" ? native.listSims() : Promise.resolve([]);
}

/** Dial an E.164 number, on `simId` when given (Android only). */
export async function placeCall(e164: string, simId?: string | null): Promise<PlaceCallResult> {
  if (native) return native.placeCall(e164, simId ?? null);
  await Linking.openURL(`tel:${e164}`);
  return "dialer";
}

export function addCallStateListener(listener: (e: CallStateEvent) => void): { remove: () => void } {
  return native ? native.addListener("callState", listener) : { remove: () => {} };
}
