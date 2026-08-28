import { Injectable } from '@nestjs/common';
import { Prisma, type Category } from '@prisma/client';
import type {
  ImportSheetHandler,
  ParsedFileRow,
  SheetRowContext,
  ValidationResult,
} from '../import-sheet-handler.interface';
import { DuplicateTracker } from '../duplicate-tracker';
import {
  detectColumns,
  mapRawRow,
  type SheetColumnDetectionResult,
} from '../../helpers/column-detector';
import {
  buildGeneratedSku,
  normalizeCategoryName,
  normalizeLookupKey,
  normalizeText,
  parseDecimal,
  parseInteger,
  toTitleCase,
} from '../../helpers/row-validator';
import { ProductsService } from '../../../products/products.service';

/** Fields the UI exposes for inline editing of a product row. */
export const PRODUCT_EDITABLE_FIELDS = [
  'name',
  'sku',
  'barcode',
  'category',
  'salePrice',
  'costPrice',
  'stock',
  'minStock',
  'taxRate',
  'description',
];

/** Normalized product import data after {@link parseProductRow}. */
export interface ParsedProductData {
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  salePrice: number;
  costPrice: number;
  stock: number;
  minStock: number;
  taxRate: number;
  taxRateProvided: boolean;
  description?: string;
  costInferred: boolean;
}

export type ParseProductRowResult =
  | {
      kind: 'error';
      errorCode: string;
      message: string;
      field?: string;
      mappedData: Record<string, unknown>;
    }
  | { kind: 'ok'; data: ParsedProductData };

/**
 * Pure, field-keyed row parser for the Productos sheet. Given the mapped cells
 * (field name -> raw string) it applies the current product import semantics:
 * a generated SKU when absent, an inferred cost price, defaulted min-stock and
 * tax rate, and the same numeric parsing helpers as the product-only importer.
 */
export function parseProductRow(
  mapped: Record<string, unknown>,
  rowIndex: number,
): ParseProductRowResult {
  const name = normalizeText(mapped.name);

  if (!name) {
    return {
      kind: 'error',
      errorCode: 'EMPTY_NAME',
      message: 'Nombre de producto requerido',
      field: 'name',
      mappedData: { ...mapped },
    };
  }

  let sku = normalizeText(mapped.sku);
  if (!sku) {
    sku = buildGeneratedSku(rowIndex - 1);
  }

  const salePrice = parseDecimal(mapped.salePrice);
  if (salePrice === null || salePrice <= 0) {
    return {
      kind: 'error',
      errorCode: 'INVALID_PRICE',
      message: 'Precio de venta invalido',
      field: 'salePrice',
      mappedData: { ...mapped, sku, name },
    };
  }

  const stock = parseInteger(mapped.stock);
  if (stock === null || stock < 0) {
    return {
      kind: 'error',
      errorCode: 'INVALID_STOCK',
      message: 'Stock invalido. Debe ser un numero entero mayor o igual a 0',
      field: 'stock',
      mappedData: { ...mapped, sku, name, salePrice },
    };
  }

  const rawCostPrice = normalizeText(mapped.costPrice);
  let costInferred = false;
  let costPrice = parseDecimal(rawCostPrice);

  if (!rawCostPrice) {
    costInferred = true;
    costPrice = salePrice;
  }

  if (costPrice === null || costPrice < 0) {
    return {
      kind: 'error',
      errorCode: 'INVALID_COST_PRICE',
      message: 'Precio de costo invalido',
      field: 'costPrice',
      mappedData: { ...mapped, sku, name, salePrice, stock },
    };
  }

  const minStockRaw = normalizeText(mapped.minStock);
  let minStock = parseInteger(minStockRaw);
  if (!minStockRaw) {
    minStock = 0;
  }

  if (minStock === null || minStock < 0) {
    return {
      kind: 'error',
      errorCode: 'INVALID_MIN_STOCK',
      message:
        'Stock minimo invalido. Debe ser un numero entero mayor o igual a 0',
      field: 'minStock',
      mappedData: { ...mapped, sku, name, salePrice, stock, costPrice },
    };
  }

  const taxRateRaw = normalizeText(mapped.taxRate);
  const taxRateProvided = taxRateRaw.length > 0;
  let taxRate = parseDecimal(taxRateRaw);
  if (!taxRateProvided) {
    taxRate = 0;
  }

  if (taxRate === null || taxRate < 0) {
    return {
      kind: 'error',
      errorCode: 'INVALID_TAX_RATE',
      message: 'Impuesto invalido',
      field: 'taxRate',
      mappedData: {
        ...mapped,
        sku,
        name,
        salePrice,
        stock,
        costPrice,
        minStock,
      },
    };
  }

  return {
    kind: 'ok',
    data: {
      name,
      sku,
      barcode: normalizeText(mapped.barcode) || undefined,
      category: normalizeText(mapped.category) || 'General',
      salePrice,
      costPrice,
      stock,
      minStock,
      taxRate,
      taxRateProvided,
      description: normalizeText(mapped.description) || undefined,
      costInferred,
    },
  };
}

/**
 * Self-contained, unit-testable handler for the Productos sheet. It preserves
 * the current product import semantics — sku/barcode org-unique duplicate
 * detection and category auto-create — without wiring the full product-only
 * pipeline onto it (that rewire is the final slice).
 *
 * The handler is meant to be instantiated once per import job so the in-file
 * duplicate trackers and the category cache stay job-scoped.
 */
@Injectable()
export class ProductHandler implements ImportSheetHandler {
  readonly sheetId = 'productos';
  readonly requiredFields = ['name', 'salePrice', 'stock'];
  readonly editableFields = PRODUCT_EDITABLE_FIELDS;

  private readonly skuTracker = new DuplicateTracker();
  private readonly barcodeTracker = new DuplicateTracker();
  private readonly categoriesByNormalizedName = new Map<string, Category>();
  private seededExisting = false;

  constructor(private readonly productsService: ProductsService) {}

  detectColumns(headers: string[]): SheetColumnDetectionResult {
    return detectColumns(this.sheetId, headers);
  }

  validateRow(row: ParsedFileRow, ctx: SheetRowContext): ValidationResult {
    const mapped = mapRawRow(this.sheetId, row.rawData);
    const parsed = parseProductRow(mapped, row.rowIndex);

    if (parsed.kind === 'error') {
      return {
        ok: false,
        error: {
          errorCode: parsed.errorCode,
          message: parsed.message,
          field: parsed.field,
          mappedData: parsed.mappedData,
        },
      };
    }

    // Seed the sku tracker with the organization's existing skus on first use.
    // Barcodes are tracked for same-file duplicates only; barcode collisions
    // against the database are caught by `ProductsService.create`.
    if (!this.seededExisting) {
      for (const key of ctx.existingKeys) {
        this.skuTracker.seed(key);
      }
      this.seededExisting = true;
    }

    const data = parsed.data;
    const skuKey = normalizeLookupKey(data.sku);
    const barcodeKey = data.barcode ? normalizeLookupKey(data.barcode) : '';

    if (this.skuTracker.isDuplicate(skuKey)) {
      return this.duplicateError('DUPLICATE_SKU', 'SKU duplicado', 'sku', data);
    }

    if (barcodeKey && this.barcodeTracker.isDuplicate(barcodeKey)) {
      return this.duplicateError(
        'DUPLICATE_BARCODE',
        'Codigo de barras duplicado',
        'barcode',
        data,
      );
    }

    this.skuTracker.register(skuKey);
    if (barcodeKey) {
      this.barcodeTracker.register(barcodeKey);
    }
    ctx.existingKeys.add(skuKey);

    return { ok: true, data: { ...data } };
  }

  async createRow(
    data: Record<string, unknown>,
    ctx: SheetRowContext,
  ): Promise<void> {
    const parsed = data as unknown as ParsedProductData;
    const category = await this.resolveCategory(parsed.category, ctx);

    const taxable = parsed.taxRateProvided && parsed.taxRate > 0;
    const taxRate = taxable ? parsed.taxRate : 0;

    await this.productsService.create(
      {
        name: parsed.name,
        sku: parsed.sku,
        barcode: parsed.barcode,
        description: parsed.description,
        costPrice: parsed.costPrice,
        salePrice: parsed.salePrice,
        taxable,
        taxRate,
        stock: parsed.stock,
        minStock: parsed.minStock,
        categoryId: category.id,
      },
      ctx.userId,
      ctx.organizationId,
    );
  }

  private duplicateError(
    errorCode: string,
    message: string,
    field: string,
    data: ParsedProductData,
  ): {
    ok: false;
    error: {
      errorCode: string;
      message: string;
      field: string;
      mappedData: Record<string, unknown>;
    };
  } {
    return {
      ok: false,
      error: {
        errorCode,
        message,
        field,
        mappedData: { ...data },
      },
    };
  }

  private async resolveCategory(
    categoryName: string,
    ctx: SheetRowContext,
  ): Promise<Category> {
    const normalized = normalizeCategoryName(categoryName || 'General');
    const cached = this.categoriesByNormalizedName.get(normalized);

    if (cached) {
      if (!cached.active) {
        const updated = await ctx.prisma.category.update({
          where: { id: cached.id },
          data: { active: true },
        });
        this.categoriesByNormalizedName.set(
          normalizeCategoryName(updated.name),
          updated,
        );
        return updated;
      }
      return cached;
    }

    const existing = await ctx.prisma.category.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: {
          equals: normalizeText(categoryName),
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      if (!existing.active) {
        const updated = await ctx.prisma.category.update({
          where: { id: existing.id },
          data: { active: true },
        });
        this.categoriesByNormalizedName.set(
          normalizeCategoryName(updated.name),
          updated,
        );
        return updated;
      }

      this.categoriesByNormalizedName.set(
        normalizeCategoryName(existing.name),
        existing,
      );
      return existing;
    }

    const displayName = toTitleCase(categoryName || 'General') || 'General';

    try {
      const createdCategory = await ctx.prisma.category.create({
        data: {
          name: displayName,
          organizationId: ctx.organizationId,
        },
      });
      this.categoriesByNormalizedName.set(
        normalizeCategoryName(createdCategory.name),
        createdCategory,
      );
      return createdCategory;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const fallback = await ctx.prisma.category.findFirst({
          where: {
            organizationId: ctx.organizationId,
            name: {
              equals: displayName,
              mode: 'insensitive',
            },
          },
        });

        if (fallback) {
          this.categoriesByNormalizedName.set(
            normalizeCategoryName(fallback.name),
            fallback,
          );
          return fallback;
        }
      }

      throw error;
    }
  }
}
