import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';
import type { SheetId } from './engine/import-sheet-handler.interface';
import {
  SHEET_COLUMN_ALIASES,
  SHEET_REQUIRED_FIELDS,
} from './helpers/column-detector';

/** Human readable name of each importable sheet used on the template. */
export const SHEET_DISPLAY_NAMES: Record<SheetId, string> = {
  productos: 'Productos',
  clientes: 'Clientes',
  proveedores: 'Proveedores',
  usuarios: 'Usuarios',
};

export const TEMPLATE_SHEET_ORDER: SheetId[] = [
  'productos',
  'clientes',
  'proveedores',
  'usuarios',
];

/** Spanish display header for each importable field key. */
const DISPLAY_HEADERS: Record<string, string> = {
  name: 'Nombre',
  sku: 'SKU',
  barcode: 'Codigo de Barras',
  category: 'Categoria',
  salePrice: 'Precio Venta',
  costPrice: 'Precio Costo',
  stock: 'Stock',
  minStock: 'Stock Minimo',
  taxRate: 'Impuesto',
  description: 'Descripcion',
  documentType: 'Tipo de Documento',
  documentNumber: 'Documento',
  email: 'Email',
  phone: 'Telefono',
  segment: 'Segmento',
  password: 'Contraseña',
  role: 'Rol',
  address: 'Direccion',
  contactName: 'Nombre de Contacto',
  bank: 'Banco',
  accountNumber: 'Numero de Cuenta',
  accountType: 'Tipo de Cuenta',
};

/** Example value shown in the template's sample row. */
const EXAMPLE_VALUES: Record<string, string | number> = {
  name: 'Ejemplo',
  sku: 'IMP-001',
  barcode: '7700000000001',
  category: 'General',
  salePrice: 5000,
  costPrice: 3500,
  stock: 10,
  minStock: 2,
  taxRate: 19,
  description: 'Descripcion opcional',
  documentType: 'CC',
  documentNumber: '1234567890',
  email: 'ejemplo@correo.com',
  phone: '3001234567',
  segment: 'OCCASIONAL',
  password: 'ContrasenaSegura123',
  role: 'CASHIER',
  address: 'Calle 123 #45-67',
  contactName: 'Juan Perez',
  bank: 'Bancolombia',
  accountNumber: '1234567890',
  accountType: 'SAVINGS',
};

export interface TemplateColumn {
  key: string;
  header: string;
  required: boolean;
  example: string | number;
}

export interface SheetTemplateDefinition {
  sheetId: SheetId;
  sheetName: string;
  columns: TemplateColumn[];
  requiredKeys: string[];
}

/**
 * Builds the canonical column definitions for the four importable sheets,
 * deriving each column list from the per-entity alias tables (which reflect
 * the fields the create-service DTOs accept) and the required-column set.
 */
export function buildTemplateDefinitions(): SheetTemplateDefinition[] {
  return TEMPLATE_SHEET_ORDER.map((sheetId) => {
    const aliases = SHEET_COLUMN_ALIASES[sheetId] ?? {};
    const required = SHEET_REQUIRED_FIELDS[sheetId] ?? [];
    const columns: TemplateColumn[] = Object.keys(aliases).map((key) => ({
      key,
      header: DISPLAY_HEADERS[key] ?? key,
      required: required.includes(key),
      example: EXAMPLE_VALUES[key] ?? '',
    }));
    return {
      sheetId,
      sheetName: SHEET_DISPLAY_NAMES[sheetId],
      columns,
      requiredKeys: [...required],
    };
  });
}

/**
 * Generates the multi-sheet import template workbook on the fly. It contains
 * the four entity sheets (Productos, Clientes, Proveedores, Usuarios) with a
 * marked header row and a sample row, plus an Instrucciones sheet describing
 * required columns, markers and retry guidance.
 */
@Injectable()
export class TemplateService {
  /** Builds the full template workbook in memory. */
  buildWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    const definitions = buildTemplateDefinitions();

    for (const definition of definitions) {
      const worksheet = workbook.addWorksheet(definition.sheetName);
      const headerRow = definition.columns.map((column) =>
        column.required ? `${column.header} *` : column.header,
      );
      worksheet.addRow(headerRow);
      worksheet.addRow(definition.columns.map((column) => column.example));
      worksheet.columns.forEach((column) => {
        column.width = 18;
      });
    }

    this.buildInstructionsSheet(workbook, definitions);
    return workbook;
  }

  /** Streams the generated template to the response with an xlsx content type. */
  async downloadTemplate(response: Response): Promise<void> {
    const workbook = this.buildWorkbook();

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename=plantilla_importacion_multi_${Date.now()}.xlsx`,
    );

    const buffer = await workbook.xlsx.writeBuffer();
    response.send(Buffer.from(buffer));
  }

  private buildInstructionsSheet(
    workbook: ExcelJS.Workbook,
    definitions: SheetTemplateDefinition[],
  ): void {
    const instructions = workbook.addWorksheet('Instrucciones');
    const lines: string[] = [];

    lines.push(
      '(*) indica columna requerida para importar esa hoja.',
      'Descarga la plantilla, completa cada hoja y subela en /imports.',
      '',
    );

    for (const definition of definitions) {
      const required = definition.columns
        .filter((column) => column.required)
        .map((column) => column.header)
        .join(', ');
      lines.push(`${definition.sheetName} - Columnas requeridas: ${required}.`);
    }

    lines.push(
      '',
      'Cada fila se crea mediante el servicio de creacion de la entidad.',
      'Puedes corregir errores y reintentar fila por fila desde la interfaz.',
    );

    lines.forEach((text) => {
      instructions.addRow([text]);
    });
    instructions.getColumn(1).width = 120;
  }
}
