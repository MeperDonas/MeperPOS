# Plan de Implementación de Mejoras — MeperPOS

Basado en el [code-review-consolidado.md](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/docs/reportes/revisiones/code-review-consolidado.md), este plan organiza todas las correcciones en **4 fases** ordenadas por prioridad y dependencia entre cambios.

> [!IMPORTANT]
> **Principio rector:** Cada fase debe dejar la aplicación funcional al terminar. No se avanza a la siguiente sin verificar la actual.

---

## Fase 1 — Seguridad Crítica

_Duración estimada: ~30 min · 6 archivos · Sin migración de BD_

Todos los problemas que permiten acceso no autorizado o forja de tokens. Se resuelven primero porque anulan todas las demás protecciones.

### 1.1 JWT Secret sin fallback

#### [MODIFY] [jwt.strategy.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/auth/jwt.strategy.ts)

- Reemplazar `configService.get('JWT_SECRET') || 'fallback-secret'` por `configService.getOrThrow('JWT_SECRET')`.
- La app debe **crashear al arrancar** si no hay secret configurado.

#### [MODIFY] [auth.module.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/auth/auth.module.ts)

- Mismo cambio: `configService.getOrThrow('JWT_SECRET')` en `JwtModule.registerAsync`.

---

### 1.2 RBAC incompleto — Agregar `RolesGuard` donde falta

#### [MODIFY] [settings.controller.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/settings/settings.controller.ts)

- Línea 26: cambiar `@UseGuards(JwtAuthGuard)` → `@UseGuards(JwtAuthGuard, RolesGuard)`.
- Importar `RolesGuard` desde `../common/guards/roles.guard`.

#### [MODIFY] [exports.controller.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/exports/exports.controller.ts)

- Línea 15: cambiar `@UseGuards(JwtAuthGuard)` → `@UseGuards(JwtAuthGuard, RolesGuard)`.
- Importar `RolesGuard`.

---

### 1.3 Resolver controlador de búsqueda duplicado e inseguro

#### [MODIFY] [products-search.controller.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/products/products-search.controller.ts)

- Línea 14: cambiar `@UseGuards(RolesGuard)` → `@UseGuards(JwtAuthGuard, RolesGuard)`.
- Importar `JwtAuthGuard` desde `../auth/jwt.strategy`.

#### [MODIFY] [products.controller.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/products/products.controller.ts)

- Eliminar los métodos `search()` (línea 78-84) y `quickSearch()` (línea 86-91) que están duplicados en `ProductsSearchController`.
- También eliminar los imports de `@ApiQuery` si ya no se necesitan (o mantener si se usan en otros métodos).

---

### 1.4 Registro abierto: proteger o eliminar

#### [MODIFY] [auth.controller.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/auth/auth.controller.ts)

- **Opción A (recomendada):** Eliminar el endpoint `POST /auth/register` ya que existe `POST /auth/users` (protegido con ADMIN) que cumple la misma función con `CreateUserDto`.
- **Opción B:** Proteger `register` con `@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles('ADMIN')`.

> [!IMPORTANT]
> **Decisión requerida:** ¿Eliminar el endpoint `register` (Opción A) o protegerlo (Opción B)? Opción A es más limpia porque `createUser` ya hace lo mismo y permite elegir el rol.

---

### 1.5 CORS restringido

#### [MODIFY] [main.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/main.ts)

- Reemplazar `app.enableCors()` por:

```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
});
```

- Agregar `CORS_ORIGIN` al `.env`.

---

## Fase 2 — Lógica de Negocio y Consistencia de Datos

_Duración estimada: ~45 min · 5 archivos + 1 migración de BD_

Corrige bugs que producen datos incorrectos o comportamiento impredecible.

### 2.1 Precio de venta desde BD, no desde el cliente

#### [MODIFY] [sales.service.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/sales/sales.service.ts)

- En `create()`, cambiar el cálculo de `itemSubtotal` (línea ~61):

```diff
-const itemSubtotal = item.unitPrice * item.quantity;
+const itemSubtotal = Number(product.salePrice) * item.quantity;
```

- Cambiar `unitPrice` en el `saleItems.push()` (línea ~72):

```diff
-unitPrice: item.unitPrice,
+unitPrice: Number(product.salePrice),
```

- Evaluar si `unitPrice` debe mantenerse en `SaleItemDto` (podría usarse para precios personalizados con autorización de ADMIN).

#### [MODIFY] [sales.dto.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/sales/dto/sales.dto.ts)

- Hacer `unitPrice` opcional en `SaleItemDto` o eliminarlo, ya que el precio se toma de BD.

---

### 2.2 `saleNumber` con autoincrement

#### [MODIFY] [schema.prisma](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/prisma/schema.prisma)

- Cambiar `saleNumber Int @unique` a `saleNumber Int @unique @default(autoincrement())`.
- Esto elimina la lógica manual y la race condition.

#### [MODIFY] [sales.service.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/sales/sales.service.ts)

- Eliminar las líneas 102-105 (búsqueda manual del saleNumber).
- Eliminar `saleNumber` del `tx.sale.create({ data: { ... } })` — PostgreSQL lo asignará automáticamente.
- Requiere **nueva migración**: `npx prisma migrate dev --name sale-number-autoincrement`.

---

### 2.3 `getLowStockProducts` corregido con raw query

#### [MODIFY] [products.service.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/products/products.service.ts)

- Reemplazar el contenido de `getLowStockProducts()` con una raw query:

```typescript
async getLowStockProducts() {
  return this.prisma.$queryRaw`
    SELECT p.*, c.name as "categoryName"
    FROM "Product" p
    LEFT JOIN "Category" c ON p."categoryId" = c.id
    WHERE p.active = true AND p.stock <= p."minStock"
    ORDER BY p.stock ASC
  `;
}
```

- Actualizar el mismo patrón en `reports.service.ts` donde se usa `this.prisma.product.fields.minStock`.

#### [MODIFY] [reports.service.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/reports/reports.service.ts)

- Línea 56-59: reemplazar el count de `lowStockProducts` con:

```typescript
this.prisma.$queryRaw<[{ count: bigint }]>`
  SELECT COUNT(*)::bigint as count FROM "Product"
  WHERE active = true AND stock <= "minStock"
`.then(r => Number(r[0].count)),
```

---

### 2.4 Filtros de fecha corregidos en Exports

#### [MODIFY] [exports.service.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/exports/exports.service.ts)

- En `getSalesData()` y `getInventoryData()`, combinar las condiciones de fecha:

```typescript
if (query.startDate || query.endDate) {
  where.createdAt = {};
  if (query.startDate) where.createdAt.gte = new Date(query.startDate);
  if (query.endDate) {
    const end = new Date(query.endDate);
    end.setHours(23, 59, 59, 999);
    where.createdAt.lte = end;
  }
}
```

- Corregir `getRowData` para ventas: reemplazar `item.paymentMethod` por `item.payments?.map(p => p.method).join(', ') || 'N/A'`.

---

### 2.5 KPIs: filtrar solo ventas completadas

#### [MODIFY] [reports.service.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/reports/reports.service.ts)

- En `getDashboardKPIs()`: agregar `status: 'COMPLETED'` al `where` de `totalSales`, `totalRevenue`, y `recentSales`.
- En `getSalesByPaymentMethod()`: agregar `where.status = 'COMPLETED'` y filtrar en la query de `sale.findMany`.

---

### 2.6 Tipo de movimiento de inventario correcto

#### [MODIFY] [products.service.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/products/products.service.ts)

- En `update()`, línea ~163, diferenciar:

```typescript
const movementType =
  newStock > previousStock ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
await this.createInventoryMovement(
  id,
  movementType,
  previousStock,
  newStock,
  "Stock adjustment",
  userId,
);
```

---

## Fase 3 — Calidad de Código y Estructura

_Duración estimada: ~60 min · 10+ archivos · Sin migración_

Limpieza que no cambia comportamiento funcional pero mejora mantenibilidad.

### 3.1 Soft-delete de productos

#### [MODIFY] [products.service.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/products/products.service.ts)

- Reemplazar `remove()` con soft-delete:

```typescript
async remove(id: string) {
  const product = await this.prisma.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundException('Product not found');
  return this.prisma.product.update({
    where: { id },
    data: { active: false },
  });
}
```

### 3.2 Concurrencia optimista con `version`

#### [MODIFY] [products.service.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/products/products.service.ts)

- En `update()`, verificar y incrementar `version`:

```typescript
const product = await this.prisma.product.update({
  where: { id, version: existingProduct.version },
  data: { ...updateProductDto, version: { increment: 1 } },
  include: { category: true },
});
```

- Manejar `P2025` (not found = version mismatch) con `ConflictException('Product was modified by another user')`.

### 3.3 Eliminar imports muertos y `require()`

#### [MODIFY] [products.controller.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/products/products.controller.ts)

- Eliminar import de `FileFieldsInterceptor`.

#### [MODIFY] [sales.service.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/sales/sales.service.ts)

- Reemplazar `const { jsPDF } = require('jspdf')` → `import { jsPDF } from 'jspdf'`.

#### [MODIFY] [exports.service.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/src/exports/exports.service.ts)

- Reemplazar `require('jspdf')` → `import { jsPDF } from 'jspdf'`.
- Reemplazar `require('@fast-csv/format')` → `import * as csv from '@fast-csv/format'` (al inicio del archivo).

### 3.4 Mover dependencias al lugar correcto

#### [MODIFY] [package.json (backend)](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/package.json)

- Mover `@faker-js/faker` de `dependencies` → `devDependencies`.
- Mover `prisma` de `dependencies` → `devDependencies`.
- Mover `@types/jspdf` de `dependencies` → `devDependencies`.

### 3.5 Git: dejar de trackear `dist/`

#### [MODIFY] [.gitignore (backend)](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/.gitignore)

- Agregar `dist/` al `.gitignore`.
- Ejecutar `git rm -r --cached backend/dist` para dejar de trackear los archivos existentes.

### 3.6 Validación de token al cargar la app

#### [MODIFY] [AuthContext.tsx](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/frontend/src/contexts/AuthContext.tsx)

- En el `useEffect` inicial, después de parsear el token de `localStorage`, hacer una verificación:

```typescript
try {
  const profileResponse = await api.get<User>("/auth/profile");
  setUser(profileResponse.data);
  localStorage.setItem("user", JSON.stringify(profileResponse.data));
} catch {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
```

### 3.7 Inconsistencias frontend ↔ backend

#### [MODIFY] [useSales.ts](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/frontend/src/hooks/useSales.ts)

- Eliminar `search` del tipo de `params` ya que el backend no lo soporta.

---

## Fase 4 — Base de Datos: Índices, Relaciones y Schema

_Duración estimada: ~20 min · 1 archivo + 1 migración_

Mejoras al schema de Prisma que optimizan rendimiento y refuerzan integridad referencial.

### 4.1 Índices, FKs y cascade rules

#### [MODIFY] [schema.prisma](file:///c:/Users/meper/Desktop/Proyecto%20de%20Grado/MeperPOS/backend/prisma/schema.prisma)

```diff
 model Sale {
   ...
+  @@index([createdAt, status])
 }

 model InventoryMovement {
   ...
+  sale    Sale?   @relation(fields: [saleId], references: [id])
+  @@index([productId, createdAt])
 }

 model AuditLog {
   ...
-  userId     String?
+  userId     String?
+  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
 }

 model Product {
-  category      Category  @relation(fields: [categoryId], references: [id])
+  category      Category  @relation(fields: [categoryId], references: [id], onDelete: Restrict)
   ...
 }

 model SaleItem {
-  product        Product @relation(fields: [productId], references: [id])
+  product        Product @relation(fields: [productId], references: [id], onDelete: Restrict)
   ...
 }
```

- Ejecutar `npx prisma migrate dev --name add-indexes-and-fks`.

> [!NOTE]
> La relación `AuditLog → User` con `onDelete: SetNull` preserva los logs aún si se elimina un usuario. La restricción `Restrict` en `Product → Category` y `SaleItem → Product` impide eliminar categorías o productos que están en uso.

---

## Resumen de Cambios por Archivo

| Fase | Archivo                         | Tipo               |
| :--: | ------------------------------- | ------------------ |
|  1   | `jwt.strategy.ts`               | MODIFY             |
|  1   | `auth.module.ts`                | MODIFY             |
|  1   | `settings.controller.ts`        | MODIFY             |
|  1   | `exports.controller.ts`         | MODIFY             |
|  1   | `products-search.controller.ts` | MODIFY             |
|  1   | `products.controller.ts`        | MODIFY             |
|  1   | `auth.controller.ts`            | MODIFY             |
|  1   | `main.ts`                       | MODIFY             |
|  2   | `sales.service.ts`              | MODIFY             |
|  2   | `sales.dto.ts`                  | MODIFY             |
|  2   | `schema.prisma`                 | MODIFY + MIGRATION |
|  2   | `products.service.ts`           | MODIFY             |
|  2   | `exports.service.ts`            | MODIFY             |
|  2   | `reports.service.ts`            | MODIFY             |
|  3   | `products.service.ts`           | MODIFY             |
|  3   | `products.controller.ts`        | MODIFY             |
|  3   | `sales.service.ts`              | MODIFY             |
|  3   | `exports.service.ts`            | MODIFY             |
|  3   | `package.json`                  | MODIFY             |
|  3   | `.gitignore`                    | MODIFY             |
|  3   | `AuthContext.tsx`               | MODIFY             |
|  3   | `useSales.ts`                   | MODIFY             |
|  4   | `schema.prisma`                 | MODIFY + MIGRATION |

**Total: ~23 cambios en ~16 archivos + 2 migraciones de BD**

---

## Verification Plan

### Automated Tests

- `npm run build` en backend y frontend después de cada fase para verificar que compila sin errores.
- `npx prisma migrate dev` para verificar que las migraciones se aplican correctamente.
- `npx prisma validate` para verificar que el schema es válido.

### Manual Verification

Después de cada fase, verificar manualmente:

**Fase 1 — Seguridad:**

1. Eliminar `JWT_SECRET` del `.env` → la app debe crashear al arrancar.
2. Intentar acceder a `GET /api/settings` sin token → debe dar 401.
3. Intentar acceder a `GET /api/settings` con token de rol CASHIER → debe dar 403.
4. Intentar `POST /api/exports/customers` con token de CASHIER → debe dar 403.
5. Verificar que el endpoint de registro ha sido eliminado/protegido.

**Fase 2 — Lógica de negocio:**

1. Crear una venta enviando un `unitPrice` diferente al `salePrice` del producto → el total debe calcularse con el precio de BD.
2. Crear dos ventas simultáneas → ambas deben tener `saleNumber` diferente (sin error de constraint).
3. Verificar productos con stock ≤ minStock en `GET /api/products/low-stock`.
4. Exportar ventas con rango de fechas → verificar que ambos filtros se aplican.
5. Dashboard KPIs: cancelar una venta y verificar que los KPIs no la incluyen.

**Fase 3 — Calidad:**

1. `npm run build` limpio en backend (sin errores de import).
2. Verificar que al refrescar la página con token expirado, se redirige al login.
3. Verificar que eliminar un producto con ventas asociadas → soft-delete (pasa a `active: false`).

**Fase 4 — BD:**

1. `npx prisma migrate dev` exitoso.
2. Verificar que intentar eliminar una categoría con productos → error controlado (Restrict).
