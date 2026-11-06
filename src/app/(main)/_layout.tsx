import { Stack } from "expo-router";
import { CallLogSender } from "@/features/calling/CallLogSender";
import { CallTracker } from "@/features/calling/CallTracker";
import { useColors } from "@/theme/tokens";

export default function MainLayout() {
  const c = useColors();
  return (
    <>
      <CallTracker />
      <CallLogSender />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="lead/[opportunityId]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="permissions" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}
