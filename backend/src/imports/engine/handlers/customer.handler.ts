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
import { validateCustomerRow } from '../../helpers/validators/customer';
import { normalizeLookupKey } from '../../helpers/row-validator';
import { CustomersService } from '../../../customers/customers.service';

const CUSTOMER_EDITABLE_FIELDS = [
  'name',
  'documentType',
  'documentNumber',
  'email',
  'phone',
  'segment',
];

/**
 * Per-entity handler for the Clientes sheet. It maps the raw sheet columns,
 * validates each row with the shared customer validator (segment enum, document
 * type, org-unique document number) and delegates creation to
 * {@link CustomersService.create}.
 *
 * {@link SheetRowContext.existingKeys} holds the document numbers already known
 * to the organization plus the ones seen earlier in the file, so the org-unique
 * documentNumber constraint is enforced both against the database and within a
 * single upload.
 */
@Injectable()
export class CustomerHandler implements ImportSheetHandler {
  readonly sheetId = 'clientes';
  readonly requiredFields = ['name', 'documentType', 'documentNumber'];
  readonly editableFields = CUSTOMER_EDITABLE_FIELDS;

  constructor(private readonly customersService: CustomersService) {}

  detectColumns(headers: string[]): SheetColumnDetectionResult {
    return detectColumns(this.sheetId, headers);
  }

  validateRow(row: ParsedFileRow, ctx: SheetRowContext): ValidationResult {
    const mapped = mapRawRow(this.sheetId, row.rawData);
    const result = validateCustomerRow(mapped, ctx.existingKeys);

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
    await this.customersService.create(data as never, ctx.organizationId);
  }
}
