"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useCashFlow,
  useCustomerStatistics,
  useEconomicOverview,
  useInventorySnapshot,
  useSalesByCategory,
  useSalesByPaymentMethod,
  useTopSellingProducts,
} from "@/hooks/useReports";
import { api, getApiErrorMessage } from "@/lib/api";
import { adaptiveReportGranularity, formatReportMoney, safeDecimalNumber } from "@/lib/reportPresentation";
import { formatCurrency, getBogotaDateInputValue, shiftDateInputValue } from "@/lib/utils";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableCell, TableHeader, TableRow } from "@/components/ui/Table";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CircleDollarSign,
  Download,
  Package,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import type { AppliedRange, FinancialDelta, FinancialReport } from "@/types";

function rangeLabel(range?: AppliedRange) {
  if (!range?.startDate && !range?.endDate) return "Período completo";
  const format = (value: string | null) => {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "America/Bogota",
    }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  };
  const start = format(range.startDate);
  const end = format(range.endDate);
  return start && end ? `${start} - ${end}` : start ? `Desde ${start}` : `Hasta ${end}`;
}

function ErrorState({ message }: { message: string }) {
  return <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{message}</p>;
}

function SectionShell({ title, icon: Icon, children, tone = "primary" }: { title: string; icon: typeof BarChart3; children: React.ReactNode; tone?: "primary" | "accent" }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs">
      <div className="flex items-center gap-2.5 border-b border-border/60 px-5 py-4">
        <div className="w-7 h-7 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function MetricCard({ label, value, helper, delta }: { label: string; value: string; helper: string; delta?: FinancialDelta }) {
  const positive = (delta?.percentage ?? 0) >= 0;
  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between">
      <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-extrabold font-mono text-foreground tracking-tight">{value}</p>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        {delta ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold ${positive ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800"}`}>
            <span aria-hidden="true">{positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}</span>
            {delta.percentage === null ? "Sin base" : `${positive ? "+" : ""}${delta.percentage.toFixed(1)}%`}
          </span>
        ) : <span />}
        <span className="text-right text-[11px] text-muted-foreground">{helper}</span>
      </div>
    </div>
  );
}

function ComparisonChart({ current, previous, range }: { current: FinancialReport; previous: FinancialReport; range: AppliedRange }) {
  const granularity = adaptiveReportGranularity(range.startDate, range.endDate);
  const currentValue = safeDecimalNumber(current.netIncome);
  const previousValue = safeDecimalNumber(previous.netIncome);
  const scale = Math.max(Math.abs(currentValue), Math.abs(previousValue), 1);
  return (
    <div className="space-y-4" aria-label={`Comparación económica por ${granularity === "day" ? "día" : "mes"}`} role="img">
      <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-foreground">Comparación con período anterior</p><p className="text-xs text-muted-foreground">Ingreso neto provisto por el contrato económico</p></div><span className="rounded-full border border-primary/30 bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-primary">Granularidad: {granularity === "day" ? "día" : "mes"}</span></div>
      {[{ label: "Actual", value: currentValue, color: "bg-primary" }, { label: "Anterior", value: previousValue, color: "bg-accent" }].map((item) => (
        <div key={item.label} className="grid grid-cols-[70px_minmax(0,1fr)_auto] items-center gap-3 text-xs">
          <span className="font-semibold text-muted-foreground">{item.label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.max(2, (Math.abs(item.value) / scale) * 100)}%` }} /></div>
          <span className="font-semibold text-foreground">{formatReportMoney(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function OperationalEmpty({ label }: { label: string }) {
  return <EmptyState icon={<BarChart3 className="h-6 w-6 text-muted-foreground/30" />} title={`Sin datos de ${label}`} subtitle="Prueba otro período o espera nuevas operaciones." className="min-h-[160px]" />;
}

export default function ReportsPage() {
  const toast = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showExporting, setShowExporting] = useState(false);
  const [showExportSection, setShowExportSection] = useState(false);

  const economic = useEconomicOverview(startDate, endDate);
  const cash = useCashFlow(startDate, endDate);
  const inventory = useInventorySnapshot(startDate, endDate);
  const paymentMethods = useSalesByPaymentMethod(startDate, endDate);
  const categories = useSalesByCategory(startDate, endDate);
  const topProducts = useTopSellingProducts(startDate, endDate, 5);
  const customers = useCustomerStatistics(startDate, endDate);
  const overview = economic.data;
  const current = overview?.current;

  const setToday = () => { const today = getBogotaDateInputValue(); setStartDate(today); setEndDate(today); };
  const setLast30Days = () => { const today = getBogotaDateInputValue(); setStartDate(shiftDateInputValue(today, -29)); setEndDate(today); };
  const handleEconomicExport = async () => {
    setShowExporting(true);
    try { await api.exportData("/exports/economic", { format: "excel", type: "economic", startDate, endDate }); toast.success("Exportación económica generada correctamente"); }
    catch (error) { toast.error(getApiErrorMessage(error, "No se pudo generar la exportación")); }
    finally { setShowExporting(false); }
  };

  const operationalPaymentMethods = useMemo(() => paymentMethods.data?.data ?? [], [paymentMethods.data?.data]);
  const operationalCategories = useMemo(() => categories.data?.data ?? [], [categories.data?.data]);
  const operationalProducts = useMemo(() => topProducts.data?.data ?? [], [topProducts.data?.data]);
  const operationalCustomers = customers.data?.topCustomers ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-5 lg:space-y-7">
        <header>
          <div className="flex items-center gap-3"><div className="h-7 w-1 rounded-full bg-primary" /><h1 className="text-2xl font-bold text-foreground lg:text-3xl">Reportes</h1></div>
          <p className="ml-4 mt-1 text-sm text-muted-foreground">Economía primero, operación después</p>
        </header>

        <section className="overflow-hidden rounded-3xl border border-primary/30 bg-primary/10" aria-label="Filtros de período">
          <div className="flex flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/5 px-4 py-3"><Calendar className="h-4 w-4 text-primary" aria-hidden="true" /><span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Período</span><Button variant="secondary" size="sm" onClick={setToday}>Hoy</Button><Button variant="secondary" size="sm" onClick={setLast30Days}>Últimos 30 días</Button>{(startDate || endDate) && <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); }}>Limpiar</Button>}</div>
          <div className="flex flex-wrap items-center gap-3 px-4 py-3"><label className="text-xs font-semibold text-muted-foreground" htmlFor="reports-start">Desde</label><input id="reports-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-9 rounded-xl border border-primary/20 bg-background/60 px-3 text-sm" /><label className="text-xs font-semibold text-muted-foreground" htmlFor="reports-end">Hasta</label><input id="reports-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-9 rounded-xl border border-primary/20 bg-background/60 px-3 text-sm" /><span className="rounded-full border border-primary/30 bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-primary">{rangeLabel(economic.data?.appliedRange)}</span></div>
        </section>

        <SectionShell title="Economía" icon={CircleDollarSign}>
          {economic.isLoading ? <div aria-busy="true"><LoadingState icon={<CircleDollarSign className="h-4 w-4 text-primary/50" />} message="Cargando economía..." /></div> : economic.error ? <ErrorState message={getApiErrorMessage(economic.error, "No se pudo cargar el resumen económico")} /> : !current ? <OperationalEmpty label="economía" /> : <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Ingreso neto" value={formatReportMoney(current.netIncome)} helper="Ventas completadas menos descuentos, sin impuestos" delta={overview!.deltas.netIncome} /><MetricCard label="Utilidad bruta" value={formatReportMoney(current.grossProfit)} helper={`${current.grossMarginPercentage?.toFixed(1) ?? "-"}% de margen`} delta={overview!.deltas.grossProfit} /><MetricCard label="Utilidad neta" value={formatReportMoney(current.netProfit)} helper={`${current.netMarginPercentage?.toFixed(1) ?? "-"}% de margen`} delta={overview!.deltas.netProfit} /><MetricCard label="Gastos operativos" value={formatReportMoney(current.operatingExpenses)} helper="Compras excluidas del gasto operativo" delta={overview!.deltas.operatingExpenses} /></div>
            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]"><div className="rounded-2xl border border-primary/20 bg-background/40 p-4"><ComparisonChart current={current} previous={overview!.previous} range={overview!.appliedRange} /></div><div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"><p className="text-sm font-semibold text-foreground">Calidad de datos</p><p className="mt-1 text-xs text-muted-foreground">Sólo los ítems con costo histórico respaldado participan en COGS y margen exactos.</p><p className="mt-4 text-lg font-bold text-foreground">{current.dataQuality.snapshotBackedItems} registros con costo exacto</p><p role="status" className="mt-1 text-xs text-amber-700 dark:text-amber-300">{current.dataQuality.excludedItems} registro{current.dataQuality.excludedItems === 1 ? "" : "s"} excluido{current.dataQuality.excludedItems === 1 ? "" : "s"}; no se estimó su costo actual.</p></div></div>
          </>}
        </SectionShell>

        <div className="grid gap-5 xl:grid-cols-2"><SectionShell title="Caja y pagos" icon={Receipt} tone="accent">{cash.isLoading ? <div aria-busy="true"><LoadingState icon={<Receipt className="h-4 w-4 text-primary/50" />} message="Cargando caja..." /></div> : cash.error ? <ErrorState message={getApiErrorMessage(cash.error, "No se pudo cargar caja")} /> : cash.data ? <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-accent/20 bg-background/40 p-4"><p className="text-xs text-muted-foreground">Cobros por fecha de pago</p><p className="mt-2 text-xl font-bold text-accent">{formatReportMoney(cash.data.collections.total)}</p></div><div className="rounded-2xl border border-accent/20 bg-background/40 p-4"><p className="text-xs text-muted-foreground">Pagos de gastos</p><p className="mt-2 text-xl font-bold text-accent">{formatReportMoney(cash.data.expensePayments.total)}</p></div></div> : <OperationalEmpty label="caja" />}</SectionShell><SectionShell title="Inventario actual" icon={Package}>{inventory.isLoading ? <div aria-busy="true"><LoadingState icon={<Package className="h-4 w-4 text-primary/50" />} message="Cargando inventario..." /></div> : inventory.error ? <ErrorState message={getApiErrorMessage(inventory.error, "No se pudo cargar inventario")} /> : inventory.data ? <div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Valor a costo actual</p><p className="mt-1 font-bold text-foreground">{formatReportMoney(inventory.data.current.stockValue)}</p></div><div><p className="text-xs text-muted-foreground">Valor de venta actual</p><p className="mt-1 font-bold text-foreground">{formatReportMoney(inventory.data.current.retailValue)}</p></div><div><p className="text-xs text-muted-foreground">Utilidad potencial</p><p className="mt-1 font-bold text-primary">{formatReportMoney(inventory.data.current.potentialProfit)}</p></div><div><p className="text-xs text-muted-foreground">Unidades en stock</p><p className="mt-1 font-bold text-foreground">{inventory.data.current.stockQuantity.toLocaleString("es-CO")}</p></div></div> : <OperationalEmpty label="inventario" />}</SectionShell></div>

        <div><p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Análisis operativo</p><div className="grid gap-5 xl:grid-cols-2">
          <SectionShell title="Productos Más Vendidos" icon={TrendingUp}>{topProducts.isLoading ? <div aria-busy="true"><LoadingState icon={<TrendingUp className="h-4 w-4 text-primary/50" />} message="Cargando productos..." /></div> : topProducts.error ? <ErrorState message={getApiErrorMessage(topProducts.error, "No se pudieron cargar productos")} /> : operationalProducts.length === 0 ? <OperationalEmpty label="productos" /> : <div className="space-y-2">{operationalProducts.map((product, index) => <div key={product.productId} className="group flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/40 p-3 transition-all hover:border-primary/30 hover:bg-primary/5"><div className="flex min-w-0 items-center gap-3"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-light font-mono text-xs font-bold text-primary">{index + 1}</span><span className="truncate text-sm font-semibold text-foreground">{product.productName}</span></div><span className="shrink-0 font-mono text-xs font-bold text-muted-foreground">{product.quantity} vendidos</span></div>)}</div>}</SectionShell>
          <SectionShell title="Categorías" icon={BarChart3} tone="accent">{categories.isLoading ? <div aria-busy="true"><LoadingState icon={<BarChart3 className="h-4 w-4 text-primary/50" />} message="Cargando categorías..." /></div> : categories.error ? <ErrorState message={getApiErrorMessage(categories.error, "No se pudieron cargar categorías")} /> : operationalCategories.length === 0 ? <OperationalEmpty label="categorías" /> : <div className="space-y-2">{operationalCategories.map((category) => <div key={category.category} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/40 p-3 transition-all hover:border-primary/30 hover:bg-primary/5"><div className="flex items-center gap-3"><span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-accent" /><span className="truncate text-sm font-medium text-foreground">{category.category}</span></div><span className="shrink-0 font-mono text-xs font-bold text-accent">{category.quantity} <span className="font-sans font-medium text-muted-foreground">unidades</span></span></div>)}</div>}</SectionShell>
          <SectionShell title="Top Clientes" icon={Users} tone="accent">{customers.isLoading ? <div aria-busy="true"><LoadingState icon={<Users className="h-4 w-4 text-primary/50" />} message="Cargando clientes..." /></div> : customers.error ? <ErrorState message={getApiErrorMessage(customers.error, "No se pudieron cargar clientes")} /> : operationalCustomers.length === 0 ? <OperationalEmpty label="clientes" /> : <Table variant="primary"><TableHeader><TableRow><TableCell as="th">Cliente</TableCell><TableCell as="th" className="text-right">Compras</TableCell><TableCell as="th" className="text-right">Total</TableCell></TableRow></TableHeader><tbody>{operationalCustomers.map((customer) => <TableRow key={customer.customerId}><TableCell><div className="flex items-center gap-2.5"><span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-light font-mono text-[11px] font-bold text-primary">{customer.customerName.charAt(0).toUpperCase()}</span><span className="text-sm font-medium text-foreground">{customer.customerName}</span></div></TableCell><TableCell className="text-right font-mono text-xs text-muted-foreground">{customer.totalSales}</TableCell><TableCell className="text-right font-mono text-sm font-bold text-foreground">{formatCurrency(customer.totalRevenue)}</TableCell></TableRow>)}</tbody></Table>}</SectionShell>
          <SectionShell title="Métodos de Pago" icon={Receipt}>{paymentMethods.isLoading ? <div aria-busy="true"><LoadingState icon={<Receipt className="h-4 w-4 text-primary/50" />} message="Cargando pagos..." /></div> : paymentMethods.error ? <ErrorState message={getApiErrorMessage(paymentMethods.error, "No se pudieron cargar pagos")} /> : operationalPaymentMethods.length === 0 ? <OperationalEmpty label="métodos de pago" /> : <div className="space-y-2">{operationalPaymentMethods.map((method) => <div key={method.paymentMethod} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/40 p-3 transition-all hover:border-primary/30 hover:bg-primary/5"><div className="flex items-center gap-3"><span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-primary" /><span className="text-sm font-medium text-foreground">{method.paymentMethod}</span></div><span className="font-mono text-sm font-bold text-primary">{formatCurrency(method.total)}</span></div>)}</div>}</SectionShell>
        </div></div>

        <SectionShell title="Exportación económica" icon={Download}><div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-sm text-muted-foreground">Descarga un único paquete con economía, caja e inventario actual para el período seleccionado.</p><Button variant="ghost" onClick={() => setShowExportSection((current) => !current)} className="w-full sm:w-auto shrink-0"><Download className="h-4 w-4" aria-hidden="true" /> {showExportSection ? "Ocultar exportación" : "Exportar economía"}</Button></div>{showExportSection && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-4"><div className="flex-1 text-xs text-muted-foreground">Genera el paquete económico del período <span className="font-mono font-bold text-foreground">({startDate} → {endDate})</span>.</div><Button onClick={handleEconomicExport} loading={showExporting}><Download className="h-4 w-4" aria-hidden="true" /> Exportar economía</Button></div>}</SectionShell>
      </div>
    </DashboardLayout>
  );
}
