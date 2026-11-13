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
  /** Android with READ_CALL_LOG: lastCallFromLog() can return talk time. Always false on iOS. */
  canReadCallLog: boolean;
}

/** An outgoing call as the Android call log recorded it. */
export interface CallLogEntry {
  /** Seconds after the other side answered; 0 when they didn't. */
  talkSeconds: number;
  /** epoch ms the call was placed */
  startedAt: number;
}

/** A folder the agent granted read access to (Android Storage Access Framework tree). */
export interface RecordingsFolder {
  /** content:// tree URI; the app stores it and re-checks it with getRecordingsFolder(). */
  uri: string;
  /** Folder display name, e.g. "Call". */
  name: string;
}

/** An audio file found in the recordings folder. */
export interface RecordingFile {
  /** content:// document URI, readable with the folder grant. */
  uri: string;
  name: string;
  sizeBytes: number;
  /** epoch ms */
  lastModified: number;
  /** May be empty when the provider doesn't report one. */
  mimeType: string;
}

/**
 * A recording another app shared to this one (Android: Share → Compass Dialer, ADR 0010). The native
 * side has already copied it into the app's cache, so `uri` is a file:// the app owns.
 */
export interface SharedRecording {
  /** file:// in the app cache; "" when `error` is set. */
  uri: string;
  /** The sender's file name, e.g. "record-1794566075519.wav". */
  name: string;
  sizeBytes: number;
  /** "" when the sender gave none (use the file extension). */
  mimeType: string;
  /** epoch ms: when the file arrived */
  sharedAt: number;
  /** Set when the file could not be copied: over 25 MB, or not readable. */
  error?: "too_big" | "unreadable";
}

export interface Sim {
  id: string;
  label: string;
}

/** "direct" = call placed; "dialer" = dialer opened with the number, agent taps call. */
export type PlaceCallResult = "direct" | "dialer";

interface NativeSimDialer {
  addListener(event: "callState", listener: (e: CallStateEvent) => void): { remove: () => void };
  addListener(event: "sharedRecording", listener: (e: SharedRecording) => void): { remove: () => void };
  takeSharedRecording(): Promise<SharedRecording | null>;
  getPermissions(): Promise<PermissionResponse>;
  requestPermissions(): Promise<PermissionResponse>;
  capabilities(): Promise<DialerCapabilities>;
  startTracking(): Promise<boolean>;
  getCallState(): Promise<NativeCallState | "unknown">;
  listSims(): Promise<Sim[]>;
  placeCall(number: string, simId: string | null): Promise<PlaceCallResult>;
  lastCallFromLog(number: string, sinceMs: number): Promise<CallLogEntry | null>;
  pickRecordingsFolder(): Promise<RecordingsFolder | null>;
  getRecordingsFolder(uri: string): Promise<RecordingsFolder | null>;
  listRecordings(treeUri: string, fromMs: number, toMs: number): Promise<RecordingFile[]>;
  uploadRecording(
    fileUri: string,
    url: string,
    contentType: string,
    sizeBytes: number,
  ): Promise<{ status: number }>;
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
    : Promise.resolve({
        platform: "fallback",
        canDirectDial: false,
        canTrack: false,
        canChooseSim: false,
        canReadCallLog: false,
      });
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

/**
 * Android: the newest outgoing call to `e164` placed at or after `sinceMs`, from the call log.
 * null on iOS, without READ_CALL_LOG, or when the phone hasn't written the entry yet.
 */
export function getLastCallFromLog(e164: string, sinceMs: number): Promise<CallLogEntry | null> {
  return native && Platform.OS === "android" ? native.lastCallFromLog(e164, sinceMs) : Promise.resolve(null);
}

/** Android: open the system folder picker (read access only). null when cancelled or unavailable. */
export function pickRecordingsFolder(): Promise<RecordingsFolder | null> {
  return native && Platform.OS === "android" ? native.pickRecordingsFolder() : Promise.resolve(null);
}

/** The folder, only while its persisted read access still exists; null when lost or unavailable. */
export function getRecordingsFolder(uri: string): Promise<RecordingsFolder | null> {
  return native && Platform.OS === "android" ? native.getRecordingsFolder(uri) : Promise.resolve(null);
}

/**
 * Android: audio files in the folder (plus one level of sub-folders) last modified within
 * [fromMs, toMs], newest first, at most 50. [] when access was revoked or unavailable.
 */
export function listRecordings(treeUri: string, fromMs: number, toMs: number): Promise<RecordingFile[]> {
  return native && Platform.OS === "android"
    ? native.listRecordings(treeUri, fromMs, toMs)
    : Promise.resolve([]);
}

/**
 * Android: HTTP PUT the file's bytes to `url` with exactly `Content-Type: contentType` and
 * `Content-Length: sizeBytes`. Resolves the HTTP status (non-2xx is NOT thrown); throws on an IO
 * failure, and when unavailable (iOS, no native module).
 */
export function uploadRecording(
  fileUri: string,
  url: string,
  contentType: string,
  sizeBytes: number,
): Promise<{ status: number }> {
  if (native && Platform.OS === "android")
    return native.uploadRecording(fileUri, url, contentType, sizeBytes);
  return Promise.reject(new Error("Recording upload is Android only"));
}

/**
 * Android: the recording shared to the app that hasn't been taken yet (also one that started the app),
 * then null. null on iOS, without the native module, or in a build made before sharing existed.
 */
export function takeSharedRecording(): Promise<SharedRecording | null> {
  if (!native || Platform.OS !== "android") return Promise.resolve(null);
  // An older Android build has the module but not this function.
  return typeof native.takeSharedRecording === "function"
    ? native.takeSharedRecording().catch(() => null)
    : Promise.resolve(null);
}

/** A recording is shared to the app while it is running. No-op when unavailable. */
export function addSharedRecordingListener(listener: (e: SharedRecording) => void): { remove: () => void } {
  if (!native || Platform.OS !== "android") return { remove: () => {} };
  return native.addListener("sharedRecording", listener);
}

export function addCallStateListener(listener: (e: CallStateEvent) => void): { remove: () => void } {
  return native ? native.addListener("callState", listener) : { remove: () => {} };
}
