import type { RowError } from '../../engine/import-sheet-handler.interface';
import { normalizeLookupKey, normalizeText } from '../row-validator';

/** Recognized customer segments (mirrors the `CustomerSegment` Prisma enum). */
export const CUSTOMER_SEGMENTS = [
  'VIP',
  'FREQUENT',
  'OCCASIONAL',
  'INACTIVE',
] as const;

export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

/** Segment applied when a row does not specify one. */
export const DEFAULT_CUSTOMER_SEGMENT: CustomerSegment = 'OCCASIONAL';

/** Normalized customer import data after validation. */
export interface CustomerImportData {
  name: string;
  documentType: string;
  documentNumber: string;
  segment: CustomerSegment;
  email?: string;
  phone?: string;
}

export type CustomerValidationResult =
  | { ok: true; data: CustomerImportData }
  | { ok: false; error: RowError };

/**
 * Validates a single mapped Clientes row before creation.
 *
 * `existingDocuments` holds normalized lookup keys of document numbers already
 * present in the organization (in the database plus this file), which is how
 * the org-unique documentNumber constraint is enforced during an import.
 */
export function validateCustomerRow(
  mapped: Record<string, unknown>,
  existingDocuments: Set<string>,
): CustomerValidationResult {
  const name = normalizeText(mapped.name);
  const documentType = normalizeText(mapped.documentType).toUpperCase();
  const documentNumber = normalizeText(mapped.documentNumber);
  const email = normalizeText(mapped.email) || undefined;
  const phone = normalizeText(mapped.phone) || undefined;

  const mappedData: Record<string, unknown> = {
    name,
    documentType,
    documentNumber,
    email,
    phone,
  };

  if (!name) {
    return {
      ok: false,
      error: {
        errorCode: 'EMPTY_NAME',
        message: 'Nombre de cliente requerido',
        field: 'name',
        mappedData,
      },
    };
  }

  if (!documentNumber) {
    return {
      ok: false,
      error: {
        errorCode: 'EMPTY_DOCUMENT',
        message: 'Numero de documento requerido',
        field: 'documentNumber',
        mappedData,
      },
    };
  }

  if (!documentType) {
    return {
      ok: false,
      error: {
        errorCode: 'EMPTY_DOCUMENT_TYPE',
        message: 'Tipo de documento requerido',
        field: 'documentType',
        mappedData,
      },
    };
  }

  const documentKey = normalizeLookupKey(documentNumber);
  if (existingDocuments.has(documentKey)) {
    return {
      ok: false,
      error: {
        errorCode: 'DUPLICATE_DOCUMENT',
        message: 'Ya existe un cliente con ese numero de documento',
        field: 'documentNumber',
        mappedData,
      },
    };
  }

  const rawSegment = normalizeText(mapped.segment);
  const segment = (
    rawSegment ? rawSegment.toUpperCase() : DEFAULT_CUSTOMER_SEGMENT
  ) as CustomerSegment;

  if (!CUSTOMER_SEGMENTS.includes(segment)) {
    return {
      ok: false,
      error: {
        errorCode: 'INVALID_SEGMENT',
        message: 'Segmento de cliente invalido',
        field: 'segment',
        mappedData: { ...mappedData },
      },
    };
  }

  return {
    ok: true,
    data: {
      name,
      documentType,
      documentNumber,
      segment,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    },
  };
}
