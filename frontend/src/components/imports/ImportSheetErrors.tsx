"use client";

import { useState } from "react";
import { Pencil, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { fieldLabel, sheetLabel } from "./labels";
import type { ImportSheetId, ImportSheetRowError } from "@/types";

type EditableValues = Record<string, string>;

function toStringValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function mapErrorVariant(errorCode: string) {
  if (errorCode.startsWith("DUPLICATE")) {
    return "danger" as const;
  }

  if (errorCode.startsWith("INVALID")) {
    return "warning" as const;
  }

  return "secondary" as const;
}

function groupBySheet(errors: ImportSheetRowError[]): ImportSheetId[] {
  const order: ImportSheetId[] = [];
  const seen = new Set<ImportSheetId>();
  errors.forEach((error) => {
    if (!seen.has(error.sheetId)) {
      seen.add(error.sheetId);
      order.push(error.sheetId);
    }
  });
  return order;
}

interface ImportSheetErrorsProps {
  errors: ImportSheetRowError[];
  retryPending?: boolean;
  onRetry: (
    error: ImportSheetRowError,
    correctedData: Record<string, unknown>,
  ) => void;
}

export function ImportSheetErrors({
  errors,
  retryPending = false,
  onRetry,
}: ImportSheetErrorsProps) {
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<EditableValues>({});

  if (errors.length === 0) {
    return null;
  }

  const sheetOrder = groupBySheet(errors);

  const startEditing = (error: ImportSheetRowError) => {
    setEditingRow(error.rowIndex);
    const values: EditableValues = {};
    error.editableFields.forEach((field) => {
      values[field] = toStringValue(error.mappedData?.[field]);
    });
    setEditValues(values);
  };

  const handleRetry = (error: ImportSheetRowError) => {
    const correctedData: Record<string, unknown> = {};
    error.editableFields.forEach((field) => {
      correctedData[field] = editValues[field] ?? "";
    });
    onRetry(error, correctedData);
  };

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 overflow-hidden">
      <div className="px-3 py-2 border-b border-rose-500/20 bg-rose-500/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">
          Errores por hoja
        </p>
      </div>

      <div className="divide-y divide-rose-500/10">
        {sheetOrder.map((sheetId) => (
          <div key={sheetId} className="p-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {sheetLabel(sheetId)}
            </p>

            {errors
              .filter((error) => error.sheetId === sheetId)
              .map((error) => (
                <div
                  key={`${error.sheetId}-${error.rowIndex}-${error.errorCode}`}
                  data-testid={`import-error-row-${error.rowIndex}`}
                  className="rounded-xl border border-rose-500/20 bg-background/40 p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={mapErrorVariant(error.errorCode)}>
                        {error.errorCode}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Fila {error.rowIndex}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => startEditing(error)}
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </Button>
                  </div>

                  <p className="text-sm text-foreground">{error.message}</p>

                  {editingRow === error.rowIndex && (
                    <div className="rounded-xl border border-accent/20 bg-background/40 p-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {error.editableFields.map((field) => (
                          <Input
                            key={field}
                            label={fieldLabel(field)}
                            value={editValues[field] ?? ""}
                            onChange={(event) =>
                              setEditValues((previous) => ({
                                ...previous,
                                [field]: event.target.value,
                              }))
                            }
                          />
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          loading={retryPending}
                          disabled={retryPending}
                          onClick={() => handleRetry(error)}
                        >
                          <RefreshCcw className="w-3.5 h-3.5" /> Reintentar fila
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingRow(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
