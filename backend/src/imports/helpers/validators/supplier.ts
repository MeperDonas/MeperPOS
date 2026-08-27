import type { RowError } from '../../engine/import-sheet-handler.interface';
import { normalizeLookupKey, normalizeText } from '../row-validator';

/** Recognized supplier account types (mirrors the `SupplierAccountType` enum). */
export const SUPPLIER_ACCOUNT_TYPES = ['SAVINGS', 'CHECKING'] as const;

export type SupplierAccountType = (typeof SUPPLIER_ACCOUNT_TYPES)[number];

/** Normalized supplier import data after validation. */
export interface SupplierImportData {
  name: string;
  documentNumber: string;
  accountType?: SupplierAccountType;
  email?: string;
  phone?: string;
  address?: string;
  contactName?: string;
  bank?: string;
  accountNumber?: string;
}

export type SupplierValidationResult =
  | { ok: true; data: SupplierImportData }
  | { ok: false; error: RowError };

/**
 * Validates a single mapped Proveedores row before creation.
 *
 * `existingDocuments` holds normalized lookup keys of document numbers already
 * present in the organization, which enforces the org-unique documentNumber
 * constraint during an import.
 */
export function validateSupplierRow(
  mapped: Record<string, unknown>,
  existingDocuments: Set<string>,
): SupplierValidationResult {
  const name = normalizeText(mapped.name);
  const documentNumber = normalizeText(mapped.documentNumber);
  const email = normalizeText(mapped.email) || undefined;
  const phone = normalizeText(mapped.phone) || undefined;
  const address = normalizeText(mapped.address) || undefined;
  const contactName = normalizeText(mapped.contactName) || undefined;
  const bank = normalizeText(mapped.bank) || undefined;
  const accountNumber = normalizeText(mapped.accountNumber) || undefined;

  const mappedData: Record<string, unknown> = {
    name,
    documentNumber,
    email,
    phone,
    address,
    contactName,
    bank,
    accountNumber,
  };

  if (!name) {
    return {
      ok: false,
      error: {
        errorCode: 'EMPTY_NAME',
        message: 'Nombre de proveedor requerido',
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

  const documentKey = normalizeLookupKey(documentNumber);
  if (existingDocuments.has(documentKey)) {
    return {
      ok: false,
      error: {
        errorCode: 'DUPLICATE_DOCUMENT',
        message: 'Ya existe un proveedor con ese numero de documento',
        field: 'documentNumber',
        mappedData,
      },
    };
  }

  const rawAccountType = normalizeText(mapped.accountType);
  let accountType: SupplierAccountType | undefined;

  if (rawAccountType) {
    const normalized = rawAccountType.toUpperCase() as SupplierAccountType;
    if (!SUPPLIER_ACCOUNT_TYPES.includes(normalized)) {
      return {
        ok: false,
        error: {
          errorCode: 'INVALID_ACCOUNT_TYPE',
          message: 'Tipo de cuenta invalido (use SAVINGS o CHECKING)',
          field: 'accountType',
          mappedData: { ...mappedData },
        },
      };
    }
    accountType = normalized;
  }

  return {
    ok: true,
    data: {
      name,
      documentNumber,
      ...(accountType ? { accountType } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(address ? { address } : {}),
      ...(contactName ? { contactName } : {}),
      ...(bank ? { bank } : {}),
      ...(accountNumber ? { accountNumber } : {}),
    },
  };
}
