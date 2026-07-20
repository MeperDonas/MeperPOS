export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  costPrice: number;
  salePrice: number;
  taxRate: number;
  effectiveTaxRate?: number;
  stock: number;
  minStock: number;
  imageUrl: string | null;
  categoryId: string;
  category?: Category;
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
  id: string;
  companyName: string;
  currency: string;
  taxRate: number;
  receiptPrefix: string;
  printHeader: string | null;
  printFooter: string | null;
  logoUrl: string | null;
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

export interface ImportRowError {
  rowIndex: number;
  rawData: Record<string, string>;
  mappedData: Record<string, unknown>;
  errorCode: string;
  message: string;
  field?: string;
  retried: boolean;
  retriedSuccess?: boolean;
  editableFields: string[];
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

export interface UserPerformanceComparison {
  revenuePct: number | null;
  salesPct: number | null;
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

export interface UserPerformance {
  userId: string;
  userName: string;
  role: "ADMIN" | "CASHIER" | "INVENTORY_USER";
  salesCount: number;
  revenue: number;
  avgTicket: number;
  uniqueCustomers: number;
  comparison?: UserPerformanceComparison;
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
