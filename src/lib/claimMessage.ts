import type { ClaimResult } from "@/api/mobileDialer";

export type ClaimTone = "accent" | "amber" | "red";

/** What the keypad says about the claim. "error" covers failures and the 3 s cap. */
export function claimMessage(result: ClaimResult | "error"): { text: string; tone: ClaimTone } {
  if (result === "error") {
    return { text: "Couldn't reach Compass — calling anyway, lead not moved", tone: "red" };
  }
  switch (result.status) {
    case "claimed":
      return {
        text: `Moved to you from ${result.previous_owner_name ?? "another agent"}`,
        tone: "accent",
      };
    case "created":
      return { text: "New lead created and assigned to you", tone: "accent" };
    case "already_owner":
      return { text: "This lead is already yours", tone: "accent" };
    case "no_opportunity":
      return { text: "No Sales opportunity for this number — not moved", tone: "amber" };
    case "not_sales":
      return { text: "Only Sales can take leads — calling without moving it", tone: "amber" };
    default:
      // A status this app doesn't know yet: the call still goes ahead.
      return { text: "Calling — Compass gave an unexpected reply, lead not moved", tone: "amber" };
  }
}
