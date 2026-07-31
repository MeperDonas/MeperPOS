"use client";

import { useState, useRef } from "react";
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
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  onUpload,
  disabled = false,
}: ImageUploadProps) {
  const toast = useToast();
  const [preview, setPreview] = useState<string | null>(value || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo es demasiado grande. Tamaño maximo: 5MB.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen valido.");
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

      {preview ? (
        <div className="relative group">
          <div className="relative aspect-square w-full rounded-lg overflow-hidden border-2 border-border bg-muted">
            <Image
              src={preview}
              alt="Preview"
              fill
              sizes="(max-width: 768px) 100vw, 320px"
              unoptimized={preview.startsWith("data:")}
              className="object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={handleRemove}
              disabled={disabled}
            >
              <X className="w-4 h-4 mr-1" />
              Eliminar
            </Button>
            {!onUpload && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleClick}
                disabled={disabled}
              >
                <Upload className="w-4 h-4 mr-1" />
                Cambiar
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={handleClick}
          className={cn(
            "aspect-square w-full rounded-lg border-2 border-dashed border-border bg-muted/50",
            "flex flex-col items-center justify-center cursor-pointer",
            "hover:border-primary/50 hover:bg-muted/80 transition-colors",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {isUploading ? (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          ) : (
            <>
              <ImageIcon className="w-12 h-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground text-center px-4">
                Haz clic para subir una imagen
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, GIF, WEBP (Máx 5MB)
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
