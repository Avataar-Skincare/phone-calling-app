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
    expect(claimMessage(base)).toEqual({ text: "Lead moved to you from Rahul.", tone: "accent" });
  });

  it("claimed without a previous owner name", () => {
    expect(claimMessage({ ...base, previous_owner_name: null }).text).toBe("Lead moved to you.");
  });

  it.each([
    ["created", "New lead. It is now yours.", "accent"],
    ["already_owner", "This lead is already yours.", "accent"],
    ["no_opportunity", "No Sales lead for this number. Owner not changed.", "amber"],
  ] as const)("%s", (status, text, tone) => {
    expect(claimMessage({ ...base, status })).toEqual({ text, tone });
  });

  it("not_sales names the caller's department", () => {
    expect(claimMessage({ ...base, status: "not_sales" }, "Central")).toEqual({
      text: "You are a Central user. Only Sales users can change the owner by manual dialing.",
      tone: "amber",
    });
  });

  it("not_sales without a department label", () => {
    expect(claimMessage({ ...base, status: "not_sales" }).text).toBe(
      "You are not a Sales user. Only Sales users can change the owner by manual dialing.",
    );
  });

  it("error / timeout", () => {
    expect(claimMessage("error")).toEqual({
      text: "Could not reach Compass. Calling now. Owner not changed.",
      tone: "red",
    });
  });

  it("an unknown status still gives a message", () => {
    expect(claimMessage({ ...base, status: "weird" as never })).toEqual({
      text: "Calling now. Owner not changed.",
      tone: "amber",
    });
  });
});
