import { validateSupplierRow, SUPPLIER_ACCOUNT_TYPES } from './supplier';

describe('SUPPLIER_ACCOUNT_TYPES', () => {
  it('defines the supplier account type enum', () => {
    expect(SUPPLIER_ACCOUNT_TYPES).toEqual(['SAVINGS', 'CHECKING']);
  });
});

describe('validateSupplierRow', () => {
  const baseRow = {
    name: 'Distribuidora XYZ',
    documentNumber: '900123456-7',
  };

  it('accepts a valid supplier row without an account type', () => {
    const result = validateSupplierRow(baseRow, new Set());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        name: 'Distribuidora XYZ',
        documentNumber: '900123456-7',
      });
      expect(result.data.accountType).toBeUndefined();
    }
  });

  it('accepts a valid supplier with a CHECKING account type', () => {
    const result = validateSupplierRow(
      { ...baseRow, accountType: 'CHECKING' },
      new Set(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.accountType).toBe('CHECKING');
    }
  });

  it('normalizes the account type case', () => {
    const result = validateSupplierRow(
      { ...baseRow, accountType: 'savings' },
      new Set(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.accountType).toBe('SAVINGS');
    }
  });

  it('carries optional supplier fields through', () => {
    const result = validateSupplierRow(
      {
        ...baseRow,
        email: 'ventas@xyz.com',
        phone: '3001234567',
        bank: 'Bancolombia',
        accountNumber: '1234567890',
        contactName: 'Juan Pérez',
      },
      new Set(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.email).toBe('ventas@xyz.com');
      expect(result.data.phone).toBe('3001234567');
      expect(result.data.bank).toBe('Bancolombia');
      expect(result.data.accountNumber).toBe('1234567890');
      expect(result.data.contactName).toBe('Juan Pérez');
    }
  });

  it('rejects a row without a name', () => {
    const result = validateSupplierRow(
      { documentNumber: '900123456-7' },
      new Set(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errorCode).toBe('EMPTY_NAME');
      expect(result.error.field).toBe('name');
    }
  });

  it('rejects a row without a document number', () => {
    const result = validateSupplierRow(
      { name: 'Distribuidora XYZ' },
      new Set(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errorCode).toBe('EMPTY_DOCUMENT');
      expect(result.error.field).toBe('documentNumber');
    }
  });

  it('rejects a document number that already exists in the organization', () => {
    const result = validateSupplierRow(baseRow, new Set(['900123456-7']));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errorCode).toBe('DUPLICATE_DOCUMENT');
      expect(result.error.field).toBe('documentNumber');
    }
  });

  it('rejects an invalid account type', () => {
    const result = validateSupplierRow(
      { ...baseRow, accountType: 'CREDIT' },
      new Set(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errorCode).toBe('INVALID_ACCOUNT_TYPE');
      expect(result.error.field).toBe('accountType');
    }
  });
});
