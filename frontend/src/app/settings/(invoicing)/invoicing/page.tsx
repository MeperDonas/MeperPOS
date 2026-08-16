"use client";

import { useEffect, useState } from "react";
import {
  useSettings,
  useUpdateSettings,
  useUpdateReceiptPrefix,
} from "@/hooks/useSettings";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { SettingsCard } from "../../_components/SettingsCard";
import { useToast } from "@/contexts/ToastContext";
import { getApiErrorMessage } from "@/lib/api";
import { Receipt, Hash } from "lucide-react";

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
  );
}
