/**
 * Rounds a financial value to 2 decimal places using IEEE 754-safe math.
 * Plain Math.round(x * 100) / 100 fails for values like 0.825 because
 * float multiplication gives 82.4999... instead of 82.5.
 * Adding 1e-7 (smaller than any financial precision, larger than any FP error)
 * fixes the drift without affecting genuine rounding boundaries.
 */
export function r2(value: number): number {
  return Math.round(value * 100 + 1e-7) / 100;
}

export function addVat(amount: number): number {
  return r2(amount * 1.2);
}

export function removeVat(amountWithVat: number): number {
  return Number((amountWithVat / 1.2).toFixed(2));
}

export function calcVat(amountWithVat: number): number {
  return Number((amountWithVat - removeVat(amountWithVat)).toFixed(2));
}
