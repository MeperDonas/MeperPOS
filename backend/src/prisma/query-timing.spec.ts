import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  aggregateQueryTiming,
  extractStatementKey,
  summarizeQueryTiming,
  writeQueryTimingDump,
  type QueryTimingStats,
} from './query-timing';

describe('query-timing harness (dev only)', () => {
  describe('extractStatementKey', () => {
    it('maps a SELECT with schema-qualified table to model.op', () => {
      const sql =
        'SELECT "t0"."id", "t0"."name" FROM "public"."Product" AS "t0" WHERE "t0"."organizationId" = $1';
      expect(extractStatementKey(sql)).toBe('product.select');
    });

    it('maps INSERT, UPDATE and DELETE statements to their model and verb', () => {
      expect(
        extractStatementKey(
          'INSERT INTO "public"."SaleItem" ("id", "saleId") VALUES ($1, $2)',
        ),
      ).toBe('saleitem.insert');
      expect(
        extractStatementKey('UPDATE "public"."Settings" SET "logoUrl" = $1'),
      ).toBe('settings.update');
      expect(
        extractStatementKey('DELETE FROM "InventoryMovement" WHERE "id" = $1'),
      ).toBe('inventorymovement.delete');
    });

    it('falls back to other.raw for unparseable statements', () => {
      expect(extractStatementKey('BEGIN')).toBe('other.raw');
      expect(extractStatementKey('')).toBe('other.raw');
    });
  });

  describe('aggregateQueryTiming', () => {
    let stats: QueryTimingStats;

    beforeEach(() => {
      stats = new Map();
    });

    it('accumulates count, totalMs and maxMs per statement key', () => {
      aggregateQueryTiming(stats, { query: 'SELECT * FROM "Product"', duration: 5 });
      aggregateQueryTiming(stats, { query: 'SELECT * FROM "Product"', duration: 11 });
      aggregateQueryTiming(stats, { query: 'UPDATE "User" SET "name" = $1', duration: 3 });

      expect(stats.get('product.select')).toEqual({ count: 2, totalMs: 16, maxMs: 11 });
      expect(stats.get('user.update')).toEqual({ count: 1, totalMs: 3, maxMs: 3 });
    });

    it('keeps maxMs when a later query is faster', () => {
      aggregateQueryTiming(stats, { query: 'SELECT * FROM "Sale"', duration: 40 });
      aggregateQueryTiming(stats, { query: 'SELECT * FROM "Sale"', duration: 4 });

      expect(stats.get('sale.select')).toEqual({ count: 2, totalMs: 44, maxMs: 40 });
    });
  });

  describe('summarizeQueryTiming', () => {
    it('lists statements sorted by total time descending', () => {
      const stats: QueryTimingStats = new Map();
      aggregateQueryTiming(stats, { query: 'SELECT * FROM "Product"', duration: 10 });
      aggregateQueryTiming(stats, { query: 'SELECT * FROM "Sale"', duration: 50 });
      aggregateQueryTiming(stats, { query: 'SELECT * FROM "Sale"', duration: 50 });

      const summary = summarizeQueryTiming(stats);
      const lines = summary.split('\n');

      expect(summary).toContain('sale.select');
      expect(summary).toContain('product.select');
      expect(lines.findIndex((line) => line.includes('sale.select'))).toBeLessThan(
        lines.findIndex((line) => line.includes('product.select')),
      );
      expect(lines.find((line) => line.includes('sale.select'))).toContain('total=100.0ms');
      expect(lines.find((line) => line.includes('product.select'))).toContain('total=10.0ms');
    });

    it('reports an explicit message when no queries were recorded', () => {
      expect(summarizeQueryTiming(new Map())).toBe('No queries recorded.');
    });
  });

  describe('writeQueryTimingDump', () => {
    it('writes a JSON dump file named query-timing-<label>.json and returns its path', () => {
      const dir = mkdtempSync(join(tmpdir(), 'query-timing-'));
      try {
        const stats: QueryTimingStats = new Map();
        aggregateQueryTiming(stats, { query: 'SELECT * FROM "Product"', duration: 7 });

        const filePath = writeQueryTimingDump(stats, 'smoke', dir);

        expect(filePath).toBe(join(dir, 'query-timing-smoke.json'));
        expect(existsSync(filePath)).toBe(true);
        const dumped = JSON.parse(readFileSync(filePath, 'utf8'));
        expect(dumped['product.select']).toEqual({ count: 1, totalMs: 7, maxMs: 7 });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
