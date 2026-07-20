import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, type Category } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { SettingsService } from '../settings/settings.service';
import type { RetryImportRowDto } from './dto/import.dto';
import {
  detectColumnMapping,
  type ColumnMapping,
} from './helpers/column-detector';
import {
  buildGeneratedSku,
  normalizeCategoryName,
  normalizeLookupKey,
  normalizeText,
  parseDecimal,
  parseInteger,
  toTitleCase,
  type ParsedImportRowData,
} from './helpers/row-validator';

type ImportJobStatus = 'PARSING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
type ImportEventType = 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';

interface ImportWarning {
  rowIndex: number;
  warningCode: string;
  message: string;
}

interface ImportEvent {
  type: ImportEventType;
  message: string;
  rowIndex: number;
  timestamp: Date;
}

interface ImportRowError {
  rowIndex: number;
  rawData: Record<string, string>;
  mappedData: Record<string, unknown>;
  errorCode: string;
  message: string;
  field?: string;
  retried: boolean;
  retriedSuccess?: boolean;
  editableFields: string[];
}

interface ParsedFileRow {
  rowIndex: number;
  rawData: Record<string, string>;
}

interface ParsedFilePayload {
  headers: string[];
  rows: ParsedFileRow[];
}

interface ImportJobInternal {
  id: string;
  userId: string;
  organizationId: string;
  status: ImportJobStatus;
  fileName: string;
  totalRows: number;
  processedRows: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  warningCount: number;
  columnMapping: ColumnMapping;
  detectedColumns: string[];
  errors: ImportRowError[];
  warnings: ImportWarning[];
  recentEvents: ImportEvent[];
  createdCategories: string[];
  startedAt: Date;
  completedAt?: Date;
  existingSkusLower: Set<string>;
  existingBarcodesLower: Set<string>;
  seenSkusInFileLower: Set<string>;
  seenBarcodesInFileLower: Set<string>;
  categoriesByNormalizedName: Map<string, Category>;
  settingsTaxRate: number;
}

const MAX_FILE_ROWS = 5000;
const JOB_TTL_MS = 30 * 60 * 1000;
const MAX_RECENT_EVENTS = 10;
const EDITABLE_FIELDS = [
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

@Injectable()
export class ImportsService implements OnModuleDestroy {
  private readonly jobs = new Map<string, ImportJobInternal>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly settingsService: SettingsService,
  ) {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredJobs();
      },
      5 * 60 * 1000,
    );

    this.cleanupInterval.unref?.();
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  async startProductsImport(
    file: Express.Multer.File,
    userId: string,
    organizationId: string | undefined,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required for this operation');
    }
    this.validateIncomingFile(file);

    const parsedFile = await this.parseFile(file);

    if (parsedFile.rows.length === 0) {
      throw new BadRequestException(
        'El archivo no contiene filas de productos para importar',
      );
    }

    if (parsedFile.rows.length > MAX_FILE_ROWS) {
      throw new BadRequestException(
        `El archivo supera el máximo permitido de ${MAX_FILE_ROWS} filas`,
      );
    }

    const detection = detectColumnMapping(parsedFile.headers);

    if (detection.missingRequiredFields.length > 0) {
      throw new BadRequestException(
        `Faltan columnas requeridas: ${detection.missingRequiredFields.join(', ')}`,
      );
    }

    const [products, categories, settings] = await Promise.all([
      this.prisma.product.findMany({
        where: { organizationId },
        select: { sku: true, barcode: true },
      }),
      this.prisma.category.findMany({ where: { organizationId } }),
      this.settingsService.find(organizationId),
    ]);

    const job: ImportJobInternal = {
      id: randomUUID(),
      userId,
      organizationId,
      status: 'PARSING',
      fileName: file.originalname,
      totalRows: parsedFile.rows.length,
      processedRows: 0,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      warningCount: 0,
      columnMapping: detection.mapping,
      detectedColumns: detection.detectedColumns,
      errors: [],
      warnings: [],
      recentEvents: [],
      createdCategories: [],
      startedAt: new Date(),
      existingSkusLower: new Set(
        products.map((p) => normalizeLookupKey(p.sku)).filter(Boolean),
      ),
      existingBarcodesLower: new Set(
        products
          .map((p) => normalizeLookupKey(p.barcode ?? ''))
          .filter(Boolean),
      ),
      seenSkusInFileLower: new Set<string>(),
      seenBarcodesInFileLower: new Set<string>(),
      categoriesByNormalizedName: new Map(
        categories.map((category) => [
          normalizeCategoryName(category.name),
          category,
        ]),
      ),
      settingsTaxRate: settings?.taxRate ? Number(settings.taxRate) : 0,
    };

    this.jobs.set(job.id, job);
    this.addEvent(job, 'INFO', 'Archivo recibido. Iniciando procesamiento', 1);

    void this.processImportJob(job.id, parsedFile.rows);

    return {
      jobId: job.id,
      totalRows: job.totalRows,
      detectedColumns: detection.detectedColumns,
      columnMapping: detection.mapping,
    };
  }

  getImportStatus(jobId: string, userId: string) {
    const job = this.getJobOrThrow(jobId, userId);
    return this.buildStatusResponse(job);
  }

  async retryImportRow(jobId: string, userId: string, dto: RetryImportRowDto) {
    const job = this.getJobOrThrow(jobId, userId);
    const unresolvedError = job.errors.find(
      (error) =>
        error.rowIndex === dto.rowIndex &&
        !(error.retried === true && error.retriedSuccess === true),
    );

    if (!unresolvedError) {
      throw new NotFoundException(
        'No se encontró un error pendiente para la fila indicada',
      );
    }

    const correctedData = this.sanitizeCorrectedData(dto.correctedData);
    const retryInput = {
      ...unresolvedError.mappedData,
      ...correctedData,
    };

    const parsed = this.parseMappedDataForRetry(dto.rowIndex, retryInput);

    if (parsed.kind === 'error') {
      unresolvedError.retried = true;
      unresolvedError.retriedSuccess = false;
      unresolvedError.errorCode = parsed.errorCode;
      unresolvedError.field = parsed.field;
      unresolvedError.message = parsed.message;
      unresolvedError.mappedData = parsed.mappedData;
      this.addEvent(job, 'ERROR', parsed.message, dto.rowIndex);
      return this.buildStatusResponse(job);
    }

    try {
      await this.validateDuplicateInDatabase(job, parsed.data);
      const category = await this.resolveCategory(
        parsed.data.category,
        job,
        dto.rowIndex,
      );

      const effectiveTaxRate = this.resolveEffectiveTaxRate(
        parsed.data.taxRate,
        parsed.data.taxRateProvided,
        category,
        job,
      );

      await this.productsService.create(
        {
          name: parsed.data.name,
          sku: parsed.data.sku,
          barcode: parsed.data.barcode,
          description: parsed.data.description,
          costPrice: parsed.data.costPrice,
          salePrice: parsed.data.salePrice,
          taxRate: effectiveTaxRate,
          stock: parsed.data.stock,
          minStock: parsed.data.minStock,
          categoryId: category.id,
        },
        userId,
        job.organizationId,
      );

      job.importedCount += 1;
      job.errorCount = Math.max(0, job.errorCount - 1);
      unresolvedError.retried = true;
      unresolvedError.retriedSuccess = true;
      unresolvedError.message = 'Fila corregida e importada correctamente';

      job.existingSkusLower.add(normalizeLookupKey(parsed.data.sku));
      if (parsed.data.barcode) {
        job.existingBarcodesLower.add(normalizeLookupKey(parsed.data.barcode));
      }

      if (parsed.data.costInferred) {
        this.addWarning(job, dto.rowIndex, 'COST_INFERRED', {
          code: 'COST_INFERRED',
          message:
            'Precio de costo inferido con el mismo valor del precio de venta',
          field: 'costPrice',
          mappedData: this.toMappedRecord(parsed.data),
        });
      }

      this.addEvent(
        job,
        'SUCCESS',
        'Fila reintentada e importada',
        dto.rowIndex,
      );
      return this.buildStatusResponse(job);
    } catch (error) {
      const mappedError = this.mapProductCreationError(
        error,
        dto.rowIndex,
        this.toMappedRecord(parsed.data),
      );
      unresolvedError.retried = true;
      unresolvedError.retriedSuccess = false;
      unresolvedError.errorCode = mappedError.code;
      unresolvedError.message = mappedError.message;
      unresolvedError.field = mappedError.field;
      unresolvedError.mappedData = mappedError.mappedData;
      this.addEvent(job, 'ERROR', mappedError.message, dto.rowIndex);
      return this.buildStatusResponse(job);
    }
  }

  async downloadTemplate(response: any) {
    const workbook = new ExcelJS.Workbook();

    const productsSheet = workbook.addWorksheet('Productos');
    productsSheet.addRow([
      'Nombre',
      'SKU',
      'Categoria',
      'Precio Venta',
      'Precio Costo',
      'Stock',
      'Stock Minimo',
      'Codigo de Barras',
      'Descripcion',
      'Impuesto (%)',
    ]);

    productsSheet.addRow([
      'Ejemplo Producto 1',
      'PROD-001',
      'Bebidas',
      5000,
      3500,
      50,
      5,
      '7702011021005',
      'Descripcion opcional',
      19,
    ]);

    productsSheet.addRow([
      'Ejemplo Producto 2',
      'PROD-002',
      'Limpieza',
      8500,
      6000,
      30,
      3,
      '',
      '',
      0,
    ]);

    productsSheet.columns.forEach((column) => {
      column.width = 18;
    });

    const instructionsSheet = workbook.addWorksheet('Instrucciones');
    const instructions = [
      'Columnas minimas requeridas: Nombre, Precio (o Precio Venta), Stock.',
      'Si no envias Precio Costo, se inferira igual al Precio Venta.',
      'Si una categoria no existe, se creara automaticamente.',
      'Si no envias Impuesto (%), se hereda de la categoria (tasa por defecto) o de la configuracion global.',
      'Filas con SKU o codigo de barras duplicado se omitiran y reportaran.',
      'Puedes corregir errores y reintentar fila por fila desde la interfaz.',
    ];

    instructions.forEach((text) => {
      instructionsSheet.addRow([text]);
    });
    instructionsSheet.getColumn(1).width = 120;

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename=plantilla_importacion_inventario_${Date.now()}.xlsx`,
    );

    const buffer = await workbook.xlsx.writeBuffer();
    response.send(Buffer.from(buffer));
  }

  private async processImportJob(jobId: string, rows: ParsedFileRow[]) {
    const job = this.jobs.get(jobId);

    if (!job) {
      return;
    }

    try {
      job.status = 'PROCESSING';

      for (const row of rows) {
        await this.processRow(job, row);
        job.processedRows += 1;
      }

      job.status = 'COMPLETED';
      job.completedAt = new Date();
      this.addEvent(job, 'INFO', 'Importacion finalizada', rows.length + 1);
    } catch (error) {
      job.status = 'FAILED';
      job.completedAt = new Date();
      const message =
        error instanceof Error
          ? error.message
          : 'Error inesperado durante la importacion';
      this.addEvent(job, 'ERROR', message, rows.length + 1);
    }
  }

  private async processRow(job: ImportJobInternal, row: ParsedFileRow) {
    const parsed = this.parseRawRow(job, row);

    if (parsed.kind === 'skip') {
      job.skippedCount += 1;
      return;
    }

    if (parsed.kind === 'error') {
      this.addError(job, row.rowIndex, row.rawData, parsed.errorCode, {
        message: parsed.message,
        field: parsed.field,
        mappedData: parsed.mappedData,
      });
      return;
    }

    const skuKey = normalizeLookupKey(parsed.data.sku);
    const barcodeKey = parsed.data.barcode
      ? normalizeLookupKey(parsed.data.barcode)
      : '';

    if (job.seenSkusInFileLower.has(skuKey)) {
      this.addError(job, row.rowIndex, row.rawData, 'DUPLICATE_SKU_FILE', {
        message: 'SKU duplicado dentro del mismo archivo',
        field: 'sku',
        mappedData: this.toMappedRecord(parsed.data),
      });
      return;
    }

    if (barcodeKey && job.seenBarcodesInFileLower.has(barcodeKey)) {
      this.addError(job, row.rowIndex, row.rawData, 'DUPLICATE_BARCODE_FILE', {
        message: 'Codigo de barras duplicado dentro del mismo archivo',
        field: 'barcode',
        mappedData: this.toMappedRecord(parsed.data),
      });
      return;
    }

    job.seenSkusInFileLower.add(skuKey);
    if (barcodeKey) {
      job.seenBarcodesInFileLower.add(barcodeKey);
    }

    const duplicateInDb = this.validateDuplicatesInMemory(job, parsed.data);
    if (duplicateInDb) {
      this.addError(job, row.rowIndex, row.rawData, duplicateInDb.code, {
        message: duplicateInDb.message,
        field: duplicateInDb.field,
        mappedData: this.toMappedRecord(parsed.data),
      });
      return;
    }

    try {
      const category = await this.resolveCategory(
        parsed.data.category,
        job,
        row.rowIndex,
      );

      const effectiveTaxRate = this.resolveEffectiveTaxRate(
        parsed.data.taxRate,
        parsed.data.taxRateProvided,
        category,
        job,
      );

      await this.productsService.create(
        {
          name: parsed.data.name,
          sku: parsed.data.sku,
          barcode: parsed.data.barcode,
          description: parsed.data.description,
          costPrice: parsed.data.costPrice,
          salePrice: parsed.data.salePrice,
          taxRate: effectiveTaxRate,
          stock: parsed.data.stock,
          minStock: parsed.data.minStock,
          categoryId: category.id,
        },
        job.userId,
        job.organizationId,
      );

      job.importedCount += 1;
      job.existingSkusLower.add(skuKey);
      if (barcodeKey) {
        job.existingBarcodesLower.add(barcodeKey);
      }

      this.addEvent(
        job,
        'SUCCESS',
        `Producto importado: ${parsed.data.name}`,
        row.rowIndex,
      );

      if (parsed.data.costInferred) {
        this.addWarning(job, row.rowIndex, 'COST_INFERRED', {
          code: 'COST_INFERRED',
          message:
            'Precio de costo inferido con el mismo valor del precio de venta',
          field: 'costPrice',
          mappedData: this.toMappedRecord(parsed.data),
        });
      }
    } catch (error) {
      const mappedError = this.mapProductCreationError(
        error,
        row.rowIndex,
        this.toMappedRecord(parsed.data),
      );
      this.addError(job, row.rowIndex, row.rawData, mappedError.code, {
        message: mappedError.message,
        field: mappedError.field,
        mappedData: mappedError.mappedData,
      });
    }
  }

  private parseRawRow(
    job: ImportJobInternal,
    row: ParsedFileRow,
  ):
    | { kind: 'skip' }
    | {
        kind: 'error';
        errorCode: string;
        message: string;
        field?: string;
        mappedData: Record<string, unknown>;
      }
    | {
        kind: 'ok';
        data: ParsedImportRowData;
      } {
    const getValue = (field: keyof ColumnMapping) => {
      const header = job.columnMapping[field];
      if (!header) {
        return '';
      }
      return normalizeText(row.rawData[header]);
    };

    const mappedData: Record<string, unknown> = {
      name: getValue('name'),
      sku: getValue('sku'),
      barcode: getValue('barcode'),
      category: getValue('category') || 'General',
      salePrice: getValue('salePrice'),
      costPrice: getValue('costPrice'),
      stock: getValue('stock'),
      minStock: getValue('minStock'),
      taxRate: getValue('taxRate'),
      description: getValue('description'),
    };

    const name = normalizeText(mappedData.name);
    if (!name) {
      return { kind: 'skip' };
    }

    let sku = normalizeText(mappedData.sku);
    if (!sku) {
      sku = buildGeneratedSku(row.rowIndex - 1);
    }

    const salePrice = parseDecimal(mappedData.salePrice);
    if (salePrice === null || salePrice <= 0) {
      return {
        kind: 'error',
        errorCode: 'INVALID_PRICE',
        message: 'Precio de venta invalido',
        field: 'salePrice',
        mappedData: {
          ...mappedData,
          sku,
          name,
        },
      };
    }

    const stock = parseInteger(mappedData.stock);
    if (stock === null || stock < 0) {
      return {
        kind: 'error',
        errorCode: 'INVALID_STOCK',
        message: 'Stock invalido. Debe ser un numero entero mayor o igual a 0',
        field: 'stock',
        mappedData: {
          ...mappedData,
          sku,
          name,
          salePrice,
        },
      };
    }

    const rawCostPrice = normalizeText(mappedData.costPrice);
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
        mappedData: {
          ...mappedData,
          sku,
          name,
          salePrice,
          stock,
        },
      };
    }

    const minStockRaw = normalizeText(mappedData.minStock);
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
        mappedData: {
          ...mappedData,
          sku,
          name,
          salePrice,
          stock,
          costPrice,
        },
      };
    }

    const taxRateRaw = normalizeText(mappedData.taxRate);
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
          ...mappedData,
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
        barcode: normalizeText(mappedData.barcode) || undefined,
        category: normalizeText(mappedData.category) || 'General',
        salePrice,
        costPrice,
        stock,
        minStock,
        taxRate,
        taxRateProvided,
        description: normalizeText(mappedData.description) || undefined,
        costInferred,
      },
    };
  }

  private parseMappedDataForRetry(
    rowIndex: number,
    source: Record<string, unknown>,
  ):
    | {
        kind: 'error';
        errorCode: string;
        message: string;
        field?: string;
        mappedData: Record<string, unknown>;
      }
    | {
        kind: 'ok';
        data: ParsedImportRowData;
      } {
    const mappedData: Record<string, unknown> = {
      name: normalizeText(source.name),
      sku:
        normalizeText(source.sku) ||
        buildGeneratedSku(Math.max(1, rowIndex - 1)),
      barcode: normalizeText(source.barcode),
      category: normalizeText(source.category) || 'General',
      salePrice: source.salePrice,
      costPrice: source.costPrice,
      stock: source.stock,
      minStock: source.minStock,
      taxRate: source.taxRate,
      description: normalizeText(source.description),
    };

    const name = normalizeText(mappedData.name);
    if (!name) {
      return {
        kind: 'error',
        errorCode: 'EMPTY_ROW',
        message: 'La fila corregida no contiene nombre de producto',
        field: 'name',
        mappedData,
      };
    }

    const salePrice = parseDecimal(mappedData.salePrice);
    if (salePrice === null || salePrice <= 0) {
      return {
        kind: 'error',
        errorCode: 'INVALID_PRICE',
        message: 'Precio de venta invalido',
        field: 'salePrice',
        mappedData,
      };
    }

    const stock = parseInteger(mappedData.stock);
    if (stock === null || stock < 0) {
      return {
        kind: 'error',
        errorCode: 'INVALID_STOCK',
        message: 'Stock invalido. Debe ser un numero entero mayor o igual a 0',
        field: 'stock',
        mappedData,
      };
    }

    const rawCostPrice = normalizeText(mappedData.costPrice);
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
        mappedData,
      };
    }

    const minStockRaw = normalizeText(mappedData.minStock);
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
        mappedData,
      };
    }

    const taxRateRaw = normalizeText(mappedData.taxRate);
    const taxRateProvided =
      source.taxRate !== undefined &&
      source.taxRate !== null &&
      taxRateRaw.length > 0;
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
        mappedData,
      };
    }

    return {
      kind: 'ok',
      data: {
        name,
        sku: normalizeText(mappedData.sku),
        barcode: normalizeText(mappedData.barcode) || undefined,
        category: normalizeText(mappedData.category) || 'General',
        salePrice,
        costPrice,
        stock,
        minStock,
        taxRate,
        taxRateProvided,
        description: normalizeText(mappedData.description) || undefined,
        costInferred,
      },
    };
  }

  private async validateDuplicateInDatabase(
    job: ImportJobInternal,
    data: ParsedImportRowData,
  ) {
    const inMemory = this.validateDuplicatesInMemory(job, data);
    if (inMemory) {
      throw new ConflictException(inMemory.message);
    }

    const [existingSku, existingBarcode] = await Promise.all([
      this.prisma.product.findUnique({
        where: {
          organizationId_sku: {
            organizationId: job.organizationId,
            sku: data.sku,
          },
        },
      }),
      data.barcode
        ? this.prisma.product.findUnique({
            where: {
              organizationId_barcode: {
                organizationId: job.organizationId,
                barcode: data.barcode,
              },
            },
          })
        : Promise.resolve(null),
    ]);

    if (existingSku) {
      throw new ConflictException('SKU already exists');
    }

    if (existingBarcode) {
      throw new ConflictException('Barcode already exists');
    }
  }

  private validateDuplicatesInMemory(
    job: ImportJobInternal,
    data: ParsedImportRowData,
  ):
    | {
        code: string;
        message: string;
        field: string;
      }
    | undefined {
    const skuKey = normalizeLookupKey(data.sku);
    if (skuKey && job.existingSkusLower.has(skuKey)) {
      return {
        code: 'DUPLICATE_SKU_DB',
        message: 'SKU ya existe en la base de datos',
        field: 'sku',
      };
    }

    const barcodeKey = data.barcode ? normalizeLookupKey(data.barcode) : '';
    if (barcodeKey && job.existingBarcodesLower.has(barcodeKey)) {
      return {
        code: 'DUPLICATE_BARCODE_DB',
        message: 'Codigo de barras ya existe en la base de datos',
        field: 'barcode',
      };
    }

    return undefined;
  }

  private async resolveCategory(
    categoryName: string,
    job: ImportJobInternal,
    rowIndex: number,
  ) {
    const normalized = normalizeCategoryName(categoryName || 'General');
    const cached = job.categoriesByNormalizedName.get(normalized);

    if (cached) {
      if (!cached.active) {
        const updated = await this.prisma.category.update({
          where: { id: cached.id },
          data: { active: true },
        });
        job.categoriesByNormalizedName.set(normalized, updated);
        return updated;
      }
      return cached;
    }

    const existing = await this.prisma.category.findFirst({
      where: {
        organizationId: job.organizationId,
        name: {
          equals: normalizeText(categoryName),
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      if (!existing.active) {
        const updated = await this.prisma.category.update({
          where: { id: existing.id },
          data: { active: true },
        });
        job.categoriesByNormalizedName.set(normalized, updated);
        return updated;
      }

      job.categoriesByNormalizedName.set(normalized, existing);
      return existing;
    }

    const displayName = toTitleCase(categoryName || 'General') || 'General';

    try {
      const createdCategory = await this.prisma.category.create({
        data: { name: displayName, organizationId: job.organizationId },
      });
      job.categoriesByNormalizedName.set(
        normalizeCategoryName(createdCategory.name),
        createdCategory,
      );

      if (!job.createdCategories.includes(createdCategory.name)) {
        job.createdCategories.push(createdCategory.name);
      }

      this.addWarning(job, rowIndex, 'CATEGORY_CREATED', {
        code: 'CATEGORY_CREATED',
        message: `Categoria creada automaticamente: ${createdCategory.name}`,
        field: 'category',
      });

      return createdCategory;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const fallback = await this.prisma.category.findFirst({
          where: {
            organizationId: job.organizationId,
            name: {
              equals: displayName,
              mode: 'insensitive',
            },
          },
        });

        if (fallback) {
          job.categoriesByNormalizedName.set(
            normalizeCategoryName(fallback.name),
            fallback,
          );
          return fallback;
        }
      }

      throw error;
    }
  }

  /**
   * Resolves the effective tax rate for a product based on precedence:
   * 1. Explicit value from CSV (taxRateProvided=true) → use as-is
   * 2. Category's defaultTaxRate → if set
   * 3. Global settings tax rate → fallback
   * 4. 0 → last resort
   */
  private resolveEffectiveTaxRate(
    parsedTaxRate: number,
    taxRateProvided: boolean,
    category: Category,
    job: ImportJobInternal,
  ): number {
    if (taxRateProvided) {
      return parsedTaxRate;
    }

    if (
      category.defaultTaxRate !== null &&
      category.defaultTaxRate !== undefined
    ) {
      return Number(category.defaultTaxRate);
    }

    return job.settingsTaxRate;
  }

  private mapProductCreationError(
    error: unknown,
    rowIndex: number,
    mappedData: Record<string, unknown>,
  ): {
    code: string;
    message: string;
    field?: string;
    mappedData: Record<string, unknown>;
  } {
    if (error instanceof ConflictException) {
      const message = String(error.message ?? '').toLowerCase();

      if (message.includes('sku')) {
        return {
          code: 'DUPLICATE_SKU_DB',
          message: 'SKU ya existe en la base de datos',
          field: 'sku',
          mappedData,
        };
      }

      if (message.includes('barcode')) {
        return {
          code: 'DUPLICATE_BARCODE_DB',
          message: 'Codigo de barras ya existe en la base de datos',
          field: 'barcode',
          mappedData,
        };
      }
    }

    const defaultMessage =
      error instanceof Error
        ? error.message
        : `Error inesperado al importar la fila ${rowIndex}`;

    return {
      code: 'IMPORT_FAILURE',
      message: defaultMessage,
      mappedData,
    };
  }

  private addError(
    job: ImportJobInternal,
    rowIndex: number,
    rawData: Record<string, string>,
    errorCode: string,
    data: {
      message: string;
      field?: string;
      mappedData?: Record<string, unknown>;
    },
  ) {
    job.errorCount += 1;

    job.errors.push({
      rowIndex,
      rawData,
      mappedData: data.mappedData ?? {},
      errorCode,
      message: data.message,
      field: data.field,
      retried: false,
      editableFields: EDITABLE_FIELDS,
    });

    this.addEvent(job, 'ERROR', data.message, rowIndex);
  }

  private addWarning(
    job: ImportJobInternal,
    rowIndex: number,
    warningCode: string,
    data: {
      code: string;
      message: string;
      field?: string;
      mappedData?: Record<string, unknown>;
    },
  ) {
    job.warningCount += 1;

    job.warnings.push({
      rowIndex,
      warningCode,
      message: data.message,
    });

    this.addEvent(job, 'WARNING', data.message, rowIndex);
  }

  private addEvent(
    job: ImportJobInternal,
    type: ImportEventType,
    message: string,
    rowIndex: number,
  ) {
    job.recentEvents.push({
      type,
      message,
      rowIndex,
      timestamp: new Date(),
    });

    if (job.recentEvents.length > MAX_RECENT_EVENTS) {
      job.recentEvents.shift();
    }
  }

  private buildStatusResponse(job: ImportJobInternal) {
    return {
      jobId: job.id,
      status: job.status,
      fileName: job.fileName,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      importedCount: job.importedCount,
      skippedCount: job.skippedCount,
      errorCount: job.errorCount,
      warningCount: job.warningCount,
      columnMapping: job.columnMapping,
      detectedColumns: job.detectedColumns,
      errors: job.errors,
      warnings: job.warnings,
      recentEvents: job.recentEvents,
      createdCategories: job.createdCategories,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      progress:
        job.totalRows > 0
          ? Math.min(100, Math.round((job.processedRows / job.totalRows) * 100))
          : 0,
    };
  }

  private getJobOrThrow(jobId: string, userId: string) {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new NotFoundException('No se encontró la importacion solicitada');
    }

    if (job.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta importacion');
    }

    return job;
  }

  private cleanupExpiredJobs() {
    const now = Date.now();

    for (const [jobId, job] of this.jobs.entries()) {
      const referenceTime =
        job.completedAt?.getTime() ?? job.startedAt.getTime();
      if (now - referenceTime > JOB_TTL_MS) {
        this.jobs.delete(jobId);
      }
    }
  }

  private validateIncomingFile(file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo no recibido o invalido');
    }

    const lowerName = file.originalname.toLowerCase();
    const isCsv = lowerName.endsWith('.csv');
    const isExcel = lowerName.endsWith('.xlsx');

    if (!isCsv && !isExcel) {
      throw new BadRequestException('Formato no soportado. Usa .xlsx o .csv');
    }
  }

  private async parseFile(
    file: Express.Multer.File,
  ): Promise<ParsedFilePayload> {
    const lowerName = file.originalname.toLowerCase();

    if (lowerName.endsWith('.csv')) {
      return this.parseCsvFile(file.buffer);
    }

    if (lowerName.endsWith('.xlsx')) {
      return this.parseExcelFile(file.buffer);
    }

    throw new BadRequestException('No se pudo identificar el tipo de archivo');
  }

  private async parseExcelFile(buffer: Buffer): Promise<ParsedFilePayload> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('El archivo Excel no contiene hojas');
    }

    const headerRow = worksheet.getRow(1);
    const maxColumns = Math.max(headerRow.cellCount, worksheet.columnCount);

    if (maxColumns === 0) {
      throw new BadRequestException('No se detectaron columnas en el archivo');
    }

    const headers: string[] = [];
    for (let i = 1; i <= maxColumns; i += 1) {
      headers.push(this.cellValueToString(headerRow.getCell(i).value));
    }

    const rows: ParsedFileRow[] = [];

    for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex);
      const rawData: Record<string, string> = {};
      let hasValues = false;

      headers.forEach((header, headerIndex) => {
        if (!header) {
          return;
        }

        const value = this.cellValueToString(
          row.getCell(headerIndex + 1).value,
        );
        rawData[header] = value;

        if (value.length > 0) {
          hasValues = true;
        }
      });

      if (hasValues) {
        rows.push({ rowIndex, rawData });
      }
    }

    return { headers, rows };
  }

  private parseCsvFile(buffer: Buffer): ParsedFilePayload {
    const content = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const delimiter = this.detectCsvDelimiter(content);
    const rows = this.parseCsvRows(content, delimiter);

    if (rows.length === 0) {
      throw new BadRequestException('El archivo CSV esta vacio');
    }

    const headers = rows[0].map((header) => normalizeText(header));
    const dataRows: ParsedFileRow[] = [];

    for (let rowNumber = 1; rowNumber < rows.length; rowNumber += 1) {
      const row = rows[rowNumber];
      const rawData: Record<string, string> = {};
      let hasValues = false;

      headers.forEach((header, index) => {
        if (!header) {
          return;
        }

        const value = normalizeText(row[index]);
        rawData[header] = value;

        if (value.length > 0) {
          hasValues = true;
        }
      });

      if (hasValues) {
        dataRows.push({ rowIndex: rowNumber + 1, rawData });
      }
    }

    return {
      headers,
      rows: dataRows,
    };
  }

  private detectCsvDelimiter(content: string): string {
    const firstLine = content.split(/\r?\n/, 1)[0] ?? '';
    const commas = (firstLine.match(/,/g) ?? []).length;
    const semicolons = (firstLine.match(/;/g) ?? []).length;
    return semicolons > commas ? ';' : ',';
  }

  private parseCsvRows(content: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i += 1) {
      const char = content[i];
      const next = content[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          currentCell += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === delimiter && !inQuotes) {
        currentRow.push(currentCell);
        currentCell = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') {
          i += 1;
        }

        currentRow.push(currentCell);
        currentCell = '';
        rows.push(currentRow);
        currentRow = [];
        continue;
      }

      currentCell += char;
    }

    currentRow.push(currentCell);
    const hasData = currentRow.some((cell) => normalizeText(cell).length > 0);
    if (hasData) {
      rows.push(currentRow);
    }

    return rows;
  }

  private cellValueToString(value: ExcelJS.CellValue): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (typeof value === 'object') {
      if ('text' in value && typeof value.text === 'string') {
        return value.text.trim();
      }

      if ('richText' in value && Array.isArray(value.richText)) {
        return value.richText
          .map((entry) => entry.text ?? '')
          .join('')
          .trim();
      }

      if ('result' in value) {
        return this.cellValueToString(value.result as ExcelJS.CellValue);
      }
    }

    return String(value).trim();
  }

  private sanitizeCorrectedData(data: Record<string, unknown>) {
    const allowed = new Set(EDITABLE_FIELDS);
    const output: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (allowed.has(key)) {
        output[key] = value;
      }
    }

    return output;
  }

  private toMappedRecord(data: ParsedImportRowData): Record<string, unknown> {
    return {
      ...data,
    };
  }
}
