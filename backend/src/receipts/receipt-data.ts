/**
 * ReceiptData contract for receipt rendering (S3 — perf-refactor #98).
 *
 * `buildReceiptData` maps a Prisma sale (with customer/items/payments) plus the
 * hydrated settings view into the display-ready data the receipt renderer
 * consumes. The mapping mirrors, verbatim, the field logic that previously
 * lived inline in the SalesService receipt builder:
 *
 *   - receipt number  = settings.receipt.prefix ? `${prefix}-${saleNumber}` : String(saleNumber)
 *   - company name    = settings.organization.name || 'Mi Negocio'
 *   - tax rate        = first item's taxRate, 0 when there are no items
 *   - item name       = product name, 'Producto eliminado' fallback
 */

export interface ReceiptSaleItemInput {
  product: { name: string } | null;
  quantity: number;
  unitPrice: unknown;
  taxRate: unknown;
  total: unknown;
}

export interface ReceiptSalePaymentInput {
  method: string;
  amount: unknown;
}

/** Structural input shape: the Prisma sale returned by SalesService.findOne. */
export interface ReceiptSale {
  saleNumber: number;
  createdAt: Date | string;
  customer: { name: string } | null;
  items?: ReceiptSaleItemInput[];
  payments?: ReceiptSalePaymentInput[];
  subtotal: unknown;
  taxAmount: unknown;
  discountAmount: unknown;
  total: unknown;
  change: unknown;
}

/** Structural input shape: the SettingsView returned by SettingsService.find. */
export interface ReceiptSettings {
  organization: { name?: string | null; logoUrl?: string | null };
  invoicing: { printHeader?: string | null; printFooter?: string | null };
  receipt: { prefix?: string | null };
}

export interface ReceiptDataItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptDataPayment {
  method: string;
  amount: number;
}

export interface ReceiptData {
  saleNumber: number;
  receiptNumber: string;
  createdAt: Date | string;
  companyName: string;
  header: string;
  footer: string;
  logoUrl: string | null | undefined;
  customerName: string | null;
  items: ReceiptDataItem[];
  payments: ReceiptDataPayment[];
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  discount: number;
  total: number;
  change: number | null;
}

export function buildReceiptData(sale: ReceiptSale, settings: ReceiptSettings): ReceiptData {
  return {
    saleNumber: sale.saleNumber,
    receiptNumber: settings.receipt.prefix
      ? `${settings.receipt.prefix}-${sale.saleNumber}`
      : String(sale.saleNumber),
    createdAt: sale.createdAt,
    companyName: settings.organization.name || 'Mi Negocio',
    header: settings.invoicing.printHeader || '',
    footer: settings.invoicing.printFooter || '',
    logoUrl: settings.organization.logoUrl,
    customerName: sale.customer ? sale.customer.name : null,
    items: (sale.items ?? []).map((item) => ({
      name: item.product?.name || 'Producto eliminado',
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    payments: (sale.payments ?? []).map((payment) => ({
      method: payment.method,
      amount: Number(payment.amount),
    })),
    subtotal: Number(sale.subtotal),
    taxAmount: Number(sale.taxAmount),
    taxRate: getTaxRate(sale),
    discount: Number(sale.discountAmount),
    total: Number(sale.total),
    change: sale.change !== null && sale.change !== undefined ? Number(sale.change) : null,
  };
}

function getTaxRate(sale: ReceiptSale): number {
  if (sale.items && sale.items.length > 0) {
    const firstItem = sale.items[0];
    return Number(firstItem.taxRate) || 0;
  }
  return 0;
}
