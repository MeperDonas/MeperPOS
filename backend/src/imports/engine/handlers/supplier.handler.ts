import { Injectable } from '@nestjs/common';
import type {
  ImportSheetHandler,
  ParsedFileRow,
  SheetRowContext,
  ValidationResult,
} from '../import-sheet-handler.interface';
import {
  detectColumns,
  mapRawRow,
  type SheetColumnDetectionResult,
} from '../../helpers/column-detector';
import { validateSupplierRow } from '../../helpers/validators/supplier';
import { normalizeLookupKey } from '../../helpers/row-validator';
import { SuppliersService } from '../../../suppliers/suppliers.service';

const SUPPLIER_EDITABLE_FIELDS = [
  'name',
  'documentNumber',
  'email',
  'phone',
  'address',
  'contactName',
  'bank',
  'accountNumber',
  'accountType',
];

/**
 * Per-entity handler for the Proveedores sheet. It maps the raw sheet columns,
 * validates each row with the shared supplier validator (account type
 * SAVINGS/CHECKING, org-unique document number) and delegates creation to
 * {@link SuppliersService.create}.
 *
 * {@link SheetRowContext.existingKeys} holds the document numbers already known
 * to the organization plus the ones seen earlier in the file, so the org-unique
 * documentNumber constraint is enforced both against the database and within a
 * single upload.
 */
@Injectable()
export class SupplierHandler implements ImportSheetHandler {
  readonly sheetId = 'proveedores';
  readonly requiredFields = ['name', 'documentNumber'];
  readonly editableFields = SUPPLIER_EDITABLE_FIELDS;

  constructor(private readonly suppliersService: SuppliersService) {}

  detectColumns(headers: string[]): SheetColumnDetectionResult {
    return detectColumns(this.sheetId, headers);
  }

  validateRow(row: ParsedFileRow, ctx: SheetRowContext): ValidationResult {
    const mapped = mapRawRow(this.sheetId, row.rawData);
    const result = validateSupplierRow(mapped, ctx.existingKeys);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    ctx.existingKeys.add(normalizeLookupKey(result.data.documentNumber));
    return { ok: true, data: { ...result.data } };
  }

  async createRow(
    data: Record<string, unknown>,
    ctx: SheetRowContext,
  ): Promise<void> {
    await this.suppliersService.create(data as never, ctx.organizationId);
  }
}
