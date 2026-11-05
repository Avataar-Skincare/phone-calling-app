import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistStorage } from "./persistStorage";

interface SettingsState {
  /** Android: SIM to call from (TelecomManager phone account id). null = phone's default. */
  simId: string | null;
  /** Android: the phone-permission explainer has been shown once. */
  permissionIntroSeen: boolean;
  setSimId: (id: string | null) => void;
  markPermissionIntroSeen: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      simId: null,
      permissionIntroSeen: false,
      setSimId: (simId) => set({ simId }),
      markPermissionIntroSeen: () => set({ permissionIntroSeen: true }),
    }),
    { name: "settings", storage: persistStorage, version: 1 },
  ),
);
