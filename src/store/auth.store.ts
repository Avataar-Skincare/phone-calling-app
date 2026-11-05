import { create } from "zustand";
import type { Session } from "@/lib/session";

interface AuthState {
  /** Loaded from secure storage on launch; null means logged out. */
  session: Session | null;
  /** False until the stored session has been read, so the app doesn't flash the login screen. */
  hydrated: boolean;
  setSession: (session: Session | null) => void;
  setHydrated: () => void;
}

/** In-memory session. Persisted to secure storage by src/lib/auth.ts. */
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  hydrated: false,
  setSession: (session) => set({ session }),
  setHydrated: () => set({ hydrated: true }),
}));
