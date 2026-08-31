import { CURRENCY, LOCALE, TIMEZONE } from './locale.constants';

/**
 * Exact-string characterization tests (S4 task 4.1).
 * These constants are consumed by settings defaults and the receipts PDF
 * renderer (golden-equality gated in S3) — a silent change here would alter
 * every generated receipt and currency default. Lock the exact values.
 */
describe('locale.constants', () => {
  it('exports the COP currency code', () => {
    expect(CURRENCY).toBe('COP');
  });

  it('exports the es-CO locale tag', () => {
    expect(LOCALE).toBe('es-CO');
  });

  it('exports the America/Bogota IANA timezone', () => {
    expect(TIMEZONE).toBe('America/Bogota');
  });
});
