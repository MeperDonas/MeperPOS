"use client";

import { useEffect } from "react";
import Image from "next/image";
import {
  X,
  ShoppingCart,
  Trash2,
  Package,
  Percent,
  Pause,
  Play,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { PaymentMethodCards } from "@/components/pos/PaymentMethodCards";
import { cn, formatCurrency } from "@/lib/utils";
import type { CartItem } from "@/types";

function cartItemOffer(item: CartItem) {
  const price = item.product?.effectiveSalePrice;
  const listPrice = Number(item.product?.salePrice);
  if (typeof price !== "number" || !Number.isFinite(listPrice)) return null;
  if (price <= 0 || price >= listPrice) return null;
  const percent = Math.max(0, Math.round(100 - (price / listPrice) * 100));
  return percent > 0 ? { percent } : null;
}

export interface MobileCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  selectedCustomerName?: string | null;
  onOpenCustomerModal: () => void;
  pausedSalesCount: number;
  onOpenPausedSales: () => void;
  onPauseSale: () => void;
  selectedPaymentMethod: "CASH" | "CARD" | "TRANSFER";
  onPaymentMethodChange: (method: "CASH" | "CARD" | "TRANSFER") => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onOpenDiscountModal: (productId: string) => void;
  onRemoveFromCart: (productId: string) => void;
  onCheckout: () => void;
  isPending?: boolean;
}

export function MobileCartDrawer({
  isOpen,
  onClose,
  cart,
  subtotal,
  taxAmount,
  discountAmount,
  total,
  selectedCustomerName,
  onOpenCustomerModal,
  pausedSalesCount,
  onOpenPausedSales,
  onPauseSale,
  selectedPaymentMethod,
  onPaymentMethodChange,
  onUpdateQuantity,
  onOpenDiscountModal,
  onRemoveFromCart,
  onCheckout,
  isPending = false,
}: MobileCartDrawerProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-up Sheet Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
        className="relative z-10 flex h-[92dvh] max-h-[92dvh] w-full flex-col rounded-t-3xl border-t border-accent/40 bg-card shadow-2xl overflow-hidden animate-slide-in-bottom"
      >
        {/* Pull handle & Header (Pinned Top) */}
        <div className="flex flex-col border-b border-border/80 bg-muted/20 px-5 pt-3 pb-3 shrink-0">
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-muted-foreground/30" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white shadow-xs">
                <ShoppingCart className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground leading-tight">
                  Carrito de Compras
                </h2>
                <p className="text-xs text-muted-foreground">
                  {cart.length === 1 ? "1 producto agregado" : `${cart.length} productos agregados`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Cerrar carrito"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Unified Scrollable Body: Cart Items + Customer + Totals + Payment Methods */}
        <div className="scrollbar-app flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {/* Cart Items Section */}
          <div className="space-y-2.5">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ShoppingCart className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-semibold text-foreground">Carrito vacío</p>
                <p className="text-xs text-muted-foreground">Agrega productos para comenzar</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-start gap-2.5 rounded-2xl border border-accent/20 bg-background/50 p-3 shadow-2xs"
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-primary/10 flex items-center justify-center">
                    {item.product.imageUrl ? (
                      <Image
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <Package className="h-5 w-5 text-primary/60" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground line-clamp-1 mb-1">
                      {item.product.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground mb-1.5">
                      {cartItemOffer(item) && (
                        <Badge
                          variant="danger"
                          className="shrink-0 text-[9px] px-1.5 py-0 font-mono uppercase"
                        >
                          Oferta -{cartItemOffer(item)!.percent}%
                        </Badge>
                      )}
                      {Number.isFinite(Number(item.originalUnitPrice)) &&
                        Number(item.unitPrice) !== Number(item.originalUnitPrice) && (
                          <s className="text-muted-foreground/60 line-through">
                            {formatCurrency(Number(item.originalUnitPrice))}
                          </s>
                        )}
                      <span className="font-medium text-foreground">
                        {formatCurrency(item.unitPrice)}
                      </span>{" "}
                      × {item.quantity}
                      {item.discountAmount > 0 && (
                        <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                          (-{formatCurrency(item.discountAmount)})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Stepper
                        value={item.quantity}
                        min={0}
                        max={item.availableStock}
                        size="sm"
                        onChange={(value) => onUpdateQuantity(item.productId, value)}
                      />
                      {item.quantity >= item.availableStock && (
                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          máx.
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenDiscountModal(item.productId)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent/30 bg-background/80 text-muted-foreground hover:text-primary transition-colors"
                        title="Descuento"
                      >
                        <Percent className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between gap-3 shrink-0">
                    <span className="stat-number text-sm font-bold text-foreground">
                      {formatCurrency(
                        item.quantity * item.unitPrice - item.discountAmount,
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveFromCart(item.productId)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      aria-label={`Eliminar ${item.product.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Customer Selection */}
          <div>
            <button
              type="button"
              onClick={onOpenCustomerModal}
              className="flex items-center gap-2 w-full h-9 px-3 rounded-xl border border-border/80 bg-background/80 text-sm text-foreground hover:border-accent/50 transition-colors overflow-hidden"
            >
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate text-xs font-semibold">
                {selectedCustomerName || "Cliente General (opcional)"}
              </span>
            </button>
          </div>

          {/* Totals Breakdown */}
          <div className="space-y-1 rounded-2xl bg-muted/30 p-3 border border-border/60">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Impuestos</span>
              <span className="font-medium text-foreground">{formatCurrency(taxAmount)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                <span>Descuento</span>
                <span className="font-medium">-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1.5 border-t border-border/40">
              <span className="text-xs font-bold text-foreground">Total a Cobrar</span>
              <span className="stat-number text-lg font-bold text-primary">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Pause / Resume */}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenPausedSales}
              className="flex-1 text-xs h-8"
            >
              <Play className="w-3.5 h-3.5 mr-1" />
              Reanudar ({pausedSalesCount})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onPauseSale}
              disabled={cart.length === 0}
              className="flex-1 text-xs h-8"
            >
              <Pause className="w-3.5 h-3.5 mr-1" />
              Pausar
            </Button>
          </div>

          {/* Payment Method Selector */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Método de Pago
            </p>
            <PaymentMethodCards
              selectedMethod={selectedPaymentMethod}
              onMethodChange={onPaymentMethodChange}
            />
          </div>
        </div>

        {/* Pinned Bottom Checkout Action Bar */}
        <div className="border-t border-border/80 bg-card p-3.5 shrink-0 pb-[calc(0.875rem+env(safe-area-inset-bottom))] shadow-lg">
          <Button
            className="w-full h-11 text-base font-bold shadow-md shadow-primary/20"
            size="lg"
            onClick={onCheckout}
            disabled={cart.length === 0}
            loading={isPending}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Cobrar {formatCurrency(total)}
          </Button>
        </div>
      </div>
    </div>
  );
}
