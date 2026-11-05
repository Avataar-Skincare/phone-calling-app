import { Stack } from "expo-router";
import { CallTracker } from "@/features/calling/CallTracker";
import { OutcomeWatchers } from "@/features/outcome/OutcomeWatchers";
import { useColors } from "@/theme/tokens";

export default function MainLayout() {
  const c = useColors();
  return (
    <>
      <CallTracker />
      <OutcomeWatchers />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="lead/[opportunityId]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="pending" />
        <Stack.Screen name="permissions" options={{ presentation: "modal" }} />
        {/* Can't be swiped away: the agent saves an outcome or says the call didn't happen. */}
        <Stack.Screen name="outcome" options={{ presentation: "modal", gestureEnabled: false }} />
      </Stack>
    </>
  );
}
