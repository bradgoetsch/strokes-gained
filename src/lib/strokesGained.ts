/**
 * Strokes Gained Calculation Engine
 *
 * Based on PGA Tour / Mark Broadie research data.
 * "Every Shot Counts" by Mark Broadie is the source for this methodology.
 *
 * Strokes Gained = (Baseline shots from start) - (Baseline shots from end) - 1
 * A positive SG means you gained on the field. Negative means you lost strokes.
 */

export type ShotSurface = 'tee' | 'fairway' | 'rough' | 'sand' | 'recovery' | 'green';

export interface Shot {
  id: string;
  /** Distance to hole in yards at start of shot */
  distanceToHole: number;
  /** Surface at start of shot */
  surface: ShotSurface;
  /** Whether the shot resulted in holing out */
  holed: boolean;
  /** Distance to hole after shot (0 if holed) */
  distanceAfter?: number;
  /** Surface after shot */
  surfaceAfter?: ShotSurface;
  /** Calculated strokes gained value */
  strokesGained?: number;
  /** Category of this shot */
  category?: SGCategory;
}

export interface HoleData {
  number: number;
  par: number;
  shots: Shot[];
  totalSG?: number;
}

export interface RoundData {
  id: string;
  date: string;
  courseName: string;
  /** Tee played (e.g. "Blue", "White") */
  teeName?: string;
  /** USGA course rating for the tee played */
  courseRating?: number;
  /** USGA slope rating for the tee played */
  slopeRating?: number;
  /** WHS handicap differential for this round */
  handicapDifferential?: number;
  holes: HoleData[];
  /** Computed totals */
  sg: {
    offTheTee: number;
    approach: number;
    aroundGreen: number;
    putting: number;
    total: number;
  };
  totalStrokes: number;
  totalPar: number;
}

export type SGCategory = 'ott' | 'approach' | 'arg' | 'putting';

/**
 * PGA Tour baseline strokes-to-hole data.
 * Source: Derived from Mark Broadie's research and PGA Tour ShotLink data.
 *
 * Format: [distance_yards, avg_strokes_to_hole]
 */

// Putting (on green) - distance in FEET
const PUTTING_BASELINE: [number, number][] = [
  [1, 1.005],
  [2, 1.010],
  [3, 1.030],
  [4, 1.065],
  [5, 1.110],
  [6, 1.162],
  [7, 1.218],
  [8, 1.274],
  [9, 1.328],
  [10, 1.380],
  [12, 1.466],
  [14, 1.541],
  [16, 1.606],
  [18, 1.660],
  [20, 1.706],
  [25, 1.790],
  [30, 1.853],
  [40, 1.946],
  [50, 2.005],
  [60, 2.049],
  [75, 2.100],
  [100, 2.165],
];

// From fairway - distance in YARDS
const FAIRWAY_BASELINE: [number, number][] = [
  [10, 2.40],
  [20, 2.55],
  [30, 2.68],
  [40, 2.79],
  [50, 2.88],
  [75, 3.04],
  [100, 3.17],
  [125, 3.28],
  [150, 3.38],
  [175, 3.49],
  [200, 3.60],
  [225, 3.71],
  [250, 3.82],
  [275, 3.94],
  [300, 4.06],
  [350, 4.28],
  [400, 4.50],
  [450, 4.71],
  [500, 4.89],
  [550, 5.05],
  [600, 5.18],
];

// From rough - distance in YARDS
const ROUGH_BASELINE: [number, number][] = [
  [10, 2.50],
  [20, 2.66],
  [30, 2.80],
  [40, 2.92],
  [50, 3.02],
  [75, 3.18],
  [100, 3.30],
  [125, 3.42],
  [150, 3.53],
  [175, 3.64],
  [200, 3.76],
  [225, 3.88],
  [250, 4.01],
  [275, 4.14],
  [300, 4.27],
  [350, 4.52],
  [400, 4.74],
  [450, 4.95],
  [500, 5.13],
  [550, 5.29],
  [600, 5.43],
];

// From sand/bunker - distance in YARDS
const SAND_BASELINE: [number, number][] = [
  [5, 2.60],
  [10, 2.72],
  [15, 2.83],
  [20, 2.94],
  [30, 3.10],
  [40, 3.23],
  [50, 3.35],
  [75, 3.58],
  [100, 3.76],
  [125, 3.93],
  [150, 4.07],
  [175, 4.22],
  [200, 4.37],
  [225, 4.52],
  [250, 4.68],
  [300, 4.98],
];

// From tee (par 4/5 drives)
const TEE_BASELINE: [number, number][] = [
  [100, 3.15],
  [150, 3.28],
  [200, 3.40],
  [250, 3.52],
  [300, 3.65],
  [350, 3.79],
  [400, 3.93],
  [450, 4.09],
  [500, 4.26],
  [550, 4.44],
  [600, 4.62],
];

// Recovery (trees, hazards, unusual lies)
const RECOVERY_BASELINE: [number, number][] = [
  [10, 2.75],
  [20, 2.92],
  [30, 3.06],
  [50, 3.25],
  [75, 3.50],
  [100, 3.68],
  [150, 3.90],
  [200, 4.14],
  [250, 4.40],
  [300, 4.65],
];

/** Linear interpolation between two points */
function interpolate(
  x: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  if (x2 === x1) return y1;
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

/** Look up baseline strokes from a table using linear interpolation */
function lookupBaseline(distance: number, table: [number, number][]): number {
  if (distance <= 0) return 0;

  // Clamp to table range
  if (distance <= table[0][0]) return table[0][1];
  if (distance >= table[table.length - 1][0]) return table[table.length - 1][1];

  // Find surrounding entries
  for (let i = 0; i < table.length - 1; i++) {
    const [d1, s1] = table[i];
    const [d2, s2] = table[i + 1];
    if (distance >= d1 && distance <= d2) {
      return interpolate(distance, d1, s1, d2, s2);
    }
  }

  return table[table.length - 1][1];
}

/**
 * Get baseline average strokes to hole from a given position
 * @param distance - distance in yards (or feet for putting)
 * @param surface - current surface
 */
export function getBaselineStrokes(distance: number, surface: ShotSurface): number {
  switch (surface) {
    case 'green':
      // Distance in feet for putting
      return lookupBaseline(distance, PUTTING_BASELINE);
    case 'tee':
      return lookupBaseline(distance, TEE_BASELINE);
    case 'fairway':
      return lookupBaseline(distance, FAIRWAY_BASELINE);
    case 'rough':
      return lookupBaseline(distance, ROUGH_BASELINE);
    case 'sand':
      return lookupBaseline(distance, SAND_BASELINE);
    case 'recovery':
      return lookupBaseline(distance, RECOVERY_BASELINE);
    default:
      return lookupBaseline(distance, FAIRWAY_BASELINE);
  }
}

/**
 * Calculate strokes gained for a single shot
 * SG = Start_Baseline - End_Baseline - 1
 */
export function calculateShotSG(shot: Shot): number {
  const startBaseline = getBaselineStrokes(shot.distanceToHole, shot.surface);

  let endBaseline = 0;
  if (!shot.holed && shot.distanceAfter !== undefined && shot.surfaceAfter) {
    endBaseline = getBaselineStrokes(shot.distanceAfter, shot.surfaceAfter);
  }

  return startBaseline - endBaseline - 1;
}

/**
 * Determine category for a shot
 */
export function getShotCategory(shot: Shot): SGCategory {
  if (shot.surface === 'green') return 'putting';
  if (shot.surface === 'tee') return 'ott';

  // Approach: shots from > 30 yards that land on green or within 30 yards
  if (
    shot.surface === 'fairway' ||
    shot.surface === 'rough' ||
    shot.surface === 'sand' ||
    shot.surface === 'recovery'
  ) {
    const distYards = shot.distanceToHole;
    if (distYards > 30) return 'approach';
    return 'arg'; // Around the green
  }

  return 'approach';
}

/**
 * Calculate all strokes gained for a hole
 */
export function calculateHoleSG(hole: HoleData): HoleData {
  const processedShots = hole.shots.map((shot) => {
    const sg = calculateShotSG(shot);
    const category = getShotCategory(shot);
    return { ...shot, strokesGained: sg, category };
  });

  const totalSG = processedShots.reduce((sum, s) => sum + (s.strokesGained ?? 0), 0);

  return { ...hole, shots: processedShots, totalSG };
}

/**
 * Calculate SG totals for a full round
 */
export function calculateRoundSG(holes: HoleData[]): RoundData['sg'] {
  let offTheTee = 0;
  let approach = 0;
  let aroundGreen = 0;
  let putting = 0;

  for (const hole of holes) {
    for (const shot of hole.shots) {
      if (shot.strokesGained === undefined) continue;
      const cat = shot.category ?? getShotCategory(shot);
      switch (cat) {
        case 'ott': offTheTee += shot.strokesGained; break;
        case 'approach': approach += shot.strokesGained; break;
        case 'arg': aroundGreen += shot.strokesGained; break;
        case 'putting': putting += shot.strokesGained; break;
      }
    }
  }

  return {
    offTheTee: parseFloat(offTheTee.toFixed(2)),
    approach: parseFloat(approach.toFixed(2)),
    aroundGreen: parseFloat(aroundGreen.toFixed(2)),
    putting: parseFloat(putting.toFixed(2)),
    total: parseFloat((offTheTee + approach + aroundGreen + putting).toFixed(2)),
  };
}

/** Format a strokes gained value for display */
export function formatSG(value: number): string {
  if (value > 0) return `+${value.toFixed(2)}`;
  return value.toFixed(2);
}

/** Get a color class based on SG value */
export function sgColorClass(value: number): string {
  if (value > 0.5) return 'text-emerald-600 dark:text-emerald-400';
  if (value > 0) return 'text-green-600 dark:text-green-400';
  if (value > -0.5) return 'text-orange-500 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

/** Get a bg color class for SG bars */
export function sgBarColor(value: number): string {
  if (value > 0) return 'bg-emerald-500';
  return 'bg-red-500';
}

export const SG_CATEGORY_LABELS: Record<SGCategory, string> = {
  ott: 'Off the Tee',
  approach: 'Approach',
  arg: 'Around Green',
  putting: 'Putting',
};

export const SG_CATEGORY_ICONS: Record<SGCategory, string> = {
  ott: '🏌️',
  approach: '🎯',
  arg: '🪄',
  putting: '⛳',
};

export const SURFACE_LABELS: Record<ShotSurface, string> = {
  tee: 'Tee',
  fairway: 'Fairway',
  rough: 'Rough',
  sand: 'Sand/Bunker',
  recovery: 'Recovery',
  green: 'Green (Putting)',
};
