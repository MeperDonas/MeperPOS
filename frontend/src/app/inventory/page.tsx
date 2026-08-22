"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeactivateProduct,
  useDeleteProduct,
  useReactivateProduct,
  useUploadProductImage,
  useUploadProductImageById,
} from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { BentoSelect } from "@/components/ui/BentoSelect";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/ui/FilterBar";
import { ProductCard } from "@/components/products/ProductCard";
import { ImportSection } from "@/components/reports/ImportSection";
import {
  Plus,
  AlertTriangle,
  Package,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import type { Product } from "@/types";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function InventoryPage() {
  const toast = useToast();
  const { user } = useAuth();
  const canManageInventory =
    user?.role === "ADMIN" || user?.role === "INVENTORY_USER";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<
    "active" | "inactive" | "all"
  >("active");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [productToDeactivate, setProductToDeactivate] = useState<string | null>(
    null,
  );
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [productToReactivate, setProductToReactivate] = useState<string | null>(
    null,
  );
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [taxRateInput, setTaxRateInput] = useState("");

  const { data, isLoading } = useProducts({
    page: showLowStockOnly || selectedCategory ? 1 : page,
    limit: showLowStockOnly || selectedCategory ? 1000 : 10,
    search: search || undefined,
    categoryId: selectedCategory || undefined,
    status: statusFilter,
  });
  const { data: categoriesData } = useCategories();

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deactivateProduct = useDeactivateProduct();
  const deleteProduct = useDeleteProduct();
  const reactivateProduct = useReactivateProduct();
  const uploadProductImage = useUploadProductImage();
  const uploadProductImageById = useUploadProductImageById(
    editingProduct?.id || "",
  );

  const products = data?.data || [];
  const meta = data?.meta;
  const categories = categoriesData?.data ?? [];

  const lowStockProducts = products
    .filter((p) => p.stock <= p.minStock)
    .toSorted((a, b) =>
      a.name.localeCompare(b.name, "es-CO", {
        sensitivity: "base",
        numeric: true,
      }),
    );
  const displayProducts = (
    showLowStockOnly ? lowStockProducts : products
  ).toSorted((a, b) =>
    a.name.localeCompare(b.name, "es-CO", {
      sensitivity: "base",
      numeric: true,
    }),
  );

  const handleEdit = (product: Product) => {
    if (!canManageInventory) return;
    setEditingProduct(product);
    setFormData(product);
    setTaxRateInput(product.taxRate > 0 ? String(product.taxRate) : "");
    setShowModal(true);
  };

  const handleCreate = () => {
    if (!canManageInventory) return;
    setEditingProduct(null);
    setFormData({
      name: "",
      sku: "",
      barcode: "",
      description: "",
      costPrice: 0,
      salePrice: 0,
      stock: 0,
      minStock: 5,
      categoryId: "",
    });
    setTaxRateInput("");
    setShowModal(true);
  };

  const handleDeactivate = (id: string) => {
    if (!canManageInventory) return;
    setProductToDeactivate(id);
    setShowDeactivateModal(true);
  };

  const confirmDeactivate = async () => {
    if (productToDeactivate) {
      try {
        await deactivateProduct.mutateAsync(productToDeactivate);
        toast.success("Producto desactivado correctamente");
        if (editingProduct?.id === productToDeactivate) {
          setShowModal(false);
          setEditingProduct(null);
          setFormData({});
        }
        setShowDeactivateModal(false);
        setProductToDeactivate(null);
      } catch (error) {
        toast.error(
          getApiErrorMessage(error, "No se pudo desactivar el producto"),
        );
      }
    }
  };

  const handleDelete = (id: string) => {
    if (!canManageInventory) return;
    setProductToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      try {
        await deleteProduct.mutateAsync(productToDelete);
        toast.success("Producto eliminado definitivamente");
        if (editingProduct?.id === productToDelete) {
          setShowModal(false);
          setEditingProduct(null);
          setFormData({});
        }
        setShowDeleteModal(false);
        setProductToDelete(null);
      } catch (error) {
        toast.error(
          getApiErrorMessage(error, "No se pudo eliminar el producto"),
        );
      }
    }
  };

  const handleReactivate = (id: string) => {
    if (!canManageInventory) return;
    setProductToReactivate(id);
    setShowReactivateModal(true);
  };

  const confirmReactivate = async () => {
    if (productToReactivate) {
      try {
        await reactivateProduct.mutateAsync(productToReactivate);
        toast.success("Producto reactivado correctamente");
        if (editingProduct?.id === productToReactivate) {
          setShowModal(false);
          setEditingProduct(null);
          setFormData({});
        }
        setShowReactivateModal(false);
        setProductToReactivate(null);
      } catch (error) {
        toast.error(
          getApiErrorMessage(error, "No se pudo reactivar el producto"),
        );
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCategoryId =
      formData.categoryId?.toString().trim() || undefined;
    const hasExplicitTaxRate = taxRateInput.trim() !== "";
    const parsedTaxRate = hasExplicitTaxRate ? Number(taxRateInput) : undefined;
    if (hasExplicitTaxRate && Number.isNaN(parsedTaxRate)) {
      toast.error("Ingresa una tasa de impuesto valida");
      return;
    }

    try {
      if (editingProduct) {
        const updateData = { ...formData };
        delete updateData.id;
        delete updateData.createdAt;
        delete updateData.updatedAt;
        delete updateData.category;
        delete updateData.imageUrl;
        delete updateData.version;
        delete updateData.categoryId;
        delete updateData.taxRate;
        delete updateData.effectiveTaxRate;
        delete updateData.isLowStock;
        delete updateData.preferredSupplierId;
        delete updateData.organizationId;
        const cleanedData = {
          ...updateData,
          ...(normalizedCategoryId ? { categoryId: normalizedCategoryId } : {}),
          ...(hasExplicitTaxRate ? { taxRate: parsedTaxRate } : {}),
          costPrice: updateData.costPrice ?? 0,
          salePrice: updateData.salePrice ?? 0,
          stock: updateData.stock ?? 0,
          minStock: updateData.minStock ?? 5,
        };
        await updateProduct.mutateAsync({
          id: editingProduct.id,
          data: cleanedData,
        });
      } else {
        if (!normalizedCategoryId) {
          toast.error("Debes seleccionar una categoria");
          return;
        }
        const cleanedFormData = {
          ...formData,
          categoryId: normalizedCategoryId,
          ...(hasExplicitTaxRate ? { taxRate: parsedTaxRate } : {}),
          costPrice: formData.costPrice ?? 0,
          salePrice: formData.salePrice ?? 0,
          stock: formData.stock ?? 0,
          minStock: formData.minStock ?? 5,
        };
        await createProduct.mutateAsync(cleanedFormData as Product);
        toast.success("Producto creado correctamente");
      }
      if (editingProduct) toast.success("Producto actualizado correctamente");
      setShowModal(false);
      setFormData({});
      setTaxRateInput("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al guardar el producto"));
    }
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    if (editingProduct) {
      const result = await uploadProductImageById.mutateAsync(file);
      return result.imageUrl || "";
    } else {
      const result = await uploadProductImage.mutateAsync(file);
      return result.imageUrl;
    }
  };

  const hasFilter =
    selectedCategory || showLowStockOnly || statusFilter !== "active";
  const isEditingInactive = Boolean(editingProduct && !editingProduct.active);

  return (
    <DashboardLayout>
      <div className="space-y-4 lg:space-y-5">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-1 h-7 rounded-full bg-primary shrink-0" />
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                Inventario
              </h1>
              {meta && (
                <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  {meta.total} productos
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground ml-4">
              Gestiona productos, precios y existencias
            </p>
          </div>
          {canManageInventory && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button variant="ghost" onClick={() => setShowImporter((current) => !current)} className="w-full sm:w-auto shrink-0">
                <Upload className="w-4 h-4" />
                {showImporter ? "Ocultar importador" : "Importar productos"}
              </Button>
              <Button onClick={handleCreate} className="w-full sm:w-auto shrink-0">
                <Plus className="w-4 h-4" />
                Nuevo Producto
              </Button>
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por nombre, SKU..."
          filterControls={
            <>
              <BentoSelect
                value={statusFilter}
                onChange={(value) =>
                  setStatusFilter(value as "active" | "inactive" | "all")
                }
                className="w-36"
                placeholder="Estado"
                options={[
                  { value: "active", label: "Activos" },
                  { value: "inactive", label: "Inactivos" },
                  { value: "all", label: "Todos" },
                ]}
              />
              <BentoSelect
                value={selectedCategory || ""}
                onChange={(value) => setSelectedCategory(value || null)}
                className={cn("w-52", selectedCategory && "border-primary/40")}
                placeholder="Todas las categorías"
                options={[
                  { value: "", label: "Todas las categorías" },
                  ...categories.map((cat) => ({
                    value: cat.id,
                    label: cat.name,
                  })),
                ]}
              />
              <button
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={cn(
                  "flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all border",
                  showLowStockOnly
                    ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                    : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground",
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Stock Bajo</span>
                {lowStockProducts.length > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0",
                      showLowStockOnly
                        ? "bg-red-500 text-white"
                        : "bg-red-500/20 text-red-600 dark:text-red-400",
                    )}
                  >
                    {lowStockProducts.length}
                  </span>
                )}
              </button>
            </>
          }
          postContent={
            hasFilter ? (
              <div className="flex items-center gap-2 px-4 py-2 border-t border-border/40 bg-muted/20">
                <SlidersHorizontal className="w-3 h-3 text-primary/60 shrink-0" />
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {displayProducts.length}
                  </span>{" "}
                  resultado{displayProducts.length !== 1 ? "s" : ""}
                  {selectedCategory && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="text-primary">
                        {categories.find((c) => c.id === selectedCategory)?.name}
                      </span>
                    </>
                  )}
                  {showLowStockOnly && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="text-red-500 dark:text-red-400">
                        stock bajo
                      </span>
                    </>
                  )}
                  {statusFilter !== "active" && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="text-primary">
                        {statusFilter === "inactive" ? "inactivos" : "todos"}
                      </span>
                    </>
                  )}
                </span>
              </div>
            ) : undefined
          }
        />

        {canManageInventory && showImporter && <ImportSection />}

        {/* Low stock alert */}
        {/* {lowStockProducts.length > 0 &&
          !showLowStockOnly &&
          !selectedCategory && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl border"
              style={{
                backgroundColor: "rgba(239,68,68,0.06)",
                borderColor: "rgba(239,68,68,0.2)",
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(239,68,68,0.12)" }}
              >
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  {lowStockProducts.length} producto
                  {lowStockProducts.length !== 1 ? "s" : ""} con stock bajo
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowLowStockOnly(true)}
              >
                Ver todos
              </Button>
            </div>
          )} */}

        {/* Content */}
        {isLoading ? (
          <LoadingState icon={<Package className="w-4 h-4 text-primary/50" />} message="Cargando productos..." />
        ) : displayProducts.length === 0 ? (
          <EmptyState
            icon={<Package className="w-6 h-6 text-muted-foreground/30" />}
            title={hasFilter ? "No se encontraron productos" : "No hay productos aún"}
            subtitle={hasFilter ? "Intenta con otros filtros" : "Crea tu primer producto"}
          />
        ) : (
          <>
            <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-5">
              {displayProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  mode="inventory"
                  product={product}
                  onClick={
                    canManageInventory ? () => handleEdit(product) : undefined
                  }
                  onDelete={
                    canManageInventory && product.active
                      ? () => handleDeactivate(product.id)
                      : undefined
                  }
                  onReactivate={
                    canManageInventory && !product.active
                      ? () => handleReactivate(product.id)
                      : undefined
                  }
                />
              ))}
            </div>

            {meta &&
              meta.totalPages > 1 &&
              !showLowStockOnly &&
              !selectedCategory && (
                <Pagination
                  currentPage={page}
                  totalPages={meta.totalPages}
                  onPageChange={setPage}
                  totalItems={meta.total}
                  itemLabel="producto"
                />
              )}
          </>
        )}
      </div>

      <Modal
        isOpen={canManageInventory && showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? "Editar Producto" : "Nuevo Producto"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-1">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Imagen del producto
              </label>
              <ImageUpload
                value={formData.imageUrl || ""}
                onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                onUpload={handleImageUpload}
                disabled={
                  uploadProductImage.isPending ||
                  uploadProductImageById.isPending
                }
              />
            </div>
            <div className="md:col-span-1 space-y-3 lg:space-y-4">
              <Input
                label="Nombre"
                value={formData.name || ""}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
              <Input
                label="SKU"
                value={formData.sku || ""}
                onChange={(e) =>
                  setFormData({ ...formData, sku: e.target.value })
                }
                required
              />
              <Input
                label="Código de Barras"
                value={formData.barcode || ""}
                onChange={(e) =>
                  setFormData({ ...formData, barcode: e.target.value })
                }
              />
              <BentoSelect
                label="Categoría"
                value={formData.categoryId || ""}
                onChange={(value) =>
                  setFormData({ ...formData, categoryId: value })
                }
                options={[
                  { value: "", label: "Seleccionar categoría" },
                  ...categories.map((cat) => ({
                    value: cat.id,
                    label: cat.name,
                  })),
                ]}
              />
              <div className="grid grid-cols-2 gap-3">
                <CurrencyInput
                  label="Precio de Costo"
                  value={formData.costPrice || ""}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      costPrice: value,
                    })
                  }
                  required
                />
                <CurrencyInput
                  label="Precio de Venta"
                  value={formData.salePrice || ""}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      salePrice: value,
                    })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Input
                    label="Impuesto (%)"
                    type="number"
                    step="0.01"
                    value={taxRateInput}
                    onChange={(e) => setTaxRateInput(e.target.value)}
                  />
                </div>
                <Input
                  label="Stock"
                  type="number"
                  value={formData.stock || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: Number(e.target.value) })
                  }
                  required
                />
                <Input
                  label="Stock Mín."
                  type="number"
                  value={formData.minStock || 5}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minStock: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
            </div>
          </div>
          <Input
            label="Descripción"
            value={formData.description || ""}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            textarea
            rows={3}
          />
          <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-border/60">
            {editingProduct?.active && (
              <Button
                type="button"
                variant="danger"
                onClick={() => handleDelete(editingProduct.id)}
                className="w-full sm:w-auto"
              >
                Eliminar definitivo
              </Button>
            )}
            {isEditingInactive && editingProduct && (
              <Button
                type="button"
                variant="danger"
                onClick={() => handleDelete(editingProduct.id)}
                className="w-full sm:w-auto"
              >
                Eliminar definitivo
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowModal(false);
                setEditingProduct(null);
                setFormData({});
                setTaxRateInput("");
              }}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={createProduct.isPending || updateProduct.isPending}
              disabled={isEditingInactive}
              className="w-full sm:w-auto"
            >
              {isEditingInactive
                ? "Reactivar desde la tarjeta"
                : editingProduct
                  ? "Actualizar"
                  : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={canManageInventory && showDeactivateModal}
        onClose={() => {
          setShowDeactivateModal(false);
          setProductToDeactivate(null);
        }}
        onConfirm={confirmDeactivate}
        title="Desactivar Producto"
        message="¿Estás seguro de que deseas desactivar este producto? Podrás reactivarlo más adelante."
        confirmText="Desactivar"
        cancelText="Cancelar"
      />

      <ConfirmDialog
        isOpen={canManageInventory && showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setProductToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Eliminar Producto Definitivamente"
        message="Esta acción elimina el producto de forma permanente. Si tiene ventas o movimientos asociados, no se podrá eliminar."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      <ConfirmDialog
        isOpen={canManageInventory && showReactivateModal}
        onClose={() => {
          setShowReactivateModal(false);
          setProductToReactivate(null);
        }}
        onConfirm={confirmReactivate}
        title="Reactivar Producto"
        message="¿Deseas reactivar este producto para volver a venderlo y gestionarlo en inventario?"
        confirmText="Reactivar"
        cancelText="Cancelar"
      />
    </DashboardLayout>
  );
}
