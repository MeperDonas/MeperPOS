"use client";

import { useSettings } from "@/hooks/useSettings";
import { LoadingState } from "@/components/ui/LoadingState";
import { SettingsCard } from "../../_components/SettingsCard";
import { Globe2 } from "lucide-react";

export default function LocaleSettingsPage() {
  const { data: settings, isLoading } = useSettings();

  if (isLoading || !settings) {
    return (
      <LoadingState
        icon={<Globe2 className="w-5 h-5 text-primary/50" />}
        message="Cargando configuración..."
      />
    );
  }

  const items = [
    { label: "Moneda", value: settings.locale.currency },
    { label: "Región (locale)", value: settings.locale.locale },
    { label: "Zona horaria", value: settings.locale.timezone },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded-full bg-primary shrink-0" />
        <h2 className="text-xl font-bold text-foreground">Moneda y Región</h2>
      </div>

      <SettingsCard
        title="Moneda y formato regional"
        description="Valores fijos de la plataforma (solo lectura)"
        icon={<Globe2 className="w-4 h-4 text-primary" />}
      >
        <dl className="space-y-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
              <dd className="text-sm font-mono font-medium text-foreground">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </SettingsCard>
    </div>
  );
}
