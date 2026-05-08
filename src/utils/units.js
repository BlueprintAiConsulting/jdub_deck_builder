/** Unit conversion helpers */

export function inchesToFeet(inches) {
  return inches / 12;
}

export function feetToInches(feet) {
  return feet * 12;
}

export function formatDimension(inches) {
  const feet = Math.floor(inches / 12);
  const remainingInches = Math.round(inches % 12);
  if (remainingInches === 0) return `${feet}'`;
  if (feet === 0) return `${remainingInches}"`;
  return `${feet}' ${remainingInches}"`;
}

export function formatDimensionFtOnly(inches) {
  return `${Math.round(inches / 12)} ft`;
}

export function sqftFromInches(widthIn, depthIn) {
  return Math.round((widthIn * depthIn) / 144);
}
