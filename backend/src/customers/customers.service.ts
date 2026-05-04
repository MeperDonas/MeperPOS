import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitService } from '../plan-limits/plan-limits.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private planLimitService: PlanLimitService,
  ) {}

  async create(createCustomerDto: CreateCustomerDto, organizationId: string) {
    const { documentNumber } = createCustomerDto;

    const existingCustomer = await this.prisma.customer.findFirst({
      where: { documentNumber, organizationId },
    });

    if (existingCustomer) {
      throw new ConflictException(
        'Customer with this document number already exists',
      );
    }

    const customer = await this.prisma.customer.create({
      data: { ...createCustomerDto, organizationId },
    });

    this.planLimitService.invalidateCache('customers', organizationId);

    return customer;
  }

  async findAll(
    organizationId: string,
    page = 1,
    limit = 10,
    search?: string,
    segment?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      organizationId,
      active: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { documentNumber: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    if (segment) {
      where.segment = segment as never;
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where: where as never,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where: where as never }),
    ]);

    return {
      data: customers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, organizationId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, organizationId },
      include: {
        sales: { include: { items: { include: { product: true } } } },
      },
    });

    if (!customer || !customer.active) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async findByDocumentNumber(documentNumber: string, organizationId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { documentNumber, organizationId, active: true },
    });

    return customer;
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
    organizationId: string,
  ) {
    const existingCustomer = await this.prisma.customer.findFirst({
      where: { id, organizationId },
    });

    if (!existingCustomer || !existingCustomer.active) {
      throw new NotFoundException('Customer not found');
    }

    if (
      updateCustomerDto.documentNumber &&
      updateCustomerDto.documentNumber !== existingCustomer.documentNumber
    ) {
      const existingDocument = await this.prisma.customer.findFirst({
        where: {
          documentNumber: updateCustomerDto.documentNumber,
          organizationId,
        },
      });
      if (existingDocument) {
        throw new ConflictException('Document number already in use');
      }
    }

    return this.prisma.customer.update({
      where: { id },
      data: updateCustomerDto,
    });
  }

  async remove(id: string, organizationId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, organizationId },
      include: { sales: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.sales.length > 0) {
      throw new ConflictException(
        'Cannot delete customer with associated sales',
      );
    }

    return this.prisma.customer.update({
      where: { id },
      data: { active: false },
    });
  }
}
