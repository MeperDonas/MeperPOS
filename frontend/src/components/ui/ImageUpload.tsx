"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "./Button";
import { useToast } from "@/contexts/ToastContext";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onUpload?: (file: File) => Promise<string>;
  /** Controlled draft mode: selecting only changes the file, never uploads. */
  file?: File | null;
  onFileChange?: (file: File | null) => void;
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  onUpload,
  file,
  onFileChange,
  disabled = false,
}: ImageUploadProps) {
  const toast = useToast();
  const [preview, setPreview] = useState<string | null>(value || null);
  const [draftPreview, setDraftPreview] = useState<{ file: File; url: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!onFileChange || !file) return;
    const url = URL.createObjectURL(file);
    setDraftPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file, onFileChange]);

  const visiblePreview = onFileChange
    ? file ? (draftPreview?.file === file ? draftPreview.url : null) : value || null
    : preview;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clearing the input allows selecting the same file again after removal.
    e.target.value = "";
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo es demasiado grande. Tamaño maximo: 5MB.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen valido.");
      return;
    }

    if (onFileChange) {
      onFileChange(file);
      return;
    }

    setIsUploading(true);

    try {
      if (onUpload) {
        const imageUrl = await onUpload(file);
        setPreview(imageUrl);
        onChange(imageUrl);
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          setPreview(result);
          onChange(result);
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al subir la imagen"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onFileChange?.(null);
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {visiblePreview ? (
        <>
          <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-border bg-muted">
            <Image
              src={visiblePreview}
              alt="Preview"
              fill
              sizes="(max-width: 768px) 240px, 320px"
              unoptimized={visiblePreview.startsWith("data:") || visiblePreview.startsWith("blob:")}
              className="object-cover"
            />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={handleClick} disabled={disabled} className="min-h-10">
              <Upload className="w-4 h-4" /> Cambiar
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={handleRemove} disabled={disabled} className="min-h-10">
              <X className="w-4 h-4" /> Eliminar
            </Button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className={cn(
            "aspect-square w-full rounded-xl border-2 border-dashed border-border bg-muted/50",
            "flex flex-col items-center justify-center cursor-pointer text-center px-3",
            "hover:border-primary/50 hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-primary transition-colors",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {isUploading ? (
            <span className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          ) : (
            <>
              <ImageIcon className="w-16 h-16 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Seleccionar imagen</span>
              <span className="text-xs text-muted-foreground mt-1 leading-relaxed">JPG, PNG, GIF o WEBP · Máx. 5 MB</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
