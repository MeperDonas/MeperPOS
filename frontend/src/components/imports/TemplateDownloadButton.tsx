"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface TemplateDownloadButtonProps {
  onDownload: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function TemplateDownloadButton({
  onDownload,
  loading = false,
  disabled = false,
}: TemplateDownloadButtonProps) {
  return (
    <Button
      variant="secondary"
      onClick={onDownload}
      loading={loading}
      disabled={disabled}
    >
      <Download className="w-4 h-4" /> Plantilla
    </Button>
  );
}
