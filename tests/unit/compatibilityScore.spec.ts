import { computeCompatibilityScore } from "../../src/utils/compatibilityScore";

describe("computeCompatibilityScore", () => {
  it("clamps distance to 0-1000 and rewards close distance", () => {
    const base = {
      mySex: "male" as const,
      theirSex: "female" as const,
      myPreference: "female" as const,
      theirPreference: "male" as const,
      sharedInterests: [],
    };

    const near = computeCompatibilityScore({
      ...base,
      distanceMiles: 0,
    });
    const far = computeCompatibilityScore({
      ...base,
      distanceMiles: 2000, // should clamp at 1000
    });

    expect(near).toBeGreaterThan(far);
    expect(far).toBeLessThanOrEqual(100);
  });

  it("adds points for matching dating preference", () => {
    const input = {
      mySex: "male" as const,
      theirSex: "female" as const,
      myPreference: "female" as const,
      theirPreference: "male" as const,
      distanceMiles: 10,
      sharedInterests: [],
      myDatingPreference: "long_term_relationship",
      theirDatingPreference: "long_term_relationship",
    };

    const score = computeCompatibilityScore(input);
    expect(score).toBeGreaterThan(0);
  });

  it("caps total score at 100 even with many interests", () => {
    const input = {
      mySex: "male" as const,
      theirSex: "female" as const,
      myPreference: "female" as const,
      theirPreference: "male" as const,
      distanceMiles: 1,
      sharedInterests: Array.from({ length: 30 }).map((_, i) => `interest-${i}`),
    };
    const score = computeCompatibilityScore(input);
    expect(score).toBeLessThanOrEqual(100);
  });
});
