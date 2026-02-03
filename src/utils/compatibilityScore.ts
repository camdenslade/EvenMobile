//********************************************************************
//
// Compatibility Score Utility
//
// Computes a compatibility score based on preferences, distance,
// and shared interests. Used for sorting swipe queues client-side.
//
//********************************************************************

export interface CompatibilityInput {
  mySex: 'male' | 'female';
  theirSex: 'male' | 'female';
  myPreference: 'male' | 'female' | 'everyone';
  theirPreference: 'male' | 'female' | 'everyone';
  distanceMiles: number;
  sharedInterests: string[];
  myDatingPreference?: string;
  theirDatingPreference?: string;
}

export function computeCompatibilityScore(input: CompatibilityInput): number {
  let score = 0;

  // Clamp distance for scoring (0-1000 miles)
  const distance = Math.min(Math.max(input.distanceMiles, 0), 1000);

  // Dating preference match (0-30 points)
  if (input.myDatingPreference && input.theirDatingPreference) {
    if (input.myDatingPreference === input.theirDatingPreference) {
      score += 30;
    } else {
      const compatible = [
        ['hookups', 'situationship'],
        ['short_term_relationship', 'short_term_open'],
        ['long_term_relationship', 'long_term_open'],
      ];
      const isCompatible = compatible.some(
        (pair) =>
          pair.includes(input.myDatingPreference!) &&
          pair.includes(input.theirDatingPreference!),
      );
      if (isCompatible) {
        score += 15;
      }
    }
  }

  // Shared interests (0-40 points)
  const interestScore = Math.min(40, input.sharedInterests.length * 5);
  score += interestScore;

  // Distance (0-30 points) - closer is better
  const distScore = Math.max(0, 30 - distance / 2);
  score += distScore;

  return Math.min(100, score);
}
