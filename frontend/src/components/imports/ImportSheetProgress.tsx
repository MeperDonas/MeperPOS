"use client";

import { Badge } from "@/components/ui/Badge";
import { sheetLabel } from "./labels";
import type {
  ImportSheetStatus,
  ImportSheetSubStatus,
} from "@/types";

const statusVariant: Record<
  ImportSheetSubStatus,
  "secondary" | "warning" | "success" | "danger"
> = {
  PENDING: "secondary",
  PROCESSING: "warning",
  COMPLETED: "success",
  REJECTED: "danger",
  FAILED: "danger",
};

interface ImportSheetProgressProps {
  sheets: ImportSheetStatus[];
  isLoading?: boolean;
}

export function ImportSheetProgress({
  sheets,
  isLoading = false,
}: ImportSheetProgressProps) {
  if (isLoading && sheets.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Cargando estado de la importacion...
      </p>
    );
  }

  if (sheets.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Ninguna hoja reconocida en el archivo.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sheets.map((sheet) => {
        const percent =
          sheet.totalRows > 0
            ? Math.round((sheet.processedRows / sheet.totalRows) * 100)
            : 0;

        return (
          <div
            key={sheet.sheetId}
            className="rounded-2xl border border-accent/20 bg-background/40 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">
                {sheetLabel(sheet.sheetId)}
              </span>
              <Badge variant={statusVariant[sheet.status]}>{sheet.status}</Badge>
            </div>

            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>
                  {sheet.processedRows} / {sheet.totalRows} filas
                </span>
                <span className="font-semibold">{percent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-accent/10 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-accent to-accent/60 transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Badge variant="secondary" className="justify-center">
                Importados: {sheet.imported}
              </Badge>
              <Badge variant="warning" className="justify-center">
                Omitidos: {sheet.skipped}
              </Badge>
              <Badge variant="danger" className="justify-center">
                Errores: {sheet.errors}
              </Badge>
              <Badge variant="primary" className="justify-center">
                Avisos: {sheet.warnings}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
