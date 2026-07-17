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

/** Парсить "567/" або "567а" → { num: 567, suffix: "/" } */
export function parseOrderNum(raw: string): { num: number | undefined; suffix: string } {
  const m = raw.trim().match(/^(\d+)(.*)$/);
  if (!m) return { num: undefined, suffix: '' };
  return { num: Number(m[1]), suffix: m[2] };
}
