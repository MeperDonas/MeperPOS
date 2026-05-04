import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { SettingsService } from '../settings/settings.service';
import { resolveEffectiveTaxRate } from '../common/utils/tax.util';
import { PlanLimitService } from '../plan-limits/plan-limits.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private settingsService: SettingsService,
    private planLimitService: PlanLimitService,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    userId: string,
    organizationId: string,
  ) {
    const { sku, barcode, categoryId, taxRate, ...rest } = createProductDto;

    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, organizationId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: { organizationId_sku: { organizationId, sku } },
      });
      if (existingSku) {
        throw new ConflictException('SKU already exists');
      }
    }

    if (barcode) {
      const existingBarcode = await this.prisma.product.findUnique({
        where: { organizationId_barcode: { organizationId, barcode } },
      });
      if (existingBarcode) {
        throw new ConflictException('Barcode already exists');
      }
    }

    // Resolve effective tax rate if not explicitly provided
    let resolvedTaxRate: number;
    if (taxRate != null) {
      // Explicitly provided — use as-is
      resolvedTaxRate = taxRate;
    } else {
      // Not provided — resolve from category default → settings fallback
      const settings = await this.settingsService.find(organizationId);
      resolvedTaxRate = resolveEffectiveTaxRate(
        null,
        category.defaultTaxRate,
        settings.taxRate ?? 19,
      );
    }

    const product = await this.prisma.product.create({
      data: {
        ...rest,
        sku,
        barcode,
        categoryId,
        organizationId,
        taxRate: resolvedTaxRate,
      },
      include: { category: true },
    });

    this.planLimitService.invalidateCache('products', organizationId);

    await this.createInventoryMovement(
      product.id,
      'PURCHASE',
      0,
      product.stock,
      'Initial stock',
      userId,
      organizationId,
    );

    return this.enrichWithEffectiveTax(product);
  }

  async findAll(
    organizationId: string,
    page = 1,
    limit = 10,
    search?: string,
    categoryId?: string,
    status: 'active' | 'inactive' | 'all' = 'active',
  ) {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { organizationId };

    if (status === 'active') {
      where.active = true;
    }

    if (status === 'inactive') {
      where.active = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { sku: { contains: search, mode: 'insensitive' as const } },
        { barcode: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: { category: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((p) => this.enrichWithEffectiveTax(p)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, organizationId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId, active: true },
      include: { category: true, movements: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.enrichWithEffectiveTax(product);
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    userId: string,
    organizationId: string,
  ) {
    const existingProduct = await this.prisma.product.findFirst({
      where: { id, organizationId, active: true },
    });

    if (!existingProduct) {
      throw new NotFoundException('Product not found');
    }

    if (updateProductDto.sku && updateProductDto.sku !== existingProduct.sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: {
          organizationId_sku: {
            organizationId,
            sku: updateProductDto.sku,
          },
        },
      });
      if (existingSku) {
        throw new ConflictException('SKU already exists');
      }
    }

    if (
      updateProductDto.barcode &&
      updateProductDto.barcode !== existingProduct.barcode
    ) {
      const existingBarcode = await this.prisma.product.findUnique({
        where: {
          organizationId_barcode: {
            organizationId,
            barcode: updateProductDto.barcode,
          },
        },
      });
      if (existingBarcode) {
        throw new ConflictException('Barcode already exists');
      }
    }

    const previousStock = existingProduct.stock;
    const newStock = updateProductDto.stock ?? previousStock;

    const updateResult = await this.prisma.product.updateMany({
      where: { id, version: existingProduct.version, active: true },
      data: {
        ...updateProductDto,
        version: { increment: 1 },
      },
    });

    if (updateResult.count === 0) {
      throw new ConflictException('Product was modified by another user');
    }

    const product = await this.prisma.product.findFirst({
      where: { id, organizationId, active: true },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (
      updateProductDto.stock !== undefined &&
      updateProductDto.stock !== previousStock
    ) {
      const movementType =
        newStock > previousStock ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
      await this.createInventoryMovement(
        id,
        movementType,
        previousStock,
        newStock,
        'Stock adjustment',
        userId,
        organizationId,
      );
    }

    return this.enrichWithEffectiveTax(product);
  }

  async deactivate(id: string, organizationId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId, active: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id },
      data: { active: false },
      include: { category: true },
    });
  }

  async remove(id: string, organizationId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    try {
      return await this.prisma.product.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'No se puede eliminar definitivamente un producto con ventas o movimientos de inventario asociados',
        );
      }
      throw error;
    }
  }

  async getLowStockProducts(organizationId: string) {
    return this.prisma.$queryRaw`
      SELECT p.*, c.name as "categoryName"
      FROM "Product" p
      LEFT JOIN "Category" c ON p."categoryId" = c.id
      WHERE p.active = true AND p."organizationId" = ${organizationId} AND p.stock <= p."minStock"
      ORDER BY p.stock ASC
    `;
  }

  async searchProducts(query: string, limit = 20, organizationId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        active: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { sku: { contains: query, mode: 'insensitive' as const } },
          { barcode: { contains: query, mode: 'insensitive' as const } },
        ],
      },
      take: limit,
      include: { category: true },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      salePrice: p.salePrice,
      stock: p.stock,
      taxRate: p.taxRate,
      effectiveTaxRate: resolveEffectiveTaxRate(
        p.taxRate,
        p.category?.defaultTaxRate ?? null,
        0,
      ),
      minStock: p.minStock,
      isLowStock: p.stock <= p.minStock,
      category: p.category,
      imageUrl: p.imageUrl,
    }));
  }

  async quickSearch(code: string, organizationId: string) {
    const normalizedCode = code.trim();

    if (!normalizedCode) {
      return null;
    }

    const product = await this.prisma.product.findFirst({
      where: {
        organizationId,
        active: true,
        OR: [
          {
            barcode: { equals: normalizedCode, mode: 'insensitive' as const },
          },
          { sku: { equals: normalizedCode, mode: 'insensitive' as const } },
        ],
      },
      include: { category: true },
    });

    if (!product) {
      return null;
    }

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      salePrice: product.salePrice,
      stock: product.stock,
      taxRate: product.taxRate,
      effectiveTaxRate: resolveEffectiveTaxRate(
        product.taxRate,
        product.category?.defaultTaxRate ?? null,
        0,
      ),
      minStock: product.minStock,
      isLowStock: product.stock <= product.minStock,
      category: product.category,
      imageUrl: product.imageUrl,
    };
  }

  /**
   * Enriches a product with effective tax rate information.
   *
   * Uses resolveEffectiveTaxRate so that a product with taxRate === 0
   * (the schema default, meaning "not explicitly set") falls back to
   * the category's defaultTaxRate.
   */
  private enrichWithEffectiveTax<
    T extends {
      taxRate: Prisma.Decimal | number;
      category?: { defaultTaxRate: Prisma.Decimal | null } | null;
    },
  >(product: T): T & { effectiveTaxRate: number } {
    return {
      ...product,
      effectiveTaxRate: resolveEffectiveTaxRate(
        product.taxRate,
        product.category?.defaultTaxRate ?? null,
        0,
      ),
    };
  }

  private async createInventoryMovement(
    productId: string,
    type:
      | 'PURCHASE'
      | 'SALE'
      | 'ADJUSTMENT_IN'
      | 'ADJUSTMENT_OUT'
      | 'DAMAGE'
      | 'RETURN',
    previousStock: number,
    newStock: number,
    reason: string,
    userId: string,
    organizationId: string,
    saleId?: string,
  ) {
    await this.prisma.inventoryMovement.create({
      data: {
        productId,
        type,
        quantity: newStock - previousStock,
        previousStock,
        newStock,
        reason,
        userId,
        organizationId,
        saleId,
      },
    });
  }

  async uploadImage(file: Express.Multer.File) {
    const imageUrl = await this.cloudinaryService.uploadImage(file, 'products');
    return { imageUrl };
  }

  async uploadProductImage(
    productId: string,
    file: Express.Multer.File,
    organizationId: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const imageUrl = await this.cloudinaryService.uploadImage(file, 'products');

    if (product.imageUrl) {
      try {
        const publicId = this.cloudinaryService.extractPublicId(
          product.imageUrl,
        );
        await this.cloudinaryService.deleteImage(publicId);
      } catch (error) {
        console.error('Error deleting old image:', error);
      }
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id: productId },
      data: { imageUrl },
      include: { category: true },
    });

    return updatedProduct;
  }

  async reactivate(id: string, organizationId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.active) {
      return product;
    }

    return this.prisma.product.update({
      where: { id },
      data: { active: true },
      include: { category: true },
    });
  }
}
