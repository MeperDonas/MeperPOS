import { Decimal } from '@prisma/client/runtime/library';

export interface TaxableProduct {
  taxable: boolean;
  taxRate?: number | Decimal | null;
}

export interface TaxableCategory {
  taxable: boolean;
  defaultTaxRate?: number | Decimal | null;
}

/**
 * Resolves the effective tax rate for a product using opt-in precedence:
 *
 *   1. Product opted-in (`taxable=true`) with a usable rate → product rate
 *   2. Category opted-in (`taxable=true`) with a usable rate → category rate
 *   3. Otherwise → 0 (no tax by default)
 *
 * Tax is opt-in only. There is no global rate and no magic-number fallback.
 *
 * @param product  - the product (needs `taxable` + `taxRate`)
 * @param category - the product's category (needs `taxable` + `defaultTaxRate`)
 * @returns        - the effective tax rate as a number
 */
export function resolveEffectiveTaxRate(
  product: TaxableProduct,
  category?: TaxableCategory | null,
): number {
  if (product.taxable) {
    const rate = toNumber(product.taxRate);
    if (rate > 0) return rate;
  }

  if (category?.taxable) {
    const rate = toNumber(category.defaultTaxRate);
    if (rate > 0) return rate;
  }

  return 0;
}

/**
 * Safely converts a Decimal or number to a plain JS number.
 * Returns 0 for null/undefined — an opted-in entity without a rate is
 * treated as "no rate".
 */
function toNumber(value: number | Decimal | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}
