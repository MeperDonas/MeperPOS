"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Table, TableCell, TableHeader, TableRow } from "@/components/ui/Table";
import { useSales } from "@/hooks/useSales";
import { formatCurrency, formatDateTime, formatPaymentMethod } from "@/lib/utils";
import type { Sale } from "@/types";

/** The card is a compact peek at the last sales; it never asks for more. */
const RECENT_SALES_LIMIT = 5;

function getStatusBadge(status: Sale["status"]) {
  switch (status) {
    case "COMPLETED":
      return <Badge variant="success">Completada</Badge>;
    case "CANCELLED":
      return <Badge variant="danger">Cancelada</Badge>;
    case "RETURNED_PARTIAL":
      return <Badge variant="warning">Parcial</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

/** Mirrors the payment convention already used by `/sales`. */
function getPaymentLabel(payments?: Sale["payments"]) {
  if (!payments || payments.length === 0) return "Sin pago";
  if (payments.length > 1) return "Mixto";
  return formatPaymentMethod(payments[0].method);
}

/**
 * Compact "Ventas recientes" peek: the last few sales in a minimum-column
 * table. The list is capped and never scrolls internally, so the dashboard
 * height does not depend on how many sales exist.
 */
export function RecentSalesCard() {
  const { data } = useSales({ limit: RECENT_SALES_LIMIT });
  const sales = (data?.data ?? []).slice(0, RECENT_SALES_LIMIT);

  return (
    <section
      data-testid="recent-sales-card"
      className="min-w-0 rounded-3xl border border-primary/20 bg-card p-4 text-foreground transition-colors hover:border-primary/35 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Ventas recientes
        </p>
        <Link
          href="/sales"
          className="inline-flex items-center gap-1 text-[12px] font-bold text-primary hover:text-primary/80"
        >
          Ver todas
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      {sales.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Sin ventas recientes
        </p>
      ) : (
        <div className="mt-3">
          <Table variant="primary">
            <TableHeader>
              <TableRow>
                <TableCell as="th" className="px-2 py-2 text-left">
                  #
                </TableCell>
                <TableCell as="th" className="px-2 py-2 text-left">
                  Hora
                </TableCell>
                <TableCell as="th" className="px-2 py-2 text-left">
                  Cliente
                </TableCell>
                <TableCell as="th" className="px-2 py-2 text-left">
                  Pago
                </TableCell>
                <TableCell as="th" className="px-2 py-2 text-right">
                  Total
                </TableCell>
                <TableCell as="th" className="px-2 py-2 text-right">
                  Estado
                </TableCell>
              </TableRow>
            </TableHeader>
            <tbody>
              {sales.map((sale) => (
                <TableRow key={sale.id} data-testid="recent-sale-row">
                  <TableCell className="px-2 py-2 font-mono font-bold">
                    {sale.saleNumber}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-muted-foreground">
                    {formatDateTime(sale.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate px-2 py-2">
                    {sale.customer?.name ?? "Cliente general"}
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    {getPaymentLabel(sale.payments)}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right font-mono font-bold tabular-nums">
                    {formatCurrency(sale.total)}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right">
                    {getStatusBadge(sale.status)}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  );
}
