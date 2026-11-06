/// <reference types="jest" />
import { formatPhone, maskPhone, toE164, toIndianMobile, whatsAppUrl } from "./phone";

describe("toIndianMobile (login input)", () => {
  it.each([
    ["9871107094", "9871107094"],
    ["98711 07094", "9871107094"],
    ["+91 98711-07094", "9871107094"],
    ["919871107094", "9871107094"],
    ["09871107094", "9871107094"],
  ])("accepts %s", (input, expected) => {
    expect(toIndianMobile(input)).toBe(expected);
  });

  it.each([
    ["5871107094", "starts with 5"],
    ["987110709", "9 digits"],
    ["", "empty"],
    ["98711070941", "11 digits without a 0 prefix"],
  ])("rejects %s (%s)", (input) => {
    expect(toIndianMobile(input)).toBeNull();
  });
});

describe("toE164 (dialing)", () => {
  it("adds +91 to a 10-digit Indian mobile", () => {
    expect(toE164("9871107094")).toBe("+919871107094");
    expect(toE164("919871107094")).toBe("+919871107094");
  });

  it("keeps an international number", () => {
    expect(toE164("+971501234567")).toBe("+971501234567");
    expect(toE164("971501234567")).toBe("+971501234567");
  });

  it("returns null when it can't be dialed", () => {
    expect(toE164("12345")).toBeNull();
    expect(toE164(null)).toBeNull();
    expect(toE164(undefined)).toBeNull();
    expect(toE164("   ")).toBeNull();
  });
});

describe("maskPhone (lists)", () => {
  it("shows the first 2 and last 3 digits", () => {
    expect(maskPhone("9871107094")).toBe("98•••••094");
    expect(maskPhone("919871107094")).toBe("98•••••094");
  });

  it("handles a missing number", () => {
    expect(maskPhone(null)).toBe("No number");
  });
});

describe("formatPhone (lead screen)", () => {
  it("groups an Indian number", () => {
    expect(formatPhone("9871107094")).toBe("+91 98711 07094");
  });

  it("leaves other numbers in E.164", () => {
    expect(formatPhone("+971501234567")).toBe("+971501234567");
  });

  it("says when there is no number", () => {
    expect(formatPhone(undefined)).toBe("No number");
  });
});

describe("whatsAppUrl (WhatsApp button)", () => {
  it.each([
    ["9876500001", "https://wa.me/919876500001"],
    ["+91 98765 00001", "https://wa.me/919876500001"],
    ["09876500001", "https://wa.me/919876500001"],
    ["+14155550123", "https://wa.me/14155550123"],
    ["12345", null],
    [null, null],
  ])("%s → %s", (input, out) => {
    expect(whatsAppUrl(input)).toBe(out);
  });
});
