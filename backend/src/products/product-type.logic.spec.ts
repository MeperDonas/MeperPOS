import { MovementType, ProductType } from '@prisma/client';
import {
  isLowStock,
  normalizeStockForType,
  resolveInitialStockMovement,
  resolveStockDeltaMovement,
  tracksStock,
} from './product-type.logic';

/**
 * The whole point of this module is that a service is not merchandise: it must never
 * be counted as stocked, never be blocked by a stock rule and never move the kárdex.
 * Every stock decision in the codebase has to route through these five functions, so
 * this spec is the single place where the rule is pinned.
 */
describe('product-type.logic — the single stock-decision authority', () => {
  describe('tracksStock', () => {
    it('tracks stock for a physical product', () => {
      expect(tracksStock(ProductType.PRODUCT)).toBe(true);
    });

    it('never tracks stock for a service', () => {
      expect(tracksStock(ProductType.SERVICE)).toBe(false);
    });
  });

  describe('normalizeStockForType', () => {
    it('forces a service to zero regardless of the stored stock', () => {
      expect(normalizeStockForType(ProductType.SERVICE, 9996)).toBe(0);
    });

    it('leaves a product stock untouched', () => {
      expect(normalizeStockForType(ProductType.PRODUCT, 42)).toBe(42);
    });

    it('leaves a zero-stock product untouched', () => {
      expect(normalizeStockForType(ProductType.PRODUCT, 0)).toBe(0);
    });
  });

  describe('resolveInitialStockMovement', () => {
    it('records no opening movement for a service, even with an invented stock', () => {
      expect(resolveInitialStockMovement(ProductType.SERVICE, 9996)).toBeNull();
    });

    it('records the opening PURCHASE movement for a product', () => {
      expect(resolveInitialStockMovement(ProductType.PRODUCT, 10)).toEqual({
        type: MovementType.PURCHASE,
        quantity: 10,
      });
    });

    it('records no opening movement for a product created with zero stock', () => {
      expect(resolveInitialStockMovement(ProductType.PRODUCT, 0)).toBeNull();
    });
  });

  describe('isLowStock', () => {
    it('never reports a service as low on stock, even at zero against a positive minimum', () => {
      expect(isLowStock(ProductType.SERVICE, 0, 5)).toBe(false);
    });

    it('never reports a service as low on stock at the zero/zero boundary', () => {
      expect(isLowStock(ProductType.SERVICE, 0, 0)).toBe(false);
    });

    it('reports a product at zero against a positive minimum', () => {
      expect(isLowStock(ProductType.PRODUCT, 0, 5)).toBe(true);
    });

    it('reports a product exactly at the minimum (the boundary is inclusive)', () => {
      expect(isLowStock(ProductType.PRODUCT, 5, 5)).toBe(true);
    });

    it('does not report a product above the minimum', () => {
      expect(isLowStock(ProductType.PRODUCT, 6, 5)).toBe(false);
    });
  });

  describe('resolveStockDeltaMovement', () => {
    it('records no movement when a service stock drops', () => {
      expect(resolveStockDeltaMovement(ProductType.SERVICE, 10, 0)).toBeNull();
    });

    it('records no movement when a service stock rises', () => {
      expect(resolveStockDeltaMovement(ProductType.SERVICE, 0, 10)).toBeNull();
    });

    it('records an ADJUSTMENT_IN when a product stock rises', () => {
      expect(resolveStockDeltaMovement(ProductType.PRODUCT, 5, 10)).toBe(
        MovementType.ADJUSTMENT_IN,
      );
    });

    it('records an ADJUSTMENT_OUT when a product stock drops', () => {
      expect(resolveStockDeltaMovement(ProductType.PRODUCT, 10, 5)).toBe(
        MovementType.ADJUSTMENT_OUT,
      );
    });

    it('records no movement when a product stock is unchanged', () => {
      expect(resolveStockDeltaMovement(ProductType.PRODUCT, 10, 10)).toBeNull();
    });
  });
});
