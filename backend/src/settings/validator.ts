import { DEFAULT_INVOICING } from './defaults';
import type { InvoicingSettings } from './schema';

/**
 * Runtime validation for typed core params.
 *
 * Invalid values fall back to the registry default and NEVER throw — reads
 * must be resilient to whatever was persisted in the JSON blob historically.
 */
export function validateInvoicing(
  raw: Record<string, unknown>,
): InvoicingSettings {
  return {
    printHeader:
      typeof raw.printHeader === 'string'
        ? raw.printHeader
        : DEFAULT_INVOICING.printHeader,
    printFooter:
      typeof raw.printFooter === 'string'
        ? raw.printFooter
        : DEFAULT_INVOICING.printFooter,
  };
}
