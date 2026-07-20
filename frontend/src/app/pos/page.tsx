"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Image from "next/image";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useProducts, useQuickSearchProduct } from "@/hooks/useProducts";
import { useCustomers } from "@/hooks/useCustomers";
import { useCreateSale } from "@/hooks/useSales";
import { usePausedSales } from "@/hooks/usePausedSales";
import { printReceipt, printThermalReceipt } from "@/hooks/useReceipt";
import { useSettings } from "@/hooks/useSettings";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { PaymentConfirmationModal } from "@/components/pos/PaymentConfirmationModal";
import { PaymentMethodCards } from "@/components/pos/PaymentMethodCards";
import { ProductCard } from "@/components/products/ProductCard";
import {
  Search,
  Star,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Printer,
  FileDown,
  Package,
  Percent,
  Pause,
  Play,
  User,
} from "lucide-react";
import { cn, formatCurrency, safeGetItem, safeSetItem } from "@/lib/utils";
import type { CartItem, Product, Sale } from "@/types";
import { useToast } from "@/contexts/ToastContext";
import { getApiErrorMessage } from "@/lib/api";

const POS_PAGE_SIZE = 20;

interface PaymentMethod {
  type: "CASH" | "CARD" | "TRANSFER";
  amount: number;
}

interface ScanFeedback {
  tone: "idle" | "success" | "warning" | "error";
  message: string;
}

const FAVORITE_PRODUCTS_KEY = "pos_favorite_product_ids";
const DEFAULT_SCAN_FEEDBACK: ScanFeedback = { tone: "idle", message: "" };

export default function POSPage() {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = safeGetItem(FAVORITE_PRODUCTS_KEY);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "CASH" | "CARD" | "TRANSFER"
  >("CASH");
  const [amountPaid, setAmountPaid] = useState<number | undefined>(undefined);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [editingDiscount, setEditingDiscount] = useState<string | null>(null);
  const [customDiscount, setCustomDiscount] = useState("");
  const [showPausedSalesModal, setShowPausedSalesModal] = useState(false);
  const [pausedSaleToDelete, setPausedSaleToDelete] = useState<string | null>(
    null,
  );
  const [showDeletePausedModal, setShowDeletePausedModal] = useState(false);
  const [scannerCode, setScannerCode] = useState("");
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback>(
    DEFAULT_SCAN_FEEDBACK,
  );

  // Debounce search input: 400ms delay, reset to page 1 on new search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value.trim());
      setCurrentPage(1);
    }, 400);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const {
    data: productsData,
    isLoading: searching,
    isFetching,
  } = useProducts({
    page: currentPage,
    limit: POS_PAGE_SIZE,
    search: debouncedSearch || undefined,
  });
  const { data: customersData } = useCustomers();
  const { data: settings } = useSettings();
  const { pausedSales, pauseSale, resumeSale, deletePausedSale } =
    usePausedSales();
  const createSale = useCreateSale();
  const quickSearchProduct = useQuickSearchProduct();

  const customers = customersData?.data || [];
  const totalPages = Math.max(productsData?.meta?.totalPages ?? 1, 1);
  const totalProducts = productsData?.meta?.total ?? 0;
  const products = useMemo(
    () => productsData?.data ?? [],
    [productsData?.data],
  );
  const visibleCurrentPage = useMemo(
    () => Math.max(1, Math.min(currentPage, totalPages)),
    [currentPage, totalPages],
  );

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages],
  );

  const isScannerBlocked =
    showCustomerModal ||
    showReceiptModal ||
    showPaymentModal ||
    !!editingDiscount ||
    showPausedSalesModal ||
    showDeletePausedModal;

  const focusScannerInput = useCallback(() => {
    if (typeof window === "undefined") return;
    const scheduleFocus =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback: FrameRequestCallback) => window.setTimeout(callback, 0);

    scheduleFocus(() => {
      scannerInputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    safeSetItem(FAVORITE_PRODUCTS_KEY, JSON.stringify(favoriteProductIds));
  }, [favoriteProductIds]);

  useEffect(() => {
    if (isScannerBlocked) return;
    focusScannerInput();
  }, [isScannerBlocked, focusScannerInput]);

  // Filter out-of-stock products from POS — they simply don't appear
  const inStockProducts = useMemo(
    () => products.filter((p) => p.stock > 0),
    [products],
  );

  const visibleProducts = useMemo(() => {
    if (!showFavoritesOnly) return inStockProducts;
    return inStockProducts.filter((product) =>
      favoriteProductIds.includes(product.id),
    );
  }, [inStockProducts, showFavoritesOnly, favoriteProductIds]);

  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    if (product.stock <= 0) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        // Cap at available stock — silently ignore if already at max
        if (existing.quantity >= product.stock) return prev;
        const newQty = Math.min(existing.quantity + quantity, product.stock);
        const discountAmount = existing.discountPercent
          ? Math.min(
              (existing.unitPrice * newQty * existing.discountPercent) / 100,
              existing.unitPrice * newQty,
            )
          : Math.min(existing.discountAmount, existing.unitPrice * newQty);
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: newQty, discountAmount }
            : item,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          product,
          quantity: Math.min(quantity, product.stock),
          unitPrice: product.salePrice,
          discountAmount: 0,
          availableStock: product.stock,
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(productId);
        return;
      }
      setCart((prev) =>
        prev.map((item) => {
          if (item.productId !== productId) return item;
          // Cap quantity at available stock
          const newQty = Math.min(quantity, item.availableStock);
          // Recalculate discount: if percentage-based, scale with new quantity
          const itemSubtotal = item.unitPrice * newQty;
          const discountAmount = item.discountPercent
            ? Math.min(
                (itemSubtotal * item.discountPercent) / 100,
                itemSubtotal,
              )
            : Math.min(item.discountAmount, itemSubtotal);
          return { ...item, quantity: newQty, discountAmount };
        }),
      );
    },
    [removeFromCart],
  );

  /** Apply a fixed-amount discount (clears any percentage tracking) */
  const updateItemDiscount = useCallback(
    (productId: string, discountAmount: number) => {
      setCart((prev) =>
        prev.map((item) => {
          if (item.productId !== productId) return item;
          const maxDiscount = item.unitPrice * item.quantity;
          return {
            ...item,
            discountAmount: Math.min(Math.max(0, discountAmount), maxDiscount),
            discountPercent: undefined,
          };
        }),
      );
      setEditingDiscount(null);
      setCustomDiscount("");
    },
    [],
  );

  /** Apply a percentage discount that scales with quantity changes */
  const updateItemDiscountPercent = useCallback(
    (productId: string, percent: number) => {
      setCart((prev) =>
        prev.map((item) => {
          if (item.productId !== productId) return item;
          const itemSubtotal = item.unitPrice * item.quantity;
          const computed = Math.min(
            (itemSubtotal * percent) / 100,
            itemSubtotal,
          );
          return {
            ...item,
            discountPercent: percent,
            discountAmount: Math.max(0, computed),
          };
        }),
      );
      setEditingDiscount(null);
      setCustomDiscount("");
    },
    [],
  );

  const handleScanSubmit = useCallback(async () => {
    if (isScannerBlocked) {
      return;
    }

    const normalizedCode = scannerCode.trim();

    if (!normalizedCode) {
      setScanFeedback({
        tone: "warning",
        message: "Escanea o ingresa un código para buscar un producto.",
      });
      focusScannerInput();
      return;
    }

    try {
      const product = await quickSearchProduct.mutateAsync(normalizedCode);

      if (!product) {
        setScanFeedback({
          tone: "error",
          message: "No encontramos un producto con ese código.",
        });
        setScannerCode("");
        return;
      }

      if (product.stock <= 0) {
        setScanFeedback({
          tone: "warning",
          message: `${product.name} no tiene stock disponible.`,
        });
        setScannerCode("");
        return;
      }

      const existingItem = cart.find((item) => item.productId === product.id);
      if (existingItem && existingItem.quantity >= product.stock) {
        setScanFeedback({
          tone: "warning",
          message: `${product.name} ya alcanzó el stock máximo en el carrito.`,
        });
        setScannerCode("");
        return;
      }

      addToCart(product);
      setScanFeedback({
        tone: "success",
        message: `${product.name} agregado al carrito.`,
      });
      setScannerCode("");
    } catch (error) {
      setScanFeedback({
        tone: "error",
        message: getApiErrorMessage(
          error,
          "No se pudo procesar el código escaneado.",
        ),
      });
      setScannerCode("");
    } finally {
      focusScannerInput();
    }
  }, [
    addToCart,
    cart,
    focusScannerInput,
    isScannerBlocked,
    quickSearchProduct,
    scannerCode,
  ]);

  const handleScannerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      void handleScanSubmit();
    },
    [handleScanSubmit],
  );

  const subtotal = cart.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice - item.discountAmount,
    0,
  );
  const taxAmount = cart.reduce(
    (sum, item) =>
      sum +
      (item.quantity * item.unitPrice - item.discountAmount) *
        ((item.product.effectiveTaxRate ?? item.product.taxRate) / 100),
    0,
  );
  const total = subtotal + taxAmount - discountAmount;

  const toggleFavoriteProduct = useCallback((productId: string) => {
    setFavoriteProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }, []);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    const totalPaid = paymentMethods.reduce(
      (sum, method) => sum + method.amount,
      0,
    );
    if (totalPaid < total) {
      toast.error("El monto total pagado debe cubrir el total de la venta");
      return;
    }
    if (paymentMethods.length === 0) {
      toast.error("Debes seleccionar al menos un metodo de pago");
      return;
    }
    try {
      const result = await createSale.mutateAsync({
        customerId: selectedCustomer || undefined,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
        })),
        discountAmount,
        payments: paymentMethods.map((method) => ({
          method: method.type,
          amount: method.amount,
        })),
      });
      setLastSale(result);
      setCart([]);
      setDiscountAmount(0);
      setAmountPaid(undefined);
      setSelectedCustomer("");
      setSearchQuery("");
      setDebouncedSearch("");
      setCurrentPage(1);
      setPaymentMethods([]);
      setShowPaymentModal(false);
      setShowReceiptModal(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al realizar la venta"));
    }
  };

  const handlePrintReceipt = async () => {
    if (lastSale) {
      try {
        await printReceipt(lastSale.id);
      } catch (error) {
        toast.error(
          getApiErrorMessage(error, "Error al imprimir el comprobante"),
        );
      }
    }
  };

  const handlePrintThermalReceipt = () => {
    if (lastSale) {
      printThermalReceipt(lastSale, settings?.companyName ?? "Mi Negocio", {
        header: settings?.printHeader,
        footer: settings?.printFooter,
      });
    }
  };

  const handlePauseSale = () => {
    if (cart.length === 0) {
      toast.info("No hay productos en el carrito");
      return;
    }
    try {
      const customerName = selectedCustomer
        ? customers.find((c) => c.id === selectedCustomer)?.name
        : "Cliente General";
      pauseSale(cart, selectedCustomer, discountAmount, customerName);
      setCart([]);
      setDiscountAmount(0);
      setAmountPaid(undefined);
      setSelectedCustomer("");
      setSearchQuery("");
      setDebouncedSearch("");
      setCurrentPage(1);
      setPaymentMethods([]);
      setEditingDiscount(null);
      setCustomDiscount("");
      toast.success("Venta pausada correctamente");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al pausar la venta",
      );
    }
  };

  const handleResumeSale = (saleId: string) => {
    try {
      const resumedSale = resumeSale(saleId);
      setCart(resumedSale.cart);
      setSelectedCustomer(resumedSale.customerId);
      setDiscountAmount(resumedSale.discountAmount);
      setShowPausedSalesModal(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al reanudar la venta",
      );
    }
  };

  const handleDeletePausedSale = (saleId: string) => {
    setPausedSaleToDelete(saleId);
    setShowDeletePausedModal(true);
  };

  const confirmDeletePausedSale = () => {
    if (!pausedSaleToDelete) return;
    deletePausedSale(pausedSaleToDelete);
    toast.success("Venta pausada eliminada");
    setPausedSaleToDelete(null);
  };

  const openPaymentModal = () => {
    setPaymentMethods([
      {
        type: selectedPaymentMethod,
        amount: selectedPaymentMethod === "CASH" ? (amountPaid ?? 0) : total,
      },
    ]);
    setShowPaymentModal(true);
  };

  const selectedCustomerName = selectedCustomer
    ? customers.find((c) => c.id === selectedCustomer)?.name
    : null;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 lg:grid lg:h-[calc(100vh-6rem)] lg:grid-cols-12 lg:gap-5">
        {/* Products Panel */}
        <div className="flex min-h-0 flex-col lg:col-span-8 lg:h-full">
          <div className="h-auto min-h-0 overflow-hidden rounded-3xl border border-primary/30 bg-primary/10 lg:flex lg:h-full lg:flex-col">
            {/* Products Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded-full bg-primary shrink-0" />
                <h2 className="text-base font-semibold text-foreground">
                  Productos
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <Badge variant="default" className="font-mono">
                    {cart.length} en carrito
                  </Badge>
                )}
              </div>
            </div>

            {/* Scanner */}
            <div className="border-b border-primary/20 bg-primary/5 px-4 py-3.5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Escaner POS
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      ref={scannerInputRef}
                      placeholder="Escanear codigo de barras o SKU"
                      value={scannerCode}
                      onChange={(e) => {
                        setScannerCode(e.target.value);
                        if (scanFeedback.message) {
                          setScanFeedback(DEFAULT_SCAN_FEEDBACK);
                        }
                      }}
                      onKeyDown={handleScannerKeyDown}
                      disabled={
                        isScannerBlocked || quickSearchProduct.isPending
                      }
                      className="h-10"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleScanSubmit()}
                      disabled={
                        isScannerBlocked ||
                        quickSearchProduct.isPending ||
                        scannerCode.trim().length === 0
                      }
                      className="sm:w-auto"
                    >
                      Agregar
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center p-4 border-b border-primary/20 bg-background/40">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, SKU o código..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Button
                type="button"
                variant={showFavoritesOnly ? "primary" : "secondary"}
                size="sm"
                onClick={() => {
                  setShowFavoritesOnly((c) => !c);
                  setCurrentPage(1);
                }}
                className="shrink-0"
              >
                <Star
                  className={`w-3.5 h-3.5 ${showFavoritesOnly ? "fill-current" : ""}`}
                />
                {showFavoritesOnly ? "Favoritos" : "Todos"}
              </Button>
            </div>

            {/* Product Grid */}
            <div className="scrollbar-app max-h-[55vh] overflow-y-auto p-4 lg:flex-1 lg:min-h-0 lg:max-h-none">
              <div
                className={cn(
                  "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 transition-opacity duration-150",
                  isFetching && !searching ? "opacity-60" : "opacity-100",
                )}
              >
                {searching ? (
                  <LoadingState icon={<Package className="w-4 h-4 text-primary/50" />} message="Buscando productos..." />
                ) : visibleProducts.length > 0 ? (
                  visibleProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      mode="pos"
                      product={product}
                      onClick={() => addToCart(product as Product)}
                      isFavorite={favoriteProductIds.includes(product.id)}
                      onToggleFavorite={() => toggleFavoriteProduct(product.id)}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={<Package className="w-6 h-6 text-muted-foreground/30" />}
                    title={
                      showFavoritesOnly
                        ? "No tienes favoritos"
                        : debouncedSearch
                          ? "No se encontraron productos"
                          : totalProducts > 0
                            ? "No hay productos en esta pagina"
                            : "No hay productos disponibles"
                    }
                  />
                )}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && !showFavoritesOnly && (
                <div className="pt-4 mt-3 border-t border-primary/20">
                  <Pagination
                    currentPage={visibleCurrentPage}
                    totalPages={totalPages}
                    onPageChange={goToPage}
                    totalItems={totalProducts}
                    pageSize={POS_PAGE_SIZE}
                    itemLabel="producto"
                    isDisabled={isFetching}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cart Panel */}
        <div className="min-h-0 lg:col-span-4 lg:h-full">
          <div className="h-auto min-h-0 overflow-hidden rounded-3xl border border-accent/30 bg-accent/10 lg:h-full flex flex-col">
            {/* Cart Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-accent/20">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded-full bg-accent shrink-0" />
                <h2 className="text-base font-semibold text-foreground">
                  Carrito
                </h2>
              </div>
              {cart.length > 0 && (
                <Badge variant="warning">{cart.length}</Badge>
              )}
            </div>

            {/* Cart Items */}
            <div className="scrollbar-app max-h-[55vh] overflow-y-auto p-3 space-y-2 lg:flex-1 lg:min-h-0 lg:max-h-none">
              {cart.length === 0 ? (
                <EmptyState icon={<ShoppingCart className="w-6 h-6 text-muted-foreground/30" />} title="Carrito vacío" subtitle="Agrega productos para comenzar" />
              ) : (
                cart.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-start gap-2.5 p-3 bg-background/40 rounded-2xl border border-accent/20 hover:border-accent/40 transition-colors"
                  >
                    <div className="relative w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                      {item.product.imageUrl ? (
                        <Image
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        <Package className="w-5 h-5 text-primary/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground line-clamp-1 mb-1">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground mb-1.5">
                        {formatCurrency(item.unitPrice)} × {item.quantity}
                        {item.discountAmount > 0 && (
                          <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">
                            (-{formatCurrency(item.discountAmount)}
                            {item.discountPercent
                              ? ` · ${item.discountPercent}%`
                              : ""}
                            )
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center rounded-lg border border-accent/30 bg-background/60">
                          <button
                            onClick={() =>
                              updateQuantity(item.productId, item.quantity - 1)
                            }
                            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-foreground">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.productId, item.quantity + 1)
                            }
                            disabled={item.quantity >= item.availableStock}
                            className={cn(
                              "w-7 h-7 flex items-center justify-center transition-colors",
                              item.quantity >= item.availableStock
                                ? "opacity-50 cursor-not-allowed text-muted-foreground/40"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        {item.quantity >= item.availableStock && (
                          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            máx.
                          </span>
                        )}
                        <button
                          onClick={() => setEditingDiscount(item.productId)}
                          className="w-7 h-7 rounded-lg border border-accent/30 bg-background/60 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                          title="Descuento"
                        >
                          <Percent className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="stat-number text-sm font-bold text-foreground">
                        {formatCurrency(
                          item.quantity * item.unitPrice - item.discountAmount,
                        )}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer */}
            <div className="border-t border-accent/20 p-4 space-y-3">
              {/* Customer Selector — near checkout */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Cliente (opcional)
                </p>
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  className="flex items-center gap-2 w-full h-9 px-3 rounded-lg border border-accent/30 bg-background/60 text-sm text-foreground hover:border-accent/50 transition-colors overflow-hidden"
                >
                  <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate text-sm font-medium">
                    {selectedCustomerName || "Sin cliente"}
                  </span>
                </button>
              </div>

              {/* Totals */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Impuestos</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(taxAmount)}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                    <span>Descuento</span>
                    <span className="font-medium">
                      -{formatCurrency(discountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-accent/20">
                  <span className="text-sm font-bold text-foreground">
                    Total
                  </span>
                  <span className="stat-number text-xl font-bold text-primary">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              {/* Pause/Resume */}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowPausedSalesModal(true)}
                  className="flex-1 text-xs"
                >
                  <Play className="w-3.5 h-3.5" />
                  Reanudar ({pausedSales.length})
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePauseSale}
                  disabled={cart.length === 0}
                  className="flex-1 text-xs"
                >
                  <Pause className="w-3.5 h-3.5" />
                  Pausar
                </Button>
              </div>

              {/* Payment Method */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Método de Pago
                </p>
                <PaymentMethodCards
                  selectedMethod={selectedPaymentMethod}
                  onMethodChange={(method) => setSelectedPaymentMethod(method)}
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={openPaymentModal}
                disabled={cart.length === 0}
                loading={createSale.isPending}
              >
                <ShoppingCart className="w-4 h-4" />
                Finalizar Venta
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Modal */}
      <Modal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        title="Seleccionar Cliente"
        size="sm"
      >
        <div className="space-y-3">
          <Input placeholder="Buscar cliente..." className="w-full" />
          <div className="scrollbar-app max-h-80 overflow-y-auto space-y-1.5">
            <div
              className={`p-3 rounded-2xl cursor-pointer transition-colors border ${selectedCustomer === "" ? "bg-primary/20 border-primary/40 text-foreground" : "bg-background/40 border-primary/20 hover:bg-primary/10 hover:border-primary/30"}`}
              onClick={() => {
                setSelectedCustomer("");
                setShowCustomerModal(false);
              }}
            >
              <p className="text-sm font-semibold text-foreground">
                Cliente General
              </p>
              <p className="text-xs text-muted-foreground">
                Sin cliente asignado
              </p>
            </div>
            {customers.map((customer) => (
              <div
                key={customer.id}
                className={`p-3 rounded-2xl cursor-pointer transition-colors border ${selectedCustomer === customer.id ? "bg-primary/20 border-primary/40" : "bg-background/40 border-primary/20 hover:bg-primary/10 hover:border-primary/30"}`}
                onClick={() => {
                  setSelectedCustomer(customer.id);
                  setShowCustomerModal(false);
                }}
              >
                <p className="text-sm font-semibold text-foreground">
                  {customer.name}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {customer.documentNumber}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <PaymentConfirmationModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={handleCheckout}
        cart={cart}
        subtotal={subtotal}
        taxAmount={taxAmount}
        total={total}
        selectedMethod={selectedPaymentMethod}
        paymentMethods={paymentMethods}
        onPaymentMethodChange={setPaymentMethods}
        loading={createSale.isPending}
        customerName={
          selectedCustomer
            ? customers.find((c) => c.id === selectedCustomer)?.name
            : "Cliente General"
        }
        saleNumber={lastSale?.saleNumber}
      />

      {/* Receipt Success Modal */}
      {lastSale && (
        <Modal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          title="¡Venta Completada!"
          size="lg"
        >
          <div className="space-y-5">
            <div
              className="text-center py-5 rounded-xl border"
              style={{
                backgroundColor: "rgba(16,185,129,0.06)",
                borderColor: "rgba(16,185,129,0.2)",
              }}
            >
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-500 flex items-center justify-center">
                <Printer className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">
                Venta Exitosa
              </h3>
              <p className="text-sm text-muted-foreground font-mono">
                Comprobante #{lastSale.saleNumber}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Cliente",
                  value: lastSale.customer?.name || "Cliente General",
                },
                {
                  label: "Método",
                  value:
                    (lastSale.payments?.length ?? 0) > 1
                      ? "Mixto"
                      : lastSale.payments?.[0]?.method === "CASH"
                        ? "Efectivo"
                        : lastSale.payments?.[0]?.method === "CARD"
                          ? "Tarjeta"
                          : "Transferencia",
                },
                {
                  label: "Items",
                  value: `${lastSale.items.length} producto(s)`,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="p-3 rounded-2xl bg-background/40 border border-accent/20"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {label}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {value}
                  </p>
                </div>
              ))}
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/30">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Total
                </p>
                <p className="stat-number text-lg font-bold text-primary">
                  {formatCurrency(lastSale.total)}
                </p>
              </div>
            </div>

            {lastSale.amountPaid != null && lastSale.amountPaid > 0 ? (
              <div className="p-3 rounded-2xl bg-background/40 border border-accent/20 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pagado:</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(lastSale.amountPaid)}
                  </span>
                </div>
                {lastSale.change !== null ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cambio:</span>
                    <span className="stat-number font-bold text-accent">
                      {formatCurrency(lastSale.change)}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2 border-t border-primary/20">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowReceiptModal(false);
                  setLastSale(null);
                }}
                className="sm:w-auto"
              >
                Cerrar
              </Button>
              <Button variant="secondary" onClick={handlePrintReceipt}>
                <FileDown className="w-4 h-4" /> Descargar PDF
              </Button>
              <Button onClick={handlePrintThermalReceipt}>
                <Printer className="w-4 h-4" /> Imprimir Recibo Térmico
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Discount Modal */}
      {editingDiscount && (
        <Modal
          isOpen={!!editingDiscount}
          onClose={() => {
            setEditingDiscount(null);
            setCustomDiscount("");
          }}
          title="Agregar Descuento"
          size="sm"
        >
          <div className="space-y-4">
            <Input
              type="number"
              step="0.01"
              label="Monto del descuento"
              value={customDiscount}
              onChange={(e) => setCustomDiscount(e.target.value)}
              placeholder="0.00"
            />
            <div className="flex gap-2">
              {[10, 20, 50].map((pct) => (
                <Button
                  key={pct}
                  variant="secondary"
                  onClick={() => {
                    if (editingDiscount)
                      updateItemDiscountPercent(editingDiscount, pct);
                  }}
                  className="flex-1"
                >
                  {pct}%
                </Button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingDiscount(null);
                  setCustomDiscount("");
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (editingDiscount)
                    updateItemDiscount(editingDiscount, Number(customDiscount));
                }}
                className="flex-1"
                disabled={!customDiscount}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Paused Sales Modal */}
      <Modal
        isOpen={showPausedSalesModal}
        onClose={() => setShowPausedSalesModal(false)}
        title="Ventas Pausadas"
        size="xl"
      >
        <div className="space-y-3">
          {pausedSales.length === 0 ? (
            <EmptyState
              icon={<Pause className="h-12 w-12" />}
              title="No hay ventas pausadas"
              subtitle="Pausa una venta para que aparezca aquí"
            />
          ) : (
            <div className="scrollbar-app max-h-96 overflow-y-auto space-y-2.5">
              {pausedSales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-4 rounded-2xl bg-background/40 border border-primary/20"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {sale.customerName || "Cliente General"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {sale.cart.length} producto(s) ·{" "}
                        {new Date(sale.pausedAt).toLocaleString("es-CO")}
                      </p>
                    </div>
                    <span className="stat-number text-base font-bold text-primary">
                      {formatCurrency(
                        sale.cart.reduce(
                          (sum, item) =>
                            sum +
                            item.quantity * item.unitPrice -
                            item.discountAmount,
                          0,
                        ),
                      )}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleResumeSale(sale.id)}
                      className="flex-1"
                    >
                      <Play className="w-3.5 h-3.5" /> Reanudar
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeletePausedSale(sale.id)}
                      className="p-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeletePausedModal}
        onClose={() => {
          setShowDeletePausedModal(false);
          setPausedSaleToDelete(null);
        }}
        onConfirm={confirmDeletePausedSale}
        title="Eliminar venta pausada"
        message="Se eliminará la venta pausada de forma definitiva."
        confirmText="Eliminar"
      />
    </DashboardLayout>
  );
}
