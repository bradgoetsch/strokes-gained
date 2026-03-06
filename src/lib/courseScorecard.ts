/**
 * Course Scorecard types and utilities for kind 34477 events.
 */

export interface HolePar {
  number: number;
  par: number;
  strokeIndex?: number; // handicap stroke index 1–18
}

export interface TeeInfo {
  name: string;        // e.g. "Blue", "White", "Red"
  gender?: string;     // "M" | "F" | "N"
  courseRating: number;
  slopeRating: number;
  yardage?: number;
}

export interface CourseScorecard {
  /** Normalized slug used as the Nostr `d` tag */
  slug: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  holes: HolePar[];
  tees: TeeInfo[];
  /** Nostr pubkey of the publisher */
  publishedBy?: string;
  /** Unix timestamp of last update */
  updatedAt?: number;
}

export const COURSE_SCORECARD_KIND = 34477;

/** Convert a course name to a URL-safe slug for the `d` tag */
export function courseSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Create a default par array (all par 4) for 9 or 18 holes */
export function defaultHoles(count: 9 | 18 = 18): HolePar[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    par: 4,
  }));
}

/** Total par from a holes array */
export function totalPar(holes: HolePar[]): number {
  return holes.reduce((s, h) => s + h.par, 0);
}

/** Build Nostr event tags for a course scorecard */
export function buildScorecardTags(card: CourseScorecard): string[][] {
  const tags: string[][] = [
    ['d', card.slug],
    ['alt', `Golf course scorecard: ${card.name}`],
    ['name', card.name],
    ['holes', JSON.stringify(card.holes)],
    ['tees', JSON.stringify(card.tees)],
    ['t', 'golf'],
    ['t', 'golf-course'],
  ];
  if (card.city) tags.push(['city', card.city]);
  if (card.state) tags.push(['state', card.state]);
  if (card.country) tags.push(['country', card.country]);
  return tags;
}
