import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OrgRole, Prisma, PrismaClient, ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto, UpdateSaleDto } from './dto/sales.dto';
import type { Response } from 'express';
import {
  parseBogotaEndOfDay,
  parseBogotaStartOfDay,
} from '../common/utils/bogota-date';
import { CacheService } from '../common/services/cache.service';
import { SettingsService } from '../settings/settings.service';
import { resolveEffectiveTaxRate } from '../common/utils/tax.util';
import { computeSkipTake } from '../common/utils/pagination';
import { computeEffectiveSalePrice } from '../products/products.service';
import { tracksStock } from '../products/product-type.logic';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { SequenceService } from '../common/sequences/sequence.service';
import { PLAN_LIMITS } from '../plan-limits/plan-limits.constants';
import { ReceiptsService } from '../receipts/receipts.service';

@Injectable()
export class SalesService {
  /** Prisma select for seller attribution on every sale query */
  private readonly sellerInclude = {
    user: { select: { id: true, name: true, email: true } },
  } as const;

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private settingsService: SettingsService,
    private sequenceService: SequenceService,
    private receiptsService: ReceiptsService,
  ) {}

  /**
   * Centralized role-aware scope filter for sale queries.
   * - ADMIN → sees all sales (no filter)
   * - CASHIER → own sales only (sale.userId = user.userId)
   * - Default (INVENTORY_USER / unknown) → own sales only (deny-by-default)
   */
  private buildScopeFilter(user: RequestUser): Record<string, unknown> {
    if (user.role === 'ADMIN') {
      return {};
    }
    // Deny-by-default: any non-ADMIN role sees only own sales
    return { userId: user.userId };
  }

  /**
   * Price override is a manager permission, not a cashier one.
   *
   * Mirrors the hierarchy enforced by `RolesGuard.getInheritedRoles` — OWNER and
   * SUPER_ADMIN inherit ADMIN — so the POS control (which only renders for
   * `hasAnyRole(role, ["ADMIN"])`) and this gate agree on who may override. A
   * missing `user` is treated as "no manager permission" (deny by default),
   * because the price is the server's to defend.
   */
  private canOverridePrice(user: RequestUser | undefined): boolean {
    if (!user) return false;
    if (user.isSuperAdmin || user.role === 'SUPER_ADMIN') return true;
    return user.role === OrgRole.ADMIN || user.role === OrgRole.OWNER;
  }

  /**
   * Writes the audit trail for a single overridden sale line.
   *
   * Follows the `audit(...)` convention of `ExpenseTaxonomyService` (one
   * SCREAMING_SNAKE action, a `resource`/`resourceId` pair, and a JSON
   * `metadata` payload) with the actor on `userId` as `ExpensesService` does.
   * `AuditLog` has no dedicated price columns, so the original and overridden
   * prices live in `metadata` — the model can carry them without a migration.
   *
   * Called inside the sale transaction on purpose: an audit trail that can be
   * lost because a separate write failed is not an audit trail.
   */
  private async auditPriceOverride(
    tx: Prisma.TransactionClient,
    entry: {
      saleId: string;
      saleNumber: number;
      productId: string;
      productName: string;
      quantity: number;
      serverUnitPrice: number;
      overriddenUnitPrice: number;
      userId: string;
      organizationId: string;
      actorRole: string;
    },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        userId: entry.userId,
        action: 'SALE_PRICE_OVERRIDE',
        resource: 'Sale',
        resourceId: entry.saleId,
        organizationId: entry.organizationId,
        metadata: {
          summary: `Price override on sale #${entry.saleNumber}: ${entry.productName} charged at ${entry.overriddenUnitPrice} instead of ${entry.serverUnitPrice}`,
          saleId: entry.saleId,
          saleNumber: entry.saleNumber,
          productId: entry.productId,
          productName: entry.productName,
          quantity: entry.quantity,
          originalUnitPrice: entry.serverUnitPrice,
          overriddenUnitPrice: entry.overriddenUnitPrice,
          actorRole: entry.actorRole,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  async create(
    createSaleDto: CreateSaleDto,
    userId: string,
    organizationId: string | undefined,
    user?: RequestUser,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required for this operation');
    }
    const { customerId, items, discountAmount = 0, payments } = createSaleDto;

    if (items.length === 0) {
      throw new BadRequestException('Sale must have at least one item');
    }

    if (!payments || payments.length === 0) {
      throw new BadRequestException(
        'Sale must have at least one payment method',
      );
    }

    let subtotal = 0;
    let totalTax = 0;
    const saleItems: Array<{
      productId: string;
      productType: ProductType;
      productTracksStock: boolean;
      quantity: number;
      unitPrice: number;
      costPriceSnapshot: Prisma.Decimal;
      taxRate: number;
      discountAmount: number;
      subtotal: number;
      total: number;
    }> = [];

    // Manager-approved price overrides awaiting their audit rows. Collected
    // here so the audit is written against the persisted sale, inside the same
    // transaction that writes it.
    const priceOverrides: Array<{
      productId: string;
      productName: string;
      quantity: number;
      serverUnitPrice: number;
      overriddenUnitPrice: number;
    }> = [];

    for (const item of items) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, organizationId },
        include: { category: true },
      });

      if (!product) {
        throw new NotFoundException(
          `Product with ID ${item.productId} not found`,
        );
      }

      if (!product.active) {
        throw new BadRequestException(`Product ${product.name} is not active`);
      }

      // The server owns the price. `computeEffectiveSalePrice` is the single
      // source of truth (promotion-aware); a client-supplied `unitPrice` is
      // never a default to fall back to, it is a request to override it — and
      // overriding is a manager-only, audited act.
      const serverUnitPrice = Number(
        computeEffectiveSalePrice(product) ?? product.salePrice,
      );
      const requestedUnitPrice =
        item.unitPrice === undefined || item.unitPrice === null
          ? null
          : Number(item.unitPrice);

      // Defensive: the DTO's @Min(0) already rejects negatives, but the service
      // is also reachable from paths that skip the ValidationPipe, and a
      // negative price would flip the sale into money owed rather than paid.
      if (requestedUnitPrice !== null && requestedUnitPrice < 0) {
        throw new BadRequestException(
          `Unit price for product ${product.name} cannot be negative`,
        );
      }

      // 0.01 tolerance absorbs float noise between a client that round-trips
      // the server price and the DECIMAL(10,2) value it was derived from.
      const isOverride =
        requestedUnitPrice !== null &&
        Math.abs(requestedUnitPrice - serverUnitPrice) > 0.01;

      if (isOverride && !this.canOverridePrice(user)) {
        throw new ForbiddenException(
          `Only an ADMIN may override the unit price of ${product.name}`,
        );
      }

      const unitPrice = requestedUnitPrice ?? serverUnitPrice;

      if (isOverride) {
        priceOverrides.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          serverUnitPrice,
          overriddenUnitPrice: unitPrice,
        });
      }

      const grossSubtotal = unitPrice * item.quantity;
      const itemDiscount = Math.max(0, item.discountAmount || 0);

      if (itemDiscount > grossSubtotal) {
        throw new BadRequestException(
          `Item discount for product ${product.name} cannot exceed item subtotal`,
        );
      }

      const itemSubtotal = grossSubtotal - itemDiscount;
      const effectiveTaxRate = resolveEffectiveTaxRate(product, product.category);
      const itemTax = itemSubtotal * (effectiveTaxRate / 100);
      const itemTotal = itemSubtotal + itemTax;

      subtotal += itemSubtotal;
      totalTax += itemTax;

      saleItems.push({
        productId: product.id,
        productType: product.type,
        productTracksStock: product.tracksStock,
        quantity: item.quantity,
        unitPrice,
        costPriceSnapshot: product.costPrice,
        taxRate: effectiveTaxRate,
        discountAmount: itemDiscount,
        subtotal: itemSubtotal,
        total: itemTotal,
      });
    }

    const total = subtotal + totalTax - discountAmount;

    if (total < 0) {
      throw new BadRequestException('Total cannot be negative');
    }

    const totalPaid = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

    if (totalPaid < total) {
      throw new BadRequestException(
        `Total paid (${totalPaid}) is less than total (${total})`,
      );
    }

    const cashPaid = payments
      .filter((p) => p.method === 'CASH')
      .reduce((sum, p) => sum + p.amount, 0);
    const change = cashPaid > total ? cashPaid - total : null;

    if (customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId, organizationId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
    }

    const year = new Date().getFullYear();

    try {
      const sale = await this.prisma.$transaction(
        async (tx) => {
          const { number: saleNumber } = await this.sequenceService.nextNumber(
            tx,
            organizationId,
            'SALE',
            year,
          );

          const createdSale = await tx.sale.create({
            data: {
              saleNumber,
              customerId,
              subtotal,
              taxAmount: totalTax,
              discountAmount,
              total,
              amountPaid: totalPaid,
              change,
              status: 'COMPLETED',
              userId,
              organizationId,
            },
          });

          for (const saleItem of saleItems) {
            await tx.saleItem.create({
              data: {
                saleId: createdSale.id,
                productId: saleItem.productId,
                quantity: saleItem.quantity,
                unitPrice: saleItem.unitPrice,
                costPriceSnapshot: saleItem.costPriceSnapshot,
                taxRate: saleItem.taxRate,
                discountAmount: saleItem.discountAmount,
                subtotal: saleItem.subtotal,
                total: saleItem.total,
                organizationId,
              },
            });

            // A service is sold labour, not merchandise: it has no stock to
            // guard, decrement or record. The flag travels with the computed
            // sale line, read from the product row that priced it.
            if (
              tracksStock({
                type: saleItem.productType,
                tracksStock: saleItem.productTracksStock,
              })
            ) {
              const updatedProduct = await tx.product.updateMany({
                where: {
                  id: saleItem.productId,
                  active: true,
                  stock: { gte: saleItem.quantity },
                },
                data: {
                  stock: { decrement: saleItem.quantity },
                },
              });

              if (updatedProduct.count === 0) {
                throw new ConflictException(
                  `Insufficient stock for product ${saleItem.productId}`,
                );
              }

              const productAfterUpdate = await tx.product.findFirst({
                where: { id: saleItem.productId, organizationId },
                select: { stock: true },
              });

              if (!productAfterUpdate) {
                throw new NotFoundException(
                  `Product with ID ${saleItem.productId} not found`,
                );
              }

              const newStock = productAfterUpdate.stock;
              const previousStock = newStock + saleItem.quantity;

              await tx.inventoryMovement.create({
                data: {
                  productId: saleItem.productId,
                  type: 'SALE' as const,
                  quantity: -saleItem.quantity,
                  previousStock,
                  newStock,
                  reason: `Sale #${saleNumber}`,
                  userId,
                  saleId: createdSale.id,
                  organizationId,
                },
              });
            }
          }

          // Every override leaves a trail, written in the same transaction as
          // the sale it explains: if the audit cannot be persisted, the sale
          // rolls back with it.
          for (const override of priceOverrides) {
            await this.auditPriceOverride(tx, {
              saleId: createdSale.id,
              saleNumber,
              userId,
              organizationId,
              actorRole: user?.role ?? 'UNKNOWN',
              ...override,
            });
          }

          for (const payment of payments) {
            await tx.payment.create({
              data: {
                saleId: createdSale.id,
                method: payment.method,
                amount: payment.amount,
                organizationId,
              },
            });
          }

          return createdSale;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        },
      );

      this.cache.clear('dashboard:');

      return this.findOne(sale.id, organizationId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2028'
      ) {
        throw new ServiceUnavailableException('Intente nuevamente');
      }
      throw error;
    }
  }

  async findAll(
    organizationId: string | undefined,
    page = 1,
    limit = 10,
    startDate?: string,
    endDate?: string,
    status?: string,
    search?: string,
    customerId?: string,
    user?: RequestUser,
  ) {
    const { skip, take } = computeSkipTake(page, limit);

    const where: Record<string, unknown> = {
      ...(organizationId ? { organizationId } : {}),
      ...(user ? this.buildScopeFilter(user) : {}),
    };

    if (status) {
      where.status = status as never;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (startDate || endDate) {
      const createdAtFilter: Record<string, Date> = {};

      const startDateFilter = parseBogotaStartOfDay(startDate);
      if (startDateFilter) {
        createdAtFilter.gte = startDateFilter;
      }

      const endDateFilter = parseBogotaEndOfDay(endDate);
      if (endDateFilter) {
        createdAtFilter.lte = endDateFilter;
      }

      where.createdAt = createdAtFilter;
    }

    const normalizedSearch = search?.trim();
    if (normalizedSearch) {
      const orFilters: Record<string, unknown>[] = [
        {
          customer: {
            is: {
              name: {
                contains: normalizedSearch,
                mode: 'insensitive' as const,
              },
            },
          },
        },
      ];

      const saleNumber = Number.parseInt(normalizedSearch, 10);
      if (!Number.isNaN(saleNumber)) {
        orFilters.push({ saleNumber });
      }

      where.OR = orFilters;
    }

    const [sales, total] = await Promise.all([
      this.prisma.sale.findMany({
        where: where as never,
        skip,
        take,
        include: {
          customer: true,
          items: {
            include: { product: true },
          },
          payments: true,
          ...this.sellerInclude,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sale.count({ where: where as never }),
    ]);

    return {
      data: sales,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, organizationId: string | undefined, user?: RequestUser) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
        payments: true,
        ...this.sellerInclude,
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    // Deny-by-default: if user context is provided, enforce scope
    if (user && user.role !== 'ADMIN' && sale.userId !== user.userId) {
      throw new ForbiddenException('You do not have access to this sale');
    }

    return sale;
  }

  async findBySaleNumber(saleNumber: number, user?: RequestUser) {
    if (!user || !user.organizationId) {
      return null;
    }
    const sale = await this.prisma.sale.findUnique({
      where: {
        organizationId_saleNumber: {
          organizationId: user.organizationId,
          saleNumber,
        },
      },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
        payments: true,
        ...this.sellerInclude,
      },
    });

    if (!sale) {
      return null;
    }

    // Deny-by-default: if user context is provided, enforce scope
    if (user && user.role !== 'ADMIN' && sale.userId !== user.userId) {
      throw new ForbiddenException('You do not have access to this sale');
    }

    return sale;
  }

  async update(
    id: string,
    updateSaleDto: UpdateSaleDto,
    userId: string,
    organizationId: string | undefined,
    user?: RequestUser,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required for this operation');
    }
    const existingSale = await this.prisma.sale.findFirst({
      where: { id, organizationId },
      include: { items: true },
    });

    if (!existingSale) {
      throw new NotFoundException('Sale not found');
    }

    // Deny-by-default: non-ADMIN users can only update own sales
    if (user && user.role !== 'ADMIN' && existingSale.userId !== user.userId) {
      throw new ForbiddenException('You do not have access to this sale');
    }

    if (existingSale.status !== 'COMPLETED') {
      throw new BadRequestException('Only completed sales can be updated');
    }

    if (updateSaleDto.status === 'CANCELLED') {
      await this.prisma.$transaction(async (tx) => {
        for (const item of existingSale.items) {
          const product = await tx.product.findFirst({
            where: {
              id: item.productId,
              organizationId: existingSale.organizationId,
            },
          });

          if (product && tracksStock(product)) {
            const previousStock = product.stock;
            const newStock = previousStock + item.quantity;

            await tx.product.update({
              where: { id: item.productId },
              data: { stock: newStock },
            });

            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                type: 'RETURN' as const,
                quantity: item.quantity,
                previousStock,
                newStock,
                reason: `Sale #${existingSale.saleNumber} cancelled`,
                userId,
                saleId: existingSale.id,
                organizationId: existingSale.organizationId,
              },
            });
          }
        }

        await tx.sale.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledById: userId,
            cancelReason: updateSaleDto.cancelReason ?? null,
          },
        });
      });

      return this.findOne(id, organizationId);
    }

    if (updateSaleDto.status === 'RETURNED_PARTIAL') {
      return this.prisma.sale.update({
        where: { id },
        data: { status: updateSaleDto.status },
      });
    }

    return this.findOne(id, organizationId);
  }

  /**
   * Force-closes an OPEN sale. Currently disabled because the application
   * does not support creating sales with status OPEN (all sales are created
   * as COMPLETED). This method is preserved for future use when open-sale
   * workflows are implemented.
   */
  async forceClose(id: string, organizationId: string | undefined, reason?: string) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required for this operation');
    }
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (!['BASIC', 'PRO'].includes(organization.plan)) {
      throw new BadRequestException('Invalid organization plan');
    }

    if (!PLAN_LIMITS[organization.plan].hasForceClose) {
      throw new ForbiddenException('Force close is only available on PRO plan');
    }

    const sale = await this.prisma.sale.findFirst({
      where: { id, organizationId },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    if ((sale.status as string) !== 'OPEN') {
      throw new BadRequestException('Only open sales can be force closed');
    }

    await this.prisma.sale.update({
      where: { id },
      data: {
        status: 'CLOSED' as never,
        ...(reason ? { cancelReason: reason } : {}),
      },
    });

    this.cache.clear('dashboard:');

    return this.findOne(id, organizationId);
  }

  /**
   * Generates the sale receipt PDF. Rendering lives in ReceiptsService
   * (data-in/Buffer-out); this method keeps HTTP response handling.
   */
  async generateReceipt(id: string, response: Response, user?: RequestUser) {
    const sale = await this.findOne(id, user?.organizationId, user);
    const settings = await this.settingsService.find(user?.organizationId);
    const pdf = this.receiptsService.generateSaleReceiptPdf(sale, settings);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename=comprobante_${sale.saleNumber}.pdf`,
    );
    response.send(pdf);
  }
}
