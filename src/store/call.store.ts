import { create } from "zustand";
import { persist } from "zustand/middleware";

import { applyCallEvent, resolveOnResume, type CallSession, type NativeState } from "@/lib/callState";
import { persistStorage } from "./persistStorage";

interface CallState {
  /** The current or most recent call. Persisted, so a call survives the app being killed. */
  session: CallSession | null;
  start: (s: CallSession) => void;
  setMode: (id: string, mode: CallSession["mode"]) => void;
  applyEvent: (e: { state: NativeState; at: number; connected?: boolean }) => void;
  resume: (native: NativeState, now: number) => void;
  clear: () => void;
}

export const useCallStore = create<CallState>()(
  persist(
    (set, get) => ({
      session: null,
      start: (session) => set({ session }),
      setMode: (id, mode) => {
        const s = get().session;
        if (s && s.id === id) set({ session: { ...s, mode } });
      },
      applyEvent: (e) => {
        const s = get().session;
        if (s) set({ session: applyCallEvent(s, e) });
      },
      resume: (native, now) => {
        const s = get().session;
        if (s) set({ session: resolveOnResume(s, native, now) });
      },
      clear: () => set({ session: null }),
    }),
    { name: "call-session", storage: persistStorage, version: 1 },
  ),
);
