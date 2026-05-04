import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitService } from '../plan-limits/plan-limits.service';
import { CreateCashRegisterDto } from './dto/create-cash-register.dto';
import { UpdateCashRegisterDto } from './dto/update-cash-register.dto';

@Injectable()
export class CashRegistersService {
  constructor(
    private prisma: PrismaService,
    private planLimitService: PlanLimitService,
  ) {}

  async create(dto: CreateCashRegisterDto, organizationId: string) {
    const existing = await this.prisma.cashRegister.findFirst({
      where: { organizationId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException(
        'Cash register with this name already exists',
      );
    }

    if (dto.isDefault) {
      await this.prisma.cashRegister.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const cashRegister = await this.prisma.cashRegister.create({
      data: {
        name: dto.name,
        isDefault: dto.isDefault ?? false,
        organizationId,
      },
    });

    this.planLimitService.invalidateCache('cashRegisters', organizationId);

    return cashRegister;
  }

  async findAll(organizationId: string) {
    return this.prisma.cashRegister.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: { id, organizationId },
    });

    if (!register) {
      throw new NotFoundException('Cash register not found');
    }

    return register;
  }

  async update(id: string, dto: UpdateCashRegisterDto, organizationId: string) {
    await this.findOne(id, organizationId);

    if (dto.name) {
      const existing = await this.prisma.cashRegister.findFirst({
        where: {
          organizationId,
          name: dto.name,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(
          'Cash register with this name already exists',
        );
      }
    }

    if (dto.isDefault) {
      await this.prisma.cashRegister.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.cashRegister.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    return this.prisma.cashRegister.delete({
      where: { id },
    });
  }

  async countByOrg(organizationId: string): Promise<number> {
    return this.prisma.cashRegister.count({
      where: { organizationId, active: true },
    });
  }
}
