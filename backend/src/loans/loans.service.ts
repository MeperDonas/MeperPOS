import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MoneyLoanEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CounterpartyType, CreateLoanDto } from './dto/create-loan.dto';
import { QueryLoansDto } from './dto/query-loans.dto';

const personSelect = { id: true, name: true } as const;
const loanSelect = {
  id: true,
  amount: true,
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
  reason: true,
  createdById: true,
  createdAt: true,
  createdBy: { select: personSelect },
} satisfies Prisma.MoneyLoanEventSelect;

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
        return loan;
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
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, organizationId: string | undefined) {
    const loan = await this.prisma.moneyLoan.findFirst({
      where: { id, organizationId: requireOrganization(organizationId) },
      select: loanSelect,
    });
    if (!loan) throw new NotFoundException('Préstamo no encontrado');
    return loan;
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
