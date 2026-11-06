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
export const addCallStateListener = jest.fn((l: Listener) => {
  listeners.add(l);
  return { remove: () => listeners.delete(l) };
});

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

export function __reset() {
  listeners.clear();
  capabilities = { ...ANDROID };
  callLog = null;
  permissions = { status: "granted", granted: true, canAskAgain: true };
  callState = "idle";
  sims = [{ id: "sim-1", label: "Jio" }];
  [
    getPermissions,
    requestPermissions,
    getCapabilities,
    startTracking,
    getCallState,
    listSims,
    placeCall,
    getLastCallFromLog,
  ].forEach((f) => f.mockClear());
}
