import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/services/cache.service';
import {
  formatDateInBogota,
  parseBogotaEndOfDay,
  parseBogotaStartOfDay,
} from '../common/utils/bogota-date';

// ─── Local types ──────────────────────────────────────────────────────────────

type SaleStatusType = 'COMPLETED' | 'CANCELLED' | 'RETURNED_PARTIAL';

interface DateFilter {
  gte?: Date;
  lte?: Date;
}

interface SaleWhereInput {
  organizationId: string;
  status?: SaleStatusType;
  createdAt?: DateFilter;
  userId?: {
    in: string[];
  };
}

interface SaleNestedWhere {
  organizationId: string;
  status?: SaleStatusType;
  createdAt?: DateFilter;
}

interface SaleItemWhereInput {
  sale?: SaleNestedWhere;
}

interface CustomerSaleWhereInput {
  organizationId: string;
  createdAt?: DateFilter;
}

interface DaySummary {
  total: number;
  subtotal: number;
  tax: number;
  count: number;
}

interface ComparisonPeriod {
  current: DateFilter;
  previous: DateFilter;
}

export interface UserPerformanceComparison {
  revenuePct: number | null;
  salesPct: number | null;
}

export interface UserPerformanceRow {
  userId: string;
  userName: string;
  salesCount: number;
  revenue: number;
  avgTicket: number;
  uniqueCustomers: number;
  comparison?: UserPerformanceComparison;
}

export interface UserPerformanceReport {
  data: UserPerformanceRow[];
  appliedRange: AppliedRangeMeta;
  comparisonRange?: AppliedRangeMeta;
}

interface UserAggregation {
  salesCount: number;
  revenue: number;
  customerIds: Set<string>;
}

export interface AppliedRangeMeta {
  startDate: string | null;
  endDate: string | null;
  timezone: 'America/Bogota';
}

const DEFAULT_COMPARISON_DAYS = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ─── Helper ───────────────────────────────────────────────────────────────────

function validateDateRange(startDate?: string, endDate?: string): void {
  const start = parseBogotaStartOfDay(startDate);
  const end = parseBogotaEndOfDay(endDate);

  if (start && end && end < start) {
    throw new BadRequestException(
      'La fecha de fin no puede ser anterior a la fecha de inicio.',
    );
  }
}

function buildAppliedRange(
  startDate?: string,
  endDate?: string,
): AppliedRangeMeta {
  const parsedStartDate = parseBogotaStartOfDay(startDate);
  const parsedEndDate = parseBogotaEndOfDay(endDate);

  return {
    startDate: parsedStartDate ? formatDateInBogota(parsedStartDate) : null,
    endDate: parsedEndDate ? formatDateInBogota(parsedEndDate) : null,
    timezone: 'America/Bogota',
  };
}

function buildComparisonRangeMeta(
  comparisonPeriod: ComparisonPeriod,
): AppliedRangeMeta {
  return {
    startDate: formatDateInBogota(comparisonPeriod.previous.gte!),
    endDate: formatDateInBogota(comparisonPeriod.previous.lte!),
    timezone: 'America/Bogota',
  };
}

function buildDateFilter(
  startDate?: string,
  endDate?: string,
): DateFilter | undefined {
  if (!startDate && !endDate) return undefined;

  const filter: DateFilter = {};

  const startDateFilter = parseBogotaStartOfDay(startDate);
  if (startDateFilter) {
    filter.gte = startDateFilter;
  }

  const endDateFilter = parseBogotaEndOfDay(endDate);
  if (endDateFilter) {
    filter.lte = endDateFilter;
  }

  return filter;
}

function buildComparisonPeriod(
  startDate?: string,
  endDate?: string,
): ComparisonPeriod {
  const now = new Date();
  const parsedStart = parseBogotaStartOfDay(startDate);
  const parsedEnd = parseBogotaEndOfDay(endDate) ?? now;

  let currentStart =
    parsedStart ??
    new Date(parsedEnd.getTime() - DEFAULT_COMPARISON_DAYS * ONE_DAY_MS + 1);
  let currentEnd = parsedEnd;

  if (currentStart.getTime() > currentEnd.getTime()) {
    const temp = currentStart;
    currentStart = currentEnd;
    currentEnd = temp;
  }

  const durationMs = Math.max(
    ONE_DAY_MS,
    currentEnd.getTime() - currentStart.getTime() + 1,
  );

  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs + 1);

  return {
    current: {
      gte: currentStart,
      lte: currentEnd,
    },
    previous: {
      gte: previousStart,
      lte: previousEnd,
    },
  };
}

function calculatePercentageChange(
  currentValue: number,
  previousValue: number,
): number | null {
  if (previousValue === 0) {
    return currentValue === 0 ? 0 : 100;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

function normalizeUserIds(userIds?: string[]): string[] | undefined {
  if (!userIds || userIds.length === 0) {
    return undefined;
  }

  const normalized = Array.from(
    new Set(userIds.map((userId) => userId.trim()).filter(Boolean)),
  );

  return normalized.length > 0 ? normalized : undefined;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async getDashboardKPIs(
    organizationId: string,
    startDate?: string,
    endDate?: string,
  ) {
    validateDateRange(startDate, endDate);

    const cacheKey = `dashboard:${organizationId}:${startDate || ''}:${endDate || ''}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const dateFilter = buildDateFilter(startDate, endDate);
    const comparisonPeriod = buildComparisonPeriod(startDate, endDate);
    const baseWhere: SaleWhereInput = {
      organizationId,
      ...(dateFilter && { createdAt: dateFilter }),
    };
    const salesWhere = { ...baseWhere, status: 'COMPLETED' as const };
    const currentPeriodSalesWhere = {
      organizationId,
      status: 'COMPLETED' as const,
      createdAt: comparisonPeriod.current,
    };
    const previousPeriodSalesWhere = {
      organizationId,
      status: 'COMPLETED' as const,
      createdAt: comparisonPeriod.previous,
    };

    const [
      totalSales,
      totalRevenue,
      totalProducts,
      totalCustomers,
      lowStockProducts,
      recentSales,
      currentPeriodSales,
      previousPeriodSales,
      currentPeriodRevenue,
      previousPeriodRevenue,
      currentPeriodCustomers,
      previousPeriodCustomers,
    ] = await Promise.all([
      this.prisma.sale.count({ where: salesWhere }),
      this.prisma.sale.aggregate({
        where: salesWhere,
        _sum: { total: true },
      }),
      this.prisma.product.count({
        where: { organizationId, active: true },
      }),
      this.prisma.customer.count({
        where: { organizationId, active: true },
      }),
      this.prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint as count FROM "Product"
          WHERE "organizationId" = ${organizationId} AND active = true AND stock <= "minStock"
        `.then((r) => Number(r[0].count)),
      this.prisma.sale.findMany({
        where: salesWhere,
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          saleNumber: true,
          total: true,
          status: true,
          createdAt: true,
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            select: {
              id: true,
              quantity: true,
              total: true,
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.sale.count({ where: currentPeriodSalesWhere }),
      this.prisma.sale.count({ where: previousPeriodSalesWhere }),
      this.prisma.sale.aggregate({
        where: currentPeriodSalesWhere,
        _sum: { total: true },
      }),
      this.prisma.sale.aggregate({
        where: previousPeriodSalesWhere,
        _sum: { total: true },
      }),
      this.prisma.customer.count({
        where: {
          organizationId,
          active: true,
          createdAt: comparisonPeriod.current,
        },
      }),
      this.prisma.customer.count({
        where: {
          organizationId,
          active: true,
          createdAt: comparisonPeriod.previous,
        },
      }),
    ]);

    const currentPeriodRevenueValue = Number(
      currentPeriodRevenue._sum.total || 0,
    );
    const previousPeriodRevenueValue = Number(
      previousPeriodRevenue._sum.total || 0,
    );

    const result = {
      totalSales,
      totalRevenue: Number(totalRevenue._sum.total || 0),
      totalProducts,
      totalCustomers,
      lowStockProducts,
      recentSales,
      trends: {
        totalSales: calculatePercentageChange(
          currentPeriodSales,
          previousPeriodSales,
        ),
        totalRevenue: calculatePercentageChange(
          currentPeriodRevenueValue,
          previousPeriodRevenueValue,
        ),
        totalCustomers: calculatePercentageChange(
          currentPeriodCustomers,
          previousPeriodCustomers,
        ),
      },
      previousPeriod: {
        revenue: previousPeriodRevenueValue,
        sales: previousPeriodSales,
      },
      appliedRange: buildAppliedRange(startDate, endDate),
      comparisonRange: buildComparisonRangeMeta(comparisonPeriod),
    };

    this.cache.set(cacheKey, result, 5 * 60 * 1000); // 5 minutes

    return result;
  }

  async getSalesByPaymentMethod(
    organizationId: string,
    startDate?: string,
    endDate?: string,
  ) {
    validateDateRange(startDate, endDate);

    const dateFilter = buildDateFilter(startDate, endDate);
    const where: SaleWhereInput = {
      organizationId,
      status: 'COMPLETED',
      ...(dateFilter && { createdAt: dateFilter }),
    };

    const sales = await this.prisma.sale.findMany({
      where: where as never,
      include: {
        payments: true,
      },
    });

    const paymentMethodTotals = new Map<
      'CASH' | 'CARD' | 'TRANSFER',
      { total: number; subtotal: number; count: number }
    >();

    for (const sale of sales) {
      for (const payment of sale.payments) {
        const current = paymentMethodTotals.get(payment.method) || {
          total: 0,
          subtotal: 0,
          count: 0,
        };
        current.total += Number(payment.amount);
        current.subtotal += Number(payment.amount);
        current.count += 1;
        paymentMethodTotals.set(payment.method, current);
      }
    }

    return {
      data: Array.from(paymentMethodTotals.entries()).map(
        ([method, totals]) => ({
          paymentMethod: method,
          total: totals.total,
          subtotal: totals.subtotal,
          count: totals.count,
        }),
      ),
      appliedRange: buildAppliedRange(startDate, endDate),
    };
  }

  async getSalesByCategory(
    organizationId: string,
    startDate?: string,
    endDate?: string,
  ) {
    validateDateRange(startDate, endDate);
    const dateFilter = buildDateFilter(startDate, endDate);
    const saleNested: SaleNestedWhere = {
      status: 'COMPLETED',
      organizationId,
      ...(dateFilter && { createdAt: dateFilter }),
    };
    const where: SaleItemWhereInput = { sale: saleNested };

    const productsByCategory = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: where as never,
      _sum: { total: true, quantity: true },
    });

    const productIds = productsByCategory.map((p) => p.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, organizationId },
      select: {
        id: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    const categorySales = new Map<
      string,
      { total: number; quantity: number }
    >();

    products.forEach((product) => {
      const saleData = productsByCategory.find(
        (p) => p.productId === product.id,
      );
      if (saleData) {
        const categoryName = product.category.name;
        const existing = categorySales.get(categoryName) ?? {
          total: 0,
          quantity: 0,
        };
        categorySales.set(categoryName, {
          total: existing.total + Number(saleData._sum.total),
          quantity: existing.quantity + (saleData._sum.quantity ?? 0),
        });
      }
    });

    return {
      data: Array.from(categorySales.entries()).map(([category, data]) => ({
        category,
        total: data.total,
        quantity: data.quantity,
      })),
      appliedRange: buildAppliedRange(startDate, endDate),
    };
  }

  async getTopSellingProducts(
    organizationId: string,
    startDate?: string,
    endDate?: string,
    limit: number = 10,
  ) {
    validateDateRange(startDate, endDate);
    const dateFilter = buildDateFilter(startDate, endDate);
    const saleNested: SaleNestedWhere = {
      status: 'COMPLETED',
      organizationId,
      ...(dateFilter && { createdAt: dateFilter }),
    };
    const where: SaleItemWhereInput = { sale: saleNested };

    const products = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: where as never,
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });

    const productIds = products.map((p) => p.productId);
    const productDetails = await this.prisma.product.findMany({
      where: { id: { in: productIds }, organizationId },
      select: {
        id: true,
        name: true,
        stock: true,
      },
    });

    return {
      data: products.map((p) => {
        const product = productDetails.find((pd) => pd.id === p.productId);
        return {
          productId: p.productId,
          productName: product?.name || 'Unknown',
          quantity: p._sum.quantity,
          total: Number(p._sum.total),
          stock: product?.stock || 0,
        };
      }),
      appliedRange: buildAppliedRange(startDate, endDate),
    };
  }

  async getCustomerStatistics(
    organizationId: string,
    startDate?: string,
    endDate?: string,
  ) {
    validateDateRange(startDate, endDate);
    const dateFilter = buildDateFilter(startDate, endDate);
    const where: CustomerSaleWhereInput = {
      organizationId,
      ...(dateFilter && { createdAt: dateFilter }),
    };

    const [totalCustomers, customersWithSales, topCustomers] =
      await Promise.all([
        this.prisma.customer.count({ where: { organizationId, active: true } }),
        this.prisma.sale.groupBy({
          by: ['customerId'],
          where: where as never,
          _count: { id: true },
          _sum: { total: true },
        }),
        this.prisma.sale.groupBy({
          by: ['customerId'],
          where: where as never,
          _count: { id: true },
          _sum: { total: true },
          orderBy: { _sum: { total: 'desc' } },
          take: 10,
        }),
      ]);

    const customerIds = topCustomers
      .map((c) => c.customerId)
      .filter((id): id is string => id !== null);
    const customerDetails = await this.prisma.customer.findMany({
      where: { id: { in: customerIds }, organizationId },
    });

    return {
      totalCustomers,
      activeCustomers: customersWithSales.length,
      topCustomers: topCustomers.map((c) => {
        const customer = customerDetails.find((cd) => cd.id === c.customerId);
        return {
          customerId: c.customerId,
          customerName: customer?.name || 'Guest',
          totalSales: c._count.id,
          totalRevenue: Number(c._sum.total),
        };
      }),
      appliedRange: buildAppliedRange(startDate, endDate),
    };
  }

  async getUserPerformance(
    organizationId: string,
    startDate?: string,
    endDate?: string,
    compare: boolean = true,
    userIds?: string[],
  ): Promise<UserPerformanceReport> {
    validateDateRange(startDate, endDate);

    const comparisonPeriod = buildComparisonPeriod(startDate, endDate);
    const selectedUserIds = normalizeUserIds(userIds);
    const currentFilter = compare
      ? comparisonPeriod.current
      : buildDateFilter(startDate, endDate);
    const currentWhere: SaleWhereInput = {
      organizationId,
      status: 'COMPLETED',
      ...(currentFilter && { createdAt: currentFilter }),
      ...(selectedUserIds && { userId: { in: selectedUserIds } }),
    };

    const currentSales = await this.prisma.sale.findMany({
      where: currentWhere as never,
      select: {
        userId: true,
        total: true,
        customerId: true,
      },
    });

    const aggregateSales = (
      sales: Array<{
        userId: string | null;
        total: unknown;
        customerId: string | null;
      }>,
    ): Map<string, UserAggregation> => {
      const totalsByUser = new Map<string, UserAggregation>();

      for (const sale of sales) {
        if (!sale.userId) continue; // Skip sales with deleted users

        const current = totalsByUser.get(sale.userId) ?? {
          salesCount: 0,
          revenue: 0,
          customerIds: new Set<string>(),
        };

        current.salesCount += 1;
        current.revenue += Number(sale.total);
        if (sale.customerId) {
          current.customerIds.add(sale.customerId);
        }

        totalsByUser.set(sale.userId, current);
      }

      return totalsByUser;
    };

    const currentAggregates = aggregateSales(currentSales);
    let previousAggregates = new Map<string, UserAggregation>();

    if (compare) {
      const previousSales = await this.prisma.sale.findMany({
        where: {
          organizationId,
          status: 'COMPLETED',
          createdAt: comparisonPeriod.previous,
          ...(selectedUserIds && {
            userId: {
              in: selectedUserIds,
            },
          }),
        } as never,
        select: {
          userId: true,
          total: true,
          customerId: true,
        },
      });

      previousAggregates = aggregateSales(previousSales);
    }

    const relevantUserIds =
      selectedUserIds ??
      Array.from(
        new Set([...currentAggregates.keys(), ...previousAggregates.keys()]),
      );

    if (relevantUserIds.length === 0) {
      return {
        data: [],
        appliedRange: buildAppliedRange(startDate, endDate),
        ...(compare && {
          comparisonRange: buildComparisonRangeMeta(comparisonPeriod),
        }),
      };
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: relevantUserIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    const rows = users.map((user) => {
      const current = currentAggregates.get(user.id) ?? {
        salesCount: 0,
        revenue: 0,
        customerIds: new Set<string>(),
      };
      const previous = previousAggregates.get(user.id);

      return {
        userId: user.id,
        userName: user.name,
        salesCount: current.salesCount,
        revenue: current.revenue,
        avgTicket:
          current.salesCount > 0 ? current.revenue / current.salesCount : 0,
        uniqueCustomers: current.customerIds.size,
        comparison: compare
          ? {
              revenuePct: calculatePercentageChange(
                current.revenue,
                previous?.revenue ?? 0,
              ),
              salesPct: calculatePercentageChange(
                current.salesCount,
                previous?.salesCount ?? 0,
              ),
            }
          : undefined,
      };
    });

    return {
      data: rows.toSorted((a, b) => b.revenue - a.revenue),
      appliedRange: buildAppliedRange(
        compare ? formatDateInBogota(comparisonPeriod.current.gte!) : startDate,
        compare ? formatDateInBogota(comparisonPeriod.current.lte!) : endDate,
      ),
      ...(compare && {
        comparisonRange: buildComparisonRangeMeta(comparisonPeriod),
      }),
    };
  }

  async getDailySales(
    organizationId: string,
    startDate: string,
    endDate: string,
  ) {
    validateDateRange(startDate, endDate);
    const startDateFilter = parseBogotaStartOfDay(startDate);
    const endDateFilter = parseBogotaEndOfDay(endDate);

    if (!startDateFilter || !endDateFilter) {
      return { data: [], appliedRange: buildAppliedRange(startDate, endDate) };
    }

    const sales = await this.prisma.sale.findMany({
      where: {
        organizationId,
        status: 'COMPLETED',
        createdAt: {
          gte: startDateFilter,
          lte: endDateFilter,
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true,
        total: true,
        subtotal: true,
        taxAmount: true,
      },
    });

    const salesByDay = new Map<string, DaySummary>();

    sales.forEach((sale) => {
      const date = formatDateInBogota(sale.createdAt);
      const existing: DaySummary = salesByDay.get(date) ?? {
        total: 0,
        subtotal: 0,
        tax: 0,
        count: 0,
      };
      salesByDay.set(date, {
        total: existing.total + Number(sale.total),
        subtotal: existing.subtotal + Number(sale.subtotal),
        tax: existing.tax + Number(sale.taxAmount),
        count: existing.count + 1,
      });
    });

    return {
      data: Array.from(salesByDay.entries()).map(([date, data]) => ({
        date,
        ...data,
      })),
      appliedRange: buildAppliedRange(startDate, endDate),
    };
  }
}
