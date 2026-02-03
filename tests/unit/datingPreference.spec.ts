import { getDatingPreferenceLabel } from "../../src/utils/datingPreference";

describe("getDatingPreferenceLabel", () => {
  it("returns age-aware label for situationship", () => {
    expect(getDatingPreferenceLabel("situationship", 20)).toBe("Situationship");
    expect(getDatingPreferenceLabel("situationship", 30)).toBe("Short-term Relationship");
  });

  it("returns correct label for other preferences", () => {
    expect(getDatingPreferenceLabel("hookups", 25)).toBe("Hookups Only");
    expect(getDatingPreferenceLabel("long_term_relationship", 25)).toBe("Long-term Relationship");
  });
});
