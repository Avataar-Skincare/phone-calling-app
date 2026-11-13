/// <reference types="jest" />
/**
 * Jest manual mock of the sim-dialer native module (`jest.mock("@modules/sim-dialer")`).
 *
 * Behaves like an Android phone with both permissions granted and one SIM. Tests drive the call
 * with `__emit({ state, at })`, exactly as the native module would, and inspect `placeCall` calls.
 */
import type {
  CallLogEntry,
  CallStateEvent,
  DialerCapabilities,
  NativeCallState,
  PermissionResponse,
  PlaceCallResult,
  RecordingFile,
  RecordingsFolder,
  SharedRecording,
  Sim,
} from "../index";

type Listener = (e: CallStateEvent) => void;
const listeners = new Set<Listener>();

const ANDROID: DialerCapabilities = {
  platform: "android",
  canDirectDial: true,
  canTrack: true,
  canChooseSim: true,
  canReadCallLog: true,
};
let capabilities: DialerCapabilities = { ...ANDROID };
/** What the call log returns for the next lookups; null = no entry (yet). */
let callLog: CallLogEntry | null = null;
let permissions: PermissionResponse = { status: "granted", granted: true, canAskAgain: true };
let callState: NativeCallState | "unknown" = "idle";
let sims: Sim[] = [{ id: "sim-1", label: "Jio" }];

/** The folder the picker returns and getRecordingsFolder() recognises; null = none / access lost. */
let recordingsFolder: RecordingsFolder | null = null;
let recordings: RecordingFile[] = [];
let uploadStatus = 200;

export const isNativeDialerAvailable = true;

export const getPermissions = jest.fn(async () => permissions);
export const requestPermissions = jest.fn(async () => permissions);
export const getCapabilities = jest.fn(async () => capabilities);
export const startTracking = jest.fn(async () => capabilities.canTrack);
export const getCallState = jest.fn(async () => callState);
export const listSims = jest.fn(async () => sims);
export const placeCall = jest.fn(async (_e164: string, _simId?: string | null): Promise<PlaceCallResult> =>
  capabilities.canDirectDial ? "direct" : "dialer",
);
export const getLastCallFromLog = jest.fn(async (_e164: string, _sinceMs: number) => callLog);
export const pickRecordingsFolder = jest.fn(async () => recordingsFolder);
export const getRecordingsFolder = jest.fn(async (uri: string) =>
  recordingsFolder && recordingsFolder.uri === uri ? recordingsFolder : null,
);
export const listRecordings = jest.fn(async (_tree: string, fromMs: number, toMs: number) =>
  recordings.filter((r) => r.lastModified >= fromMs && r.lastModified <= toMs),
);
export const uploadRecording = jest.fn(
  async (_fileUri: string, _url: string, _contentType: string, _sizeBytes: number) => ({
    status: uploadStatus,
  }),
);
export const addCallStateListener = jest.fn((l: Listener) => {
  listeners.add(l);
  return { remove: () => listeners.delete(l) };
});

/** Files shared to the app and not yet taken (cold start, or shared while no listener was up). */
let sharedQueue: SharedRecording[] = [];
const sharedListeners = new Set<(e: SharedRecording) => void>();
export const takeSharedRecording = jest.fn(async () => sharedQueue.shift() ?? null);
export const addSharedRecordingListener = jest.fn((l: (e: SharedRecording) => void) => {
  sharedListeners.add(l);
  return { remove: () => sharedListeners.delete(l) };
});

/**
 * Share a recording to the app. Like the native side it is queued for takeSharedRecording() AND
 * emitted to listeners; the app takes it once (the queue is what a cold start reads).
 * `emit: false` simulates a cold start: only takeSharedRecording() sees it.
 */
export function __shareRecording(file: SharedRecording, opts: { emit?: boolean } = {}) {
  sharedQueue.push(file);
  if (opts.emit !== false) sharedListeners.forEach((l) => l(file));
}

/** Deliver a call-state event to the app, as the native module would. */
export function __emit(e: CallStateEvent) {
  if (e.state === "offhook" || e.state === "dialing" || e.state === "connected") callState = "offhook";
  if (e.state === "idle" || e.state === "ended") callState = "idle";
  listeners.forEach((l) => l(e));
}

export function __setCapabilities(c: Partial<DialerCapabilities>) {
  capabilities = { ...capabilities, ...c };
}

export function __setPermissions(p: Partial<PermissionResponse>) {
  permissions = { ...permissions, ...p };
}

/** Set what the Android call log reports for the call (talk time 0 = not answered). */
export function __setCallLog(entry: CallLogEntry | null) {
  callLog = entry;
}

export function __setSims(s: Sim[]) {
  sims = s;
}

/** The folder the picker returns; getRecordingsFolder() recognises it. null = none / access lost. */
export function __setRecordingsFolder(f: RecordingsFolder | null) {
  recordingsFolder = f;
}

/** Files listRecordings() returns (filtered by the requested time window). */
export function __setRecordings(r: RecordingFile[]) {
  recordings = r;
}

/** HTTP status uploadRecording() resolves with. */
export function __setUploadStatus(status: number) {
  uploadStatus = status;
}

export function __reset() {
  listeners.clear();
  capabilities = { ...ANDROID };
  callLog = null;
  permissions = { status: "granted", granted: true, canAskAgain: true };
  callState = "idle";
  sims = [{ id: "sim-1", label: "Jio" }];
  recordingsFolder = null;
  recordings = [];
  uploadStatus = 200;
  sharedQueue = [];
  sharedListeners.clear();
  [
    getPermissions,
    requestPermissions,
    getCapabilities,
    startTracking,
    getCallState,
    listSims,
    placeCall,
    getLastCallFromLog,
    pickRecordingsFolder,
    getRecordingsFolder,
    listRecordings,
    uploadRecording,
    takeSharedRecording,
    addSharedRecordingListener,
  ].forEach((f) => f.mockClear());
}
