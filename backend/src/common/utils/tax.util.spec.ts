import { resolveEffectiveTaxRate } from './tax.util';
import { Decimal } from '@prisma/client/runtime/library';

describe('resolveEffectiveTaxRate(product, category)', () => {
  describe('product opted-in (taxable=true) takes precedence', () => {
    it('returns the product rate when both product and category are opted in', () => {
      const product = { taxable: true, taxRate: 5 };
      const category = { taxable: true, defaultTaxRate: 16 };
      expect(resolveEffectiveTaxRate(product, category)).toBe(5);
    });

    it('returns the product rate even when the category is opted in with a different rate', () => {
      const product = { taxable: true, taxRate: new Decimal('8.5') };
      const category = { taxable: true, defaultTaxRate: 16 };
      expect(resolveEffectiveTaxRate(product, category)).toBe(8.5);
    });
  });

  describe('category opted-in fallback', () => {
    it('returns the category defaultTaxRate when the product is not opted in', () => {
      const product = { taxable: false, taxRate: 0 };
      const category = { taxable: true, defaultTaxRate: 16 };
      expect(resolveEffectiveTaxRate(product, category)).toBe(16);
    });

    it('accepts a Decimal category rate', () => {
      const product = { taxable: false, taxRate: 0 };
      const category = { taxable: true, defaultTaxRate: new Decimal('10.5') };
      expect(resolveEffectiveTaxRate(product, category)).toBe(10.5);
    });
  });

  describe('no tax by default (opt-in only)', () => {
    it('returns 0 when neither product nor category is opted in', () => {
      const product = { taxable: false, taxRate: 0 };
      const category = { taxable: false, defaultTaxRate: 0 };
      expect(resolveEffectiveTaxRate(product, category)).toBe(0);
    });

    it('returns 0 when the category is opted in but has no rate', () => {
      const product = { taxable: false, taxRate: 0 };
      const category = { taxable: true, defaultTaxRate: null };
      expect(resolveEffectiveTaxRate(product, category)).toBe(0);
    });

    it('returns 0 when the category is null', () => {
      const product = { taxable: false, taxRate: 0 };
      expect(resolveEffectiveTaxRate(product, null)).toBe(0);
    });
  });

  describe('defensive: opted-in without a usable rate', () => {
    it('falls back to the category when the product is opted in but has no rate', () => {
      const product = { taxable: true, taxRate: null };
      const category = { taxable: true, defaultTaxRate: 16 };
      expect(resolveEffectiveTaxRate(product, category)).toBe(16);
    });

    it('returns 0 when the product is opted in with rate 0 and category is not opted in', () => {
      const product = { taxable: true, taxRate: 0 };
      const category = { taxable: false, defaultTaxRate: 0 };
      expect(resolveEffectiveTaxRate(product, category)).toBe(0);
    });
  });
});
