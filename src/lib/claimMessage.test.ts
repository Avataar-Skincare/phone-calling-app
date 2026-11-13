/// <reference types="jest" />
import type { ClaimResult } from "@/api/mobileDialer";
import { claimMessage } from "./claimMessage";

const base: ClaimResult = {
  status: "claimed",
  lead_id: "501",
  lead_name: "Asha Rao",
  lead_created: false,
  opportunity_id: "7001",
  previous_owner_user_id: "12",
  previous_owner_name: "Rahul",
  changed: true,
};

describe("claimMessage", () => {
  it("claimed names the previous owner", () => {
    expect(claimMessage(base)).toEqual({ text: "Moved to you from Rahul", tone: "accent" });
  });

  it("claimed without a previous owner name", () => {
    expect(claimMessage({ ...base, previous_owner_name: null }).text).toBe("Moved to you from another agent");
  });

  it.each([
    ["created", "New lead created and assigned to you", "accent"],
    ["already_owner", "This lead is already yours", "accent"],
    ["no_opportunity", "No Sales opportunity for this number — not moved", "amber"],
    ["not_sales", "Only Sales can take leads — calling without moving it", "amber"],
  ] as const)("%s", (status, text, tone) => {
    expect(claimMessage({ ...base, status })).toEqual({ text, tone });
  });

  it("error / timeout", () => {
    expect(claimMessage("error")).toEqual({
      text: "Couldn't reach Compass — calling anyway, lead not moved",
      tone: "red",
    });
  });

  it("an unknown status still gives a message", () => {
    expect(claimMessage({ ...base, status: "weird" as never }).tone).toBe("amber");
  });
});
