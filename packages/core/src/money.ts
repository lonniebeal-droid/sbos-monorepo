/**
 * Money helpers shared across billing services. Amounts are handled in whole
 * cents of precision; persistence uses Decimal(12,2).
 */

/** Round a monetary value to two decimal places (cents). */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
