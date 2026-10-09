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
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CounterpartyType, CreateLoanDto } from './dto/create-loan.dto';
import { QueryLoansDto } from './dto/query-loans.dto';

const personSelect = { id: true, name: true } as const;
const loanSelect = {
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

function pagination(query: QueryLoansDto) {
  // Defensive bounds also protect internal callers that bypass the DTO pipe.
  const page = Math.min(1000000, Math.max(1, Math.trunc(query.page || 1)));
  const limit = Math.min(100, Math.max(1, Math.trunc(query.limit || 20)));
  return { page, limit, skip: (page - 1) * limit };
}

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateLoanDto,
    actorId: string,
    organizationId: string | undefined,
  ) {
    const orgId = requireOrganization(organizationId);
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
    const where = { organizationId: requireOrganization(organizationId) };
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
          const type = kind as MoneyLoanEventType;
          const result = {
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

  private async validateCounterparty(
    tx: Prisma.TransactionClient,
    dto: CreateLoanDto,
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
