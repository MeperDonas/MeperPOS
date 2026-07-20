"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  Settings as SettingsIcon,
  Building2,
  FileText,
  Trash2,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";

export default function SettingsPage() {
  const toast = useToast();
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [formData, setFormData] = useState({
    companyName: "",
    currency: "COP",
    taxRate: 19,
    receiptPrefix: "REC-",
    printHeader: "",
    printFooter: "",
    logoUrl: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings.mutateAsync(formData);
      toast.success("Configuración guardada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al guardar la configuración"));
    }
  };

  const handleLogoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoFile) return;
    const formDataUpload = new FormData();
    formDataUpload.append("file", logoFile);
    try {
      const response = await api.postWithFormData<{ logoUrl: string }>("/settings/logo", formDataUpload);
      setFormData({ ...formData, logoUrl: response.data.logoUrl });
      setLogoFile(null);
      setLogoPreview(null);
      toast.success("Logo subido correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al subir el logo"));
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); }
  };

  const handleRemoveLogo = async () => {
    try {
      await updateSettings.mutateAsync({ ...formData, logoUrl: "" });
      setLogoPreview(null);
      toast.success("Logo eliminado correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al eliminar el logo"));
    }
  };

  useEffect(() => {
    if (settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        companyName: settings.companyName,
        currency: settings.currency,
        taxRate: Number(settings.taxRate),
        receiptPrefix: settings.receiptPrefix,
        printHeader: settings.printHeader || "",
        printFooter: settings.printFooter || "",
        logoUrl: settings.logoUrl || "",
      });
      if (settings.logoUrl) setLogoPreview(settings.logoUrl);
    }
  }, [settings]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState icon={<SettingsIcon className="w-5 h-5 text-primary/50" />} message="Cargando configuración..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5 lg:space-y-7 max-w-3xl">

        {/* Page Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-7 rounded-full bg-primary shrink-0" />
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Configuración</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-4">Ajusta la configuración del sistema</p>
        </div>

        {/* General Settings */}
        <div className="rounded-3xl border border-primary/30 bg-primary/10 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-primary/20">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <SettingsIcon className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Configuración General</h3>
          </div>
          <div className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Nombre de la Empresa" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} required className="sm:col-span-2" />
                <Input label="Moneda" value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} required />
                <Input label="Tasa de Impuesto (%)" type="number" step="0.01" value={formData.taxRate} onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })} required />
                <Input label="Prefijo de Comprobante" value={formData.receiptPrefix} onChange={(e) => setFormData({ ...formData, receiptPrefix: e.target.value })} required className="sm:col-span-2" />
              </div>

              {/* Logo Section */}
              <div className="pt-4 border-t border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">Logo del Negocio</h4>
                </div>
                <div className="space-y-3">
                  {(logoPreview || formData.logoUrl) && (
                    <div className="flex items-center gap-4">
                      <div className="relative w-16 h-16 bg-background/60 rounded-2xl border border-primary/30 flex items-center justify-center overflow-hidden">
                        <Image src={logoPreview || formData.logoUrl} alt="Logo" fill sizes="64px" className="object-contain" />
                      </div>
                      <Button type="button" variant="danger" size="sm" onClick={handleRemoveLogo}>
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar Logo
                      </Button>
                    </div>
                  )}
                  <div>
                    <input type="file" id="logo" accept="image/*" onChange={handleLogoChange} className="hidden" />
                    <Button type="button" variant="secondary" size="sm" onClick={() => (document.getElementById("logo") as HTMLInputElement)?.click()}>
                      <Upload className="w-3.5 h-3.5" />
                      {logoFile ? logoFile.name : "Seleccionar Logo"}
                    </Button>
                  </div>
                  {logoFile && (
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={handleLogoUpload}><Upload className="w-3.5 h-3.5" /> Subir Logo</Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => { setLogoFile(null); setLogoPreview(formData.logoUrl); }}>Cancelar</Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Print Settings */}
              <div className="pt-4 border-t border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-primary" />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">Configuración de Impresión</h4>
                </div>
                <div className="space-y-4">
                  <Input label="Encabezado de Impresión" value={formData.printHeader} onChange={(e) => setFormData({ ...formData, printHeader: e.target.value })} textarea rows={3} placeholder="Información que aparecerá en el encabezado de los recibos" />
                  <Input label="Pie de Página de Impresión" value={formData.printFooter} onChange={(e) => setFormData({ ...formData, printFooter: e.target.value })} textarea rows={3} placeholder="Información que aparecerá al pie de los recibos" />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-primary/20">
                <Button type="submit" loading={updateSettings.isPending}>Guardar Configuración</Button>
              </div>
            </form>
          </div>
        </div>

        {/* Preview Card */}
        <div className="rounded-3xl border border-accent/30 bg-accent/10 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-accent/20">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Vista Previa del Recibo</h3>
          </div>
          <div className="p-5">
            <div className="bg-background/40 rounded-2xl p-5 border border-accent/20 space-y-3 max-w-xs mx-auto font-mono">
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">{formData.companyName || "Nombre empresa"}</p>
                {formData.printHeader && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{formData.printHeader}</p>}
              </div>
              <div className="border-t border-dashed border-accent/30 pt-3 space-y-1.5">
                {[
                  { k: "Impuesto", v: `${formData.taxRate}%` },
                  { k: "Moneda", v: formData.currency },
                  { k: "Prefijo", v: formData.receiptPrefix },
                ].map(({ k, v }) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{k}:</span>
                    <span className="font-medium text-foreground">{v}</span>
                  </div>
                ))}
              </div>
              {formData.printFooter && (
                <div className="border-t border-dashed border-accent/30 pt-3">
                  <p className="text-xs text-muted-foreground text-center whitespace-pre-line">{formData.printFooter}</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
