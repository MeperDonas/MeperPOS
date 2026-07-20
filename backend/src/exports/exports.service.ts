import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExportQueryDto, InventoryMovementsQueryDto } from './dto/export.dto';
import * as ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import * as csv from '@fast-csv/format';

@Injectable()
export class ExportsService {
  constructor(private prisma: PrismaService) {}

  async getInventoryMovements(
    organizationId: string | undefined,
    query: InventoryMovementsQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { ...(organizationId ? { organizationId } : {}) };

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.startDate || query.endDate) {
      const createdAt: Record<string, Date> = {};

      if (query.startDate) {
        createdAt.gte = new Date(query.startDate);
      }

      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        createdAt.lte = end;
      }

      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where: where as never,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
        },
      }),
      this.prisma.inventoryMovement.count({ where: where as never }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async exportSales(
    organizationId: string | undefined,
    query: ExportQueryDto,
    response: any,
  ) {
    const sales = await this.getSalesData(organizationId, query);
    return this.exportData(sales, 'sales', query.format, response);
  }

  async exportProducts(
    organizationId: string | undefined,
    query: ExportQueryDto,
    response: any,
  ) {
    const products = await this.getProductsData(organizationId, query);
    return this.exportData(products, 'products', query.format, response);
  }

  async exportCustomers(
    organizationId: string | undefined,
    query: ExportQueryDto,
    response: any,
  ) {
    const customers = await this.getCustomersData(organizationId, query);
    return this.exportData(customers, 'customers', query.format, response);
  }

  async exportInventory(
    organizationId: string | undefined,
    query: ExportQueryDto,
    response: any,
  ) {
    const movements = await this.getInventoryData(organizationId, query);
    return this.exportData(movements, 'inventory', query.format, response);
  }

  private async getSalesData(organizationId: string | undefined, query: ExportQueryDto) {
    const where: any = { ...(organizationId ? { organizationId } : {}) };
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    return this.prisma.sale.findMany({
      where,
      take: query.limit || undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: true } },
        customer: true,
        payments: true,
      },
    });
  }

  private async getProductsData(organizationId: string | undefined, query: ExportQueryDto) {
    return this.prisma.product.findMany({
      where: { ...(organizationId ? { organizationId } : {}), active: true },
      take: query.limit || undefined,
      orderBy: { createdAt: 'desc' },
      include: { category: { select: { name: true } } },
    });
  }

  private async getCustomersData(
    organizationId: string | undefined,
    query: ExportQueryDto,
  ) {
    return this.prisma.customer.findMany({
      where: { ...(organizationId ? { organizationId } : {}), active: true },
      take: query.limit || undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getInventoryData(
    organizationId: string | undefined,
    query: ExportQueryDto,
  ) {
    const where: any = { ...(organizationId ? { organizationId } : {}) };
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    return this.prisma.inventoryMovement.findMany({
      where,
      take: query.limit || undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { name: true, sku: true } },
        user: { select: { name: true } },
      },
    });
  }

  private async exportData(
    data: any[],
    type: string,
    format: string,
    response: any,
  ) {
    switch (format) {
      case 'excel':
        await this.exportToExcel(data, type, response);
        break;
      case 'csv':
        await this.exportToCSV(data, type, response);
        break;
      case 'pdf':
        await this.exportToPDF(data, type, response);
        break;
    }
  }

  private async exportToExcel(data: any[], type: string, response: any) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(type);
    worksheet.addRow(this.getHeaders(type));
    data.forEach((item) => worksheet.addRow(this.getRowData(type, item)));

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename=${type}_${Date.now()}.xlsx`,
    );
    await workbook.xlsx.write(response);
    response.end();
  }

  private async exportToCSV(data: any[], type: string, response: any) {
    const csvData = [
      this.getHeaders(type),
      ...data.map((item) => this.getRowData(type, item)),
    ];

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename=${type}_${Date.now()}.csv`,
    );
    response.write('\uFEFF');
    response.flushHeaders();

    csv.write(csvData, { headers: false }).pipe(response);
  }

  private async exportToPDF(data: any[], type: string, response: any) {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`${type.charAt(0).toUpperCase() + type.slice(1)} Report`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

    doc.setFontSize(8);

    let y = 50;
    const margin = 14;

    const headers = this.getHeaders(type);
    const colWidths = this.getColumnWidths(type);

    let x = margin;
    headers.forEach((header: string, index: number) => {
      doc.rect(x, y, colWidths[index], 10, 'S');
      doc.text(header, x + 2, y + 6);
      x += colWidths[index];
    });
    y += 10;

    data.forEach((item) => {
      const rowData = this.getRowData(type, item);
      x = margin;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      rowData.forEach((cell: any, index: number) => {
        doc.rect(x, y, colWidths[index], 10, 'S');
        const text = String(cell).substring(0, 20);
        doc.text(text, x + 2, y + 6);
        x += colWidths[index];
      });
      y += 10;
    });

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename=${type}_${Date.now()}.pdf`,
    );
    response.send(Buffer.from(doc.output('arraybuffer')));
  }

  private getHeaders(type: string): string[] {
    const headers: Record<string, string[]> = {
      sales: [
        'Sale #',
        'Date',
        'Customer',
        'Total',
        'Status',
        'Payment Method',
      ],
      products: [
        'Name',
        'SKU',
        'Category',
        'Price',
        'Cost',
        'Stock',
        'Min Stock',
      ],
      customers: [
        'Name',
        'Document Type',
        'Document #',
        'Email',
        'Phone',
        'Segment',
      ],
      inventory: [
        'Date',
        'Product',
        'Type',
        'Quantity',
        'Previous Stock',
        'New Stock',
        'User',
      ],
    };
    return headers[type] || [];
  }

  private getRowData(type: string, item: any): any[] {
    const getters: Record<string, (item: any) => any[]> = {
      sales: (item) => [
        item.saleNumber,
        new Date(item.createdAt).toLocaleDateString(),
        item.customer?.name || 'N/A',
        Number(item.total).toFixed(2),
        item.status,
        item.payments?.map((p: { method: string }) => p.method).join(', ') ||
          'N/A',
      ],
      products: (item) => [
        item.name,
        item.sku,
        item.category?.name || 'N/A',
        Number(item.salePrice).toFixed(2),
        Number(item.costPrice).toFixed(2),
        item.stock,
        item.minStock,
      ],
      customers: (item) => [
        item.name,
        item.documentType,
        item.documentNumber,
        item.email || 'N/A',
        item.phone || 'N/A',
        item.segment,
      ],
      inventory: (item) => [
        new Date(item.createdAt).toLocaleDateString(),
        item.product?.name || 'N/A',
        item.type,
        item.quantity,
        item.previousStock,
        item.newStock,
        item.user?.name || 'N/A',
      ],
    };
    return getters[type](item);
  }

  private getColumnWidths(type: string): number[] {
    const widths: Record<string, number[]> = {
      sales: [20, 30, 40, 25, 25, 30],
      products: [50, 25, 25, 20, 20, 15, 15],
      customers: [35, 25, 25, 30, 25, 20],
      inventory: [25, 40, 25, 15, 20, 20, 25],
    };
    return widths[type] || [];
  }
}
