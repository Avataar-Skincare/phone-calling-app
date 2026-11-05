import { setUnauthorizedHandler } from "@/api/client";
import { queryClient } from "@/api/queryClient";
import { useAuthStore } from "@/store/auth.store";
import { buildSession, isSessionExpired, parseStoredSession, type Session } from "./session";
import { secureStorage } from "./storage";
import type { VerifyOtpResponse } from "@/types/compass";

const SESSION_KEY = "compass_session";

/** Read the stored session on launch. An expired or unreadable one is discarded. */
export async function loadSession(): Promise<void> {
  const store = useAuthStore.getState();
  try {
    const session = parseStoredSession(await secureStorage.get(SESSION_KEY));
    if (session && !isSessionExpired(session)) {
      store.setSession(session);
    } else if (session) {
      await secureStorage.del(SESSION_KEY);
    }
  } finally {
    store.setHydrated();
  }
}

export async function signIn(res: VerifyOtpResponse): Promise<Session> {
  const session = buildSession(res.token, res.user);
  await secureStorage.set(SESSION_KEY, JSON.stringify(session));
  useAuthStore.getState().setSession(session);
  return session;
}

export async function signOut(): Promise<void> {
  useAuthStore.getState().setSession(null);
  queryClient.clear();
  await secureStorage.del(SESSION_KEY);
}

/** Sign out when the session has passed its expiry. Returns true if it did. */
export async function signOutIfExpired(): Promise<boolean> {
  const session = useAuthStore.getState().session;
  if (session && isSessionExpired(session)) {
    await signOut();
    return true;
  }
  return false;
}

// Compass rejected the token (expired, or the user was removed): back to login.
setUnauthorizedHandler(() => {
  void signOut();
});
