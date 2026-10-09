import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryLoanOperation,
  InventoryLoanStatus,
  OrgRole,
  Prisma,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryLoanDto } from './dto/create-inventory-loan.dto';
import { CounterpartyType } from './dto/create-loan.dto';
import { deriveInventoryLoanQuantities } from './inventory-loan.invariants';

const itemSelect = {
  id: true,
  productId: true,
  quantity: true,
  deliveredQuantity: true,
  returnedQuantity: true,
  cancelledQuantity: true,
} as const;
function loanSelect(organizationId: string) {
  return {
    id: true,
    organizationId: true,
    status: true,
    createdById: true,
    createdAt: true,
    customerId: true,
    supplierId: true,
    employeeId: true,
    items: {
      where: { organizationId },
      select: itemSelect,
      orderBy: { id: 'asc' as const },
    },
  } satisfies Prisma.InventoryLoanSelect;
}
type Loan = Prisma.InventoryLoanGetPayload<{
  select: ReturnType<typeof loanSelect>;
}>;
function present(loan: Loan) {
  return {
    ...loan,
    createdAt: loan.createdAt.toISOString(),
    items: loan.items.map((item) => ({
      ...item,
      ...deriveInventoryLoanQuantities(item),
    })),
  };
}
type Snapshot = ReturnType<typeof present>;
export interface InventoryLoanQuery {
  page?: number;
  limit?: number;
  status?: InventoryLoanStatus;
  counterpartyType?: CounterpartyType;
  counterpartyId?: string;
}
function organization(id: string | undefined): string {
  if (!id || !id.trim())
    throw new ForbiddenException(
      'Seleccione una organización para operar préstamos',
    );
  return id;
}
function normalize(input: CreateInventoryLoanDto) {
  const dto = plainToInstance(CreateInventoryLoanDto, input);
  if (
    validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }).length
  ) {
    throw new BadRequestException(
      'Solicitud de préstamo de inventario inválida',
    );
  }
  if (
    new Set(dto.items.map((item) => item.productId)).size !== dto.items.length
  ) {
    throw new BadRequestException('Los productos no pueden repetirse');
  }
  // Item order is not semantic. This also gives every writer the same lock order.
  dto.items.sort((a, b) => a.productId.localeCompare(b.productId));
  return dto;
}
function payload(dto: CreateInventoryLoanDto): Prisma.InputJsonObject {
  return {
    type: 'CREATE',
    counterpartyType: dto.counterpartyType,
    customerId:
      dto.counterpartyType === CounterpartyType.CUSTOMER
        ? dto.counterpartyId
        : null,
    supplierId:
      dto.counterpartyType === CounterpartyType.SUPPLIER
        ? dto.counterpartyId
        : null,
    employeeId:
      dto.counterpartyType === CounterpartyType.EMPLOYEE
        ? dto.counterpartyId
        : null,
    items: dto.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
  };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).sort().join(',') === keys.sort().join(',');
}
// Validate the completed CREATE shape, not a live loan fallback. No private fields survive.
function snapshot(operation: InventoryLoanOperation): Snapshot {
  const result: unknown = operation.resultSnapshot;
  const invalid = () =>
    new ConflictException('Resultado de solicitud inválido');
  if (
    !object(result) ||
    !exactKeys(result, [
      'id',
      'organizationId',
      'status',
      'createdById',
      'createdAt',
      'customerId',
      'supplierId',
      'employeeId',
      'items',
    ]) ||
    result.id !== operation.loanId ||
    result.organizationId !== operation.organizationId ||
    result.createdById !== operation.actorId ||
    result.status !== 'OPEN' ||
    typeof result.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(result.createdAt)) ||
    !Array.isArray(result.items) ||
    !result.items.length ||
    result.items.length > 100
  )
    throw invalid();
  const ids = [result.customerId, result.supplierId, result.employeeId];
  if (
    ids.filter((id) => id !== null).length !== 1 ||
    ids.some(
      (id) => id !== null && (typeof id !== 'string' || id.trim().length === 0),
    )
  )
    throw invalid();
  const products = new Set<string>();
  for (const item of result.items) {
    if (
      !object(item) ||
      !exactKeys(item, [
        'id',
        'productId',
        'quantity',
        'deliveredQuantity',
        'returnedQuantity',
        'cancelledQuantity',
        'reservedRemaining',
        'outstanding',
      ]) ||
      typeof item.id !== 'string' ||
      !item.id ||
      typeof item.productId !== 'string' ||
      !item.productId ||
      products.has(item.productId) ||
      !Number.isInteger(item.quantity) ||
      (item.quantity as number) < 1 ||
      (item.quantity as number) > 2147483647 ||
      item.deliveredQuantity !== 0 ||
      item.returnedQuantity !== 0 ||
      item.cancelledQuantity !== 0 ||
      item.reservedRemaining !== item.quantity ||
      item.outstanding !== 0
    )
      throw invalid();
    products.add(item.productId);
  }
  return result as Snapshot;
}
function replay(
  operation: InventoryLoanOperation,
  actorId: string,
  request: Prisma.InputJsonObject,
) {
  if (
    operation.actorId !== actorId ||
    operation.type !== 'CREATE' ||
    canonical(operation.requestPayload) !== canonical(request)
  ) {
    throw new ConflictException('La clave ya pertenece a otra solicitud');
  }
  return snapshot(operation);
}
function page(query: InventoryLoanQuery) {
  const bounded = (value: number | undefined, fallback: number, max: number) =>
    value === undefined
      ? fallback
      : Number.isFinite(value)
        ? Math.min(max, Math.max(1, Math.trunc(value)))
        : fallback;
  const page = bounded(query.page, 1, 1000000);
  const limit = bounded(query.limit, 20, 100);
  return { page, limit, skip: (page - 1) * limit };
}

// Deliberately NOT registered in any Nest module or controller. L3C-C gates rollout.
@Injectable()
export class InventoryLoansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateInventoryLoanDto, actor: RequestUser) {
    const orgId = organization(actor?.organizationId);
    if (
      !actor.userId ||
      ![OrgRole.OWNER, OrgRole.ADMIN, 'SUPER_ADMIN'].includes(actor.role)
    ) {
      throw new ForbiddenException('No tiene permisos para crear préstamos');
    }
    const dto = normalize(input);
    const request = payload(dto);
    const key = {
      organizationId_requestKey: {
        organizationId: orgId,
        requestKey: dto.requestKey,
      },
    };
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Even SUPER_ADMIN needs a real active, administrative same-tenant membership.
          const member = await tx.organizationUser.findFirst({
            where: {
              organizationId: orgId,
              userId: actor.userId,
              role: { in: [OrgRole.OWNER, OrgRole.ADMIN] },
              user: { active: true },
            },
            select: { userId: true },
          });
          if (!member)
            throw new ForbiddenException(
              'Administrador activo de la organización requerido',
            );
          const previous = await tx.inventoryLoanOperation.findUnique({
            where: key,
          });
          if (previous) return replay(previous, actor.userId, request);
          await this.validateCounterparty(tx, dto, orgId);
          for (const item of dto.items) {
            const product = await tx.product.findFirst({
              where: {
                id: item.productId,
                organizationId: orgId,
                active: true,
                type: 'PRODUCT',
                tracksStock: true,
              },
              select: {
                id: true,
                stock: true,
                reservedStock: true,
                version: true,
                type: true,
                tracksStock: true,
              },
            });
            if (!product)
              throw new BadRequestException(
                'Producto activo con inventario requerido',
              );
            if (
              ![product.stock, product.reservedStock, product.version].every(
                (n) => Number.isInteger(n) && n >= 0 && n <= 2147483647,
              ) ||
              product.reservedStock > product.stock ||
              product.type !== 'PRODUCT' ||
              product.tracksStock !== true ||
              product.stock - product.reservedStock < item.quantity ||
              product.version === 2147483647
            ) {
              throw new ConflictException(
                'Inventario disponible insuficiente o inválido',
              );
            }
            const changed = await tx.product.updateMany({
              where: {
                id: item.productId,
                organizationId: orgId,
                active: true,
                type: 'PRODUCT',
                tracksStock: true,
                version: product.version,
                reservedStock: product.reservedStock,
                stock: {
                  equals: product.stock,
                  gte: product.reservedStock + item.quantity,
                },
              },
              data: {
                reservedStock: { increment: item.quantity },
                version: { increment: 1 },
              },
            });
            if (changed.count !== 1)
              throw new ConflictException(
                'El inventario cambió; reintente con la misma clave',
              );
          }
          const loan = await tx.inventoryLoan.create({
            data: {
              organizationId: orgId,
              createdById: actor.userId,
              customerId:
                dto.counterpartyType === CounterpartyType.CUSTOMER
                  ? dto.counterpartyId
                  : null,
              supplierId:
                dto.counterpartyType === CounterpartyType.SUPPLIER
                  ? dto.counterpartyId
                  : null,
              employeeId:
                dto.counterpartyType === CounterpartyType.EMPLOYEE
                  ? dto.counterpartyId
                  : null,
              items: {
                create: dto.items.map((item) => ({
                  ...item,
                  organizationId: orgId,
                })),
              },
            },
            select: loanSelect(orgId),
          });
          const result = present(loan);
          const operation = await tx.inventoryLoanOperation.create({
            data: {
              organizationId: orgId,
              loanId: loan.id,
              actorId: actor.userId,
              type: 'CREATE',
              requestKey: dto.requestKey,
              requestPayload: request,
              resultSnapshot: result,
            },
          });
          await tx.inventoryLoanEvent.create({
            data: {
              loanId: loan.id,
              organizationId: orgId,
              createdById: actor.userId,
              type: 'CREATED',
              operationId: operation.id,
            },
          });
          await tx.auditLog.create({
            data: {
              organizationId: orgId,
              userId: actor.userId,
              action: 'INVENTORY_LOAN_CREATED',
              resource: 'InventoryLoan',
              resourceId: loan.id,
              metadata: { operationId: operation.id },
            },
          });
          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        // Only outside the aborted transaction: never blindly repeat reservations.
        const previous = await this.prisma.inventoryLoanOperation.findUnique({
          where: key,
        });
        if (previous) return replay(previous, actor.userId, request);
        throw new ConflictException(
          'Conflicto de inventario; reintente con la misma clave',
        );
      }
      throw error;
    }
  }

  private async validateCounterparty(
    tx: Prisma.TransactionClient,
    dto: CreateInventoryLoanDto,
    orgId: string,
  ) {
    const where = {
      id: dto.counterpartyId,
      organizationId: orgId,
      active: true,
    };
    const found =
      dto.counterpartyType === CounterpartyType.CUSTOMER
        ? await tx.customer.findFirst({ where, select: { id: true } })
        : dto.counterpartyType === CounterpartyType.SUPPLIER
          ? await tx.supplier.findFirst({ where, select: { id: true } })
          : await tx.organizationUser.findFirst({
              where: {
                userId: dto.counterpartyId,
                organizationId: orgId,
                user: { active: true },
              },
              select: { userId: true },
            });
    if (!found)
      throw new BadRequestException(
        'Contraparte activa de la organización requerida',
      );
  }

  async findAll(query: InventoryLoanQuery, organizationId: string | undefined) {
    const orgId = organization(organizationId);
    if (
      query.status !== undefined &&
      !Object.values(InventoryLoanStatus).includes(query.status)
    ) {
      throw new BadRequestException('Estado de préstamo inválido');
    }
    if (
      (query.counterpartyType === undefined) !==
        (query.counterpartyId === undefined) ||
      (query.counterpartyType !== undefined &&
        (!Object.values(CounterpartyType).includes(query.counterpartyType) ||
          typeof query.counterpartyId !== 'string' ||
          !query.counterpartyId))
    ) {
      throw new BadRequestException('Filtro de contraparte inválido');
    }
    const where: Prisma.InventoryLoanWhereInput = {
      organizationId: orgId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.counterpartyType === CounterpartyType.CUSTOMER
        ? { customerId: query.counterpartyId }
        : {}),
      ...(query.counterpartyType === CounterpartyType.SUPPLIER
        ? { supplierId: query.counterpartyId }
        : {}),
      ...(query.counterpartyType === CounterpartyType.EMPLOYEE
        ? { employeeId: query.counterpartyId }
        : {}),
    };
    const paging = page(query);
    const [rows, total] = await Promise.all([
      this.prisma.inventoryLoan.findMany({
        where,
        select: loanSelect(orgId),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: paging.skip,
        take: paging.limit,
      }),
      this.prisma.inventoryLoan.count({ where }),
    ]);
    return {
      data: rows.map(present),
      total,
      page: paging.page,
      limit: paging.limit,
      totalPages: Math.ceil(total / paging.limit),
    };
  }

  async findOne(id: string, organizationId: string | undefined) {
    const orgId = organization(organizationId);
    const loan = await this.prisma.inventoryLoan.findFirst({
      where: { id, organizationId: orgId },
      select: loanSelect(orgId),
    });
    if (!loan) throw new NotFoundException('Préstamo no encontrado');
    return present(loan);
  }

  async history(
    id: string,
    query: InventoryLoanQuery,
    organizationId: string | undefined,
  ) {
    const orgId = organization(organizationId);
    await this.findOne(id, orgId);
    const where = { loanId: id, organizationId: orgId };
    const paging = page(query);
    const [data, total] = await Promise.all([
      this.prisma.inventoryLoanEvent.findMany({
        where,
        select: {
          id: true,
          loanId: true,
          itemId: true,
          type: true,
          quantity: true,
          createdById: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: paging.skip,
        take: paging.limit,
      }),
      this.prisma.inventoryLoanEvent.count({ where }),
    ]);
    return {
      data,
      total,
      page: paging.page,
      limit: paging.limit,
      totalPages: Math.ceil(total / paging.limit),
    };
  }
}
