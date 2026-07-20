import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { OrgRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationRequiredGuard)
@UseInterceptors(AdminOrganizationInterceptor)
@ApiBearerAuth()
export class ProductsSearchController {
  constructor(private prisma: PrismaService) {}

  @Get('search')
  @Roles(OrgRole.ADMIN, OrgRole.MEMBER, OrgRole.CASHIER)
  @ApiOperation({ summary: 'Search products for POS (real-time search)' })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search query (name, sku, or barcode)',
  })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'categoryId', required: false })
  async searchProducts(
    @CurrentUser() user: RequestUser,
    @Query('q') q?: string,
    @Query('limit') limit: number = 10,
    @Query('categoryId') categoryId?: string,
  ) {
    if (!q || q.trim() === '') {
      return [];
    }

    const searchQuery = q.trim();

    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
      active: true,
      OR: [
        { name: { contains: searchQuery, mode: 'insensitive' as const } },
        { sku: { contains: searchQuery, mode: 'insensitive' as const } },
        { barcode: { contains: searchQuery, mode: 'insensitive' as const } },
      ],
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const products = await this.prisma.product.findMany({
      where: where as never,
      take: limit,
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        salePrice: true,
        stock: true,
        minStock: true,
        imageUrl: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { stock: 'desc' }, // Productos con stock disponible primero
        { name: 'asc' },
      ],
    });

    return {
      success: true,
      data: products.map((product) => ({
        ...product,
        isLowStock: product.stock <= product.minStock,
      })),
    };
  }

  @Get('quick-search')
  @Roles(OrgRole.ADMIN, OrgRole.MEMBER, OrgRole.CASHIER)
  @ApiOperation({ summary: 'Quick search by barcode or SKU for POS' })
  @ApiQuery({ name: 'code', required: true, description: 'Barcode or SKU' })
  async quickSearch(
    @CurrentUser() user: RequestUser,
    @Query('code') code: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: {
        organizationId: user.organizationId,
        active: true,
        OR: [{ barcode: { equals: code } }, { sku: { equals: code } }],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        salePrice: true,
        stock: true,
        minStock: true,
        imageUrl: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!product) {
      return {
        success: false,
        message: 'Product not found',
        data: null,
      };
    }

    return {
      success: true,
      data: {
        ...product,
        isLowStock: product.stock <= product.minStock,
      },
    };
  }
}
