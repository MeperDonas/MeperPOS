import {
  validateCustomerRow,
  CUSTOMER_SEGMENTS,
  DEFAULT_CUSTOMER_SEGMENT,
} from './customer';

describe('CUSTOMER_SEGMENTS', () => {
  it('defines the customer segment enum', () => {
    expect(CUSTOMER_SEGMENTS).toEqual([
      'VIP',
      'FREQUENT',
      'OCCASIONAL',
      'INACTIVE',
    ]);
  });

  it('defaults to OCCASIONAL when no segment is supplied', () => {
    expect(DEFAULT_CUSTOMER_SEGMENT).toBe('OCCASIONAL');
  });
});

describe('validateCustomerRow', () => {
  const baseRow = {
    name: 'John Doe',
    documentType: 'CC',
    documentNumber: '1234567890',
  };

  it('accepts a valid customer row and defaults the segment', () => {
    const result = validateCustomerRow(baseRow, new Set());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        name: 'John Doe',
        documentType: 'CC',
        documentNumber: '1234567890',
        segment: 'OCCASIONAL',
      });
    }
  });

  it('accepts an explicit valid segment and normalizes its case', () => {
    const result = validateCustomerRow(
      { ...baseRow, segment: 'frequent' },
      new Set(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.segment).toBe('FREQUENT');
    }
  });

  it('normalizes the document type case', () => {
    const result = validateCustomerRow(
      { ...baseRow, documentType: 'cc' },
      new Set(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.documentType).toBe('CC');
    }
  });

  it('carries optional email and phone through', () => {
    const result = validateCustomerRow(
      { ...baseRow, email: 'john@example.com', phone: '3001234567' },
      new Set(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.email).toBe('john@example.com');
      expect(result.data.phone).toBe('3001234567');
    }
  });

  it('rejects a row without a name', () => {
    const result = validateCustomerRow(
      { documentType: 'CC', documentNumber: '1234567890' },
      new Set(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errorCode).toBe('EMPTY_NAME');
      expect(result.error.field).toBe('name');
    }
  });

  it('rejects a row without a document number', () => {
    const result = validateCustomerRow(
      { name: 'John Doe', documentType: 'CC' },
      new Set(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errorCode).toBe('EMPTY_DOCUMENT');
      expect(result.error.field).toBe('documentNumber');
    }
  });

  it('rejects a row without a document type', () => {
    const result = validateCustomerRow(
      { name: 'John Doe', documentNumber: '1234567890' },
      new Set(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errorCode).toBe('EMPTY_DOCUMENT_TYPE');
      expect(result.error.field).toBe('documentType');
    }
  });

  it('rejects an invalid segment value', () => {
    const result = validateCustomerRow(
      { ...baseRow, segment: 'PREMIUM' },
      new Set(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errorCode).toBe('INVALID_SEGMENT');
      expect(result.error.field).toBe('segment');
    }
  });

  it('rejects a document number that already exists in the organization', () => {
    const existing = new Set(['1234567890']);

    const result = validateCustomerRow(baseRow, existing);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errorCode).toBe('DUPLICATE_DOCUMENT');
      expect(result.error.field).toBe('documentNumber');
    }
  });

  it('accepts a fresh document number even when a different one exists', () => {
    const result = validateCustomerRow(baseRow, new Set(['0000000000']));

    expect(result.ok).toBe(true);
  });
});
