import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExpensePaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateExpensePaymentDto } from './dto/create-expense-payment.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

const MONTH_REGEX = /^\d{4}-\d{2}$/;
const BOGOTA_OFFSET_UTC_HOURS = 5;

export function deriveExpensePaymentStatus(
  total: Prisma.Decimal,
  paymentsSum: Prisma.Decimal,
): ExpensePaymentStatus {
  return paymentsSum.gte(total) ? 'PAID' : 'PARTIAL';
}

export function buildMonthRange(month: string): {
  start: Date;
  end: Date;
} {
  if (!MONTH_REGEX.test(month)) {
    throw new BadRequestException('El formato del mes debe ser YYYY-MM');
  }

  const [year, monthIndex] = month.split('-').map(Number);
  const start = new Date(
    Date.UTC(year, monthIndex - 1, 1, BOGOTA_OFFSET_UTC_HOURS, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(year, monthIndex, 1, BOGOTA_OFFSET_UTC_HOURS, 0, 0, 0) - 1,
  );

  return { start, end };
}

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  private requireOrganizationId(organizationId: string | undefined): string {
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID is required for this operation',
      );
    }
    return organizationId;
  }

  private async assertCategoryInOrganization(
    categoryId: string,
    organizationId: string,
  ): Promise<void> {
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id: categoryId, organizationId },
    });
    if (!category) {
      throw new NotFoundException('Categoría de salidas no encontrada');
    }
  }

  private async assertSupplierInOrganization(
    supplierId: string,
    organizationId: string,
  ): Promise<void> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId },
    });
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }
  }

  private async assertPurchaseOrderInOrganization(
    purchaseOrderId: string,
    organizationId: string,
  ): Promise<void> {
    const purchaseOrder = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, organizationId },
    });
    if (!purchaseOrder) {
      throw new NotFoundException('Orden de compra no encontrada');
    }
  }

  private sumPayments(payments: { amount: Prisma.Decimal }[]): Prisma.Decimal {
    return payments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Prisma.Decimal(0),
    );
  }

  async create(
    dto: CreateExpenseDto,
    userId: string,
    organizationId: string | undefined,
  ) {
    const orgId = this.requireOrganizationId(organizationId);

    await this.assertCategoryInOrganization(dto.categoryId, orgId);
    if (dto.supplierId) {
      await this.assertSupplierInOrganization(dto.supplierId, orgId);
    }
    if (dto.purchaseOrderId) {
      await this.assertPurchaseOrderInOrganization(dto.purchaseOrderId, orgId);
    }

    if (dto.payments.length === 0) {
      throw new BadRequestException(
        'Cada salida debe registrarse con al menos un pago',
      );
    }

    const total = new Prisma.Decimal(dto.total);
    const paymentsSum = this.sumPayments(
      dto.payments.map((payment) => ({
        amount: new Prisma.Decimal(payment.amount),
      })),
    );

    if (paymentsSum.gt(total)) {
      throw new BadRequestException(
        'La suma de los pagos no puede superar el total de la salida',
      );
    }

    const status = deriveExpensePaymentStatus(total, paymentsSum);

    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          organizationId: orgId,
          categoryId: dto.categoryId,
          supplierId: dto.supplierId ?? null,
          purchaseOrderId: dto.purchaseOrderId ?? null,
          description: dto.description ?? null,
          date: new Date(dto.date),
          total,
          status,
          createdById: userId,
          payments: {
            create: dto.payments.map((payment) => ({
              organizationId: orgId,
              amount: new Prisma.Decimal(payment.amount),
              method: payment.method,
              date: new Date(payment.date),
            })),
          },
        },
        include: { payments: true, category: true, supplier: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'EXPENSE_CREATED',
          resource: 'Expense',
          resourceId: expense.id,
          organizationId: orgId,
          metadata: {
            summary: `Salida creada por ${total.toString()}`,
            total: total.toString(),
            status,
            payments: dto.payments.map((payment) => ({
              amount: new Prisma.Decimal(payment.amount).toString(),
              method: payment.method,
              date: payment.date,
            })),
            timestamp: new Date().toISOString(),
          },
        },
      });

      return expense;
    });
  }

  async findAll(query: QueryExpensesDto, organizationId: string | undefined) {
    const orgId = this.requireOrganizationId(organizationId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {
      organizationId: orgId,
      active: true,
    };

    if (query.month) {
      const { start, end } = buildMonthRange(query.month);
      where.date = { gte: start, lte: end };
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }
    if (query.status) {
      where.status = query.status;
    }

    const search = query.search?.trim();
    if (search) {
      where.description = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: { category: true, supplier: true, payments: true },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, organizationId: string | undefined) {
    const orgId = this.requireOrganizationId(organizationId);

    const expense = await this.prisma.expense.findFirst({
      where: { id, organizationId: orgId },
      include: {
        category: true,
        supplier: true,
        purchaseOrder: true,
        payments: { orderBy: { date: 'asc' } },
      },
    });

    if (!expense) {
      throw new NotFoundException('Salida no encontrada');
    }

    return expense;
  }

  async update(
    id: string,
    dto: UpdateExpenseDto,
    userId: string,
    organizationId: string | undefined,
  ) {
    const orgId = this.requireOrganizationId(organizationId);

    const existing = await this.prisma.expense.findFirst({
      where: { id, organizationId: orgId },
      include: { payments: true },
    });

    if (!existing) {
      throw new NotFoundException('Salida no encontrada');
    }

    if (dto.categoryId) {
      await this.assertCategoryInOrganization(dto.categoryId, orgId);
    }
    if (dto.supplierId) {
      await this.assertSupplierInOrganization(dto.supplierId, orgId);
    }
    if (dto.purchaseOrderId) {
      await this.assertPurchaseOrderInOrganization(dto.purchaseOrderId, orgId);
    }

    const newTotal =
      dto.total !== undefined ? new Prisma.Decimal(dto.total) : existing.total;
    const paymentsSum = this.sumPayments(existing.payments);

    if (newTotal.lt(paymentsSum)) {
      throw new BadRequestException(
        'El nuevo total no puede ser menor que la suma de los pagos registrados',
      );
    }

    const status = deriveExpensePaymentStatus(newTotal, paymentsSum);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: {
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
          ...(dto.purchaseOrderId !== undefined && {
            purchaseOrderId: dto.purchaseOrderId,
          }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.date !== undefined && { date: new Date(dto.date) }),
          ...(dto.total !== undefined && { total: newTotal }),
          status,
        },
        include: { category: true, supplier: true, payments: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'EXPENSE_UPDATED',
          resource: 'Expense',
          resourceId: id,
          organizationId: orgId,
          metadata: {
            summary: 'Salida actualizada',
            before: {
              total: existing.total.toString(),
              status: existing.status,
              description: existing.description,
              date: existing.date.toISOString(),
            },
            after: {
              total: updated.total.toString(),
              status: updated.status,
              description: updated.description,
              date: updated.date.toISOString(),
            },
            timestamp: new Date().toISOString(),
          },
        },
      });

      return updated;
    });
  }

  async addPayment(
    id: string,
    dto: CreateExpensePaymentDto,
    userId: string,
    organizationId: string | undefined,
  ) {
    const orgId = this.requireOrganizationId(organizationId);

    const existing = await this.prisma.expense.findFirst({
      where: { id, organizationId: orgId },
      include: { payments: true },
    });

    if (!existing) {
      throw new NotFoundException('Salida no encontrada');
    }

    if (!existing.active) {
      throw new BadRequestException(
        'No se pueden registrar pagos en una salida eliminada',
      );
    }

    const amount = new Prisma.Decimal(dto.amount);
    const paymentsSum = this.sumPayments(existing.payments).add(amount);

    if (paymentsSum.gt(existing.total)) {
      throw new BadRequestException(
        'La suma de los pagos no puede superar el total de la salida',
      );
    }

    const status = deriveExpensePaymentStatus(existing.total, paymentsSum);

    return this.prisma.$transaction(async (tx) => {
      await tx.expensePayment.create({
        data: {
          expenseId: id,
          organizationId: orgId,
          amount,
          method: dto.method,
          date: new Date(dto.date),
        },
      });

      const updated = await tx.expense.update({
        where: { id },
        data: { status },
        include: { category: true, supplier: true, payments: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'EXPENSE_PAYMENT_ADDED',
          resource: 'Expense',
          resourceId: id,
          organizationId: orgId,
          metadata: {
            summary: `Pago de ${amount.toString()} registrado`,
            amount: amount.toString(),
            method: dto.method,
            date: dto.date,
            beforeStatus: existing.status,
            afterStatus: status,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return updated;
    });
  }

  async remove(id: string, userId: string, organizationId: string | undefined) {
    const orgId = this.requireOrganizationId(organizationId);

    const existing = await this.prisma.expense.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException('Salida no encontrada');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: { active: false },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'EXPENSE_DELETED',
          resource: 'Expense',
          resourceId: id,
          organizationId: orgId,
          metadata: {
            summary: 'Salida eliminada (borrado lógico)',
            total: existing.total.toString(),
            timestamp: new Date().toISOString(),
          },
        },
      });

      return updated;
    });
  }
}
