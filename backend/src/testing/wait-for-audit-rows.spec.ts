import { waitForAuditRows } from './wait-for-audit-rows';

describe('waitForAuditRows', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('waits for one audit row inserted after 100 ms, not an early empty result', async () => {
    let rows: Array<{ id: string }> = [];
    setTimeout(() => {
      rows = [{ id: 'late-audit' }];
    }, 100);
    const fetchRows = jest.fn(() => Promise.resolve(rows));

    const pending = waitForAuditRows({ fetchRows, expectedCount: 1 });
    await jest.advanceTimersByTimeAsync(100);
    const result = await pending;

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 'late-audit' });
  });

  it('returns rows already matching the expected count', async () => {
    const rows = [{ id: 'existing-audit' }];
    const fetchRows = jest.fn(() => Promise.resolve(rows));

    const pending = waitForAuditRows({ fetchRows, expectedCount: 1 });

    expect(await pending).toEqual(rows);
    expect(fetchRows).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([0, 1])(
    'waits the full timeout when the constant count %i remains insufficient',
    async (count) => {
      const rows = Array.from({ length: count }, (_, index) => ({
        id: String(index),
      }));
      const fetchRows = jest.fn(() => Promise.resolve(rows));
      let settled = false;
      const pending = waitForAuditRows({ fetchRows, expectedCount: 2 }).then(
        (result) => {
          settled = true;
          return result;
        },
      );

      await jest.advanceTimersByTimeAsync(1999);
      expect(settled).toBe(false);
      expect(fetchRows).toHaveBeenCalledTimes(40);

      await jest.advanceTimersByTimeAsync(1);
      expect(await pending).toEqual(rows);
      expect(settled).toBe(true);
      expect(fetchRows).toHaveBeenCalledTimes(41);
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('returns the latest rows after at most 40 polls when the count keeps changing', async () => {
    let count = 0;
    const fetchRows = jest.fn(() =>
      Promise.resolve(
        Array.from({ length: count++ }, (_, index) => ({ id: String(index) })),
      ),
    );

    const pending = waitForAuditRows({ fetchRows, expectedCount: 100 });
    await jest.advanceTimersByTimeAsync(2000);

    expect(await pending).toHaveLength(40);
    expect(fetchRows).toHaveBeenCalledTimes(41);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('preserves excess rows so the caller can detect an unexpected count', async () => {
    const rows = [{ id: 'first-audit' }, { id: 'extra-audit' }];
    const fetchRows = jest.fn(() => Promise.resolve(rows));

    const pending = waitForAuditRows({ fetchRows, expectedCount: 1 });

    const result = await pending;
    expect(result).toEqual(rows);
    expect(result).toHaveLength(2);
    expect(fetchRows).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
