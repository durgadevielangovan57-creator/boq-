// Common estimator utilities: unit conversions and simple construction formulas

export function inchesToFeet(inches: number): number {
  return inches / 12;
}

export function sqftFromInches(widthInInches: number, heightInInches: number): number {
  const w = inchesToFeet(widthInInches);
  const h = inchesToFeet(heightInInches);
  return w * h;
}

export function perimeterFeet(widthInInches: number, heightInInches: number): number {
  const w = inchesToFeet(widthInInches);
  const h = inchesToFeet(heightInInches);
  return 2 * (w + h);
}

/**
 * Estimate frame length in feet for a door (outer frame length)
 * Uses perimeter in feet.
 */
export function frameLengthFeet(widthInInches: number, heightInInches: number): number {
  return perimeterFeet(widthInInches, heightInInches);
}

// Legacy helpers that match the original estimator formulas so refactors
// can use utilities without changing numeric behavior.

/**
 * Door frame length in feet using legacy formula from estimator: 2*height + width
 * Input expects dimensions in feet.
 */
export function doorFrameLengthLegacyFeet(heightFeet: number, widthFeet: number): number {
  return 2 * heightFeet + widthFeet;
}

/**
 * Legacy glass area calculation used by existing estimator code.
 * The original estimator used `(gh * gw) / 9` for sqft; preserve that here.
 * Inputs are in inches.
 */
export function glassAreaLegacySqft(glassHeightInInches: number, glassWidthInInches: number): number {
  return (glassHeightInInches * glassWidthInInches) / 9;
}

/**
 * Legacy glass perimeter in feet as used by estimator: 2*(gh + gw)/12
 * Inputs are in inches.
 */
export function glassPerimeterLegacyFeet(glassHeightInInches: number, glassWidthInInches: number): number {
  return 2 * (glassHeightInInches + glassWidthInInches) / 12;
}

/**
 * Simple hinge count estimator: at least 2 hinges, then roughly one hinge per 30 inches of height.
 */
export function hingeCount(heightInInches: number): number {
  const count = Math.max(2, Math.ceil(heightInInches / 30));
  return count;
}

export function roundTwo(n: number): number {
  return Math.round(n * 100) / 100;
}

export default {
  inchesToFeet,
  sqftFromInches,
  perimeterFeet,
  frameLengthFeet,
  hingeCount,
  roundTwo,
};
