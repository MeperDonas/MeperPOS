import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto, organizationId: string | undefined) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required for this operation');
    }
    const { name } = createCategoryDto;

    const existingCategory = await this.prisma.category.findFirst({
      where: { name, organizationId },
    });

    if (existingCategory) {
      throw new ConflictException('Category already exists');
    }

    const category = await this.prisma.category.create({
      data: { ...createCategoryDto, organizationId },
    });

    return this.serializeCategory(category);
  }

  async findAll(
    organizationId: string | undefined,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where = {
      ...(organizationId ? { organizationId } : {}),
      active: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              {
                description: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { products: true },
          },
        },
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      data: categories.map((category) => ({
        ...this.serializeCategory(category),
        productCount: category._count.products,
        _count: undefined,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, organizationId?: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      include: { products: true },
    });

    if (!category || !category.active) {
      throw new NotFoundException('Category not found');
    }

    return this.serializeCategory(category);
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    organizationId: string | undefined,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required for this operation');
    }
    const existingCategory = await this.prisma.category.findFirst({
      where: { id, organizationId },
    });

    if (!existingCategory || !existingCategory.active) {
      throw new NotFoundException('Category not found');
    }

    if (
      updateCategoryDto.name &&
      updateCategoryDto.name !== existingCategory.name
    ) {
      const existingName = await this.prisma.category.findFirst({
        where: { name: updateCategoryDto.name, organizationId },
      });
      if (existingName) {
        throw new ConflictException('Category name already exists');
      }
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });

    return this.serializeCategory(category);
  }

  async remove(id: string, organizationId: string | undefined) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required for this operation');
    }
    const category = await this.prisma.category.findFirst({
      where: { id, organizationId },
      include: { products: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.products.length > 0) {
      throw new ConflictException(
        'Cannot delete category with associated products',
      );
    }

    return this.prisma.category.update({
      where: { id },
      data: { active: false },
    });
  }

  private serializeCategory<
    T extends { defaultTaxRate: Prisma.Decimal | number | null },
  >(
    category: T,
  ): Omit<T, 'defaultTaxRate'> & { defaultTaxRate: number | null } {
    return {
      ...category,
      defaultTaxRate: this.toNumber(category.defaultTaxRate),
    };
  }

  private toNumber(value: Prisma.Decimal | number | null): number | null {
    if (value === null) {
      return null;
    }

    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }
}
