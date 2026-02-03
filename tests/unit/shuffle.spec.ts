import shuffleArray from "../../src/utils/shuffle";

describe("shuffleArray", () => {
  it("does not mutate the original array", () => {
    const arr = [1, 2, 3, 4];
    const copy = [...arr];
    shuffleArray(arr);
    expect(arr).toEqual(copy);
  });

  it("returns all elements in some order", () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
  });
});
