import { Injectable } from '@nestjs/common';
import { jsPDF } from 'jspdf';
import { LOCALE, TIMEZONE } from '../common/constants/locale.constants';
import { buildReceiptData, ReceiptData, ReceiptSale, ReceiptSettings } from './receipt-data';

/**
 * Renders sale receipt PDFs (80mm thermal-style layout) with jsPDF.
 *
 * This module owns ALL receipt rendering: the service is pure data-in /
 * Buffer-out (no Response, no database access) so it is unit-testable and the
 * jsPDF dependency stays confined here. SalesService delegates receipt
 * generation and keeps HTTP response handling.
 *
 * The rendering logic below is a mechanical move of the former SalesService
 * receipt builder; the golden PDF-equality suite
 * (test/fixtures/receipts) gates any future change to it.
 */
@Injectable()
export class ReceiptsService {
  generateSaleReceiptPdf(sale: ReceiptSale, settings: ReceiptSettings): Buffer {
    const data: ReceiptData = buildReceiptData(sale, settings);
    return this.render(data);
  }

  private render(data: ReceiptData): Buffer {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 300],
    });
    const companyName = data.companyName;
    const printHeader = data.header;
    const printFooter = data.footer;
    const logoUrl = data.logoUrl;
    const receiptNumber = data.receiptNumber;

    const margin = 4;
    const maxWidth = 80 - margin * 2;
    let y = 5;

    if (logoUrl) {
      try {
        doc.addImage(logoUrl, 'PNG', 40 - 15, y, 30, 15, undefined, 'FAST');
        y += 17;
      } catch (error) {
        console.error('Error loading logo:', error);
      }
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const companyNameLines = doc.splitTextToSize(
      companyName.toUpperCase(),
      maxWidth,
    ) as string[];
    companyNameLines.forEach((line: string) => {
      doc.text(line, 40, y, { align: 'center' });
      y += 5;
    });
    y += 2;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    if (printHeader) {
      const headerLines = doc.splitTextToSize(
        printHeader,
        maxWidth,
      ) as string[];
      headerLines.forEach((line: string) => {
        doc.text(line, 40, y, { align: 'center' });
        y += 3.5;
      });
    }

    y += 3;
    doc.line(margin, y, 80 - margin, y);
    y += 4;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const receiptDate = new Date(data.createdAt).toLocaleDateString(LOCALE, {
      timeZone: TIMEZONE,
    });
    const receiptTime = new Date(data.createdAt).toLocaleTimeString(LOCALE, {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
    });
    doc.text(
      `No. ${receiptNumber}    ${receiptDate} ${receiptTime}`,
      margin,
      y,
    );
    y += 5;

    if (data.customerName !== null) {
      doc.text(`Cliente: ${data.customerName}`, margin, y);
      y += 4;
    }

    if (data.payments.length > 0) {
      if (data.payments.length === 1) {
        doc.text(
          `Pago: ${this.getPaymentMethodText(data.payments[0].method)}`,
          margin,
          y,
        );
      } else {
        doc.text(`Pago: Mixto (${data.payments.length} métodos)`, margin, y);
      }
      y += 4;
    }

    doc.line(margin, y, 80 - margin, y);
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('CANT  ITEM            $UNIT      $TOTAL', margin, y);
    y += 3;
    doc.line(margin, y, 80 - margin, y);
    y += 3;

    doc.setFont('helvetica', 'normal');
    for (const item of data.items) {
      const itemName =
        item.name.length > 14 ? item.name.substring(0, 14) + '..' : item.name;

      doc.text(`${item.quantity}`, margin + 2, y);
      doc.text(itemName, margin + 9, y);
      doc.text(this.formatCurrencyCompact(item.unitPrice), margin + 33, y);
      doc.text(this.formatCurrencyCompact(item.total), 80 - margin - 15, y);
      y += 4;
    }

    y += 2;
    doc.line(margin, y, 80 - margin, y);
    y += 4;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('SUBTOTAL', margin, y);
    doc.text(this.formatCurrencyCompact(data.subtotal), 80 - margin - 15, y);
    y += 4;

    if (data.taxAmount > 0) {
      doc.text(`IVA (${data.taxRate}%)`, margin, y);
      doc.text(this.formatCurrencyCompact(data.taxAmount), 80 - margin - 15, y);
      y += 4;
    }

    if (data.discount > 0) {
      doc.text('DESCUENTO', margin, y);
      doc.text(`-${this.formatCurrencyCompact(data.discount)}`, 80 - margin - 15, y);
      y += 4;
    }

    doc.line(margin, y, 80 - margin, y);
    y += 4;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL A PAGAR', margin, y);
    doc.text(this.formatCurrencyCompact(data.total), 80 - margin - 18, y);
    y += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    if (data.payments.length > 0) {
      if (data.payments.length > 1) {
        y += 3;
        doc.line(margin, y, 80 - margin, y);
        y += 3;
        doc.setFont('helvetica', 'bold');
        doc.text('PAGOS:', margin, y);
        y += 4;
        doc.setFont('helvetica', 'normal');

        for (const payment of data.payments) {
          const methodText = this.getPaymentMethodText(payment.method);
          doc.text(`${methodText}:`, margin, y);
          doc.text(this.formatCurrencyCompact(payment.amount), 80 - margin - 15, y);
          y += 4;
        }
      } else {
        const cashPayment = data.payments.find((p) => p.method === 'CASH');
        if (cashPayment) {
          doc.text('RECIBIDO:', margin, y);
          doc.text(
            this.formatCurrencyCompact(cashPayment.amount),
            80 - margin - 15,
            y,
          );
          y += 4;

          if (data.change !== null && data.change > 0) {
            doc.text('CAMBIO:', margin, y);
            doc.text(this.formatCurrencyCompact(data.change), 80 - margin - 15, y);
            y += 4;
          }
        }
      }
    }

    y += 4;
    doc.line(margin, y, 80 - margin, y);
    y += 5;

    doc.setFontSize(7);
    if (printFooter) {
      const footerLines = doc.splitTextToSize(
        printFooter,
        maxWidth,
      ) as string[];
      footerLines.forEach((line: string) => {
        doc.text(line, 40, y, { align: 'center' });
        y += 3.5;
      });
    }

    y += 3;
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('*** GRACIAS POR SU COMPRA ***', 40, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    return Buffer.from(doc.output('arraybuffer'));
  }

  private formatCurrencyCompact(amount: number): string {
    if (amount >= 1000000) {
      return '$' + (amount / 1000000).toFixed(2) + 'M';
    } else if (amount >= 1000) {
      return '$' + (amount / 1000).toFixed(0) + 'K';
    } else {
      return '$' + amount.toFixed(0);
    }
  }

  private getPaymentMethodText(method: string): string {
    const methods: Record<string, string> = {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      TRANSFER: 'Transferencia',
    };
    return methods[method] || method;
  }
}
