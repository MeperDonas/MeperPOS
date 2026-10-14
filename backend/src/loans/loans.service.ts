import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MoneyLoanEventType,
  MoneyLoanStatus,
  MonetaryLoanType,
  PaymentMethod,
  Prisma,
  type PosLoanSaleIntent,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CounterpartyType, CreateLoanDto } from './dto/create-loan.dto';
import { QueryLoansDto } from './dto/query-loans.dto';
import { CreatePosLoanDto } from './dto/create-pos-loan.dto';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import {
  buildSaleQuote,
  canOverrideSalePrice,
  resolveSaleItemPricing,
} from '../sales/sale-pricing';
import { prepareSaleQuoteForStorage } from '../sales/sale-quote-storage';
import { tracksStock } from '../products/product-type.logic';

const personSelect = { id: true, name: true } as const;
const loanSelect = {
  type: true,
  id: true,
  amount: true,
  status: true,
  version: true,
  events: { select: { id: true, type: true, amount: true, reversesId: true } },
  issuedAt: true,
  dueAt: true,
  reason: true,
  customerId: true,
  supplierId: true,
  employeeId: true,
  createdById: true,
  createdAt: true,
  customer: { select: personSelect },
  supplier: { select: personSelect },
  employee: { select: personSelect },
  createdBy: { select: personSelect },
} satisfies Prisma.MoneyLoanSelect;
const eventSelect = {
  id: true,
  loanId: true,
  type: true,
  amount: true,
  method: true,
  reversesId: true,
  reason: true,
  createdById: true,
  createdAt: true,
  createdBy: { select: personSelect },
} satisfies Prisma.MoneyLoanEventSelect;

type Loan = Prisma.MoneyLoanGetPayload<{ select: typeof loanSelect }>;

function totals(loan: Loan) {
  const collected = loan.events.reduce((total, event) => {
    if (event.type === MoneyLoanEventType.COLLECTED)
      return total.plus(event.amount!);
    if (event.type === MoneyLoanEventType.REVERSED)
      return total.minus(event.amount!);
    return total;
  }, new Prisma.Decimal(0));
  const balance = loan.amount.minus(collected);
  return {
    collected: collected.toFixed(2),
    balance: balance.toFixed(2),
    paymentStatus: balance.isZero()
      ? 'PAID'
      : collected.isZero()
        ? 'UNPAID'
        : 'PARTIAL',
  };
}

function present(loan: Loan) {
  const { events, version, ...data } = loan;
  void events;
  void version;
  return { ...data, ...totals(loan) };
}

function requireOrganization(organizationId: string | undefined): string {
  if (!organizationId) {
    throw new ForbiddenException(
      'Seleccione una organización para operar préstamos',
    );
  }
  return organizationId;
}

function supportedType(type: unknown): MonetaryLoanType | undefined {
  if (type === undefined) return undefined;
  if (type !== MonetaryLoanType.MONEY && type !== MonetaryLoanType.SERVICE) {
    throw new BadRequestException('Tipo de préstamo no soportado');
  }
  return type;
}

function pagination(query: QueryLoansDto) {
  // Defensive bounds also protect internal callers that bypass the DTO pipe.
  const page = Math.min(1000000, Math.max(1, Math.trunc(query.page || 1)));
  const limit = Math.min(100, Math.max(1, Math.trunc(query.limit || 20)));
  return { page, limit, skip: (page - 1) * limit };
}

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  async initiateFromPos(
    dto: CreatePosLoanDto,
    organizationId: string | undefined,
    actor: RequestUser | undefined,
  ): Promise<Prisma.JsonObject> {
    const orgId = requireOrganization(organizationId);
    if (
      !actor?.userId ||
      (!actor.isSuperAdmin &&
        actor.role !== 'SUPER_ADMIN' &&
        (actor.organizationId !== orgId ||
          !['OWNER', 'ADMIN', 'CASHIER', 'MEMBER'].includes(actor.role)))
    ) {
      throw new ForbiddenException('No tiene permiso para financiar ventas');
    }
    dto = plainToInstance(CreatePosLoanDto, dto);
    const payload = this.posRequestPayload(dto);
    const hash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const where = {
      organizationId: orgId,
      initiationRequestKey: dto.requestKey,
    };
    const replay = (intent: PosLoanSaleIntent) =>
      this.posInitiationReplay(
        intent,
        orgId,
        actor.userId,
        dto.requestKey,
        hash,
      );
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const prior = await tx.posLoanSaleIntent.findFirst({ where });
          if (prior) return replay(prior);
          if (
            validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })
              .length ||
            (dto.dueAt != null && dto.dueAt < dto.issuedAt)
          ) {
            throw new BadRequestException('Solicitud de financiación inválida');
          }
          const user = await tx.user.findFirst({
            where: { id: actor.userId, active: true },
            select: { id: true },
          });
          if (!user) throw new ForbiddenException('El actor no está activo');
          await this.validateCounterparty(
            tx,
            {
              counterpartyType: CounterpartyType.CUSTOMER,
              counterpartyId: dto.customerId,
            },
            orgId,
          );
          const products = await tx.product.findMany({
            where: {
              organizationId: orgId,
              active: true,
              id: { in: [...new Set(dto.items.map((item) => item.productId))] },
            },
            include: { category: true },
          });
          const byId = new Map(
            products.map((product) => [product.id, product]),
          );
          const quantities = new Map<string, number>();
          let subtotal = 0;
          let totalTax = 0;
          const priced = dto.items.map((item) => {
            const product = byId.get(item.productId);
            if (!product) {
              throw new NotFoundException(
                `Product with ID ${item.productId} not found`,
              );
            }
            const row = resolveSaleItemPricing(
              product,
              item,
              canOverrideSalePrice(actor),
            );
            subtotal += row.pricedItem.subtotal;
            totalTax += row.taxAmount;
            if (tracksStock(product)) {
              const quantity =
                (quantities.get(product.id) ?? 0) + item.quantity;
              if (quantity > 2147483647) {
                throw new BadRequestException(
                  'Cantidad agregada fuera de rango',
                );
              }
              quantities.set(product.id, quantity);
            }
            return row;
          });
          // Preserve SalesService's original tax before B4 normalization.
          const prepared = prepareSaleQuoteForStorage(
            buildSaleQuote(
              priced.map((row) => row.pricedItem),
              subtotal + totalTax,
            ),
          );
          const holds = [...quantities].sort(([a], [b]) => a.localeCompare(b));
          for (const [id, quantity] of holds) {
            const product = byId.get(id)!;
            if (
              !Number.isInteger(product.stock) ||
              !Number.isInteger(product.reservedStock) ||
              product.reservedStock < 0 ||
              product.stock - product.reservedStock < quantity
            ) {
              throw new ConflictException(
                'Existencias disponibles insuficientes',
              );
            }
            const changed = await tx.product.updateMany({
              where: {
                id,
                organizationId: orgId,
                active: true,
                type: product.type,
                tracksStock: product.tracksStock,
                version: product.version,
                stock: product.stock,
                reservedStock: product.reservedStock,
              },
              data: {
                reservedStock: { increment: quantity },
                version: { increment: 1 },
              },
            });
            if (changed.count !== 1) {
              throw new ConflictException(
                'El producto cambió; reintente la solicitud',
              );
            }
          }
          const loan = await tx.moneyLoan.create({
            data: {
              organizationId: orgId,
              type: MonetaryLoanType.MONEY,
              amount: prepared.agreedCustomerTotal,
              customerId: dto.customerId,
              createdById: actor.userId,
              issuedAt: new Date(payload.issuedAt),
              dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
              reason: payload.reason,
            },
            select: { id: true },
          });
          const intentId = randomUUID();
          // Own JSON containers while retaining B4's canonical money strings.
          const snapshot = {
            items: prepared.snapshot.items.map((item) => ({ ...item })),
            agreedCustomerTotal: prepared.snapshot.agreedCustomerTotal,
          };
          snapshot.items.forEach((item) => Object.freeze(item));
          Object.freeze(snapshot.items);
          Object.freeze(snapshot);
          const result = {
            intentId,
            loanId: loan.id,
            organizationId: orgId,
            customerId: dto.customerId,
            agreedCustomerTotal: prepared.agreedCustomerTotal.toFixed(2),
            quoteSnapshot: snapshot,
          };
          await tx.posLoanSaleIntent.create({
            data: {
              id: intentId,
              organizationId: orgId,
              loanId: loan.id,
              customerId: dto.customerId,
              agreedCustomerTotal: prepared.agreedCustomerTotal,
              quoteSnapshot: snapshot,
              initiationRequestKey: dto.requestKey,
              initiationRequestHash: hash,
              initiatedById: actor.userId,
              initiationResult: result,
            },
          });
          for (const [productId, quantity] of holds) {
            await tx.posLoanSaleReservation.create({
              data: {
                intentId,
                organizationId: orgId,
                productId,
                quantity,
                state: 'HELD',
              },
            });
          }
          await tx.moneyLoanEvent.create({
            data: {
              loanId: loan.id,
              organizationId: orgId,
              createdById: actor.userId,
              type: MoneyLoanEventType.CREATED,
              reason: payload.reason,
            },
          });
          await tx.auditLog.create({
            data: {
              organizationId: orgId,
              userId: actor.userId,
              action: 'LOAN_CREATED',
              resource: 'MoneyLoan',
              resourceId: loan.id,
              metadata: {
                type: MonetaryLoanType.MONEY,
                amount: result.agreedCustomerTotal,
                issuedAt: payload.issuedAt,
                dueAt: payload.dueAt,
                reason: payload.reason,
                counterpartyType: CounterpartyType.CUSTOMER,
                counterpartyId: dto.customerId,
                intentId,
              },
            },
          });
          for (const { override } of priced) {
            if (!override) continue;
            await tx.auditLog.create({
              data: {
                organizationId: orgId,
                userId: actor.userId,
                action: 'SALE_PRICE_OVERRIDE',
                resource: 'MoneyLoan',
                resourceId: loan.id,
                metadata: {
                  loanId: loan.id,
                  intentId,
                  productId: override.productId,
                  productName: override.productName,
                  quantity: override.quantity,
                  originalUnitPrice: override.serverUnitPrice,
                  overriddenUnitPrice: override.overriddenUnitPrice,
                  actorRole: actor.role,
                  timestamp: new Date().toISOString(),
                  summary: `Price override on financed loan ${loan.id}: ${override.productName} charged at ${override.overriddenUnitPrice} instead of ${override.serverUnitPrice}`,
                },
              },
            });
          }
          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      // Reconcile only this intent's key constraint, outside the aborted callback.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = error.meta?.target;
        const ownKey =
          target ===
            'PosLoanSaleIntent_organizationId_initiationRequestKey_key' ||
          (error.meta?.modelName === 'PosLoanSaleIntent' &&
            Array.isArray(target) &&
            target.length === 2 &&
            target.includes('organizationId') &&
            target.includes('initiationRequestKey'));
        if (ownKey) {
          const winner = await this.prisma.posLoanSaleIntent.findFirst({
            where,
          });
          if (winner) return replay(winner);
          throw new ConflictException(
            'No se encontró evidencia de la solicitud concurrente',
          );
        }
      }
      throw error;
    }
  }

  async create(
    dto: CreateLoanDto,
    actorId: string,
    organizationId: string | undefined,
  ) {
    const orgId = requireOrganization(organizationId);
    const type = supportedType(dto.type) ?? MonetaryLoanType.MONEY;
    const issuedAt = new Date(dto.issuedAt);
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dueAt && dueAt < issuedAt) {
      throw new BadRequestException(
        'La fecha de vencimiento no puede ser anterior al préstamo',
      );
    }
    const amount = new Prisma.Decimal(dto.amount);
    const reason = dto.reason.trim();

    return this.prisma.$transaction(
      async (tx) => {
        await this.validateCounterparty(tx, dto, orgId);
        const loan = await tx.moneyLoan.create({
          data: {
            organizationId: orgId,
            type,
            amount,
            issuedAt,
            dueAt,
            reason,
            createdById: actorId,
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
          },
          select: loanSelect,
        });
        await tx.moneyLoanEvent.create({
          data: {
            loanId: loan.id,
            organizationId: orgId,
            createdById: actorId,
            type: MoneyLoanEventType.CREATED,
            reason,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: orgId,
            userId: actorId,
            action: 'LOAN_CREATED',
            resource: 'MoneyLoan',
            resourceId: loan.id,
            metadata: {
              type,
              amount: amount.toFixed(2),
              issuedAt: dto.issuedAt,
              dueAt: dto.dueAt ?? null,
              reason,
              counterpartyType: dto.counterpartyType,
              counterpartyId: dto.counterpartyId,
            },
          },
        });
        return present(loan);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async findAll(query: QueryLoansDto, organizationId: string | undefined) {
    const orgId = requireOrganization(organizationId);
    const type = supportedType(query.type);
    const where = { organizationId: orgId, ...(type ? { type } : {}) };
    const { page, limit, skip } = pagination(query);
    const [data, total] = await Promise.all([
      this.prisma.moneyLoan.findMany({
        where,
        select: loanSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.moneyLoan.count({ where }),
    ]);
    return {
      data: data.map(present),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, organizationId: string | undefined) {
    const loan = await this.prisma.moneyLoan.findFirst({
      where: { id, organizationId: requireOrganization(organizationId) },
      select: loanSelect,
    });
    if (!loan) throw new NotFoundException('Préstamo no encontrado');
    return present(loan);
  }

  async getHistory(
    id: string,
    query: QueryLoansDto,
    organizationId: string | undefined,
  ) {
    const orgId = requireOrganization(organizationId);
    await this.findOne(id, orgId);
    const where = { loanId: id, organizationId: orgId };
    const { page, limit, skip } = pagination(query);
    const [data, total] = await Promise.all([
      this.prisma.moneyLoanEvent.findMany({
        where,
        select: eventSelect,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.moneyLoanEvent.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async mutate(
    id: string,
    kind: string,
    body: {
      requestKey?: unknown;
      amount?: unknown;
      method?: unknown;
      reason?: unknown;
      paymentId?: unknown;
    },
    actorId: string,
    organizationId: string | undefined,
  ) {
    const orgId = requireOrganization(organizationId);
    if (!['COLLECTED', 'REVERSED', 'CLOSED', 'CANCELLED'].includes(kind)) {
      throw new BadRequestException('Operación inválida');
    }
    if (
      typeof body.requestKey !== 'string' ||
      !body.requestKey.trim() ||
      body.requestKey.length > 100
    ) {
      throw new BadRequestException(
        'La clave de solicitud es obligatoria (máximo 100 caracteres)',
      );
    }
    let amount: Prisma.Decimal | null = null;
    let method: PaymentMethod | null = null;
    let reason = kind === 'COLLECTED' ? 'Abono recibido' : 'Cierre confirmado';
    if (kind === 'COLLECTED') {
      if (typeof body.amount !== 'number' || !Number.isFinite(body.amount)) {
        throw new BadRequestException(
          'El abono debe ser un número decimal válido',
        );
      }
      amount = new Prisma.Decimal(body.amount);
      if (
        amount.lte(0) ||
        amount.gt('99999999.99') ||
        amount.decimalPlaces() > 2
      ) {
        throw new BadRequestException(
          'El abono debe ser positivo y tener máximo dos decimales',
        );
      }
      if (
        !Object.values(PaymentMethod).includes(body.method as PaymentMethod)
      ) {
        throw new BadRequestException('Medio de pago inválido');
      }
      method = body.method as PaymentMethod;
    }
    if (kind === 'REVERSED' || kind === 'CANCELLED') {
      if (
        typeof body.reason !== 'string' ||
        !body.reason.trim() ||
        body.reason.trim().length > 500
      ) {
        throw new BadRequestException(
          'Indique un motivo de 1 a 500 caracteres',
        );
      }
      reason = body.reason.trim();
    }
    if (
      kind === 'REVERSED' &&
      (typeof body.paymentId !== 'string' || !body.paymentId)
    ) {
      throw new BadRequestException('Indique el abono a reversar');
    }
    // Fixed field order and Decimal normalization make replay comparisons stable.
    // Bind the request to its authenticated actor as well as its operation/payload.
    const requestPayload = JSON.stringify({
      kind,
      actorId,
      amount: amount?.toFixed(2) ?? null,
      method,
      reason,
      paymentId: kind === 'REVERSED' ? body.paymentId : null,
    });
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const loan = await tx.moneyLoan.findFirst({
            where: { id, organizationId: orgId },
            select: loanSelect,
          });
          if (!loan) throw new NotFoundException('Préstamo no encontrado');
          const prior = await tx.moneyLoanEvent.findFirst({
            where: {
              loanId: id,
              organizationId: orgId,
              requestKey: body.requestKey as string,
            },
          });
          if (prior) {
            if (prior.requestPayload !== requestPayload)
              throw new ConflictException(
                'La clave ya fue utilizada con otra solicitud',
              );
            return {
              ...(prior.result as Prisma.JsonObject),
              eventId: prior.id,
            };
          }
          if (loan.status !== MoneyLoanStatus.OPEN) {
            throw new ConflictException(
              'El préstamo está cerrado o cancelado; no admite operaciones ni reapertura automática',
            );
          }
          const before = totals(loan);
          let reversesId: string | null = null;
          let status: MoneyLoanStatus = loan.status;
          if (kind === 'COLLECTED' && amount!.gt(before.balance)) {
            throw new ConflictException('El abono supera el saldo pendiente');
          }
          if (kind === 'REVERSED') {
            const payment = loan.events.find(
              (event) =>
                event.id === body.paymentId &&
                event.type === MoneyLoanEventType.COLLECTED,
            );
            if (!payment)
              throw new NotFoundException(
                'Abono no encontrado en este préstamo',
              );
            if (loan.events.some((event) => event.reversesId === payment.id))
              throw new ConflictException('El abono ya fue reversado');
            amount = payment.amount!;
            reversesId = payment.id;
          }
          if (kind === 'CLOSED') {
            if (before.balance !== '0.00')
              throw new ConflictException(
                'El préstamo debe estar totalmente pagado antes de confirmar el cierre',
              );
            status = MoneyLoanStatus.CLOSED;
          }
          if (kind === 'CANCELLED') {
            if (before.collected !== '0.00')
              throw new ConflictException(
                'Reverse los abonos pendientes antes de cancelar; la cancelación no realiza reembolsos',
              );
            status = MoneyLoanStatus.CANCELLED;
          }
          // All competing collections, reversals and transitions contend on this row.
          const changed = await tx.moneyLoan.updateMany({
            where: {
              id,
              organizationId: orgId,
              version: loan.version,
              status: MoneyLoanStatus.OPEN,
            },
            data: { version: { increment: 1 }, status },
          });
          if (changed.count !== 1)
            throw new ConflictException(
              'El préstamo cambió; reintente con la misma clave de solicitud',
            );
          if (kind === 'CANCELLED') {
            const intent = await tx.posLoanSaleIntent.findFirst({
              where: { loanId: id, organizationId: orgId },
            });
            if (intent) {
              if (intent.finalSaleId != null) {
                throw new ConflictException(
                  'La financiación ya tiene venta final',
                );
              }
              const holds = await tx.posLoanSaleReservation.findMany({
                where: {
                  intentId: intent.id,
                  organizationId: orgId,
                  state: 'HELD',
                },
                orderBy: { productId: 'asc' },
              });
              const finalizedAt = new Date();
              for (const hold of holds) {
                const product = await tx.product.findFirst({
                  where: { id: hold.productId, organizationId: orgId },
                  select: {
                    id: true,
                    stock: true,
                    reservedStock: true,
                    version: true,
                  },
                });
                if (
                  !Number.isInteger(hold.quantity) ||
                  hold.quantity < 1 ||
                  hold.quantity > 2147483647 ||
                  !product ||
                  !Number.isInteger(product.stock) ||
                  product.stock > 2147483647 ||
                  !Number.isInteger(product.reservedStock) ||
                  product.reservedStock < hold.quantity ||
                  product.reservedStock > product.stock ||
                  !Number.isInteger(product.version) ||
                  product.version < 0 ||
                  product.version >= 2147483647
                ) {
                  throw new ConflictException(
                    'Reserva o contadores históricos inconsistentes',
                  );
                }
                const released = await tx.product.updateMany({
                  where: {
                    id: hold.productId,
                    organizationId: orgId,
                    version: product.version,
                    stock: product.stock,
                    reservedStock: product.reservedStock,
                  },
                  data: {
                    reservedStock: { decrement: hold.quantity },
                    version: { increment: 1 },
                  },
                });
                if (released.count !== 1) {
                  throw new ConflictException(
                    'Los contadores de la reserva cambiaron',
                  );
                }
                const claimed = await tx.posLoanSaleReservation.updateMany({
                  where: {
                    id: hold.id,
                    intentId: intent.id,
                    organizationId: orgId,
                    state: 'HELD',
                  },
                  data: {
                    state: 'RELEASED',
                    finalizedAt,
                    finalizedById: actorId,
                  },
                });
                if (claimed.count !== 1) {
                  throw new ConflictException('La reserva ya fue reclamada');
                }
              }
            }
          }
          const type = kind as MoneyLoanEventType;
          const result = {
            type: loan.type,
            loanId: id,
            status,
            ...totals({
              ...loan,
              events: [...loan.events, { id: '', type, amount, reversesId }],
            }),
          };
          const event = await tx.moneyLoanEvent.create({
            data: {
              loanId: id,
              organizationId: orgId,
              createdById: actorId,
              type,
              amount,
              method,
              reversesId,
              reason,
              requestKey: body.requestKey as string,
              requestPayload,
              result,
            },
          });
          await tx.auditLog.create({
            data: {
              organizationId: orgId,
              userId: actorId,
              action: `LOAN_${kind}`,
              resource: 'MoneyLoan',
              resourceId: id,
              metadata: {
                eventId: event.id,
                amount: amount?.toFixed(2) ?? null,
                method,
                reason,
                reversesId,
                requestKey: body.requestKey as string,
                ...result,
              },
            },
          });
          return { ...result, eventId: event.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code)
      ) {
        throw new ConflictException(
          'Operación concurrente; reintente con la misma clave de solicitud',
        );
      }
      throw error;
    }
  }

  private posRequestPayload(dto: CreatePosLoanDto) {
    if (
      !dto ||
      typeof dto.requestKey !== 'string' ||
      !dto.requestKey.trim() ||
      dto.requestKey.length > 100 ||
      typeof dto.reason !== 'string' ||
      !Array.isArray(dto.items)
    ) {
      throw new BadRequestException('Solicitud de financiación inválida');
    }
    const items = dto.items.map((item) => {
      if (
        !item ||
        typeof item.productId !== 'string' ||
        !item.productId.trim() ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 2147483647
      ) {
        throw new BadRequestException('Línea de financiación inválida');
      }
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? null,
        discountAmount: item.discountAmount ?? 0,
      };
    });
    return {
      customerId: dto.customerId,
      issuedAt: dto.issuedAt,
      dueAt: dto.dueAt ?? null,
      reason: dto.reason.trim(),
      items,
    };
  }

  private posInitiationReplay(
    intent: PosLoanSaleIntent,
    orgId: string,
    actorId: string,
    key: string,
    hash: string,
  ): Prisma.JsonObject {
    const conflict = () => {
      throw new ConflictException(
        'La clave no corresponde a una iniciación válida de este actor',
      );
    };
    const object = (value: Prisma.JsonValue): value is Prisma.JsonObject =>
      value !== null && typeof value === 'object' && !Array.isArray(value);
    const money = (value: Prisma.JsonValue | undefined): value is string =>
      typeof value === 'string' &&
      /^(0|[1-9][0-9]{0,7})[.][0-9]{2}$/.test(value);
    const result = intent.initiationResult;
    const snapshot = intent.quoteSnapshot;
    if (
      !intent.id.trim() ||
      !intent.loanId.trim() ||
      !intent.customerId.trim() ||
      intent.organizationId !== orgId ||
      intent.initiatedById !== actorId ||
      intent.initiationRequestKey !== key ||
      intent.initiationRequestHash !== hash ||
      !intent.agreedCustomerTotal ||
      !object(result) ||
      !object(snapshot)
    )
      return conflict();
    if (
      Object.keys(result).length !== 6 ||
      Object.keys(snapshot).length !== 2 ||
      result.intentId !== intent.id ||
      result.loanId !== intent.loanId ||
      result.organizationId !== orgId ||
      result.customerId !== intent.customerId ||
      !money(result.agreedCustomerTotal) ||
      result.agreedCustomerTotal !== intent.agreedCustomerTotal.toFixed(2) ||
      intent.agreedCustomerTotal.lte(0) ||
      snapshot.agreedCustomerTotal !== result.agreedCustomerTotal ||
      !isDeepStrictEqual(result.quoteSnapshot, snapshot) ||
      !Array.isArray(snapshot.items) ||
      !snapshot.items.length
    )
      return conflict();
    for (const item of snapshot.items) {
      if (
        !object(item) ||
        Object.keys(item).length !== 4 ||
        typeof item.productId !== 'string' ||
        !item.productId.trim() ||
        typeof item.quantity !== 'number' ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 2147483647 ||
        !money(item.resolvedUnitPrice) ||
        !money(item.discountAmount)
      )
        return conflict();
    }
    return result;
  }

  private async validateCounterparty(
    tx: Prisma.TransactionClient,
    dto: Pick<CreateLoanDto, 'counterpartyType' | 'counterpartyId'>,
    organizationId: string,
  ) {
    let exists: unknown;
    const where = { id: dto.counterpartyId, organizationId, active: true };
    switch (dto.counterpartyType) {
      case CounterpartyType.CUSTOMER:
        exists = await tx.customer.findFirst({ where, select: { id: true } });
        break;
      case CounterpartyType.SUPPLIER:
        exists = await tx.supplier.findFirst({ where, select: { id: true } });
        break;
      case CounterpartyType.EMPLOYEE:
        exists = await tx.organizationUser.findFirst({
          where: {
            userId: dto.counterpartyId,
            organizationId,
            user: { active: true },
          },
          select: { userId: true },
        });
        break;
    }
    if (!exists) {
      throw new BadRequestException(
        'La contraparte no está activa o no pertenece a la organización',
      );
    }
  }
}
