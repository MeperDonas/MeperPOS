import type { ImportSheetId } from "@/types";

export const SHEET_LABELS: Record<ImportSheetId, string> = {
  productos: "Productos",
  clientes: "Clientes",
  proveedores: "Proveedores",
  usuarios: "Usuarios",
};

export const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  sku: "SKU",
  barcode: "Código de barras",
  category: "Categoría",
  salePrice: "Precio venta",
  costPrice: "Precio costo",
  stock: "Stock",
  minStock: "Stock mínimo",
  taxRate: "Impuesto (%)",
  description: "Descripción",
  documentType: "Tipo de documento",
  documentNumber: "N° documento",
  email: "Email",
  password: "Contraseña",
  role: "Rol",
  accountType: "Tipo de cuenta",
  phone: "Teléfono",
  address: "Dirección",
  contactName: "Nombre de contacto",
};

export function sheetLabel(sheetId: ImportSheetId): string {
  return SHEET_LABELS[sheetId] ?? sheetId;
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}
