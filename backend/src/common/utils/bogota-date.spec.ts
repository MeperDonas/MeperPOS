import { BadRequestException } from '@nestjs/common';
import { parseBogotaMonthRange } from './bogota-date';

describe('parseBogotaMonthRange', () => {
  it('maps a YYYY-MM month to Bogota day boundaries', () => {
    const { start, end } = parseBogotaMonthRange('2026-08');

    expect(start.toISOString()).toBe('2026-08-01T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-01T04:59:59.999Z');
  });

  it('handles the December to January year rollover', () => {
    const { start, end } = parseBogotaMonthRange('2026-12');

    expect(start.toISOString()).toBe('2026-12-01T05:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T04:59:59.999Z');
  });

  it('treats 2026-08-01T05:00Z (midnight in Bogota) as the month start boundary', () => {
    const { start, end } = parseBogotaMonthRange('2026-08');

    expect(new Date('2026-08-01T05:00:00.000Z').getTime()).toBe(
      start.getTime(),
    );
    expect(new Date('2026-08-01T04:59:59.999Z').getTime()).toBeLessThan(
      start.getTime(),
    );
    expect(new Date('2026-09-01T04:59:59.999Z').getTime()).toBe(end.getTime());
  });

  it('rejects malformed month strings', () => {
    expect(() => parseBogotaMonthRange('2026-8')).toThrow(BadRequestException);
    expect(() => parseBogotaMonthRange('nope')).toThrow(BadRequestException);
    expect(() => parseBogotaMonthRange('')).toThrow(BadRequestException);
    expect(() => parseBogotaMonthRange(undefined as never)).toThrow(
      BadRequestException,
    );
  });
});
