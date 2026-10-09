import {
  deriveInventoryLoanQuantities,
  InventoryLoanCounts,
  transitionInventoryLoanItem,
  validateInventoryLoanCounts,
} from './inventory-loan.invariants';

const initial: InventoryLoanCounts = {
  quantity: 10,
  deliveredQuantity: 0,
  returnedQuantity: 0,
  cancelledQuantity: 0,
};

describe('inventory loan pure accounting', () => {
  it('derives the initial reservation without a physical delivery', () => {
    expect(
      deriveInventoryLoanQuantities(Object.freeze({ ...initial })),
    ).toEqual({
      reservedRemaining: 10,
      outstanding: 0,
    });
  });

  it.each([undefined, null, {}, { quantity: 1 }])(
    'rejects missing counts: %p',
    (counts) => {
      expect(() =>
        validateInventoryLoanCounts(counts as InventoryLoanCounts),
      ).toThrow();
    },
  );

  it.each([
    'quantity',
    'deliveredQuantity',
    'returnedQuantity',
    'cancelledQuantity',
  ])('rejects invalid %s without coercion', (field) => {
    for (const invalid of [
      -1,
      0.5,
      NaN,
      Infinity,
      -Infinity,
      2147483648,
      Number.MAX_SAFE_INTEGER,
      '1',
      true,
      null,
      undefined,
    ]) {
      expect(() =>
        validateInventoryLoanCounts({ ...initial, [field]: invalid }),
      ).toThrow();
    }
  });

  it.each([
    { ...initial, quantity: 0 },
    { ...initial, returnedQuantity: 1 },
    { ...initial, deliveredQuantity: 11 },
    { ...initial, deliveredQuantity: 6, cancelledQuantity: 5 },
  ])('rejects inconsistent allocation: %p', (counts) => {
    expect(() => validateInventoryLoanCounts(counts)).toThrow();
  });

  it('derives remaining reservation independently of recorded returns', () => {
    expect(
      deriveInventoryLoanQuantities({
        ...initial,
        deliveredQuantity: 6,
        returnedQuantity: 2,
        cancelledQuantity: 1,
      }),
    ).toEqual({ reservedRemaining: 3, outstanding: 4 });
  });

  it('supports partial movements without mutating input', () => {
    const original = Object.freeze({ ...initial });
    const delivered = transitionInventoryLoanItem(original, 'DELIVERED', 6);
    expect(delivered).toEqual({
      counts: { ...initial, deliveredQuantity: 6 },
      stockDelta: -6,
      reservationDelta: -6,
    });
    const returned = transitionInventoryLoanItem(
      delivered.counts,
      'RETURNED',
      2,
    );
    expect(returned).toEqual({
      counts: { ...initial, deliveredQuantity: 6, returnedQuantity: 2 },
      stockDelta: 2,
      reservationDelta: 0,
    });
    const cancelled = transitionInventoryLoanItem(
      returned.counts,
      'CANCELLED',
      4,
    );
    expect(cancelled).toEqual({
      counts: { ...returned.counts, cancelledQuantity: 4 },
      stockDelta: 0,
      reservationDelta: -4,
    });
    expect(deriveInventoryLoanQuantities(cancelled.counts)).toEqual({
      reservedRemaining: 0,
      outstanding: 4,
    });
    expect(original).toEqual(initial);
    expect(delivered.counts.returnedQuantity).toBe(0);
    expect(returned.counts.cancelledQuantity).toBe(0);
  });

  it.each(['DELIVERED', 'RETURNED', 'CANCELLED'] as const)(
    'rejects invalid or excessive %s quantities',
    (movement) => {
      for (const quantity of [0, -1, 0.5, NaN, Infinity, 2147483648, 11]) {
        expect(() =>
          transitionInventoryLoanItem(initial, movement, quantity),
        ).toThrow();
      }
    },
  );

  it('rejects unknown movements and invalid input before arithmetic', () => {
    expect(() =>
      transitionInventoryLoanItem(initial, 'UNKNOWN' as 'DELIVERED', 1),
    ).toThrow();
    expect(() =>
      deriveInventoryLoanQuantities({ ...initial, returnedQuantity: 1 }),
    ).toThrow();
    expect(() =>
      transitionInventoryLoanItem({ ...initial, quantity: 0 }, 'DELIVERED', 1),
    ).toThrow();
  });

  it('accepts the Prisma Int boundary without overflowing allocation arithmetic', () => {
    const counts = { ...initial, quantity: 2147483647 };
    const delivered = transitionInventoryLoanItem(
      counts,
      'DELIVERED',
      2147483647,
    );
    const returned = transitionInventoryLoanItem(
      delivered.counts,
      'RETURNED',
      2147483647,
    );
    expect(deriveInventoryLoanQuantities(returned.counts)).toEqual({
      reservedRemaining: 0,
      outstanding: 0,
    });
    expect(returned.reservationDelta).toBe(0);
    expect(() =>
      transitionInventoryLoanItem(delivered.counts, 'DELIVERED', 1),
    ).toThrow();
    expect(() =>
      validateInventoryLoanCounts({
        ...counts,
        deliveredQuantity: 2147483647,
        cancelledQuantity: 2147483647,
      }),
    ).toThrow();
  });

  it('never re-reserves returned units or permits duplicate returns', () => {
    const delivered = transitionInventoryLoanItem(initial, 'DELIVERED', 10);
    const first = transitionInventoryLoanItem(delivered.counts, 'RETURNED', 3);
    const last = transitionInventoryLoanItem(first.counts, 'RETURNED', 7);
    expect(first.reservationDelta + last.reservationDelta).toBe(0);
    expect(first.stockDelta + last.stockDelta).toBe(10);
    expect(() =>
      transitionInventoryLoanItem(last.counts, 'RETURNED', 1),
    ).toThrow();
    expect(() =>
      transitionInventoryLoanItem(last.counts, 'DELIVERED', 1),
    ).toThrow();
    expect(() =>
      transitionInventoryLoanItem(last.counts, 'CANCELLED', 1),
    ).toThrow();
  });

  it('cancels only undelivered units, including the full integer boundary', () => {
    const counts = Object.freeze({ ...initial, quantity: 2147483647 });
    const cancelled = transitionInventoryLoanItem(
      counts,
      'CANCELLED',
      2147483647,
    );
    expect(cancelled.stockDelta).toBe(0);
    expect(cancelled.reservationDelta).toBe(-2147483647);
    expect(deriveInventoryLoanQuantities(cancelled.counts)).toEqual({
      reservedRemaining: 0,
      outstanding: 0,
    });
    expect(() =>
      transitionInventoryLoanItem(cancelled.counts, 'CANCELLED', 1),
    ).toThrow();
    expect(() =>
      transitionInventoryLoanItem(cancelled.counts, 'DELIVERED', 1),
    ).toThrow();
  });
});
