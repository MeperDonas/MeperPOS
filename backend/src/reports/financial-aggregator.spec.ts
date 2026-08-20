import { Prisma } from '@prisma/client';
import {
  aggregateFinancialSales,
  compareFinancialReports,
  serializeFinancialReport,
} from './financial-aggregator';

const decimal = (value: string | number) => new Prisma.Decimal(value);

describe('financial aggregation', () => {
  it('calculates tax-exclusive net income, exact COGS, gross profit and net profit', () => {
    const result = aggregateFinancialSales(
      [
        {
          subtotal: decimal('100.00'),
          discountAmount: decimal('10.00'),
          taxAmount: decimal('17.10'),
          items: [
            {
              quantity: 2,
              subtotal: decimal('100.00'),
              costPriceSnapshot: decimal('30.00'),
              discountAmount: decimal('0.00'),
              productId: 'p-1',
              productName: 'Widget',
              categoryName: 'General',
            },
          ],
        },
      ],
      [
        {
          total: decimal('15.00'),
          purchaseOrderId: null,
        },
        {
          total: decimal('999.00'),
          purchaseOrderId: 'purchase-1',
        },
      ],
    );

    expect(result.netIncome).toBe('90.00');
    expect(result.cogs).toBe('60.00');
    expect(result.grossProfit).toBe('30.00');
    expect(result.netProfit).toBe('15.00');
    expect(result.tax).toBe('17.10');
    expect(result.operatingExpenses).toBe('15.00');
  });

  it('excludes missing snapshots from exact margin and reports data quality', () => {
    const result = aggregateFinancialSales([
      {
        subtotal: decimal('100.00'),
        discountAmount: decimal('20.00'),
        taxAmount: decimal('0.00'),
        items: [
          {
            quantity: 1,
            subtotal: decimal('60.00'),
            costPriceSnapshot: decimal('25.00'),
            discountAmount: decimal('0.00'),
            productId: 'known',
            productName: 'Known',
            categoryName: 'General',
          },
          {
            quantity: 1,
            subtotal: decimal('40.00'),
            costPriceSnapshot: null,
            discountAmount: decimal('0.00'),
            productId: 'unknown',
            productName: 'Unknown',
            categoryName: 'General',
          },
        ],
      },
    ]);

    expect(result.netIncome).toBe('80.00');
    expect(result.cogs).toBe('25.00');
    expect(result.grossProfit).toBe('23.00');
    expect(result.dataQuality).toEqual({
      snapshotBackedItems: 1,
      excludedItems: 1,
      excludedQuantity: 1,
    });
  });

  it('allocates a sale discount proportionally for product margins', () => {
    const result = aggregateFinancialSales([
      {
        subtotal: decimal('100.00'),
        discountAmount: decimal('30.00'),
        taxAmount: decimal('0.00'),
        items: [
          {
            quantity: 1,
            subtotal: decimal('25.00'),
            costPriceSnapshot: decimal('10.00'),
            discountAmount: decimal('0.00'),
            productId: 'p-1',
            productName: 'A',
            categoryName: 'General',
          },
          {
            quantity: 1,
            subtotal: decimal('75.00'),
            costPriceSnapshot: decimal('20.00'),
            discountAmount: decimal('0.00'),
            productId: 'p-2',
            productName: 'B',
            categoryName: 'General',
          },
        ],
      },
    ]);

    expect(result.products).toEqual([
      expect.objectContaining({ productId: 'p-1', netRevenue: '17.50' }),
      expect.objectContaining({ productId: 'p-2', netRevenue: '52.50' }),
    ]);
  });

  it('is zero-safe for empty data and zero margin denominators', () => {
    const result = aggregateFinancialSales([], []);

    expect(result.netIncome).toBe('0.00');
    expect(result.grossMarginPercentage).toBeNull();
    expect(result.netMarginPercentage).toBeNull();
  });

  it('serializes every Decimal report value as a string', () => {
    const serialized = serializeFinancialReport({
      netIncome: decimal('10.50'),
      nested: { cogs: decimal('2.25') },
      rows: [{ margin: decimal('8.25') }],
    });

    expect(serialized).toEqual({
      netIncome: '10.50',
      nested: { cogs: '2.25' },
      rows: [{ margin: '8.25' }],
    });
  });

  it('returns absolute and percentage deltas with zero-safe comparisons', () => {
    const current = aggregateFinancialSales([
      {
        subtotal: decimal('100.00'),
        discountAmount: decimal('0.00'),
        taxAmount: decimal('0.00'),
        items: [],
      },
    ]);
    const previous = aggregateFinancialSales([]);

    expect(compareFinancialReports(current, previous).netIncome).toEqual({
      absolute: '100.00',
      percentage: 100,
    });
  });
});
