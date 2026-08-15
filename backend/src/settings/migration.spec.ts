import { normalizeSettingsJson } from './migration';

describe('normalizeSettingsJson', () => {
  const ctx = { logoUrl: null };

  it('moves companyName to Organization.name and removes it from settings', () => {
    const result = normalizeSettingsJson(
      { companyName: 'Acme', printHeader: 'H' },
      ctx,
    );

    expect(result.organizationName).toBe('Acme');
    expect(result.settings.companyName).toBeUndefined();
    expect(result.settings.printHeader).toBe('H');
  });

  it('moves logoUrl to top-level when top-level is empty', () => {
    const result = normalizeSettingsJson(
      { logoUrl: 'https://cdn/new.png' },
      ctx,
    );

    expect(result.logoUrl).toBe('https://cdn/new.png');
    expect(result.settings.logoUrl).toBeUndefined();
  });

  it('keeps the existing top-level logoUrl (top-level wins)', () => {
    const result = normalizeSettingsJson(
      { logoUrl: 'https://cdn/new.png' },
      { logoUrl: 'https://cdn/existing.png' },
    );

    expect(result.logoUrl).toBeUndefined();
    expect(result.settings.logoUrl).toBeUndefined();
  });

  it('moves receiptPrefix to the SALE sequence prefix', () => {
    const result = normalizeSettingsJson({ receiptPrefix: 'INV-' }, ctx);

    expect(result.receiptPrefix).toBe('INV-');
    expect(result.settings.receiptPrefix).toBeUndefined();
  });

  it('moves unknown ad-hoc keys into custom and preserves downgradeFlags', () => {
    const result = normalizeSettingsJson(
      {
        printHeader: 'H',
        adhoc: 'x',
        another: 1,
        downgradeFlags: { a: true },
      },
      ctx,
    );

    expect(result.settings.custom).toEqual({ adhoc: 'x', another: 1 });
    expect(result.settings.downgradeFlags).toEqual({ a: true });
    expect(result.settings.printHeader).toBe('H');
  });

  it('merges into an existing custom section', () => {
    const result = normalizeSettingsJson(
      { custom: { existing: 'yes' }, adhoc: 'x' },
      ctx,
    );

    expect(result.settings.custom).toEqual({ existing: 'yes', adhoc: 'x' });
  });

  it('is a no-op for already-normalized settings (re-runnable)', () => {
    const input = {
      printHeader: 'H',
      printFooter: 'F',
      downgradeFlags: { a: 1 },
      custom: { k: 'v' },
    };

    const result = normalizeSettingsJson(input, ctx);

    expect(result.organizationName).toBeUndefined();
    expect(result.logoUrl).toBeUndefined();
    expect(result.receiptPrefix).toBeUndefined();
    expect(result.settings).toEqual(input);
  });
});
