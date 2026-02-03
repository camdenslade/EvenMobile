import { normalizePhotos } from "../../src/utils/photoUtils";

describe("normalizePhotos", () => {
  it("filters empty entries and returns valid photos", () => {
    const res = normalizePhotos(["https://ok", "", "  ", null as any, undefined as any]);
    expect(res).toEqual(["https://ok"]);
  });

  it("falls back to provided fallback when no valid photos", () => {
    const res = normalizePhotos([], "https://fallback");
    expect(res).toEqual(["https://fallback"]);
  });

  it("returns empty array when nothing valid", () => {
    expect(normalizePhotos(null)).toEqual([]);
    expect(normalizePhotos([], "")).toEqual([]);
  });
});
