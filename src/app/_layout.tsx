import { useEffect } from "react";
import { AppState } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider, focusManager } from "@tanstack/react-query";

import { queryClient } from "@/api/queryClient";
import { loadSession, signOutIfExpired } from "@/lib/auth";
import { useAuthStore } from "@/store/auth.store";
import { useColors } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync();

// React Native has no window focus: tell TanStack Query when the app comes to the foreground,
// so lists and counts refresh when an agent returns from a call.
AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Gate />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/**
 * The session is the single source of truth for routing: with no session only the (auth)
 * screens exist, with one only the (main) screens do. Logging out or a 401 clears the session,
 * so the agent always lands on login.
 */
function Gate() {
  const c = useColors();
  const session = useAuthStore((s) => s.session);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    if (hydrated) void SplashScreen.hideAsync();
  }, [hydrated]);

  // End the session exactly when the token expires, and re-check whenever the app returns
  // to the foreground (timers don't run while the app is suspended).
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => void signOutIfExpired(), Math.max(0, session.expiresAt - Date.now()));
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void signOutIfExpired();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [session]);

  if (!hydrated) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(main)" />
      </Stack.Protected>
    </Stack>
  );
}
