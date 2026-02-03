import { formatPhoneNumber, extractPhoneDigits } from "../../src/utils/phoneUtils";

describe("phoneUtils", () => {
  it("formats partial and full phone numbers", () => {
    expect(formatPhoneNumber("555")).toBe("(555");
    expect(formatPhoneNumber("5551234")).toBe("(555) 123-4");
    expect(formatPhoneNumber("5551234567")).toBe("(555) 123-4567");
  });

  it("truncates to 10 digits", () => {
    expect(formatPhoneNumber("555123456789")).toBe("(555) 123-4567");
  });

  it("extracts digits from formatted numbers", () => {
    const raw = extractPhoneDigits("(555) 123-4567");
    expect(raw).toBe("5551234567");
  });
});
