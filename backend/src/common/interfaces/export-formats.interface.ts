export interface ExportProduct {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  costPrice: number;
  salePrice: number;
  taxRate: number;
  stock: number;
  minStock: number;
  imageUrl: string | null;
}

export interface ExportSale {
  id: string;
  saleNumber: number;
  createdAt: string;
  customerName: string | null;
  customerDocument: string | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  status: string;
  items: ExportSaleItem[];
}

export interface ExportSaleItem {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  subtotal: number;
  taxRate: number;
  total: number;
}

export interface ExportCustomer {
  id: string;
  name: string;
  documentType: string;
  documentNumber: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  referencia: string | null;
  placaMoto: string | null;
  segment: string;
  totalPurchases: number;
}

export interface ExportInventoryMovement {
  id: string;
  productName: string;
  sku: string;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  userName: string;
  createdAt: string;
}

export type ExportFormat = 'pdf' | 'excel' | 'csv';

export interface ExportQueryDto {
  format: ExportFormat;
  type: 'sales' | 'products' | 'customers' | 'inventory';
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface CsvDelimiter {
  value: string;
  label: string;
}

export const CSV_DELIMITERS: CsvDelimiter[] = [
  { value: ',', label: 'Comma (,)' },
  { value: ';', label: 'Punto y coma (;)' },
  { value: '\t', label: 'Tabulador (\\t)' },
];
