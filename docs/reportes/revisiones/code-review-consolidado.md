# 📋 Code Review Consolidado — MeperPOS

> Revisión técnica combinada: análisis de Antigravity (Google DeepMind) + GPT Codex 5.3  
> Fecha: 19/02/2026

---

## Stack Tecnológico

| Capa                    | Tecnología            | Versión       |
| ----------------------- | --------------------- | ------------- |
| **Backend**             | NestJS + TypeScript   | v11           |
| **ORM**                 | Prisma                | v6.19         |
| **Base de datos**       | PostgreSQL            | —             |
| **Frontend**            | Next.js + React       | v16.1 / v19.2 |
| **Estilos**             | TailwindCSS           | v4            |
| **State Management**    | TanStack React Query  | v5            |
| **Validación Frontend** | Zod + React Hook Form | —             |
| **Autenticación**       | JWT + Passport        | —             |
| **Almacenamiento**      | Cloudinary            | —             |

---

## ✅ Lo Bien Hecho

1. **Arquitectura modular** — Cada dominio (`auth`, `products`, `sales`, `customers`, `categories`, `reports`, `exports`, `settings`) tiene su módulo, controlador, servicio y DTOs. Sigue correctamente los patrones de NestJS.
2. **DTOs con `class-validator`** — Decoradores `@IsEmail`, `@IsUUID`, `@MinLength`, `@ValidateNested`. `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true`.
3. **Transacciones en ventas** — `prisma.$transaction()` cubre atomicidad entre creación de venta, descuento de stock y movimientos de inventario.
4. **Sistema de auditoría** — `AuditInterceptor` + `@AuditAction()` decorator: registro no invasivo que separa la auditoría de la lógica de negocio.
5. **Manejo de errores centralizado** — `HttpExceptionFilter` unifica errores HTTP, Prisma (`P2002`, `P2025`, `P2003`) y genéricos con formato estándar `{ success, error.code, error.message }`.
6. **RBAC** — `RolesGuard` + `@Roles()` con roles `ADMIN`, `CASHIER`, `INVENTORY_USER`.
7. **Rate Limiting** — Global (100 req/min) + granular en login (10/min) y registro (5/min).
8. **React Query** — Hooks personalizados con `queryKey` granulares e `invalidateQueries` correctos al mutar datos.
9. **API Client centralizado** — Clase `ApiClient` con interceptores para JWT y redirección automática en 401.
10. **Tipos compartidos** — `types/index.ts` centraliza todas las interfaces TypeScript, incluyendo `PaginatedResponse<T>` genérico.
11. **Swagger** — Todos los endpoints documentados con `@ApiOperation`, `@ApiTags`, `@ApiBearerAuth`.
12. **Prisma Schema** — UUIDs como PKs, `Decimal(10,2)` para valores monetarios, campos `active` para soft-delete, `@updatedAt` automático, unique constraints en `email`, `sku`, `barcode`, `documentNumber`, enums correctos.

---

## 🔴 Problemas Críticos

### 1. RBAC incompleto: `@Roles` no se aplica en varios módulos

_(Codex)_

`settings.controller.ts` y `exports.controller.ts` declaran `@Roles('ADMIN')` pero solo tienen `@UseGuards(JwtAuthGuard)` a nivel de clase, **sin `RolesGuard`**. El decorador se ignora silenciosamente.

**Impacto:** Endpoints que aparentan ser "solo ADMIN" no están protegidos por rol.

### 2. JWT Secret con fallback inseguro

_(Ambos)_

```typescript
// jwt.strategy.ts y auth.module.ts
secretOrKey: configService.get('JWT_SECRET') || 'fallback-secret',
```

Si `JWT_SECRET` no está en el entorno, la app arranca con un secreto público conocido. Cualquier atacante puede forjar tokens JWT válidos con el secret `'fallback-secret'`.

**Fix:** Lanzar error si la variable no existe, nunca usar fallback.

### 3. Manipulación de precio en ventas

_(Codex)_

```typescript
// sales.service.ts
const itemSubtotal = item.unitPrice * item.quantity; // unitPrice viene del frontend
```

El precio se acepta desde el cliente en lugar de tomarse de `product.salePrice` en BD. Un atacante puede modificar el request HTTP y enviar `unitPrice: 0.01`.

**Fix:** Ignorar `item.unitPrice` del DTO y usar siempre `product.salePrice`.

### 4. Race condition en `saleNumber`

_(Ambos)_

```typescript
const lastSale = await this.prisma.sale.findFirst({
  orderBy: { saleNumber: "desc" },
});
const saleNumber = lastSale ? lastSale.saleNumber + 1 : 1; // Fuera de transacción
```

Dos ventas simultáneas pueden obtener el mismo `saleNumber`, causando un error de unique constraint.

**Fix:** Mover dentro del `$transaction()` o usar `@default(autoincrement())` en el schema.

### 5. Registro de usuarios abierto al público

_(Antigravity)_

`POST /auth/register` no tiene `JwtAuthGuard` ni `RolesGuard`. Cualquier persona puede crear cuentas con rol `CASHIER`.

**Fix:** Proteger el endpoint o deshabilitarlo en producción.

### 6. `getLowStockProducts` no funciona correctamente

_(Antigravity)_

```typescript
stock: { lte: this.prisma.product.fields.minStock }, // Incorrecto en Prisma
```

Prisma no soporta comparaciones entre columnas de la misma fila en `where`. Necesita `$queryRaw` o filtrado en memoria.

---

## 🟡 Problemas Importantes

### 7. Rutas duplicadas y guard inconsistente en Products

_(Codex)_

`products.controller.ts` y `products-search.controller.ts` comparten rutas `/products/search` y `/products/quick-search`. Además, `ProductsSearchController` tiene solo `RolesGuard` sin `JwtAuthGuard`, lo que puede causar que `request.user` sea `undefined` y falle el guard.

### 8. Bug en filtro de fechas en Exports

_(Ambos)_

```typescript
// exports.service.ts — startDate y endDate se pisan:
if (query.startDate) where.createdAt = { gte: new Date(query.startDate) };
if (query.endDate) where.createdAt = { lte: new Date(query.endDate) }; // Sobrescribe
```

Si ambos filtros están presentes, solo se aplica `endDate`.

### 9. Export de ventas referencia campo inexistente

_(Codex)_

```typescript
// exports.service.ts
sales: (item) => [..., item.paymentMethod, ...] // Campo no existe en el modelo
```

El modelo usa `payments[]` (tabla separada), no `paymentMethod` directo en `Sale`.

### 10. Inconsistencias frontend ↔ backend

_(Codex)_

- `useSales.ts` envía `search` como query param, pero `sales.controller.ts` no lo soporta.
- Un hook llama `GET /exports/inventory`, pero el backend expone `POST` para esa ruta.

Estas features funcionan silenciosamente de forma incorrecta.

### 11. KPIs del Dashboard incluyen ventas canceladas

_(Codex)_

`getDashboardKPIs` y `getSalesByPaymentMethod` no filtran por `status: 'COMPLETED'`, mientras que `getSalesByCategory`, `getTopSellingProducts` y `getDailySales` sí lo hacen. Inconsistencia que distorsiona los KPIs financieros.

### 12. Campo `version` declarado pero no implementado

_(Antigravity)_

```typescript
version Int @default(0) // "Para concurrencia optimista" — nunca se usa en updates
```

### 13. Tipo de movimiento siempre `ADJUSTMENT_IN`

_(Antigravity)_

Al actualizar stock en `products.service.ts`, siempre se registra `ADJUSTMENT_IN` independientemente de si el stock subió o bajó. Debería ser `ADJUSTMENT_OUT` cuando `newStock < previousStock`.

### 14. Eliminación destructiva de productos

_(Antigravity)_

`product.delete()` falla si hay `SaleItem` o `InventoryMovement` asociados. Debería ser siempre un soft delete (`active: false`).

### 15. `any` excesivo + ESLint en estado crítico

_(Ambos)_

- Backend: 257 errores + 3 warnings de ESLint (`any`, `require()`, tipado inseguro).
- Frontend: 3 errores + 17 warnings (incluyendo `react-hooks/set-state-in-effect`).
- `require('jspdf')` en lugar de ESM `import` desactiva el type-checking.
- `eslint-disable` al inicio de archivos en lugar de corregir los tipos.

### 16. `backend/dist` versionado en git

_(Codex)_

208 archivos compilados están siendo trackeados en el repositorio. Añadir `dist/` al `.gitignore` del backend.

### 17. `@faker-js/faker` en `dependencies` de producción

_(Antigravity)_

Librería de seeding/testing en dependencias de producción. Aumenta el bundle sin necesidad. Mover a `devDependencies`.

---

## 🟢 Sugerencias de Mejora

### Seguridad

- **CORS** configurar con `origin` específico en lugar de `app.enableCors()` abierto.
- **Token en localStorage** es susceptible a XSS. Evaluar `httpOnly cookies` para el JWT.
- **Validar token al iniciar app** — `AuthContext` confía ciegamente en `localStorage` sin verificar que el token no expiró.

### Base de Datos

- **Índices faltantes** en `Sale(createdAt, status)` e `InventoryMovement(productId, createdAt)` — son columnas de filtrado frecuente en reportes.
- **`InventoryMovement.saleId`** debería ser una FK explícita con `@relation`.
- **`AuditLog.userId`** no tiene relación formal con `User`, rompiendo trazabilidad si se elimina el usuario.
- **Settings** debería ser un singleton global (sin `userId`), o documentar claramente el diseño por usuario.
- **2 migraciones `_init`** indican historial de migraciones desordenado.
- Usar `@default(autoincrement())` para `saleNumber` en lugar de lógica manual.

### Calidad y Operación

- **Tests** — Añadir tests unitarios para: cálculo de ventas, validación de stock, reportes, guards y autenticación.
- **Paginación en reportes** — `getSalesByPaymentMethod`, `getSalesByCategory` traen todos los registros sin límite.
- **Cache en memoria** (`CacheService` con `Map`) no sobrevive reinicios, no escala horizontalmente y no tiene límite de tamaño. Considerar Redis o `CacheModule` de NestJS.
- **Logger de requests** — Añadir `LoggerMiddleware` o `morgan` para trazabilidad en producción.
- **`generateInvoice`** (236 líneas en `SalesService`) mezcla lógica de negocio con generación de PDF. Extraer a `InvoiceService`.
- **`prisma` CLI** mover a `devDependencies` (solo `@prisma/client` en producción).

---

## 📊 Análisis de Base de Datos

| Aspecto                                 | Estado                                    |
| --------------------------------------- | ----------------------------------------- |
| UUIDs como PKs                          | ✅                                        |
| `Decimal(10,2)` para dinero             | ✅                                        |
| Soft-delete con `active`                | ✅ Parcial (no en todos los modelos)      |
| Unique constraints                      | ✅                                        |
| Enums tipados                           | ✅                                        |
| Índices en columnas de filtro frecuente | ❌ Faltan                                 |
| FKs explícitas en todas las relaciones  | ❌ `saleId` en `InventoryMovement` sin FK |
| `onDelete` cascade definido             | ❌ Default implícito                      |
| `AuditLog` relacionado a `User`         | ❌ Relación informal                      |

---

## 📊 Evaluación Final Comparada

| Categoría         | Antigravity |   Codex    |   Consenso   |
| ----------------- | :---------: | :--------: | :----------: |
| Arquitectura      |    8/10     |    7/10    |  **7.5/10**  |
| Lógica de negocio |    6/10     |    6/10    |   **6/10**   |
| APIs / Contratos  |    8/10     |   5.5/10   | **6.5/10** ¹ |
| Base de datos     |    7/10     |    7/10    |   **7/10**   |
| Seguridad         |    5/10     |     —      |   **5/10**   |
| Testing / Calidad |    2/10     |   4.5/10   |   **3/10**   |
| **Global**        | **~6.2/10** | **6.5/10** | **~6.3/10**  |

> ¹ Codex tiene más razón en APIs/Contratos al detectar inconsistencias frontend↔backend silenciosas.

---

## Veredicto Consolidado

El proyecto tiene una **base arquitectónica sólida y profesional** — modular, stack moderno, dominio bien modelado. Es funcional como **demo/MVP académico** y demuestra buen conocimiento de NestJS, Prisma y React.

Sin embargo, presenta **riesgos importantes para producción**:

1. 🔴 **Seguridad**: JWT fallback, registro abierto, precios manipulables desde cliente, RBAC silenciosamente ignorado.
2. 🔴 **Consistencia de datos**: race condition en `saleNumber`, filtros de fechas rotos, KPIs con datos incorrectos.
3. 🟡 **Calidad operativa**: 257 errores de lint, prácticamente sin tests, cache no escalable.

**Prioridad de acción recomendada:**

1. Corregir JWT secret sin fallback
2. Corregir manipulación de precio (tomar de BD)
3. Corregir RBAC en settings y exports controllers
4. Corregir `saleNumber` con autoincrement o dentro de transacción
5. Corregir filtros de fecha en exports
6. Añadir tests para lógica de ventas
