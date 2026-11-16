/// <reference types="jest" />
import { dialTarget, pressKey, sanitizeDialInput } from "./dialInput";

describe("sanitizeDialInput", () => {
  it("keeps digits, spacing and a leading +", () => {
    expect(sanitizeDialInput("+91 98711-07094")).toBe("+91 98711-07094");
  });

  it("drops invisible bidi marks from a WhatsApp paste", () => {
    expect(sanitizeDialInput("‪+91 98711 07094‬")).toBe("+91 98711 07094");
    expect(sanitizeDialInput("‎9871107094‏")).toBe("9871107094");
  });

  it("drops letters and a + that isn't first", () => {
    expect(sanitizeDialInput("call 98711+07094")).toBe("9871107094");
  });

  it("limits the length", () => {
    expect(sanitizeDialInput("9".repeat(40))).toHaveLength(20);
  });
});

describe("pressKey", () => {
  it("appends digits and removes the last character", () => {
    expect(pressKey("98", "7")).toBe("987");
    expect(pressKey("987", "back")).toBe("98");
    expect(pressKey("", "back")).toBe("");
  });

  it("allows + only as the first key", () => {
    expect(pressKey("", "+")).toBe("+");
    expect(pressKey("98", "+")).toBe("98");
  });
});

describe("dialTarget", () => {
  const expected = { e164: "+919871107094", display: "+91 98711 07094" };

  it.each([
    "+91 98711-07094",
    "09871107094",
    "919871107094",
    "9871107094",
    "‪+91 98711 07094‬",
    "(98711) 07094",
  ])("accepts %s", (input) => {
    expect(dialTarget(input)).toEqual(expected);
  });

  it("keeps an international number", () => {
    expect(dialTarget("+971 50 123 4567")).toEqual({ e164: "+971501234567", display: "+971501234567" });
  });

  it.each(["", "98765", "5871107094", "+", "abc"])("rejects %j", (input) => {
    expect(dialTarget(input)).toBeNull();
  });
});
