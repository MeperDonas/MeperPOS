export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  costPrice: number;
  salePrice: number;
  /** Active promotion on the product (backend-computed effectiveSalePrice derives from these) */
  promotionType?: "PERCENTAGE" | "FIXED_PRICE" | null;
  promotionValue?: number | null;
  /** Backend-computed promo price (null when no active promotion) */
  effectiveSalePrice?: number | null;
  taxRate: number;
  effectiveTaxRate?: number;
  stock: number;
  minStock: number;
  imageUrl: string | null;
  categoryId: string;
  category?: Category;
  preferredSupplierId?: string | null;
  organizationId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
  isLowStock?: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  defaultTaxRate: number | null;
  active: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  documentType: string;
  documentNumber: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  referencia: string | null;
  placaMoto: string | null;
  segment: "VIP" | "FREQUENT" | "OCCASIONAL" | "INACTIVE";
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaleUser {
  id: string;
  name: string;
  email: string;
}

export interface Sale {
  id: string;
  saleNumber: number;
  customerId: string | null;
  customer?: Customer;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid: number | null;
  change: number | null;
  status: "OPEN" | "CLOSED" | "COMPLETED" | "CANCELLED" | "RETURNED_PARTIAL";
  userId: string;
  user?: SaleUser;
  items: SaleItem[];
  payments?: Payment[];
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  saleId: string;
  method: "CASH" | "CARD" | "TRANSFER";
  amount: number;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
  subtotal: number;
  total: number;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  product?: Product;
  type: "PURCHASE" | "SALE" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGE" | "RETURN";
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  userId: string;
  saleId: string | null;
  createdAt: string;
}

export interface Settings {
  organization: {
    name: string;
    logoUrl: string | null;
  };
  invoicing: {
    printHeader: string;
    printFooter: string;
  };
  receipt: {
    prefix: string | null;
  };
  locale: {
    currency: string;
    locale: string;
    timezone: string;
  };
  custom: Record<string, unknown>;
}

export interface AppliedRange {
  startDate: string | null;
  endDate: string | null;
  timezone: string;
}

export interface ReportEnvelope<T> {
  data: T;
  appliedRange: AppliedRange;
  comparisonRange?: AppliedRange;
}

export interface FinancialDataQuality {
  snapshotBackedItems: number;
  excludedItems: number;
  excludedQuantity: number;
}

export interface FinancialProductMargin {
  productId: string;
  productName: string;
  categoryName: string;
  quantity: number;
  netRevenue: string;
  cogs: string;
  grossProfit: string;
  marginPercentage: number | null;
}

export interface FinancialReport {
  netIncome: string;
  tax: string;
  cogs: string;
  grossProfit: string;
  grossMarginPercentage: number | null;
  operatingExpenses: string;
  netProfit: string;
  netMarginPercentage: number | null;
  products: FinancialProductMargin[];
  dataQuality: FinancialDataQuality;
}

export interface FinancialDelta {
  absolute: string;
  percentage: number | null;
}

export interface FinancialOverview {
  current: FinancialReport;
  previous: FinancialReport;
  deltas: Record<string, FinancialDelta>;
  appliedRange: AppliedRange;
  comparisonRange: AppliedRange;
}

export interface CashFlowReport {
  accountingBasis: string;
  collections: {
    total: string;
    byPaymentMethod: Array<{ paymentMethod: string; total: string; count: number }>;
  };
  expensePayments: {
    total: string;
    byPaymentMethod: Array<{ paymentMethod: string; total: string; count: number }>;
  };
  appliedRange: AppliedRange;
}

export interface InventorySnapshotReport {
  isCurrentSnapshot: boolean;
  valuationBasis: string;
  current: {
    stockQuantity: number;
    stockValue: string;
    retailValue: string;
    potentialProfit: string;
  };
  movements: { totalQuantity: number; byType: Record<string, number> };
  appliedRange: AppliedRange;
}

export interface DashboardData {
  totalSales: number;
  totalRevenue: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockProducts: number;
  trends: {
    totalSales: number | null;
    totalRevenue: number | null;
    totalCustomers: number | null;
  };
  previousPeriod?: {
    revenue: number;
    sales: number;
  };
  recentSales: Array<{
    id: string;
    saleNumber: number;
    total: number;
    status: string;
    createdAt: string;
    customer?: { id: string; name: string } | null;
    items: Array<{
      id: string;
      quantity: number;
      total: number;
      product: { id: string; name: string };
    }>;
  }>;
  appliedRange: AppliedRange;
  comparisonRange?: AppliedRange;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  /** Snapshot of product.salePrice at add-to-cart time — original price before any override */
  originalUnitPrice: number;
  discountAmount: number;
  /** When set, discount scales with quantity: amount = price × qty × percent / 100 */
  discountPercent?: number;
  /** Snapshot of product.stock at add-to-cart time — used to cap quantity in POS */
  availableStock: number;
}

export interface SearchProductResult {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  salePrice: number;
  promotionType?: "PERCENTAGE" | "FIXED_PRICE" | null;
  promotionValue?: number | null;
  effectiveSalePrice?: number | null;
  stock: number;
  imageUrl: string | null;
  category: { name: string };
  isLowStock: boolean;
}

export interface SaleByPaymentMethod {
  paymentMethod: string;
  total: number;
  subtotal: number;
  count: number;
}

export interface SaleByCategory {
  category: string;
  total: number;
  quantity: number;
}

export interface SaleByCategoryDaily {
  date: string;
  category: string;
  total: number;
  quantity: number;
}

export interface TopSellingProduct {
  productId: string;
  productName: string;
  quantity: number;
  total: number;
  stock: number;
}

export interface CustomerStatistics {
  totalCustomers: number;
  activeCustomers: number;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalSales: number;
    totalRevenue: number;
  }>;
  appliedRange: AppliedRange;
  comparisonRange?: AppliedRange;
}

export interface DailySale {
  date: string;
  total: number;
  subtotal: number;
  tax: number;
  count: number;
}

export interface ImportStartResponse {
  jobId: string;
  totalRows: number;
  detectedColumns: string[];
  columnMapping: Record<string, string>;
}

export interface ImportWarning {
  rowIndex: number;
  warningCode: string;
  message: string;
}

export interface ImportEvent {
  type: "SUCCESS" | "ERROR" | "WARNING" | "INFO";
  message: string;
  rowIndex: number;
  timestamp: string;
}

/** The four entity sheets processed by the multi-sheet importer. */
export type ImportSheetId = "productos" | "clientes" | "proveedores" | "usuarios";

/** Per-sheet lifecycle sub-status inside a job's per-sheet breakdown. */
export type ImportSheetSubStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "REJECTED"
  | "FAILED";

export interface ImportRowError {
  rowIndex: number;
  /** Originating sheet for the failed row. Present on multi-sheet imports. */
  sheetId?: ImportSheetId;
  rawData: Record<string, string>;
  mappedData: Record<string, unknown>;
  errorCode: string;
  message: string;
  field?: string;
  retried: boolean;
  retriedSuccess?: boolean;
  editableFields: string[];
}

/** A row error from a multi-sheet import, always carrying its sheetId. */
export interface ImportSheetRowError {
  rowIndex: number;
  sheetId: ImportSheetId;
  errorCode: string;
  message: string;
  field?: string;
  mappedData?: Record<string, unknown>;
  editableFields: string[];
  retried: boolean;
  retriedSuccess?: boolean;
}

/** Per-sheet counters and sub-status returned in a job's per-sheet breakdown. */
export interface ImportSheetStatus {
  sheetId: ImportSheetId;
  status: ImportSheetSubStatus;
  totalRows: number;
  processedRows: number;
  imported: number;
  skipped: number;
  errors: number;
  warnings: number;
  missingRequiredFields?: string[];
  planLimitRejected?: boolean;
  planLimitMessage?: string;
  rowErrors: ImportSheetRowError[];
}

/** Full (multi-sheet) import job status: global counters + per-sheet breakdown. */
export interface ImportFullJobStatus {
  jobId: string;
  status: "PARSING" | "PROCESSING" | "COMPLETED" | "FAILED";
  fileName: string;
  totalRows: number;
  processedRows: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  warningCount: number;
  sheets: ImportSheetStatus[];
  errors: ImportSheetRowError[];
}

export interface ImportJobStatus {
  jobId: string;
  status: "PARSING" | "PROCESSING" | "COMPLETED" | "FAILED";
  fileName: string;
  totalRows: number;
  processedRows: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  warningCount: number;
  progress: number;
  columnMapping: Record<string, string>;
  detectedColumns: string[];
  errors: ImportRowError[];
  warnings: ImportWarning[];
  recentEvents: ImportEvent[];
  createdCategories: string[];
  startedAt: string;
  completedAt?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MEMBER" | "OWNER" | "CASHIER" | "INVENTORY_USER";
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaleFilters {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  search?: string;
  customerId?: string;
}

export type TaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type TaskEventType =
  | "CREATED"
  | "UPDATED"
  | "STATUS_CHANGED"
  | "DELETED";

export type TaskDataSource = "remote" | "local-fallback" | "local-only";

export interface TaskUserRef {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  createdById: string;
  assignedToId?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: TaskUserRef;
  assignedTo?: TaskUserRef | null;
}

export interface TaskEvent {
  id: string;
  taskId: string;
  type: TaskEventType;
  fromStatus?: TaskStatus | null;
  toStatus: TaskStatus;
  note?: string | null;
  createdById: string;
  createdAt: string;
  createdBy?: TaskUserRef;
}

export interface TaskListResult {
  tasks: Task[];
  source: TaskDataSource;
}

export type PurchaseOrderStatus =
  | "DRAFT"
  | "PENDING"
  | "PARTIAL_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export interface Supplier {
  id: string;
  name: string;
  documentNumber: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  contactName?: string | null;
  bank?: string | null;
  accountNumber?: string | null;
  accountType?: "SAVINGS" | "CHECKING" | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  product?: { id: string; name: string; sku: string };
  qtyOrdered: number;
  qtyReceived: number;
  unitCost: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: number;
  supplierId: string;
  supplier?: Supplier;
  createdById: string;
  createdBy?: { id: string; name: string };
  status: PurchaseOrderStatus;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string | null;
  confirmedAt?: string | null;
  receivedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: PurchaseOrderItem[];
}

export interface PlanLimit {
  type: "users" | "products" | "customers" | "cashRegisters";
  current: number;
  limit: number;
  exceeded: boolean;
  warningAt: number;
}

export interface PlanLimitsStatus {
  organizationId: string | null;
  limits: PlanLimit[];
}

export interface PaymentRecord {
  id: string;
  organizationId: string;
  amount: number;
  method: "CASH" | "CARD" | "TRANSFER";
  date: string;
  status: "PENDING" | "PAID" | "FAILED";
  createdAt: string;
  updatedAt: string;
}

export interface BillingStatus {
  id: string;
  plan: "BASIC" | "PRO";
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED";
  trialEndsAt: string | null;
  billingStatus: "PENDING" | "PAID" | "OVERDUE";
}

export type ExpenseStatus = "PARTIAL" | "PAID";

export interface ExpensePayment {
  id: string;
  expenseId: string;
  organizationId: string;
  amount: number;
  method: "CASH" | "CARD" | "TRANSFER";
  date: string;
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  organizationId: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  organizationId: string;
  categoryId: string;
  category?: ExpenseCategory;
  supplierId: string | null;
  supplier?: Supplier | null;
  purchaseOrderId: string | null;
  purchaseOrder?: PurchaseOrder | null;
  description: string | null;
  date: string;
  total: number;
  status: ExpenseStatus;
  receiptUrl: string | null;
  active: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  payments?: ExpensePayment[];
}

export interface ExpenseMonthlySummary {
  month: string;
  total: number;
  categories: Array<{
    categoryId: string;
    name: string;
    total: number;
  }>;
}

export interface ExpenseAuditEntry {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: unknown;
  createdAt: string;
  organizationId: string;
  user?: { name: string; email: string } | null;
}

export type ExpenseQueryParams = {
  page?: number;
  limit?: number;
  month?: string;
  categoryId?: string;
  supplierId?: string;
  status?: ExpenseStatus;
  search?: string;
};
