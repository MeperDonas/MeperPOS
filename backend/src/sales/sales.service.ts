import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto, UpdateSaleDto } from './dto/sales.dto';
import { jsPDF } from 'jspdf';
import type { Response } from 'express';
import {
  parseBogotaEndOfDay,
  parseBogotaStartOfDay,
} from '../common/utils/bogota-date';
import { CacheService } from '../common/services/cache.service';
import { SettingsService } from '../settings/settings.service';
import { resolveEffectiveTaxRate } from '../common/utils/tax.util';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { SequenceService } from '../common/sequences/sequence.service';
import { PLAN_LIMITS } from '../plan-limits/plan-limits.constants';

interface SaleItem {
  taxRate: unknown;
}

interface SaleWithItems {
  items?: SaleItem[];
}

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

  async create(
    createSaleDto: CreateSaleDto,
    userId: string,
    organizationId: string,
  ) {
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
      quantity: number;
      unitPrice: number;
      taxRate: number;
      discountAmount: number;
      subtotal: number;
      total: number;
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

      const unitPrice = Number(product.salePrice);
      const grossSubtotal = unitPrice * item.quantity;
      const itemDiscount = Math.max(0, item.discountAmount || 0);

      if (itemDiscount > grossSubtotal) {
        throw new BadRequestException(
          `Item discount for product ${product.name} cannot exceed item subtotal`,
        );
      }

      const itemSubtotal = grossSubtotal - itemDiscount;
      const effectiveTaxRate = resolveEffectiveTaxRate(
        product.taxRate,
        product.category?.defaultTaxRate ?? null,
        0,
      );
      const itemTax = itemSubtotal * (effectiveTaxRate / 100);
      const itemTotal = itemSubtotal + itemTax;

      subtotal += itemSubtotal;
      totalTax += itemTax;

      saleItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
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
                taxRate: saleItem.taxRate,
                discountAmount: saleItem.discountAmount,
                subtotal: saleItem.subtotal,
                total: saleItem.total,
                organizationId,
              },
            });

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
    organizationId: string,
    page = 1,
    limit = 10,
    startDate?: string,
    endDate?: string,
    status?: string,
    search?: string,
    customerId?: string,
    user?: RequestUser,
  ) {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      organizationId,
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
        take: limit,
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

  async findOne(id: string, organizationId: string, user?: RequestUser) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, organizationId },
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
    if (!user) {
      return null;
    }
    const sale = await this.prisma.sale.findUnique({
      where: {
        organizationId_saleNumber: {
          organizationId: user.organizationId!,
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
    organizationId: string,
    user?: RequestUser,
  ) {
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

          if (product) {
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
  async forceClose(id: string, organizationId: string, reason?: string) {
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

  async generateReceipt(id: string, response: Response, user?: RequestUser) {
    const organizationId = user?.organizationId ?? '';
    const sale = await this.findOne(id, organizationId, user);
    const settings = user
      ? await this.settingsService.find(user.organizationId!)
      : {};

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 300],
    });
    const companyName = settings?.companyName || 'Mi Negocio';
    const printHeader = settings?.printHeader || '';
    const printFooter = settings?.printFooter || '';
    const logoUrl = settings?.logoUrl;

    const margin = 4;
    const maxWidth = 80 - margin * 2;
    let y = 5;

    if (logoUrl) {
      try {
        doc.addImage(logoUrl, 'PNG', 40 - 15, y, 30, 15, undefined, 'FAST');
        y += 17;
      } catch (error) {
        console.error('Error loading logo:', error);
      }
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const companyNameLines = doc.splitTextToSize(
      companyName.toUpperCase(),
      maxWidth,
    ) as string[];
    companyNameLines.forEach((line: string) => {
      doc.text(line, 40, y, { align: 'center' });
      y += 5;
    });
    y += 2;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    if (printHeader) {
      const headerLines = doc.splitTextToSize(
        printHeader,
        maxWidth,
      ) as string[];
      headerLines.forEach((line: string) => {
        doc.text(line, 40, y, { align: 'center' });
        y += 3.5;
      });
    }

    y += 3;
    doc.line(margin, y, 80 - margin, y);
    y += 4;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const receiptDate = new Date(sale.createdAt).toLocaleDateString('es-CO');
    const receiptTime = new Date(sale.createdAt).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });
    doc.text(
      `No. ${sale.saleNumber}    ${receiptDate} ${receiptTime}`,
      margin,
      y,
    );
    y += 5;

    if (sale.customer) {
      doc.text(`Cliente: ${sale.customer.name}`, margin, y);
      y += 4;
    }

    if (sale.payments && sale.payments.length > 0) {
      if (sale.payments.length === 1) {
        doc.text(
          `Pago: ${this.getPaymentMethodText(sale.payments[0].method)}`,
          margin,
          y,
        );
      } else {
        doc.text(`Pago: Mixto (${sale.payments.length} métodos)`, margin, y);
      }
      y += 4;
    }

    doc.line(margin, y, 80 - margin, y);
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('CANT  ITEM            $UNIT      $TOTAL', margin, y);
    y += 3;
    doc.line(margin, y, 80 - margin, y);
    y += 3;

    doc.setFont('helvetica', 'normal');
    for (const item of sale.items) {
      const productName = item.product?.name || 'Producto eliminado';
      const itemName =
        productName.length > 14
          ? productName.substring(0, 14) + '..'
          : productName;

      doc.text(`${item.quantity}`, margin + 2, y);
      doc.text(itemName, margin + 9, y);
      doc.text(
        this.formatCurrencyCompact(Number(item.unitPrice)),
        margin + 33,
        y,
      );
      doc.text(
        this.formatCurrencyCompact(Number(item.total)),
        80 - margin - 15,
        y,
      );
      y += 4;
    }

    y += 2;
    doc.line(margin, y, 80 - margin, y);
    y += 4;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('SUBTOTAL', margin, y);
    doc.text(
      this.formatCurrencyCompact(Number(sale.subtotal)),
      80 - margin - 15,
      y,
    );
    y += 4;

    const taxAmount = Number(sale.taxAmount);
    if (taxAmount > 0) {
      doc.text(`IVA (${this.getTaxRate(sale)}%)`, margin, y);
      doc.text(this.formatCurrencyCompact(taxAmount), 80 - margin - 15, y);
      y += 4;
    }

    const discountAmount = Number(sale.discountAmount);
    if (discountAmount > 0) {
      doc.text('DESCUENTO', margin, y);
      doc.text(
        `-${this.formatCurrencyCompact(discountAmount)}`,
        80 - margin - 15,
        y,
      );
      y += 4;
    }

    doc.line(margin, y, 80 - margin, y);
    y += 4;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL A PAGAR', margin, y);
    doc.text(
      this.formatCurrencyCompact(Number(sale.total)),
      80 - margin - 18,
      y,
    );
    y += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    if (sale.payments && sale.payments.length > 0) {
      if (sale.payments.length > 1) {
        y += 3;
        doc.line(margin, y, 80 - margin, y);
        y += 3;
        doc.setFont('helvetica', 'bold');
        doc.text('PAGOS:', margin, y);
        y += 4;
        doc.setFont('helvetica', 'normal');

        for (const payment of sale.payments) {
          const methodText = this.getPaymentMethodText(payment.method);
          doc.text(`${methodText}:`, margin, y);
          doc.text(
            this.formatCurrencyCompact(Number(payment.amount)),
            80 - margin - 15,
            y,
          );
          y += 4;
        }
      } else {
        const cashPayment = sale.payments.find((p) => p.method === 'CASH');
        if (cashPayment) {
          doc.text('RECIBIDO:', margin, y);
          doc.text(
            this.formatCurrencyCompact(Number(cashPayment.amount)),
            80 - margin - 15,
            y,
          );
          y += 4;

          if (sale.change !== null && Number(sale.change) > 0) {
            doc.text('CAMBIO:', margin, y);
            doc.text(
              this.formatCurrencyCompact(Number(sale.change)),
              80 - margin - 15,
              y,
            );
            y += 4;
          }
        }
      }
    }

    y += 4;
    doc.line(margin, y, 80 - margin, y);
    y += 5;

    doc.setFontSize(7);
    if (printFooter) {
      const footerLines = doc.splitTextToSize(
        printFooter,
        maxWidth,
      ) as string[];
      footerLines.forEach((line: string) => {
        doc.text(line, 40, y, { align: 'center' });
        y += 3.5;
      });
    }

    y += 3;
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('*** GRACIAS POR SU COMPRA ***', 40, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename=comprobante_${sale.saleNumber}.pdf`,
    );
    response.send(Buffer.from(doc.output('arraybuffer')));
  }

  private getTaxRate(sale: SaleWithItems): number {
    if (sale.items && sale.items.length > 0) {
      const firstItem = sale.items[0];
      return Number(firstItem.taxRate) || 0;
    }
    return 0;
  }

  private formatCurrencyCompact(amount: number): string {
    if (amount >= 1000000) {
      return '$' + (amount / 1000000).toFixed(2) + 'M';
    } else if (amount >= 1000) {
      return '$' + (amount / 1000).toFixed(0) + 'K';
    } else {
      return '$' + amount.toFixed(0);
    }
  }

  private getPaymentMethodText(method: string): string {
    const methods: Record<string, string> = {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      TRANSFER: 'Transferencia',
    };
    return methods[method] || method;
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
    }).format(amount);
  }
}
