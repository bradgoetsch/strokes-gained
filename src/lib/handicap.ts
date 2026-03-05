/**
 * World Handicap System (WHS) Handicap Index Calculator
 *
 * Formula:
 *   Differential = (Adjusted Gross Score − Course Rating) × 113 / Slope Rating
 *   Handicap Index = Average of best 8 from last 20 differentials × 0.96
 *
 * This is mathematically identical to the USGA/GHIN calculation.
 * It is NOT an official USGA handicap and cannot be used for sanctioned play.
 *
 * Reference: https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system.html
 */

export interface HandicapRound {
  score: number;
  courseRating: number;
  slopeRating: number;
  date: string;
}

/** Standard slope used in differential formula */
const STANDARD_SLOPE = 113;

/** Calculate a single handicap differential */
export function calcDifferential(
  score: number,
  courseRating: number,
  slopeRating: number
): number {
  return ((score - courseRating) * STANDARD_SLOPE) / slopeRating;
}

/**
 * Calculate handicap index from an array of rounds.
 * Uses the WHS table for how many differentials to use based on round count.
 * Returns null if fewer than 3 rounds with rating/slope data.
 */
export function calcHandicapIndex(rounds: HandicapRound[]): number | null {
  // Sort by date ascending
  const sorted = [...rounds].sort((a, b) => a.date.localeCompare(b.date));

  // Take last 20 (WHS window)
  const recent = sorted.slice(-20);

  if (recent.length < 3) return null;

  // Compute differentials
  const diffs = recent.map((r) =>
    calcDifferential(r.score, r.courseRating, r.slopeRating)
  );

  // WHS table: number of rounds → number of best differentials to use
  const count = diffs.length;
  let numBest: number;
  if (count < 6) numBest = 1;
  else if (count === 6) numBest = 2;
  else if (count === 7) numBest = 2;
  else if (count === 8) numBest = 2;
  else if (count === 9) numBest = 3;
  else if (count === 10) numBest = 3;
  else if (count === 11) numBest = 4;
  else if (count === 12) numBest = 4;
  else if (count === 13) numBest = 5;
  else if (count === 14) numBest = 5;
  else if (count === 15) numBest = 6;
  else if (count === 16) numBest = 6;
  else if (count === 17) numBest = 7;
  else if (count === 18) numBest = 7;
  else if (count === 19) numBest = 8;
  else numBest = 8; // 20 rounds

  // Sort diffs ascending, take the best (lowest) N
  const bestDiffs = [...diffs].sort((a, b) => a - b).slice(0, numBest);
  const avg = bestDiffs.reduce((s, d) => s + d, 0) / bestDiffs.length;

  // Apply 96% playing condition adjustment
  const index = avg * 0.96;

  // Cap at +8.0 to 54.0 per WHS
  return Math.min(54.0, parseFloat(index.toFixed(1)));
}

/**
 * Calculate course handicap from handicap index.
 * Course Handicap = Handicap Index × (Slope / 113) + (Course Rating − Par)
 */
export function calcCourseHandicap(
  handicapIndex: number,
  slopeRating: number,
  courseRating: number,
  par: number
): number {
  return Math.round(
    handicapIndex * (slopeRating / STANDARD_SLOPE) + (courseRating - par)
  );
}

/** Format handicap index for display (e.g. "+2.4", "18.5") */
export function formatHandicap(index: number): string {
  if (index < 0) return `+${Math.abs(index).toFixed(1)}`;
  return index.toFixed(1);
}
