import type { ClaimResult } from "@/api/mobileDialer";

export type ClaimTone = "accent" | "amber" | "red";

/**
 * What the keypad says about the claim, in simple words. "error" covers failures and the 3 s cap.
 * `departmentLabel` is the caller's department name from Compass (e.g. "Central").
 */
export function claimMessage(
  result: ClaimResult | "error",
  departmentLabel?: string | null,
): { text: string; tone: ClaimTone } {
  if (result === "error") {
    return { text: "Could not reach Compass. Calling now. Owner not changed.", tone: "red" };
  }
  switch (result.status) {
    case "claimed":
      return {
        text: result.previous_owner_name
          ? `Lead moved to you from ${result.previous_owner_name}.`
          : "Lead moved to you.",
        tone: "accent",
      };
    case "created":
      return { text: "New lead. It is now yours.", tone: "accent" };
    case "already_owner":
      return { text: "This lead is already yours.", tone: "accent" };
    case "no_opportunity":
      return { text: "No Sales lead for this number. Owner not changed.", tone: "amber" };
    case "not_sales": {
      const who = departmentLabel ? `a ${departmentLabel} user` : "not a Sales user";
      return {
        text: `You are ${who}. Only Sales users can change the owner by manual dialing.`,
        tone: "amber",
      };
    }
    default:
      // A status this app doesn't know yet: the call still goes ahead.
      return { text: "Calling now. Owner not changed.", tone: "amber" };
  }
}
