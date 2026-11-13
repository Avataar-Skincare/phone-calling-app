import { create } from "zustand";

import type { SharedRecording } from "@modules/sim-dialer";

interface SharedRecordingState {
  /** The recording shared to the app that the agent is dealing with now, or null. */
  file: SharedRecording | null;
  set: (file: SharedRecording) => void;
  clear: () => void;
}

/**
 * The recording shared from the phone's Phone app (ADR 0010). Memory only, on purpose: the native
 * side keeps a not-yet-taken file until JavaScript takes it, and a file the agent already saw is
 * their to share again. A persisted copy could outlive its cache file and open a dead screen.
 */
export const useSharedRecording = create<SharedRecordingState>((set) => ({
  file: null,
  set: (file) => set({ file }),
  clear: () => set({ file: null }),
}));
