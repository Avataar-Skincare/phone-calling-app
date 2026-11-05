import { useCallback } from "react";
import { Alert, Platform } from "react-native";
import { router } from "expo-router";

import { isNativeDialerAvailable } from "@modules/sim-dialer";
import { toE164 } from "@/lib/phone";
import { useCallStore } from "@/store/call.store";
import { useSettingsStore } from "@/store/settings.store";
import { startCall } from "./callFlow";

export interface CallRequest {
  name: string;
  phone: string | null | undefined;
  opportunityId: string | null;
  leadId: string | null;
  taskId: string | null;
}

function showError(e: unknown) {
  Alert.alert("Couldn't start the call", e instanceof Error ? e.message : "Try again.");
}

/**
 * Shared tap handler for every call button.
 *  1. Checks the number can be dialed.
 *  2. Refuses while another call is live or its outcome hasn't been saved.
 *  3. On Android, shows the phone-permission explainer once before the first call.
 *  4. Places the call and opens a call session.
 */
export function useCallLead() {
  return useCallback(async (req: CallRequest) => {
    const phone = toE164(req.phone);
    if (!phone) {
      Alert.alert("No number to call", "This lead has no phone number that can be dialed.");
      return;
    }

    const current = useCallStore.getState().session;
    if (current && current.status === "ended") {
      // One call at a time: the last call's outcome has to be saved (or discarded) first.
      Alert.alert(
        "Save the last call first",
        `Record how the call to ${current.name} went, then call again.`,
        [
          { text: "Not now", style: "cancel" },
          { text: "Record outcome", onPress: () => router.push("/outcome") },
        ],
      );
      return;
    }
    if (current) {
      Alert.alert(
        "A call is still open",
        `The call to ${current.name} hasn't finished yet. If it has ended, clear it and try again.`,
        [
          { text: "Keep it", style: "cancel" },
          {
            text: "Clear and call",
            style: "destructive",
            onPress: () => {
              useCallStore.getState().clear();
              startCall({ ...req, phone }).catch(showError);
            },
          },
        ],
      );
      return;
    }

    if (
      Platform.OS === "android" &&
      isNativeDialerAvailable &&
      !useSettingsStore.getState().permissionIntroSeen
    ) {
      router.push({
        pathname: "/permissions",
        params: {
          name: req.name,
          phone,
          opportunityId: req.opportunityId ?? "",
          leadId: req.leadId ?? "",
          taskId: req.taskId ?? "",
        },
      });
      return;
    }

    try {
      await startCall({ ...req, phone });
    } catch (e) {
      showError(e);
    }
  }, []);
}
