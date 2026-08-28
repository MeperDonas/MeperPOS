"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ImportUpload } from "@/components/imports/ImportUpload";
import { TemplateDownloadButton } from "@/components/imports/TemplateDownloadButton";
import { ImportSheetProgress } from "@/components/imports/ImportSheetProgress";
import { ImportSheetErrors } from "@/components/imports/ImportSheetErrors";
import { useImport } from "@/hooks/useImport";
import { useToast } from "@/contexts/ToastContext";
import { getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CheckCircle2, FileSpreadsheet, RefreshCcw, Upload } from "lucide-react";
import type { ImportSheetRowError } from "@/types";

export default function ImportsPage() {
  const toast = useToast();
  const {
    startImport,
    statusQuery,
    startData,
    retryRow,
    downloadTemplate,
    reset,
  } = useImport({ mode: "full" });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const status = statusQuery.data;
  const hasStarted = !!startData;
  const isProcessing = status?.status === "PARSING" || status?.status === "PROCESSING";
  const isFinished = status?.status === "COMPLETED" || status?.status === "FAILED";

  const onFileSelected = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Formato no soportado. Usa un archivo .xlsx");
      return;
    }

    setSelectedFile(file);
  };

  const handleStartImport = async () => {
    if (!selectedFile) {
      toast.error("Selecciona un archivo para iniciar la importacion");
      return;
    }

    try {
      await startImport.mutateAsync(selectedFile);
      toast.success("Importacion iniciada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo iniciar la importacion"));
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadTemplate.mutateAsync();
      toast.success("Plantilla descargada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo descargar la plantilla"));
    }
  };

  const handleRetryRow = async (
    error: ImportSheetRowError,
    correctedData: Record<string, unknown>,
  ) => {
    try {
      await retryRow.mutateAsync({
        rowIndex: error.rowIndex,
        sheetId: error.sheetId,
        correctedData,
      });
      toast.success("Fila reintentada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo reintentar la fila"));
    }
  };

  const handleReset = () => {
    reset();
    setSelectedFile(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 lg:space-y-5">
        {/* Page Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-7 rounded-full bg-primary shrink-0" />
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
              Importar Inventario
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-4">
            Importa productos, clientes, proveedores y usuarios desde un archivo
            multi-hoja (.xlsx)
          </p>
        </div>

        <div className="rounded-3xl border border-accent/30 bg-accent/10 overflow-hidden transition-all duration-300">
          <div className="px-5 py-4 border-b border-accent/20 flex items-center gap-2">
            <div className="p-1.5 bg-accent/20 rounded-lg">
              <Upload className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Importación Multi-Hoja
            </h3>
          </div>

          <div className="p-5 space-y-4">
            {!hasStarted && (
              <>
                <ImportUpload
                  selectedFile={selectedFile}
                  onFileSelected={onFileSelected}
                  onClear={() => setSelectedFile(null)}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={handleStartImport}
                    disabled={!selectedFile}
                    loading={startImport.isPending}
                  >
                    Iniciar importacion
                  </Button>
                  <TemplateDownloadButton
                    onDownload={handleDownloadTemplate}
                    loading={downloadTemplate.isPending}
                  />
                </div>
              </>
            )}

            {hasStarted && (
              <>
                <div className="rounded-2xl border border-accent/20 bg-background/40 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                        Archivo
                      </p>
                      <p className="text-sm font-medium text-foreground truncate">
                        {status?.fileName ?? selectedFile?.name ?? "Importacion en curso"}
                      </p>
                    </div>

                    <Badge variant={isProcessing ? "warning" : isFinished ? "success" : "primary"}>
                      {status?.status ?? "PARSING"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Badge variant="secondary" className="justify-center">
                      Procesados: {status?.processedRows ?? 0}
                    </Badge>
                    <Badge variant="success" className="justify-center">
                      Importados: {status?.importedCount ?? 0}
                    </Badge>
                    <Badge variant="warning" className="justify-center">
                      Omitidos: {status?.skippedCount ?? 0}
                    </Badge>
                    <Badge variant="danger" className="justify-center">
                      Errores: {status?.errorCount ?? 0}
                    </Badge>
                  </div>
                </div>

                <ImportSheetProgress
                  sheets={status?.sheets ?? []}
                  isLoading={statusQuery.isLoading && hasStarted}
                />

                <ImportSheetErrors
                  errors={status?.errors ?? []}
                  retryPending={retryRow.isPending}
                  onRetry={handleRetryRow}
                />

                {isFinished && (
                  <div className="flex items-center justify-end gap-2">
                    <div className="flex-1" />
                    {status?.status === "COMPLETED" && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        Importacion finalizada
                      </div>
                    )}
                    <TemplateDownloadButton
                      onDownload={handleDownloadTemplate}
                      loading={downloadTemplate.isPending}
                    />
                    <Button variant="primary" onClick={handleReset}>
                      <RefreshCcw className="w-4 h-4" /> Nueva importacion
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <FileSpreadsheet className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            El archivo debe contener las hojas Productos, Clientes, Proveedores y
            Usuarios. Descarga la plantilla para conocer las columnas requeridas.
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}
