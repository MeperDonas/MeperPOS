"use client";

import { useEffect, useState } from "react";
import {
  useSettings,
  useUpdateSettings,
  useUpdateReceiptPrefix,
} from "@/hooks/useSettings";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { SettingsCard } from "../../_components/SettingsCard";
import { useToast } from "@/contexts/ToastContext";
import { getApiErrorMessage } from "@/lib/api";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { Hash, Receipt, Store } from "lucide-react";

const sampleItems = [
  { name: "Café especial", quantity: 2, price: 18000 },
  { name: "Pan artesanal", quantity: 1, price: 12000 },
];

function ReceiptPreview({
  organizationName,
  logoUrl,
  printHeader,
  printFooter,
  prefix,
}: {
  organizationName: string;
  logoUrl: string | null;
  printHeader: string;
  printFooter: string;
  prefix: string;
}) {
  const subtotal = sampleItems.reduce(
    (total, item) => total + item.quantity * item.price,
    0,
  );
  const discount = 5000;
  const taxableSubtotal = subtotal - discount;
  const tax = taxableSubtotal * 0.19;
  const total = taxableSubtotal + tax;
  const sampleNumber = `${prefix || "REC-"}000184`;

  return (
    <Card className="overflow-hidden border-primary/20 bg-card">
      <div className="border-b border-border/60 bg-primary/5 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Vista previa
            </p>
            <h2 className="mt-1 text-base font-bold text-foreground">
              Comprobante / recibo de muestra
            </h2>
          </div>
          <Receipt className="mt-0.5 h-5 w-5 shrink-0 text-primary/70" aria-hidden="true" />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Se actualiza en vivo. Es una muestra ilustrativa y no un documento electrónico válido.
        </p>
      </div>

      <div className="bg-muted/20 p-4 sm:p-6">
        <article
          className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-border/70 bg-background px-5 py-6 shadow-sm"
          aria-label="Vista previa del comprobante"
        >
          <header className="text-center">
            <div className="mb-3 flex min-h-14 items-center justify-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`Logo de ${organizationName || "la organización"}`}
                  className="max-h-14 max-w-40 object-contain"
                />
              ) : (
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-primary/35 bg-primary/10 text-primary"
                  aria-label="Sin logo configurado"
                >
                  <Store className="h-6 w-6" aria-hidden="true" />
                </div>
              )}
            </div>
            <h3 className="break-words text-lg font-bold text-foreground">
              {organizationName || "Nombre de la organización"}
            </h3>
            {printHeader ? (
              <p className="mt-2 whitespace-pre-line break-words text-xs leading-relaxed text-muted-foreground">
                {printHeader}
              </p>
            ) : (
              <p className="mt-2 text-xs italic text-muted-foreground/70">Encabezado de impresión</p>
            )}
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Comprobante #{sampleNumber}</p>
              <p>{formatDateTime(new Date())}</p>
            </div>
          </header>

          <div className="my-5 border-t border-dashed border-border" />

          <section aria-label="Productos de muestra" className="space-y-3">
            {sampleItems.map((item) => (
              <div key={item.name} className="text-xs">
                <div className="flex items-start justify-between gap-3 font-medium text-foreground">
                  <span className="min-w-0 break-words">{item.name}</span>
                  <span className="shrink-0">{formatCurrency(item.quantity * item.price)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {item.quantity} x {formatCurrency(item.price)}
                </p>
              </div>
            ))}
          </section>

          <div className="my-5 border-t border-dashed border-border" />

          <section aria-label="Totales de muestra" className="space-y-2 text-xs">
            <div className="flex justify-between gap-3 text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between gap-3 text-muted-foreground">
              <span>Descuento</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
            <div className="flex justify-between gap-3 text-muted-foreground">
              <span>Impuestos (19%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="mt-3 flex justify-between gap-3 border-t border-border pt-3 text-sm font-bold text-primary">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </section>

          <footer className="mt-6 border-t border-border pt-4 text-center">
            {printFooter ? (
              <p className="whitespace-pre-line break-words text-xs leading-relaxed text-muted-foreground">
                {printFooter}
              </p>
            ) : (
              <p className="text-xs italic text-muted-foreground/70">Pie de página de impresión</p>
            )}
          </footer>
        </article>
      </div>
    </Card>
  );
}

export default function InvoicingSettingsPage() {
  const toast = useToast();
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const updateReceiptPrefix = useUpdateReceiptPrefix();

  const [printHeader, setPrintHeader] = useState("");
  const [printFooter, setPrintFooter] = useState("");
  const [prefix, setPrefix] = useState("");

  useEffect(() => {
    if (settings) {
      setPrintHeader(settings.invoicing.printHeader ?? "");
      setPrintFooter(settings.invoicing.printFooter ?? "");
      setPrefix(settings.receipt.prefix ?? "");
    }
  }, [settings]);

  if (isLoading || !settings) {
    return (
      <LoadingState
        icon={<Receipt className="w-5 h-5 text-primary/50" />}
        message="Cargando configuración..."
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings.mutateAsync({ printHeader, printFooter });
      toast.success("Configuración guardada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al guardar la configuración"));
    }
  };

  const handlePrefixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateReceiptPrefix.mutateAsync(prefix);
      toast.success("Prefijo guardado correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al guardar el prefijo"));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded-full bg-primary shrink-0" />
        <h2 className="text-xl font-bold text-foreground">
          Facturación y Recibos
        </h2>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <div className="space-y-5">
          <SettingsCard
            title="Impresión de comprobantes"
            description="Encabezado y pie que aparecen en los recibos"
            icon={<Receipt className="w-4 h-4 text-primary" />}
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Encabezado de Impresión"
                textarea
                rows={3}
                value={printHeader}
                onChange={(e) => setPrintHeader(e.target.value)}
                placeholder="Información que aparecerá en el encabezado de los recibos"
              />
              <Input
                label="Pie de Página de Impresión"
                textarea
                rows={3}
                value={printFooter}
                onChange={(e) => setPrintFooter(e.target.value)}
                placeholder="Información que aparecerá al pie de los recibos"
              />

              <div className="flex justify-end pt-2">
                <Button type="submit" loading={updateSettings.isPending}>
                  Guardar
                </Button>
              </div>
            </form>
          </SettingsCard>

          <SettingsCard
            title="Prefijo de comprobante"
            description="Prefijo que antecede al número de cada recibo"
            icon={<Hash className="w-4 h-4 text-primary" />}
          >
            <form onSubmit={handlePrefixSubmit} className="space-y-4">
              <Input
                label="Prefijo de comprobante"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="Ej. REC-"
              />

              <div className="flex justify-end pt-2">
                <Button type="submit" loading={updateReceiptPrefix.isPending}>
                  Guardar prefijo
                </Button>
              </div>
            </form>
          </SettingsCard>
        </div>

        <div className={cn("lg:sticky lg:top-5")}>
          <ReceiptPreview
            organizationName={settings.organization.name}
            logoUrl={settings.organization.logoUrl}
            printHeader={printHeader}
            printFooter={printFooter}
            prefix={prefix}
          />
        </div>
      </div>
    </div>
  );
}
