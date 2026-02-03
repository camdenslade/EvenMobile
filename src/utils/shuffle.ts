//********************************************************************
//
// shuffleArray Function
//
// Implements a generic, immutable array shuffle using the Fisher-Yates
// algorithm. Returns a new shuffled array without mutating the original.
// Ensures statistically-unbiased shuffle for any array type.
//
// Return Value
// ------------
// T[]    New array with elements in randomized order
//
// Value Parameters
// ----------------
// arr    T[]    Original array to shuffle
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// copy    T[]        Copy of original array
// i       number     Loop counter (backward iteration)
// j       number     Random index for swap
//
//*******************************************************************

export default function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}
