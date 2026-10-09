export interface InventoryLoanCounts {
  quantity: number;
  deliveredQuantity: number;
  returnedQuantity: number;
  cancelledQuantity: number;
}

export type InventoryLoanMovement = 'DELIVERED' | 'RETURNED' | 'CANCELLED';

const PRISMA_INT_MAX = 2147483647;

function requireCount(value: number, minimum = 0): void {
  if (!Number.isInteger(value) || value < minimum || value > PRISMA_INT_MAX) {
    throw new RangeError('Inventory loan quantities must be bounded integers');
  }
}

export function validateInventoryLoanCounts(counts: InventoryLoanCounts): void {
  if (!counts || typeof counts !== 'object') {
    throw new TypeError('Inventory loan counts are required');
  }
  requireCount(counts.quantity, 1);
  requireCount(counts.deliveredQuantity);
  requireCount(counts.returnedQuantity);
  requireCount(counts.cancelledQuantity);
  if (
    counts.returnedQuantity > counts.deliveredQuantity ||
    counts.deliveredQuantity > counts.quantity - counts.cancelledQuantity
  ) {
    throw new RangeError('Inventory loan quantities exceed their allocation');
  }
}

export function deriveInventoryLoanQuantities(counts: InventoryLoanCounts) {
  validateInventoryLoanCounts(counts);
  return {
    reservedRemaining:
      counts.quantity - counts.deliveredQuantity - counts.cancelledQuantity,
    outstanding: counts.deliveredQuantity - counts.returnedQuantity,
  };
}

// Pure accounting proposal only: no persistence, status policy or stock writes.
export function transitionInventoryLoanItem(
  counts: InventoryLoanCounts,
  movement: InventoryLoanMovement,
  quantity: number,
): {
  counts: InventoryLoanCounts;
  stockDelta: number;
  reservationDelta: number;
} {
  const { reservedRemaining, outstanding } =
    deriveInventoryLoanQuantities(counts);
  requireCount(quantity, 1);
  const next = { ...counts };
  switch (movement) {
    case 'DELIVERED':
      if (quantity > reservedRemaining) {
        throw new RangeError('Delivery exceeds the remaining reservation');
      }
      next.deliveredQuantity += quantity;
      return {
        counts: next,
        stockDelta: -quantity,
        reservationDelta: -quantity,
      };
    case 'RETURNED':
      if (quantity > outstanding) {
        throw new RangeError('Return exceeds delivered outstanding quantity');
      }
      next.returnedQuantity += quantity;
      return { counts: next, stockDelta: quantity, reservationDelta: 0 };
    case 'CANCELLED':
      if (quantity > reservedRemaining) {
        throw new RangeError(
          'Cancellation exceeds the undelivered reservation',
        );
      }
      next.cancelledQuantity += quantity;
      return { counts: next, stockDelta: 0, reservationDelta: -quantity };
    default:
      throw new TypeError('Unsupported inventory loan movement');
  }
}
