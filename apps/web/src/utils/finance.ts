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
