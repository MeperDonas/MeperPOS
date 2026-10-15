"use client";

import { useRef, useState, type FormEvent } from "react";
import { HandCoins } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useCollectLoan,
  useCompletePosLoan,
  useLoan,
  useLoanHistory,
  useLoans,
} from "@/hooks/useLoans";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Table, TableCell, TableHeader, TableRow } from "@/components/ui/Table";
import { useToast } from "@/contexts/ToastContext";
import { getApiErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type {
  CollectLoanInput,
  Loan,
  MonetaryLoanType,
  MoneyLoanEventType,
  MoneyLoanStatus,
} from "@/types";

const PAGE_SIZE = 10;

const TYPE_LABELS: Record<MonetaryLoanType, string> = {
  MONEY: "Efectivo",
  SERVICE: "Servicio",
};

const STATUS_LABELS: Record<MoneyLoanStatus, string> = {
  OPEN: "Abierto",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

const STATUS_VARIANTS: Record<MoneyLoanStatus, "primary" | "success" | "danger"> = {
  OPEN: "primary",
  CLOSED: "success",
  CANCELLED: "danger",
};

const EVENT_LABELS: Record<MoneyLoanEventType, string> = {
  CREATED: "Creado",
  COLLECTED: "Abono",
  REVERSED: "Reversión",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

const METHOD_OPTIONS = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
];

/** The server owns these strings; the client only formats them for display. */
function money(value: string): string {
  return formatCurrency(Number(value));
}

function counterpartyName(loan: Loan): string {
  return (
    loan.customer?.name ??
    loan.supplier?.name ??
    loan.employee?.name ??
    "Sin contraparte"
  );
}

/**
 * The server finalizes only a paid POS financing: a MONEY loan that is still
 * OPEN, with its linked customer and a zero balance. Intent membership is not
 * part of the loan projection, so this mirrors what the row actually exposes.
 */
function canCompletePosLoan(loan: Loan): boolean {
  return (
    loan.type === "MONEY" &&
    loan.status === "OPEN" &&
    loan.customer !== null &&
    loan.balance === "0.00"
  );
}

export default function LoansPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [method, setMethod] = useState<CollectLoanInput["method"]>("CASH");
  const collectKeyRef = useRef<string | null>(null);
  const completeKeyRef = useRef<string | null>(null);

  const loansQuery = useLoans({ page, limit: PAGE_SIZE });
  const loanQuery = useLoan(selectedId ?? "");
  const historyQuery = useLoanHistory(selectedId ?? "");
  const collectLoan = useCollectLoan();
  const completePosLoan = useCompletePosLoan();

  const loans = loansQuery.data?.data ?? [];
  const loan = loanQuery.data ?? null;
  const history = historyQuery.data?.data ?? [];

  const handleCollect = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !amount || amount <= 0) {
      toast.error("Ingrese un monto válido");
      return;
    }
    // One key per attempt: reused verbatim after an uncertain failure and
    // released only once the server confirms the collection.
    if (!collectKeyRef.current) {
      collectKeyRef.current = crypto.randomUUID();
    }
    try {
      await collectLoan.mutateAsync({
        id: selectedId,
        amount,
        method,
        requestKey: collectKeyRef.current,
      });
      collectKeyRef.current = null;
      setAmount(undefined);
      toast.success("Abono registrado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el abono"));
    }
  };

  const handleComplete = async () => {
    if (!selectedId || !loan || !canCompletePosLoan(loan)) return;
    if (!completeKeyRef.current) {
      completeKeyRef.current = crypto.randomUUID();
    }
    try {
      // The frozen quote already lives on the server: only the idempotency key
      // travels, never items, totals or a sale id.
      await completePosLoan.mutateAsync({
        id: selectedId,
        requestKey: completeKeyRef.current,
      });
      completeKeyRef.current = null;
      toast.success("Venta financiada completada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo completar la venta"));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1.5 shrink-0 rounded-full bg-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
            Préstamos
          </h1>
        </div>

        <Card className="overflow-hidden">
          {loansQuery.isLoading ? (
            <LoadingState
              icon={<HandCoins className="h-5 w-5 text-primary" />}
              message="Cargando préstamos..."
            />
          ) : loansQuery.isError ? (
            <ErrorState
              message={getApiErrorMessage(
                loansQuery.error,
                "No se pudieron cargar los préstamos",
              )}
              retryLabel="Reintentar"
              onRetry={() => void loansQuery.refetch()}
            />
          ) : loans.length === 0 ? (
            <EmptyState
              icon={<HandCoins className="h-5 w-5 text-muted-foreground" />}
              title="Sin préstamos registrados"
              subtitle="Las obligaciones y las ventas financiadas aparecerán aquí."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell as="th">Tipo</TableCell>
                    <TableCell as="th">Contraparte</TableCell>
                    <TableCell as="th">Monto</TableCell>
                    <TableCell as="th">Abonado</TableCell>
                    <TableCell as="th">Saldo</TableCell>
                    <TableCell as="th">Estado</TableCell>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {loans.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedId(row.id);
                        setAmount(undefined);
                      }}
                    >
                      <TableCell>{TYPE_LABELS[row.type]}</TableCell>
                      <TableCell>{counterpartyName(row)}</TableCell>
                      <TableCell>{money(row.amount)}</TableCell>
                      <TableCell>{money(row.collected)}</TableCell>
                      <TableCell>{money(row.balance)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[row.status]}>
                          {STATUS_LABELS[row.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
          <div className="border-t border-border/60 p-4">
            <Pagination
              currentPage={loansQuery.data?.page ?? page}
              totalPages={loansQuery.data?.totalPages ?? 0}
              totalItems={loansQuery.data?.total}
              pageSize={PAGE_SIZE}
              itemLabel="préstamo"
              onPageChange={setPage}
            />
          </div>
        </Card>
      </div>

      <Modal
        isOpen={selectedId !== null}
        onClose={() => {
          setSelectedId(null);
          setAmount(undefined);
        }}
        title="Detalle del préstamo"
      >
        {loanQuery.isLoading ? (
          <LoadingState
            icon={<HandCoins className="h-5 w-5 text-primary" />}
            message="Cargando detalle..."
          />
        ) : loanQuery.isError || !loan ? (
          <ErrorState
            message={getApiErrorMessage(
              loanQuery.error,
              "No se pudo cargar el préstamo",
            )}
            retryLabel="Reintentar"
            onRetry={() => void loanQuery.refetch()}
          />
        ) : (
          <div className="space-y-5 p-4 sm:p-6">
            <div className="grid grid-cols-3 gap-3 text-center">
              {(
                [
                  ["Monto", loan.amount],
                  ["Abonado", loan.collected],
                  ["Saldo", loan.balance],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl bg-muted/40 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    {money(value)}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{counterpartyName(loan)}</span>
              <Badge variant={STATUS_VARIANTS[loan.status]}>
                {STATUS_LABELS[loan.status]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{loan.reason}</p>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Historial
              </h3>
              <ul className="mt-2 space-y-1.5">
                {history.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-foreground">
                      {EVENT_LABELS[event.type]}
                    </span>
                    <span className="text-muted-foreground">
                      {event.amount ? money(event.amount) : event.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {loan.status === "OPEN" && (
              <form onSubmit={handleCollect} className="space-y-3">
                <CurrencyInput
                  label="Monto del abono"
                  value={amount}
                  onChange={setAmount}
                />
                <Select
                  label="Método"
                  options={METHOD_OPTIONS}
                  value={method}
                  onChange={(event) =>
                    setMethod(event.target.value as CollectLoanInput["method"])
                  }
                />
                <Button type="submit" loading={collectLoan.isPending}>
                  Registrar abono
                </Button>
              </form>
            )}

            {canCompletePosLoan(loan) && (
              <Button
                type="button"
                variant="success"
                loading={completePosLoan.isPending}
                onClick={() => void handleComplete()}
              >
                Completar venta financiada
              </Button>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
