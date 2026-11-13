import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistStorage } from "./persistStorage";

interface SettingsState {
  /** Android: SIM to call from (TelecomManager phone account id). null = phone's default. */
  simId: string | null;
  /** Android: the phone-permission explainer has been shown once. */
  permissionIntroSeen: boolean;
  /** Android: the folder the phone dialer saves call recordings in (read access granted once). */
  recordingsFolder: { uri: string; name: string } | null;
  /** epoch ms: the agent skipped the "phone is hiding call logs" warning (quiet for 24 h, ADR 0011). */
  hiddenLogSkippedAt: number | null;
  skipHiddenLogWarning: () => void;
  setSimId: (id: string | null) => void;
  setRecordingsFolder: (folder: { uri: string; name: string } | null) => void;
  markPermissionIntroSeen: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      simId: null,
      permissionIntroSeen: false,
      recordingsFolder: null,
      hiddenLogSkippedAt: null,
      skipHiddenLogWarning: () => set({ hiddenLogSkippedAt: Date.now() }),
      setSimId: (simId) => set({ simId }),
      setRecordingsFolder: (recordingsFolder) => set({ recordingsFolder }),
      markPermissionIntroSeen: () => set({ permissionIntroSeen: true }),
    }),
    { name: "settings", storage: persistStorage, version: 1 },
  ),
);
