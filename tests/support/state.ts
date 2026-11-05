/// <reference types="jest" />
/// <reference types="node" />
/**
 * Reset every piece of app state between tests, and helpers to put the app in a known state.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { queryClient } from "@/api/queryClient";
import { buildSession } from "@/lib/session";
import { useAuthStore } from "@/store/auth.store";
import { useCallStore } from "@/store/call.store";
import { useOutcomeQueue } from "@/store/outcomeQueue.store";
import { useSettingsStore } from "@/store/settings.store";
import { agent, jwt } from "./compass";

export async function resetAppState() {
  queryClient.clear();
  useAuthStore.setState({ session: null, hydrated: false });
  useCallStore.setState({ session: null });
  useOutcomeQueue.setState({ items: [] });
  useSettingsStore.setState({ simId: null, permissionIntroSeen: false });
  await AsyncStorage.clear();
  (SecureStore as unknown as { __reset: () => void }).__reset();
}

/** Logged in as the fixture agent (Sales). */
export function signedInAs(user = agent) {
  useAuthStore.setState({ session: buildSession(jwt(), user), hydrated: true });
}
