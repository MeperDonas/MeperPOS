"use client";

import { api } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Sale, SaleItem } from "@/types";

export async function printReceipt(saleId: string) {
  try {
    await api.exportData(`/sales/${saleId}/receipt`, {});
  } catch {
    throw new Error("Error al generar el comprobante");
  }
}

interface ThermalReceiptOptions {
  header?: string | null;
  footer?: string | null;
}

const paymentMethodLabels: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

function buildReceiptHtml(
  sale: Sale,
  organizationName: string,
  options: ThermalReceiptOptions = {},
): string {
  const { header, footer } = options;
  const totalPaid = sale.amountPaid ?? 0;
  const change = sale.change ?? 0;

  const itemRows = sale.items
    .map((item: SaleItem) => {
      const lineTotal = item.quantity * item.unitPrice - item.discountAmount;
      const detail = `${item.quantity} x ${formatCurrency(item.unitPrice)}${
        item.discountAmount > 0
          ? ` - ${formatCurrency(item.discountAmount)}`
          : ""
      }`;
      return `
        <div class="receipt-item">
          <div class="receipt-item-row">
            <span class="receipt-item-name">${escapeHtml(
              item.product?.name ?? item.productId,
            )}</span>
            <span class="receipt-item-total">${formatCurrency(lineTotal)}</span>
          </div>
          <div class="receipt-item-detail">${detail}</div>
        </div>
      `;
    })
    .join("");

  const paymentRows = (sale.payments ?? [])
    .map(
      (payment) => `
        <div class="receipt-row">
          <span>${paymentMethodLabels[payment.method] ?? payment.method}</span>
          <span>${formatCurrency(payment.amount)}</span>
        </div>
      `,
    )
    .join("");

  const discountRow =
    sale.discountAmount > 0
      ? `
        <div class="receipt-row receipt-discount">
          <span>Descuento</span>
          <span>-${formatCurrency(sale.discountAmount)}</span>
        </div>
      `
      : "";

  const changeRow =
    change > 0
      ? `
        <div class="receipt-row receipt-change">
          <span>Cambio</span>
          <span>${formatCurrency(change)}</span>
        </div>
      `
      : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Comprobante #${sale.saleNumber}</title>
        <style>
          @media print {
            @page { margin: 0; size: 80mm auto; }
            body { margin: 0; padding: 0; background: #fff; color: #000; }
            .thermal-receipt { width: 80mm; padding: 4mm; margin: 0 auto; font-family: monospace; font-size: 12px; box-sizing: border-box; }
            .no-print { display: none !important; }
          }
          @media screen {
            body { background: #f5f5f5; }
            .thermal-receipt { width: 80mm; padding: 12px; margin: 20px auto; background: #fff; border: 1px dashed #ccc; font-family: monospace; font-size: 12px; box-sizing: border-box; }
          }
          .thermal-receipt { line-height: 1.4; }
          .receipt-header { text-align: center; margin-bottom: 8px; }
          .receipt-title { font-size: 14px; font-weight: bold; margin: 0; }
          .receipt-meta { margin: 2px 0; font-size: 11px; }
          .receipt-divider { border: none; border-top: 1px dashed #000; margin: 8px 0; }
          .receipt-item { margin-bottom: 6px; }
          .receipt-item-row { display: flex; justify-content: space-between; }
          .receipt-item-name { flex: 1; padding-right: 8px; word-break: break-word; }
          .receipt-item-total { white-space: nowrap; }
          .receipt-item-detail { font-size: 11px; }
          .receipt-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .receipt-grand-total { font-weight: bold; font-size: 13px; margin-top: 4px; }
          .receipt-footer { text-align: center; margin-top: 8px; font-size: 11px; }
          .print-button { display: block; width: 80mm; margin: 12px auto; padding: 10px; text-align: center; background: #000; color: #fff; border: none; font-family: monospace; font-size: 13px; cursor: pointer; }
        </style>
      </head>
      <body>
        <button class="print-button no-print" onclick="window.print()">Imprimir Comprobante</button>
        <div class="thermal-receipt">
          <header class="receipt-header">
            <h2 class="receipt-title">${escapeHtml(header || organizationName)}</h2>
            <p class="receipt-meta">Comprobante #${sale.saleNumber}</p>
            <p class="receipt-meta">${formatDateTime(sale.createdAt)}</p>
          </header>

          <hr class="receipt-divider" />

          <section class="receipt-items">
            ${itemRows}
          </section>

          <hr class="receipt-divider" />

          <section class="receipt-totals">
            <div class="receipt-row"><span>Subtotal</span><span>${formatCurrency(
              sale.subtotal,
            )}</span></div>
            <div class="receipt-row"><span>Impuestos</span><span>${formatCurrency(
              sale.taxAmount,
            )}</span></div>
            ${discountRow}
            <div class="receipt-row receipt-grand-total"><span>Total</span><span>${formatCurrency(
              sale.total,
            )}</span></div>
          </section>

          <hr class="receipt-divider" />

          <section class="receipt-payments">
            ${paymentRows}
          </section>

          ${changeRow}

          <hr class="receipt-divider" />

          <footer class="receipt-footer">
            <p>${escapeHtml(footer || "Gracias por su compra")}</p>
          </footer>
        </div>
        <script>window.print();</script>
      </body>
    </html>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function printThermalReceipt(
  sale: Sale,
  organizationName: string,
  options: ThermalReceiptOptions = {},
): void {
  const printWindow = window.open(
    "",
    "_blank",
    "width=320,height=600,scrollbars=yes,resizable=yes",
  );

  if (!printWindow) {
    return;
  }

  printWindow.document.write(buildReceiptHtml(sale, organizationName, options));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
