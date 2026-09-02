# Project Baseline — MeperPOS

> **Documento de referencia**: estado actual del monorepo, verificado contra el código.
> **Fecha**: 2026-09-02 · **Rol**: fuente de verdad para la siguiente fase de auditoría (Audit Findings).
> **Convenciones**: `FACT` = confirmado directamente en el repositorio; `INFERENCE` = inferencia razonable basada en evidencia; `UNKNOWN` = no pudo confirmarse.
> Este documento describe **qué existe y cómo funciona**. No contiene juicios, recomendaciones ni propuestas de cambio.

---

## 1. Overview

`MeperPOS` es un sistema full-stack de gestión de inventario con módulo Point of Sale (POS), orientado a un negocio colombiano (moneda COP, locale `es-CO`, zona horaria `America/Bogota`).

- [FACT] Estructura de monorepo con **dos aplicaciones npm independientes** (sin workspace tooling raíz):
  - `backend/` — API REST NestJS 11 + Prisma 6 + PostgreSQL (puerto 3001).
  - `frontend/` — SPA Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 (puerto 3000).
- [FACT] El backend es **multi-tenant por organización** (`Organization`), con roles por organización, planes (`BASIC`/`PRO`), estados de facturación y límites por plan.
- [FACT] Autenticación JWT híbrida: access token en memoria + cookie httpOnly + refresh token rotativo (detalle en §11).
- [FACT] Alcance funcional (según módulos y páginas): inventario/Productos, POS/Ventas, Compras/Órdenes de compra, Proveedores, Gastos/Expensas, Clientes, Categorías, Reportes/Financiero, Tareas, Settings por organización, Administración SuperAdmin, import/export, impresión de recibos.
- [FACT] La documentación raíz (`AGENTS.md`/`CLAUDE.md`) está **sustancialmente desactualizada** frente al código actual (ver §17 y contradicciones en §16).
- [UNKNOWN] Estado real de bases de datos desplegadas y volúmenes de datos; configuración actual de plataformas (Railway/Vercel/Supabase/Cloudinary) no está versionada.

---

## 2. Repository Structure

```
MeperPOS/
├── backend/                      # API NestJS (app npm independiente)
│   ├── prisma/
│   │   ├── schema.prisma         # 23 modelos + 15 enums (fuente de datos)
│   │   ├── migrations/           # 29 migraciones (20260119 → 20260901)
│   │   ├── seed.ts               # Seed demo dev (SuperAdmin + 2 orgs faker)
│   │   └── seed-org.ts           # Seed determinista por organización
│   ├── src/
│   │   ├── main.ts               # Bootstrap (ValidationPipe, filtro global, Swagger dev)
│   │   ├── app.module.ts         # Módulo raíz; APP_GUARD Throttler→CSRF→OrgStatus
│   │   ├── app-configuration.ts  # helmet + cookieParser + prefijo /api
│   │   ├── admin/                # Plataforma SuperAdmin (orgs, planes, métricas)
│   │   ├── auth/                 # Login, refresh, selección de org, JWT, cookies
│   │   ├── billing/              # Estado de facturación, PaymentRecord, scheduler (no-op)
│   │   ├── cash-registers/       # Cajas registradoras
│   │   ├── categories/           # Categorías de producto
│   │   ├── cloudinary/           # Subida de imágenes (Cloudinary + fallback local)
│   │   ├── common/               # Guards, decorators, interceptors, filtros, cache, sequences, utils
│   │   ├── config/               # runtime-env (validación JWT_SECRET)
│   │   ├── customers/            # Clientes
│   │   ├── expenses/             # Gastos + expense-categories + pagos parciales
│   │   ├── exports/              # Exportación CSV/XLSX/PDF
│   │   ├── imports/              # Importación Excel (productos; multi-sheet)
│   │   ├── plan-limits/          # Cuotas por plan (BASIC/PRO)
│   │   ├── prisma/               # PrismaService (@Global)
│   │   ├── products/             # CRUD productos + search + upload
│   │   ├── purchase-orders/      # Órdenes de compra (confirm/receive/cancel)
│   │   ├── receipts/             # PDF recibo 80mm (jsPDF)
│   │   ├── reports/              # Reportes + agregador financiero + golden fixtures
│   │   ├── sales/                # Ventas multi-pago, numeración, recibos
│   │   ├── settings/             # Engine JSON tipado en Organization.settings
│   │   ├── suppliers/            # Proveedores
│   │   ├── tasks/                # Tareas + TaskEvent (timeline inmutable)
│   │   ├── testing/              # two-org-fixture (tests de integración)
│   │   └── users/                # Gestión de usuarios de la organización
│   ├── test/
│   │   ├── jest-e2e.json         # Config E2E
│   │   ├── *.e2e-spec.ts         # 3 specs E2E
│   │   └── fixtures/             # receipts/ + reports-golden/ (golden baselines)
│   ├── docker-compose.yml        # Solo Postgres local (dev)
│   ├── scripts/                  # Helpers operativos (ping-supabase, validate-*, etc.)
│   ├── package.json              # Scripts + jest config + dotenv-cli
│   └── .env / .env.development / .env.production / .env.example
├── frontend/
│   ├── src/
│   │   ├── app/                  # App Router (rutas/páginas)
│   │   ├── components/           # ui/, layout/, auth/, pos/, expenses/, etc.
│   │   ├── contexts/             # AuthContext, ThemeContext, ToastContext
│   │   ├── hooks/                # 1 archivo por dominio (TanStack Query)
│   │   ├── lib/                  # api.ts, utils.ts, auth.ts, session.ts, etc.
│   │   └── types/                # types/index.ts (interfaces duplicadas a mano)
│   ├── next.config.ts            # React Compiler, Turbopack, image loader, security headers
│   ├── vitest.config.ts          # jsdom + Testing Library + quarantine list
│   └── package.json              # Scripts dev/build/start/lint/test
├── docs/                         # Documentación del proyecto (ver §15)
├── openspec/                     # OpenSpec config + changes/multi-tenant-completion
├── .github/workflows/ci.yml      # CI (2 jobs: backend + frontend)
├── AGENTS.md / CLAUDE.md         # Byte-idénticos y desactualizados
├── README.md / README.en.md      # Docs de alto nivel (parcialmente desactualizados)
├── .gitignore
└── node_modules/                 # Solo .vite/ cache — no es workspace install
```

---

## 3. Technology Stack

| Capa | Tecnología | Evidencia |
|---|---|---|
| Backend framework | NestJS 11 (`@nestjs/common`, core, cli) | `backend/package.json` |
| ORM | Prisma 6.19 (`@prisma/client`, `prisma`) | `backend/package.json`, `schema.prisma` |
| Base de datos | PostgreSQL (local docker v15, CI v17, prod Supabase) | `docker-compose.yml`, `ci.yml`, runbook |
| AuthN | passport-jwt + @nestjs/jwt + bcryptjs; cookies httpOnly | `backend/src/auth/` |
| AuthZ | Guards + decorators `@Roles` + `@PlanLimit`; OrgStatus/CSRF | `backend/src/common/` |
| Validación | class-validator + class-transformer (DTOs) | `main.ts` |
| Frontend | Next.js 16.1.3 App Router + React 19.2.3 | `frontend/package.json` |
| Estilos | Tailwind v4 (PostCSS, sin tailwind.config) + CSS variables + React Compiler | `frontend/` |
| Estado servidor | TanStack Query v5 (`@tanstack/react-query`) | `frontend/package.json` |
| Estado cliente | Context: Auth, Theme, Toast | `frontend/src/contexts/` |
| Forms | react-hook-form + zod (declarados, **sin uso en código**) | `frontend/package.json` (ver §16) |
| HTTP | Axios (instancia singleton con interceptores) | `frontend/src/lib/api.ts` |
| Testing backend | Jest 30 + ts-jest (+ supertest) | `backend/package.json` |
| Testing frontend | Vitest 4 + Testing Library + jsdom | `frontend/package.json` |
| Doc API | Swagger (solo `NODE_ENV !== production`, `/api/docs`) | `backend/src/main.ts` |
| Integración imágenes | Cloudinary (con fallback local) | `backend/src/cloudinary/` |
| Exports | exceljs (XLSX), @fast-csv/format (CSV), jspdf (PDF) | `backend/package.json` |

[FACT] Node: CI usa Node 22. No hay `.nvmrc`/`engines` (ver §16).

---

## 4. Monorepo Architecture

- [FACT] **No existe workspace monorepo**: no hay `package.json` raíz, ni pnpm/yarn/lerna/turbo. `backend/` y `frontend/` son paquetes npm independientes con su propio `package-lock.json`.
- [FACT] **Comunicación**: frontend consume backend únicamente por HTTP (Axios → `/api`), con `NEXT_PUBLIC_API_URL` (default `http://localhost:3001/api`). No hay paquete compartido de tipos/contratos.
- [FACT] Prefijo global de API: `app.setGlobalPrefix('api')` en `backend/src/app-configuration.ts`.
- [FACT] Los scripts backend cargan env por archivo con `dotenv-cli -e` (`.env.development` para dev/test, `.env.production` para build/prod).
- [INFERENCE] La separación en dos apps independientes es intencional para deploys separados (Vercel + Railway), a costa de tipos duplicados manualmente.
- [FACT] `openspec/` (config + change `multi-tenant-completion`) existe en el repo y se usa para el flujo SDD híbrido engram+openspec (`openspec/config.yaml`).

---

## 5. Frontend Architecture

### 5.1 Páginas / Routing (App Router)

- [FACT] Rutas (archivos verificados en `frontend/src/app/`):
  `/` (redirect auth), `/login`, `/register` (deshabilitado), `/dashboard`, `/pos`, `/inventory`, `/sales` + `/sales/[id]`, `/customers`, `/categories`, `/suppliers`, `/purchase-orders` + `/new` + `/[id]`, `/expenses`, `/reports`, `/tasks`, `/profile`, `/users` (redirect a `/settings/team`), `/admin` + `/admin/organizations` + `/[id]`, `/settings` (grupo: general, invoicing, team, data, billing, locale, advanced).
- [FACT] **No existe middleware** de Next: el guard de rutas es 100% cliente (`AuthContext` + `DashboardLayout` + mapa `routeRoleMap` en `components/layout/DashboardLayout.tsx`).
- [FACT] No hay `loading.tsx`/`error.tsx`/`not-found.tsx` de ruta; los estados de carga/error son inline por página.
- [FACT] Patrón de página: casi todas son componentes cliente grandes de un solo archivo que poseen estado, mutaciones, modales y paginación (`pos/page.tsx` 1486 líneas, `tasks/page.tsx` 1095, `inventory/page.tsx` 906, `expenses/page.tsx` 743). No hay split container/presentational.
- [FACT] Layout de dashboard: `DashboardLayout` + `Sidebar` (320px desktop, drawer mobile), renderizados explícitamente por cada página; offset `lg:ml-[320px]`.
- [FACT] Zona admin: `app/admin/layout.tsx` con shell propio (solo SUPER_ADMIN), top nav (Ir al Panel, Dashboard, Organizaciones).
- [FACT] Modales pesados se cargan lazy con `next/dynamic` + `prefetchOnIdle`.

### 5.2 Componentes

- [FACT] `components/ui/` — primitivas compartidas: Button, Input, Select, Modal, Card, Badge, ConfirmDialog, ImageUpload, Table, Pagination, FilterBar, LoadingState, EmptyState, DynamicFallback, BentoSelect, CurrencyInput, MetricCard, Stepper. Todas aceptan `className` y usan `cn()`.
- [FACT] `components/layout/`: DashboardLayout, Sidebar. `components/providers/`: QueryProvider. `components/auth/`: AuthCard, OrganizationSwitcher, OrganizationSelectModal. `components/billing/`: PlanLimitBanner.
- [FACT] Componentes por dominio: `pos/` (PaymentConfirmationModal, PaymentMethodCards, QuickAmountButtons, MobileCartDrawer, MobileCartFloatingBar, ThermalReceipt), `products/ProductCard`, `purchase-orders/`, `expenses/`, `imports/`, `dashboard/`, `categories/`, `users/UsersManagementPage`.
- [FACT] `DashboardLayout` muestra `PlanLimitBanner` (conexión backend plan-limits).

### 5.3 Estado / Data fetching

- [FACT] TanStack Query: un `QueryClient` (`QueryProvider`) con `staleTime: 60_000`, `refetchOnWindowFocus: false`. Mutaciones invalidan sus query keys.
- [FACT] Hooks por recurso en `hooks/` (21 archivos): useProducts, useCustomers, useCategories, useSuppliers, useSales, useReports, usePurchaseOrders, useExpenses, useTasks, useUsers, useSettings, useAdmin, useBilling, usePlanLimits, useImport, useProfile, usePausedSales, useReceipt, etc.
- [FACT] Contexts: `AuthContext` (sesión, organización, login/logout/switch), `ThemeContext` (dark/light con `localStorage.theme` y `prefers-color-scheme`), `ToastContext` (notificaciones 3.5 s).
- [FACT] localStorage: `theme`, `user` (solo caché de display), `pos_favorite_product_ids`, `paused_sales`, `selectedOrganizationId`. Los tokens legacy `token`/`refreshToken` se eliminan activamente.

### 5.4 API client

- [FACT] `src/lib/api.ts` — `ApiClient` singleton axios: baseURL `NEXT_PUBLIC_API_URL || http://localhost:3001/api`, `withCredentials: true`, inyecta `Authorization: Bearer` (token en memoria) y `X-Organization-Id`; en verbos mutantes envía `x-csrf-token`; en 401 (excepto endpoints auth y retries) hace refresh single-flight y reintenta una vez; expone helpers `get/postWithFormData/put/patch/delete/upload/exportData/downloadData` y `getApiErrorMessage`.
- [FACT] `src/lib/session.ts` — token de acceso solo en memoria (se pierde al recargar; se restaura vía refresh cookie).
- [FACT] `src/lib/auth.ts` — tipos de rol + `getEffectiveRoles`/`hasAnyRole`; jerarquía OWNER⊃ADMIN⊃MEMBER⊃CASHIER; SUPER_ADMIN hereda todo.
- [FACT] `src/lib/utils.ts` — `cn()`, `formatCurrency` (COP), `formatDate/formatDateTime`, helpers fecha Bogotá, `resolveTaxFields`, `PAYMENT_METHOD_LABELS`.

### 5.5 Validación (frontend)

- [FACT] react-hook-form + zod + @hookform/resolvers están **instalados pero no importados en ningún archivo de src/** (grep sin coincidencias). La validación es imperativa manual en handlers (`profile`, `login`, formularios `<form onSubmit>`).
- [FACT] No hay schemas zod en el frontend.

### 5.6 Tipos

- [FACT] `src/types/index.ts` (681 líneas): interfaces manuales de dominio (Product, Category, Customer, Sale, Settings, PurchaseOrder, Expense, etc.). Sin paquete compartido con backend — duplicadas a mano.
- [FACT] Roles duplicados en tres lugares con formas que no coinciden del todo: `lib/auth.ts` (`AppRole` incl. SUPER_ADMIN), `types/index.ts` (`User` sin SUPER_ADMIN/OWNER consistentes), `AuthContext.tsx` (interfaces propias User/Organization). (Observación, no juicio.)

### 5.7 Manejo de errores

- [FACT] Errores de API → `useToast().error(getApiErrorMessage(error, fallback))`; lecturas fallidas inline; sin ErrorBoundary global ni `error.tsx`.
- [FACT] Tipos de UI de estado: `LoadingState`, `EmptyState`, `DynamicFallback` (spinner para lazy modals).

---

## 6. Backend Architecture

### 6.1 Bootstrap / Config

- [FACT] `main.ts`: `validateJwtSecretOrExit` (prod aborta si JWT_SECRET falta o < 32 chars), `NestFactory.create`, `configureApp` (helmet sin CSP, cookieParser, prefijo `/api`), CORS inline con `CORS_ORIGIN`, ValidationPipe global `{ whitelist, forbidNonWhitelisted, transform, enableImplicitConversion }`, `HttpExceptionFilter` global, Swagger solo dev.
- [FACT] `app.module.ts`: ConfigModule global, ThrottlerModule global (100 req/min), módulos globales `CacheModule`, `PrismaModule`, `CloudinaryModule` (`@Global()`), y módulos de dominio.
- [FACT] Guards globales vía `APP_GUARD` en orden: **ThrottlerGuard → CookieCsrfGuard → OrganizationStatusGuard**. No hay JwtAuthGuard global (auth por ruta).
- [FACT] `GET /api/health` (`app.controller.ts`): `SELECT 1` → 503 si falla. `GET /` responde texto.

### 6.2 Inventario de módulos (routes/roles/dominio)

| Módulo | Prefijo | Roles (ruta) | Responsabilidad principal |
|---|---|---|---|
| auth | `auth` | login público, resto JWT | Login, refresh, logout, profile, change-password, select-organization, select-org |
| users | `users` | ADMIN | CRUD usuarios org, toggle-active, reset-password, PlanLimit('users') |
| admin | `admin` | SUPER_ADMIN | Orgs CRUD, status/plan, members, transfer-owner, metrics |
| categories | `categories` | ADMIN, MEMBER | CRUD categorías |
| products | `products` | ADMIN, MEMBER (+CASHIER en quick-search) | CRUD, low-stock, search, upload, concurrencia `version` |
| customers | `customers` | ADMIN, MEMBER, CASHIER | CRUD clientes, búsqueda por documento |
| sales | `sales` | ADMIN, MEMBER, CASHIER | Crear venta multi-pago, listar (scoping por rol), force-close, receipt |
| reports | `reports` | ADMIN | Dashboard KPIs, económico, cash flow, inventario, top-selling, etc. |
| settings | `settings` | ADMIN | GET/PUT settings org, logo, organización, receipt-prefix |
| exports | `exports` | ADMIN | Export CSV/XLSX/PDF por entidad |
| imports | `imports` | ADMIN, CASHIER | Templates + import Excel (full multi-sheet) |
| cloudinary | (uso servicio) | — | Subida imágenes con fallback local |
| cash-registers | `cash-registers` | ADMIN | CRUD cajas, PlanLimit('cashRegisters') |
| billing | `billing` | ADMIN/OWNER (+SUPER_ADMIN en payments) | Estado facturación, payment records |
| plan-limits | `plan-limits` | JWT | GET status de límites |
| suppliers | `suppliers` | ADMIN, MEMBER | CRUD proveedores |
| purchase-orders | `purchase-orders` | ADMIN, MEMBER | PO DRAFT→PENDING→RECEIVED; receive crea movimientos |
| expenses | `expenses` | ADMIN | Gastos, pagos parciales, soft-delete, recibos Cloudinary |
| expense-categories | `expense-categories` | ADMIN | CRUD categorías de gasto |
| tasks | `tasks` | todos los roles | Tareas + timeline TaskEvent |

Nota [FACT]: **`products-search.controller.ts` es código muerto no registrado**; el search real vive en `ProductsController` (ADMIN/MEMBER). No hay ruta pública `register` (solo método de servicio).

### 6.3 Patrón controller típico

- [FACT] Stack estándar por controller: `@UseGuards(JwtAuthGuard, RolesGuard, OrganizationRequiredGuard[, PlanLimitGuard])` + interceptor `AdminOrganizationInterceptor` + `@Roles(...)`; decoradores `@CurrentUser`, `@AuditAction`, `@PlanLimit`.
- [FACT] Scoping por organización: los services reciben `organizationId` del JWT y usan `findFirst({ id, organizationId })` (guarda de fila por tenant).
- [FACT] Scoping por rol en ventas: `buildScopeFilter` — ADMIN ve todas; no-ADMIN solo las propias (deny-by-default).
- [FACT] Service → `PrismaService` directo (no hay capa repository separada).

### 6.4 Flujo de una petición autenticada (entrada → persistencia → respuesta)

1. [FACT] HTTP → Express: helmet → cookie-parser → prefijo `/api` (`app-configuration.ts`).
2. [FACT] Guards globales `APP_GUARD`: Throttler (100/min; login 10/min) → CookieCsrf (double-submit; omite GET/HEAD y si hay Bearer) → OrganizationStatus (bloquea escrituras si `SUSPENDED`).
3. [FACT] Guards de ruta: JwtAuthGuard (valida JWT + usuario activo + tokenVersion + membresía org) → RolesGuard (hereda roles: OWNER→ADMIN→MEMBER→CASHIER) → OrganizationRequiredGuard (exige orgId salvo SuperAdmin) → PlanLimitGuard (si aplica).
4. [FACT] Interceptores: `AdminOrganizationInterceptor` (SuperAdmin elige org por header `x-organization-id`); `AuditInterceptor` donde hay `@AuditAction` (escribe `AuditLog` post-éxito, fire-and-forget).
5. [FACT] Controller valida DTO (ValidationPipe) → Service → PrismaService (transacciones `$transaction`, secuencias con `SELECT ... FOR UPDATE`) → respuesta.
6. [FACT] Errores → `HttpExceptionFilter` con forma `{ success:false, error:{ code, message, details?, statusCode, timestamp, path } }`.

---

## 7. Domain Map

| Dominio | Propósito | Backend | Frontend | Datos |
|---|---|---|---|---|
| Identidad/AuthN | Login, refresh, selección org, sesión | auth | contexts/AuthContext, api.ts, login | User, RefreshToken, cookies |
| Multi-tenant | Aislamiento por organización, roles, planes, estados | admin, plan-limits, billing, guards | admin/, settings/(billing), PlanLimitBanner | Organization, OrganizationUser, PaymentRecord |
| Usuarios | Miembros y roles de la org | users | settings/(team) → UsersManagementPage | User, OrganizationUser |
| Productos/Catálogo | CRUD, stock, precios, promociones, impuestos | products, categories | inventory/, categories/, pos (búsqueda) | Product, Category, InventoryMovement |
| Ventas/POS | Carrito, pagos mixtos, numeración, impresión | sales, receipts, cash-registers | pos/, sales/, sales/[id] | Sale, SaleItem, Payment, SaleItem.costPriceSnapshot |
| Clientes | Cartera de clientes y segmentos | customers | customers/ | Customer |
| Compras | Órdenes de compra y recepción | purchase-orders, suppliers | purchase-orders/, suppliers/ | PurchaseOrder, PurchaseOrderItem, Supplier |
| Gastos | Egresos con pagos parciales y categorías | expenses, expense-categories | expenses/ | Expense, ExpensePayment, ExpenseCategory |
| Reportes/Financiero | KPIs, económico, cash flow, inventario | reports, exports | reports/, dashboard/ | Sale+SaleItem, InventoryMovement, Expense, Customer |
| Tareas | Gestión interna con timeline | tasks | tasks/ | Task, TaskEvent |
| Configuración | Parametrización por org | settings | settings/* | Organization.settings (JSON tipado) |
| Datos externos | Import/export, imágenes, recibos | imports, exports, cloudinary, receipts | settings/(data), components/imports | Jobs en memoria (imports); Cloudinary/local uploads |

---

## 8. Data Architecture

### 8.1 Modelo de datos

- [FACT] **23 modelos / 15 enums** en `backend/prisma/schema.prisma` (591 líneas). Todos los PK son `String @default(uuid())`.
- [FACT] Modelos: Organization (raíz tenant), User, OrganizationUser, RefreshToken, OrganizationSequence, CashRegister, Category, Product, InventoryMovement, Customer, Sale, Payment, SaleItem, Task, TaskEvent, Supplier, PurchaseOrder, PurchaseOrderItem, AuditLog, PaymentRecord, ExpenseCategory, Expense, ExpensePayment.
- [FACT] Enums: OrgStatus, PlanType, BillingStatus, OrgRole, PromotionType, MovementType, CustomerSegment, PaymentMethod, SupplierAccountType, ExpensePaymentStatus, PaymentRecordStatus, SaleStatus, TaskStatus, TaskEventType, PurchaseOrderStatus.
- [FACT] Multi-tenant: **`organizationId` NOT NULL en todos los modelos de dominio**; FK a Organization con `onDelete: Cascade`. Membresía vía `OrganizationUser` (`@@unique([userId, organizationId])`, `role OrgRole`, `isPrimaryOwner`).
- [FACT] Money: `Decimal`; productos/ventas `Decimal(10,2)`, órdenes/gastos `Decimal(12,2)`; stock `Int`.
- [FACT] Unicidad e índices **por organización**: `Product(organizationId,sku)`, `Sale(organizationId,saleNumber)`, `InventoryMovement(organizationId,productId,createdAt)`, etc.

### 8.2 Concurrencia y numeración

- [FACT] Concurrencia optimista en `Product.version` (update con `where { id, version }`, `version: { increment: 1 }`). Recepción de PO usa el mismo patrón sobre stock/costo.
- [FACT] Decremento de stock en venta: `updateMany` atómico con guard `stock >= qty` dentro de transacción Serializable.
- [FACT] Numeración de ventas (SALE) y órdenes (PO) por org/año: `OrganizationSequence` + raw `SELECT ... FOR UPDATE` en `SequenceService`, dentro de `$transaction` Serializable.

### 8.3 Transacciones y raw SQL

- [FACT] `$transaction` interactivo (Serializable, maxWait 5000, timeout 10000) en sales, purchase-orders, expenses, tasks; array-form en auth/admin. P2028 → `ServiceUnavailableException`.
- [FACT] Raw SQL solo en 4 puntos: sequence FOR UPDATE, low-stock list, dashboard low-stock count, health `SELECT 1`.

### 8.4 Migraciones

- [FACT] **29 migraciones** (20260119 → 20260901 `refresh_token_org_binding`); `migration_lock.toml` provider postgresql. Incluye: migración multi-tenant (agrega `organizationId` a ~15 tablas, reemplaza unicidades globales por compuestas, introduce OrganizationUser/OrganizationSequence/RefreshToken, **drop de tabla `Settings`**, drop de secuencias autoincrement en favor de OrganizationSequence), backfill de categorías de gasto por org, backfill PlanType, enum growth (CASHIER/INVENTORY_USER), `SaleItem.costPriceSnapshot`.
- [UNKNOWN] Estado de sync de la BD viva con `_prisma_migrations` (no inspeccionable read-only).

### 8.5 Seeds

- [FACT] `seed.ts`: guard `NODE_ENV==='development'`; crea SuperAdmin `admin@sistema.com/admin123`; en dev crea 2 orgs demo (Cafetería Demo BASIC + Supermercado Demo PRO) con productos/categorías/clientes/ventas/sequences/caja/expense categories.
- [FACT] `seed-org.ts`: dirigido por `SEED_ORG_SLUG/ID` o `TARGET_EMAIL`; catálogo determinista idempotente (upserts); guard dev/test o `SEED_ALLOW_NON_DEV=true`.

---

## 9. API Architecture

- [FACT] Endpoints agrupados por módulo bajo prefijo global `/api` (ver tabla §6.2 y mapa de endpoints consumidos por hooks en §10).
- [FACT] Contratos de entrada: DTOs `class-validator`, ValidationPipe global whitelist + forbidNonWhitelisted + transform.
- [FACT] Formato de error unificado (HttpExceptionFilter): `{ success:false, error:{ code, message, details?, statusCode, timestamp, path } }`. Códigos: clase de excepción en mayúsculas (UNAUTHORIZED, BAD_REQUEST, ...) o mapeos Prisma (DUPLICATE_RECORD P2002, NOT_FOUND P2025, FOREIGN_KEY_ERROR P2003, DATABASE_ERROR).
- [FACT] Paginación estándar: respuesta `{ data, meta: { total, page, limit, totalPages } }`.
- [FACT] Descarga de archivos: `@Res()` streaming (PDF recibos, CSV/XLSX exports con BOM `\uFEFF` en CSV).
- [FACT] Swagger en `/api/docs` solo con `NODE_ENV !== 'production'`; `docs/authorization-matrix.md` validada por `matrix-coverage.spec.ts` contra el documento OpenAPI.

---

## 10. Frontend ↔ Backend Flows

### 10.1 Mapa de endpoints consumidos por hooks del frontend

| Recurso | Endpoints (método y path bajo /api) | Hook frontend |
|---|---|---|
| Productos | GET `/products`, `/products/{id}`, `/products/low-stock`, `/products/search`, `/products/quick-search`; POST `/products`, `/products/upload`, `/products/{id}/upload`; PUT `/products/{id}` (+`/deactivate`, `/reactivate`); DELETE `/products/{id}` | useProducts |
| Categorías | CRUD `/categories` | useCategories |
| Clientes | CRUD `/customers`; GET `/customers/document/{doc}` | useCustomers |
| Proveedores | CRUD `/suppliers` | useSuppliers |
| Ventas | GET `/sales`, `/sales/{id}`, `/sales/number/{n}`; POST `/sales`; PUT `/sales/{id}`; POST `/sales/{id}/receipt` | useSales, useReceipt |
| Reportes | GET `/reports/dashboard`, `/reports/economic`, `/reports/economic/cash`, `/reports/economic/inventory`, `/reports/sales/payment-method`, `/reports/sales/category`, `/reports/sales/category-daily`, `/reports/products/top-selling`, `/reports/customers/statistics`, `/reports/sales/daily` | useReports |
| Órdenes de compra | CRUD `/purchase-orders`; POST `/{id}/confirm|receive|cancel` | usePurchaseOrders |
| Gastos | `/expenses` list/detail/summary/monthly/history + create/patch/delete/payments/duplicate/upload; `/expense-categories` CRUD | useExpenses |
| Tareas | GET `/tasks`, `/tasks/assignees`, `/tasks/{id}/timeline`; POST `/tasks`; PUT `/tasks/{id}` + `/status`; DELETE `/tasks/{id}` | useTasks |
| Usuarios | `/users` CRUD + toggle-active/reset-password | useUsers |
| Settings | GET/PUT `/settings`; POST `/settings/logo`; PATCH `/settings/organization`, `/settings/receipt-prefix` | useSettings |
| Admin | `/admin/metrics`; `/admin/organizations` + `/{id}` + status/plan/members | useAdmin |
| Billing/Plan | GET `/billing/status`, `/billing/payments`; POST `/billing/payments`; GET `/plan-limits/status` | useBilling, usePlanLimits |
| Import | POST `/imports/full|products`; GET `/imports/{jobId}/status`; POST `/imports/{jobId}/retry-row`; GET `/imports/*-template` | useImport |
| Export | POST `/exports/{type}`; GET `/exports/inventory?format=json` | useExportData/useSettings |
| Auth | POST `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/select-organization`, `/auth/select-org`, `/auth/change-password`; GET/PUT `/auth/profile` | AuthContext, useProfile |

### 10.2 Contratos y serialización

- [FACT] **No hay tipos compartidos**: el frontend mantiene interfaces manuales (`src/types/index.ts`) que replican las respuestas del backend; el backend genera su propio shape desde Prisma/DTOs. Riesgo de drift es una observación, no juicio.
- [FACT] Fechas: se serializan ISO; el frontend convierte a es-CO con helpers de zona Bogotá; los reportes backend agrupan por día Bogotá.
- [FACT] Montos: el backend envía Decimal (serializado por JSON como string o number según contexto); el frontend usa `formatCurrency` (COP, 0 decimales) y helpers `safeDecimalNumber`/`formatReportMoney`.
- [FACT] Errores: el frontend interpreta `getApiErrorMessage` sobre la forma unificada del filtro de excepciones.

### 10.3 Flujo ejemplo (funcionalidad transversal)

**Crear una venta desde el POS (frontend → backend → DB):**
1. [FACT] `pos/page.tsx` arma `CartItem[]`; al confirmar invoca `useCreateSale` (hooks/useSales) → `api.post('/sales', payload)`.
2. [FACT] Axios inyecta `Authorization: Bearer` (token en memoria) y `X-Organization-Id`; verbo mutante envía `x-csrf-token`.
3. [FACT] Backend: guards globales (throttler → CSRF → org status) → `SalesController` → `JwtAuthGuard`/Roles/OrgRequired → DTO validado → `SalesService.create`.
4. [FACT] `SalesService.create` (Serializable tx): valida org/productos/impuestos/promociones; `SequenceService.nextNumber` (SALE); `sale.create`; por item `saleItem.create` + `product.updateMany` (stock decrement con guard); `inventoryMovement.create` (SALE, previous/new stock); `payment.create` por método; post-commit limpia `cache.clear('dashboard:')`.
5. [FACT] Respuesta → sale hidratada; frontend invalida queries `sales`, `products`, `dashboard`.
6. [FACT] Impresión: `POST /sales/{id}/receipt` genera PDF 80mm (ReceiptsService/jsPDF) o el frontend usa `useReceipt.printThermalReceipt` (HTML térmico local).

---

## 11. Authentication & Authorization

### 11.1 Autenticación

- [FACT] Login `POST /api/auth/login` (rate limit 10/min): verifica bcrypt (`BCRYPT_ROUNDS=12`), valida `active`, devuelve access token + emite cookies httpOnly + refresh token.
- [FACT] Tokens: access JWT 30 min (claims: sub, email, organizationId, role, tokenVersion) HS256; refresh token opaco 40 bytes (guardado SHA-256) 7 días, **cookie-only**, rotación con revocación, grace 60 s para tabs concurrentes, ligado a `organizationId`.
- [FACT] Cookies (`cookies.helper.ts`): `access_token` (httpOnly, path `/`), `refresh_token` (httpOnly, path `/api/auth`), `csrf_token` (leíble por JS). Prod: `SameSite=None; Secure`; dev: `SameSite=Lax`.
- [FACT] Frontend guarda el access token **solo en memoria** (`session.ts`) y lo restaura con refresh single-flight en 401; elimina keys legacy de localStorage.
- [FACT] `POST /auth/refresh` renueva; `POST /auth/logout` revoca; `POST /auth/change-password` rota tokenVersion.
- [FACT] **No existe ruta pública de registro** (`register` solo método de servicio; frontend `/register` deshabilitado "contacta un admin").
- [FACT] Org: multi-org → pre-auth JWT (5 min) + `POST /auth/select-organization`; switch en sesión → `POST /auth/select-org` (revoca y reemite ligado a nueva org).

### 11.2 Autorización

- [FACT] Roles: `OrgRole` OWNER/ADMIN/MEMBER/CASHIER/INVENTORY_USER (+ SuperAdmin como flag `User.isSuperAdmin`, no enum). OWNER se mapea legacy a ADMIN en validateUser.
- [FACT] Jerarquía en RolesGuard: OWNER→[OWNER,ADMIN,MEMBER,CASHIER]; ADMIN→[ADMIN,MEMBER,CASHIER]; MEMBER→[MEMBER,CASHIER].
- [FACT] Enforcement: decoradores `@Roles` por ruta/controller; scoping de datos por servicio (sales por rol; resto org-scoped); `OrganizationStatusGuard` bloquea escrituras a orgs SUSPENDED; `OrganizationRequiredGuard` exige orgId salvo SuperAdmin; `AdminOrganizationInterceptor` permite a SuperAdmin impersonar org por header.
- [FACT] Plan limits: `@PlanLimit(type)` + PlanLimitGuard; BASIC max 3 users/100 products/50 customers/1 cash-register; PRO ilimitado + `hasForceClose`.
- [FACT] `docs/authorization-matrix.md` (viviente) + CI (`matrix-coverage.spec.ts`) contra OpenAPI; `docs/url-identifier-policy.md` documenta que los IDs en URL nunca son authz.

---

## 12. Integrations

| Integración | Uso | Módulo(s) | Notas |
|---|---|---|---|
| Cloudinary | Imágenes de productos, logos, recibos de gasto | cloudinary, products, settings, expenses | Fallback local (`CLOUDINARY_FALLBACK_LOCAL=true` o error de red). Frontend custom image loader apunta a Cloudinary. [FACT] `uuid` se importa en cloudinary.service.ts sin estar en dependencies (transitivo — ver §16) |
| Excel (exceljs) | Export XLSX + import multi-sheet | exports, imports | Import con jobs **en memoria** (Map) — se pierden en restart |
| CSV (@fast-csv) | Export CSV con BOM | exports | |
| PDF (jsPDF) | Recibos térmicos 80mm y export PDF | receipts, exports | Golden fixtures PDF |
| Supabase Postgres | BD producción | prisma | Sin código en repo (solo scripts/runbook) |
| Railway / Vercel | Hosting API / frontend | — | Sin config versionada |
| Pasarela de pagos | — | — | [FACT] No existe gateway; PaymentRecord es bookkeeping manual |

---

## 13. Testing

### Backend (Jest 30)

- [FACT] Config unit en `backend/package.json` (rootDir `src`, `*.spec.ts`, ts-jest, node env). `test:e2e` con `test/jest-e2e.json`.
- [FACT] Scripts: `test`, `test:watch`, `test:cov`, `test:e2e` — todos con `dotenv -e .env.development`.
- [FACT] 85 specs unitarias (`*.spec.ts` en `backend/src`); **15 specs de integración** (`*.int.spec.ts`) que requieren BD dev real (usando `src/testing/two-org-fixture.ts`); **3 e2e specs** (`test/*.e2e-spec.ts`).
- [FACT] Áreas cubiertas: auth (7), products (4), sales, expenses (7), imports (13+ incl. engine), reports (6 + golden), settings (4), common guards (4), users (4), billing, admin, tasks, plan-limits, suppliers, purchase-orders, customers, categories. Cloudinary **sin specs**.
- [FACT] Golden fixtures: recibos PDF (`test/fixtures/receipts/`) y reportes (`reports-golden/`) con scripts de regeneración (`fixtures:receipts`, `fixtures:reports-golden`, `fixtures:reports-timing`).

### Frontend (Vitest 4)

- [FACT] `vitest.config.ts`: jsdom, setup jest-dom + RTL cleanup, alias `@`, **quarantine list de 4 suites** que fallan (excluidas de CI): `sales/page.behavior`, `admin/organizations/[id]/page`, `AuthContext.switch`, `dashboard/CategoryStackedChart`.
- [FACT] 66 archivos de test (`*.test.ts/tsx`, incl. suites `*.evidence/behavior/characterization`): unit de lib/hooks, componentes ui/dominio, páginas, contratos de tema en globals.css, auth.
- [FACT] CI no corre cobertura; `openspec/config.yaml` declara coverage threshold 0 y frontend coverage null.

### CI (`.github/workflows/ci.yml`)

- [FACT] 2 jobs en Node 22: backend (Postgres 17 service, prisma generate/migrate deploy, build, `npm run test`) y frontend (`tsc --noEmit`, `npm run test`, `next build`, **security-header check** con `next start`).
- [FACT] Triggers: pull_request + push a `master`. No corre lint, no publica artefactos, no hace deploy.

---

## 14. Infrastructure & Deployment

- [FACT] Prod: **frontend Vercel** (`meperpos.vercel.app`), **API Railway** (`meperpos-api.up.railway.app`), **BD Supabase Postgres**, imágenes Cloudinary (evidencia: CSP en `next.config.ts`, `docs/secrets-rotation.md`, `docs/runbooks/runbook-despliegue-produccion.md`).
- [FACT] `backend/docker-compose.yml`: solo Postgres local dev (postgres:15, `admin/admin123/inventario_db`). No hay Dockerfile/Procfile/nginx en el repo.
- [FACT] Env backend: `.env.development`/`.env.production` vía dotenv-cli; vars: DATABASE_URL, DIRECT_URL, JWT_SECRET (≥32 chars, fail-fast prod), PORT, CORS_ORIGIN, CLOUDINARY_*, CLOUDINARY_FALLBACK_LOCAL, PRISMA_QUERY_LOG/DUMP, SEED_ALLOW_NON_DEV. Env frontend: solo `NEXT_PUBLIC_API_URL`.
- [FACT] Observabilidad: `GET /api/health` (`SELECT 1`); Nest Logger en 3 archivos; console disperso; **scheduler billing diario es no-op intencional**; audit vía AuditLog. No hay Sentry/Prometheus/Terminus/logging estructurado.
- [FACT] Scripts operativos: `backend/scripts/` (ping-supabase, diagnose-network, validate-*, phase2-bootstrap.sql), `backend/fix-sequences.js`, `backend/reset-kevin-password.js`, `frontend/scripts/build-size.mjs` (guard de tamaño de bundle con baseline).

---

## 15. Important Dependencies

- Backend (prod): `@nestjs/*` (common/core/config/jwt/passport/platform-express/schedule/swagger/throttler), `@prisma/client`, `bcryptjs`, `class-transformer`, `class-validator`, `cloudinary`, `cookie-parser`, `exceljs`, `helmet`, `jspdf`, `multer`, `passport`, `passport-jwt`, `@fast-csv/format`, `streamifier`, `rxjs`.
- Backend (dev): jest 30, ts-jest, supertest, typescript 5.9, eslint 9 + typescript-eslint, prettier, prisma, dotenv-cli, @faker-js/faker, pg, pdf-parse, ts-node, ts-loader.
- Frontend (prod): next 16.1.3 (exact), react 19.2.3, @tanstack/react-query ^5, axios, clsx, tailwind-merge, lucide-react, react-hook-form + zod + @hookform/resolvers (**sin uso**).
- Frontend (dev): vitest ^4, @testing-library/react/jest-dom/user-event, jsdom, typescript, tailwindcss ^4, eslint-config-next, babel-plugin-react-compiler.

---

## 16. Main Application Flows

1. **Auth + selección de organización**: login → (multi-org: pre-auth + select-organization) → restore silencioso vía refresh → org-scope en cada request (`X-Organization-Id`).
2. **POS venta**: cart cliente → POST /sales → tx Serializable (secuencia + venta + items + stock + movimientos + pagos) → invalidación queries → recibo PDF/thermal.
3. **Inventario**: CRUD productos con concurrencia `version`, activación/desactivación, import/export, subida imágenes, low-stock.
4. **Compra**: PO draft → confirm (PENDING) → receive (stock + costPriceSnapshot + PURCHASE movements) → parcial/total; vínculo con gasto.
5. **Gastos**: creación con pagos parciales → estado PAID/PARTIAL → soft-delete; categorías; recibo Cloudinary.
6. **Reportes/dashboard**: queries agregadas org-scoped con fecha Bogotá + caché 5 min + agregador financiero con costPriceSnapshot (COGS) y cancelaciones.
7. **Multi-tenant/admin**: creación de org (siembra sequences/caja/categorías de gasto), planes y límites, suspensión revoca tokens, SuperAdmin management.
8. **Tareas**: CRUD con transiciones de estado validadas y timeline inmutable TaskEvent.

---

## 17. Known Constraints

- [FACT] Sin workspace de npm: tipos y contratos duplicados a mano entre frontend y backend.
- [FACT] Sin registro público de usuarios (solo admin crea; SuperAdmin siembra).
- [FACT] Sin middleware/route-guard en Next: seguridad de rutas solo cliente (SUPER_ADMIN bypass del mapa; rutas protegidas también por backend).
- [FACT] Imports en memoria (no persistidos): jobs perdidos en restart/instancia múltiple.
- [FACT] Scheduler de billing es no-op por diseño; estado de facturación cambia solo por acción manual/admin.
- [FACT] Sin gateway de pagos; PaymentRecord manual.
- [FACT] Guardas CSRF: doble submit con cookie `csrf_token`; CSRF exempt incluye path muerto `/api/auth/register`.
- [FACT] `HttpExceptionFilter` no reenvuelve arrays de errores de validación (`message` puede ser `string[]`).
- [FACT] `products-search.controller.ts` es código muerto (no registrado); CASHIER recibe 403 en `/products/search` del controller principal.
- [FACT] `uuid` importado en `cloudinary.service.ts` pero no declarado en dependencies (dependencia transitiva no declarada).
- [FACT] React-hook-form/zod instalados sin uso en frontend.
- [FACT] 4 suites de test frontend en quarantine (fallan).
- [FACT] Migraciones tempranas duplicadas (`_init`/`implementaciones`) sugieren reset inicial; BD viva no verificable read-only.

---

## 18. Unknowns

- Estado real (migrado/sync) de las BD de desarrollo y producción; volúmenes de datos.
- Configuración actual de Railway/Vercel/Supabase/Cloudinary (no versionada).
- Contenido exacto de `.env.example` y archivos `.env*` (no legibles por política).
- Alcance completo de `PaymentRecord`/`CashRegister`/`RefreshToken.organizationId` en runtime (módulos recientes, cableado parcialmente verificado).
- Rama por defecto real del remoto (docs dicen `main`; CI usa `master`; existe `development`).
- Estado de los artifacts locales `.codegraph/`, `node_modules/.vite` y su impacto (no funcional).
- Documentación `docs/arquitectura/guia-maestra-proyecto.md` contiene descripciones aspiracionales/stale (Redis, PWA/mobile, rol legacy) — no se verificó su vigencia real.
- Por qué `/settings/billing|locale|advanced` no aparecen en el nav de settings (4 entradas vs 7 grupos).

---

## Apéndice A — Archivos de referencia clave

| Área | Archivo(s) |
|---|---|
| Schema DB | `backend/prisma/schema.prisma` |
| Migraciones | `backend/prisma/migrations/` (29) |
| Bootstrap backend | `backend/src/main.ts`, `backend/src/app-configuration.ts`, `backend/src/app.module.ts` |
| Guards/interceptores | `backend/src/common/guards/*`, `backend/src/common/interceptors/*` |
| Auth | `backend/src/auth/` (service, controller, jwt.strategy, cookies.helper, constants) |
| Ventas | `backend/src/sales/sales.service.ts` |
| Productos | `backend/src/products/products.service.ts` (+ search dead) |
| Reportes | `backend/src/reports/reports.service.ts`, `financial-aggregator.ts` |
| Settings | `backend/src/settings/` (schema, defaults, validator, migration) |
| Plan limits | `backend/src/plan-limits/` |
| CI | `.github/workflows/ci.yml` |
| Frontend cliente API | `frontend/src/lib/api.ts`, `frontend/src/lib/session.ts` |
| Frontend routing | `frontend/src/app/**/page.tsx`, `frontend/src/components/layout/DashboardLayout.tsx`, `Sidebar.tsx` |
| Hooks | `frontend/src/hooks/` |
| Tipos | `frontend/src/types/index.ts` |
| Config frontend | `frontend/next.config.ts`, `frontend/vitest.config.ts`, `frontend/src/app/globals.css` |
| Runbook/ops | `docs/runbooks/runbook-despliegue-produccion.md`, `docs/secrets-rotation.md` |
| AuthZ | `docs/authorization-matrix.md`, `docs/url-identifier-policy.md` |
| SDD | `openspec/config.yaml`, `openspec/changes/multi-tenant-completion/` |
