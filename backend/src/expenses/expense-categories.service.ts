import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { DEFAULT_EXPENSE_CATEGORY_NAMES } from './default-expense-categories';

export { DEFAULT_EXPENSE_CATEGORY_NAMES };

@Injectable()
export class ExpenseCategoriesService {
  constructor(private prisma: PrismaService) {}

  async ensureDefaultCategories(organizationId: string): Promise<number> {
    const count = await this.prisma.expenseCategory.count({
      where: { organizationId },
    });

    if (count > 0) {
      return 0;
    }

    const result = await this.prisma.expenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORY_NAMES.map((name) => ({
        name,
        organizationId,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }

  async findAll(organizationId: string | undefined) {
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID is required for this operation',
      );
    }

    await this.ensureDefaultCategories(organizationId);

    return this.prisma.expenseCategory.findMany({
      where: { organizationId, active: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(
    dto: CreateExpenseCategoryDto,
    organizationId: string | undefined,
  ) {
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID is required for this operation',
      );
    }

    const existing = await this.prisma.expenseCategory.findFirst({
      where: { name: dto.name, organizationId },
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe una categoría de salidas con ese nombre',
      );
    }

    return this.prisma.expenseCategory.create({
      data: { name: dto.name, organizationId },
    });
  }

  async update(
    id: string,
    dto: UpdateExpenseCategoryDto,
    organizationId: string | undefined,
  ) {
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID is required for this operation',
      );
    }

    const category = await this.prisma.expenseCategory.findFirst({
      where: { id, organizationId },
    });

    if (!category) {
      throw new NotFoundException('Categoría de salidas no encontrada');
    }

    if (dto.name) {
      const existing = await this.prisma.expenseCategory.findFirst({
        where: { name: dto.name, organizationId },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Ya existe una categoría de salidas con ese nombre',
        );
      }
    }

    return this.prisma.expenseCategory.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, organizationId: string | undefined) {
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID is required for this operation',
      );
    }

    const category = await this.prisma.expenseCategory.findFirst({
      where: { id, organizationId },
    });

    if (!category) {
      throw new NotFoundException('Categoría de salidas no encontrada');
    }

    return this.prisma.expenseCategory.update({
      where: { id },
      data: { active: false },
    });
  }
}
