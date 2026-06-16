"use client";

import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Sale } from "@/types";

interface ThermalReceiptProps {
  sale: Sale;
  organizationName: string;
  header?: string | null;
  footer?: string | null;
}

const paymentMethodLabels: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

export function ThermalReceipt({
  sale,
  organizationName,
  header,
  footer,
}: ThermalReceiptProps) {
  const totalPaid = sale.amountPaid ?? 0;
  const change = sale.change ?? 0;

  return (
    <div className="thermal-receipt" data-testid="thermal-receipt">
      <header className="receipt-header">
        <h2 className="receipt-title">{header || organizationName}</h2>
        <p className="receipt-meta">Comprobante #{sale.saleNumber}</p>
        <p className="receipt-meta">{formatDateTime(sale.createdAt)}</p>
      </header>

      <hr className="receipt-divider" />

      <section className="receipt-items">
        {sale.items.map((item) => {
          const lineTotal = item.quantity * item.unitPrice - item.discountAmount;
          return (
            <div key={item.id} className="receipt-item">
              <div className="receipt-item-row">
                <span className="receipt-item-name">
                  {item.product?.name ?? item.productId}
                </span>
                <span className="receipt-item-total">
                  {formatCurrency(lineTotal)}
                </span>
              </div>
              <div className="receipt-item-detail">
                {item.quantity} x {formatCurrency(item.unitPrice)}
                {item.discountAmount > 0 && (
                  <span className="receipt-item-discount">
                    {" "}
                    - {formatCurrency(item.discountAmount)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <hr className="receipt-divider" />

      <section className="receipt-totals">
        <div className="receipt-row">
          <span>Subtotal</span>
          <span>{formatCurrency(sale.subtotal)}</span>
        </div>
        <div className="receipt-row">
          <span>Impuestos</span>
          <span>{formatCurrency(sale.taxAmount)}</span>
        </div>
        {sale.discountAmount > 0 && (
          <div className="receipt-row receipt-discount">
            <span>Descuento</span>
            <span>-{formatCurrency(sale.discountAmount)}</span>
          </div>
        )}
        <div className="receipt-row receipt-grand-total">
          <span>Total</span>
          <span>{formatCurrency(sale.total)}</span>
        </div>
      </section>

      <hr className="receipt-divider" />

      <section className="receipt-payments">
        {sale.payments?.map((payment) => (
          <div key={payment.id} className="receipt-row">
            <span>{paymentMethodLabels[payment.method] ?? payment.method}</span>
            <span>{formatCurrency(payment.amount)}</span>
          </div>
        ))}
      </section>

      {change > 0 && (
        <div className="receipt-row receipt-change">
          <span>Cambio</span>
          <span>{formatCurrency(change)}</span>
        </div>
      )}

      <hr className="receipt-divider" />

      <footer className="receipt-footer">
        <p>{footer || "Gracias por su compra"}</p>
      </footer>
    </div>
  );
}
