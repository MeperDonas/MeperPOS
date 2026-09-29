type AuditRowsOptions<Row> = {
  fetchRows: () => Promise<Row[]>;
  expectedCount: number;
};

/**
 * Waits for a positive expected row count, not for absence (expectedCount > 0).
 * Returns excess rows unchanged so callers can assert the exact count.
 * After 40 polls at 50 ms, returns the latest rows even if still insufficient.
 */
export const waitForAuditRows = async <Row>(
  options: AuditRowsOptions<Row>,
): Promise<Row[]> => {
  let rows = await options.fetchRows();
  if (rows.length >= options.expectedCount) {
    return rows;
  }
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    rows = await options.fetchRows();
    if (rows.length >= options.expectedCount) {
      return rows;
    }
  }
  return rows;
};
