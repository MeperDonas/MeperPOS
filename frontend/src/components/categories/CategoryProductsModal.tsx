"use client";

import Image from "next/image";
import { useProducts } from "@/hooks/useProducts";
import { Modal } from "@/components/ui/Modal";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatCurrency } from "@/lib/utils";
import { Package, PackageX } from "lucide-react";
import type { Category, Product } from "@/types";

interface CategoryProductsModalProps {
  category: Category | null;
  onClose: () => void;
}

function StockBadge({ product }: { product: Product }) {
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= product.minStock;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border shrink-0",
        isOutOfStock
          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
          : isLowStock
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      )}
    >
      {product.stock} uds.
    </span>
  );
}

function ProductRow({ product }: { product: Product }) {
  const isInactive = product.active === false;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/50 bg-card p-2.5 transition-colors hover:border-primary/30",
        isInactive && "opacity-60",
      )}
    >
      {/* Thumbnail */}
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-muted/20">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-5 w-5 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-[13px] font-semibold text-foreground">
          {product.name}
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-medium text-muted-foreground">
            {product.sku}
          </span>
          {isInactive && (
            <span className="font-mono text-[10px] font-semibold text-muted-foreground">
              · Inactivo
            </span>
          )}
        </div>
      </div>

      {/* Price + stock */}
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="font-mono text-[13px] font-bold text-foreground">
          {formatCurrency(product.salePrice)}
        </span>
        <StockBadge product={product} />
      </div>
    </li>
  );
}

export function CategoryProductsModal({
  category,
  onClose,
}: CategoryProductsModalProps) {
  const { data, isLoading, isError } = useProducts({
    categoryId: category?.id,
    limit: 200,
    status: "all",
    enabled: !!category?.id,
  });

  const products = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  return (
    <Modal
      isOpen={!!category}
      onClose={onClose}
      title={category ? `Productos · ${category.name}` : ""}
      size="md"
    >
      {isLoading ? (
        <LoadingState
          icon={<Package className="w-4 h-4 text-primary/50" />}
          message="Cargando productos..."
        />
      ) : isError ? (
        <EmptyState
          icon={<PackageX className="w-6 h-6 text-muted-foreground/30" />}
          title="No se pudieron cargar los productos"
          subtitle="Intenta de nuevo más tarde"
        />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<PackageX className="w-6 h-6 text-muted-foreground/30" />}
          title="No hay productos en esta categoría"
          subtitle={total === 0 ? "Aún no se han asignado productos" : undefined}
        />
      ) : (
        <>
          {/* Count header */}
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              {total} {total === 1 ? "producto" : "productos"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Desplázate para ver todos
            </span>
          </div>

          {/* Scrollable list */}
          <ul className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto scrollbar-app pr-1">
            {products.map((product) => (
              <ProductRow key={product.id} product={product} />
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
