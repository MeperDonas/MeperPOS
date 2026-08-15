"use client";

import { useEffect, useState } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { SettingsCard } from "../../_components/SettingsCard";
import { useToast } from "@/contexts/ToastContext";
import { getApiErrorMessage } from "@/lib/api";
import { SlidersHorizontal, Plus, Trash2 } from "lucide-react";

interface CustomEntry {
  key: string;
  value: string;
}

export default function AdvancedSettingsPage() {
  const toast = useToast();
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const [entries, setEntries] = useState<CustomEntry[]>([]);

  useEffect(() => {
    if (settings) {
      setEntries(
        Object.entries(settings.custom).map(([key, value]) => ({
          key,
          value: typeof value === "string" ? value : JSON.stringify(value),
        }))
      );
    }
  }, [settings]);

  if (isLoading || !settings) {
    return (
      <LoadingState
        icon={<SlidersHorizontal className="w-5 h-5 text-primary/50" />}
        message="Cargando configuración..."
      />
    );
  }

  const updateEntry = (index: number, patch: Partial<CustomEntry>) =>
    setEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );

  const removeEntry = (index: number) =>
    setEntries((prev) => prev.filter((_, i) => i !== index));

  const addEntry = () => setEntries((prev) => [...prev, { key: "", value: "" }]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const custom: Record<string, unknown> = {};
    for (const entry of entries) {
      const key = entry.key.trim();
      if (key) custom[key] = entry.value;
    }
    try {
      await updateSettings.mutateAsync({ custom });
      toast.success("Configuración guardada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al guardar la configuración"));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded-full bg-primary shrink-0" />
        <h2 className="text-xl font-bold text-foreground">Avanzado</h2>
      </div>

      <SettingsCard
        title="Claves personalizadas"
        description="Parámetros libres clave/valor preservados por el sistema"
        icon={<SlidersHorizontal className="w-4 h-4 text-primary" />}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay claves personalizadas.
            </p>
          ) : (
            entries.map((entry, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end"
              >
                <Input
                  label="Clave"
                  value={entry.key}
                  onChange={(e) => updateEntry(index, { key: e.target.value })}
                />
                <Input
                  label="Valor"
                  value={entry.value}
                  onChange={(e) => updateEntry(index, { value: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEntry(index)}
                  aria-label="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}

          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={addEntry}>
              <Plus className="w-3.5 h-3.5" /> Agregar
            </Button>
            <Button type="submit" loading={updateSettings.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </SettingsCard>
    </div>
  );
}
