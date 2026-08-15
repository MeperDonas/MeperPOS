# Plan 06 — Lotes, vencimientos y alertas automáticas

> [!IMPORTANT]
> **Cambio transversal al inventario.** Este plan introduce el concepto de **lote** (`Batch`) por producto: mismo SKU, fechas de vencimiento distintas, trazabilidad por lote. Afecta POS (FEFO automático), compras (recibir con lote), ajustes, devoluciones y reportes. Depende parcialmente del Plan 05 (multi-ubicación) — el stock por lote se cruza con stock por ubicación.
>
> **Estimación: 50–65 horas de desarrollo + testing. Proyecto de 2 meses calendario.**

---

## 1. Contexto y Motivación

### 1.1 Problema actual

El sistema trata el stock como un número agregado por producto. Eso funciona para commodities no perecederos, pero **se rompe** en rubros como:

- Productos alimenticios (lácteos, embutidos, panadería).
- Farmacia y suplementos (control estricto de vencimiento por regulación INVIMA).
- Cosmética y cuidado personal.
- Química para el hogar.
- Tabacos, bebidas alcohólicas (normativa específica).

**Consecuencias del modelo actual:**
- No se sabe cuántas unidades de un producto vencen "esta semana" vs "en 6 meses".
- No se controla FIFO/FEFO: puede venderse stock nuevo dejando stock viejo a vencerse.
- Devoluciones de productos vencidos no rastrean el lote del proveedor → imposible gestionar reclamaciones.
- Reportes de rotación son engañosos: un producto con 100 unidades puede tener 50 por vencerse.
- INVIMA y auditorías de sanidad exigen trazabilidad por lote: este sistema no lo cumple.

### 1.2 Lo que resuelve este plan

- Modelo `Batch` con `batchNumber`, `expiryDate?`, `quantity`, `supplierId?`, `locationId`.
- Recepción de compras asigna mercancía a lotes (un PO puede recibir en 1..N lotes).
- Venta POS descuenta automáticamente del lote por vencer más cercano (**FEFO** — First-Expired-First-Out).
- Devoluciones (desde Plan 02) referencian el lote original.
- Alertas diarias: productos próximos a vencer (7/15/30 días configurable), productos vencidos (auto-bloqueados de venta), quiebres de stock por categoría.
- Sistema de notificaciones en-app (tareas existentes) + email opcional.
- Reporte de rotación con desglose por lote.

### 1.3 Fuera de alcance

- Trazabilidad serial (por número de serie individual) — otro plan.
- Códigos GS1-128 / DataMatrix para lotes — otro plan.
- Lotes con dimensiones distintas (peso, tamaño) — el lote hereda unidades del producto.
- Retiro masivo (recall) automatizado — se logra con reporte + ajuste manual.

### 1.4 Opcionalidad por producto

Aplicar lotes a **todos** los productos obliga a capturar `expiryDate` en ventas de clavos o ropa, que no aplica. Por eso:

```prisma
model Product {
  // ...
  tracksBatches     Boolean   @default(false)
  tracksExpiry      Boolean   @default(false)   // implica tracksBatches=true
}
```

- `tracksBatches = false` (default): producto usa `ProductStock.quantity` tal como antes. Cero cambios operativos.
- `tracksBatches = true`: producto requiere lote en compras y usa FEFO en ventas.
- `tracksExpiry = true`: adicionalmente exige `expiryDate` en lotes y activa alertas de vencimiento.

---

## 2. Decisiones de Arquitectura

### 2.1 DECISIÓN: Batch como fuente de verdad vs agregado

| Opción | Tradeoff |
|---|---|
| A — Solo `Batch` con stock. `ProductStock.quantity` = `sum(Batch.quantity)` computado | Single source of truth, pero todo query de stock hace agregación |
| B — `ProductStock.quantity` sigue siendo fuente de verdad, `Batch` auxiliar para trazabilidad | Dos fuentes, riesgo de desincronización (igual que el error del Plan 05) |
| **C (elegida)** — `Batch.quantity` es la fuente de verdad PARA productos con `tracksBatches=true`. `ProductStock.quantity` se mantiene como caché derivado actualizado en la misma transacción. Productos sin lotes siguen usando solo `ProductStock`. | Rendimiento + consistencia. Más código en operaciones, pero correcto. |

**Decisión adoptada: Opción C — Batch es fuente de verdad para productos lote-tracked; ProductStock.quantity se mantiene sincronizado en transacción.**

Justificación: leer `sum(Batch.quantity)` en cada request de inventario es caro (cientos de lotes por producto popular). Mantener `ProductStock.quantity` actualizado siempre dentro de la misma transacción que actualiza el Batch elimina el riesgo de desincronización. El invariante a testear: `sum(batch.quantity WHERE productId=X AND locationId=Y) === ProductStock(X,Y).quantity`.

### 2.2 FEFO — algoritmo de picking

```typescript
function pickBatchesFEFO(batches: Batch[], qtyNeeded: number): Pick[] {
  const ordered = batches
    .filter(b => b.quantity > 0 && b.status === 'ACTIVE')
    .sort((a, b) => {
      // Sin expiryDate ordena al final (stock no perecedero dentro del mismo producto)
      if (a.expiryDate === null && b.expiryDate === null) return a.createdAt - b.createdAt;
      if (a.expiryDate === null) return 1;
      if (b.expiryDate === null) return -1;
      const diff = a.expiryDate - b.expiryDate;
      if (diff !== 0) return diff;
      return a.createdAt - b.createdAt;  // tiebreaker FIFO
    });

  const picks: Pick[] = [];
  let remaining = qtyNeeded;
  for (const b of ordered) {
    if (remaining === 0) break;
    const take = Math.min(b.quantity, remaining);
    picks.push({ batchId: b.id, quantity: take });
    remaining -= take;
  }
  if (remaining > 0) throw new Error('Stock insuficiente');
  return picks;
}
```

- `expiryDate ASC NULLS LAST`, tiebreaker por `createdAt ASC` (el lote más viejo primero).
- Productos con `tracksExpiry=false` pero `tracksBatches=true` ordenan solo por `createdAt` (puro FIFO).
- Se pueden descontar múltiples lotes en una sola venta.

### 2.3 Bloqueo automático de vencidos

Un cron diario (00:00 hora local) marca como `EXPIRED` todos los Batch con `expiryDate <= now()`. `Batch.status = EXPIRED` hace que FEFO los ignore. Un admin puede marcarlos manualmente como `DESTROYED` (generando `InventoryMovement(DAMAGE)`).

### 2.4 Recepción multi-lote por compra

Un `PurchaseOrderItem` puede recibirse en 1..N lotes. DTO de recepción ya no lleva `quantityReceived` único sino array:

```typescript
{
  purchaseOrderItemId: "...",
  receivedBatches: [
    { batchNumber: "L-2026-A", expiryDate: "2026-12-31", quantity: 100 },
    { batchNumber: "L-2026-B", expiryDate: "2027-03-15", quantity: 50 },
  ]
}
```

### 2.5 Alertas como cron jobs + Task generation

4 cron jobs:
1. **`expire-batches`** (diario 00:00): marca EXPIRED los Batch vencidos.
2. **`expiry-warning`** (diario 06:00): genera Tasks para productos que vencen en ≤ N días configurable en Settings.
3. **`low-stock-warning`** (diario 06:30): genera Tasks para productos bajo `ProductStock.minStock`.
4. **`stockout-warning`** (cada 30min): productos con 0 stock en ubicación que tenían ventas recientes.

Cada cron crea `Task` con `type`, `title`, `dueDate`, `assignedToId` (ADMIN o INVENTORY_USER de la ubicación). Se reutiliza el módulo `TasksModule` existente.

### 2.6 Integración con multi-ubicación (Plan 05)

Si Plan 05 está activo: `Batch` tiene `locationId` y los cálculos FEFO + alertas son por `(productId, locationId)`. Si Plan 05 NO está activo aún: `Batch.locationId` se popula con la Location default (MAIN). El código funciona igual.

---

## 3. Modelo de Datos

### 3.1 Nuevos enums y modelos

```prisma
enum BatchStatus {
  ACTIVE
  EXPIRED
  DESTROYED
  RECALLED    // retirado por calidad / recall del fabricante
  QUARANTINE  // en revisión, no vendible temporalmente
}

model Batch {
  id               String        @id @default(uuid())
  productId        String
  product          Product       @relation(fields: [productId], references: [id])
  locationId       String
  location         Location      @relation(fields: [locationId], references: [id])

  batchNumber      String        // "L-2026-A", "PROD-2026-001", código del proveedor
  expiryDate       DateTime?     // null si producto no tiene fecha de vencimiento
  manufactureDate  DateTime?
  quantity         Int           @default(0)
  version          Int           @default(0)   // optimistic concurrency
  status           BatchStatus   @default(ACTIVE)

  supplierId       String?
  supplier         Supplier?     @relation(fields: [supplierId], references: [id])
  purchaseOrderId  String?
  purchaseOrder    PurchaseOrder? @relation(fields: [purchaseOrderId], references: [id])

  cost             Decimal?      @db.Decimal(10, 2)   // costo unitario de este lote

  notes            String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  saleBatches      SaleItemBatch[]
  movements        InventoryMovement[]   // movements referencian el lote

  @@unique([productId, locationId, batchNumber])
  @@index([productId, locationId, status, expiryDate])
  @@index([expiryDate])
  @@index([status])
}

// Permite descontar una venta en múltiples lotes (FEFO)
model SaleItemBatch {
  id           String     @id @default(uuid())
  saleItemId   String
  saleItem     SaleItem   @relation(fields: [saleItemId], references: [id], onDelete: Cascade)
  batchId      String
  batch        Batch      @relation(fields: [batchId], references: [id])
  quantity     Int

  @@index([saleItemId])
  @@index([batchId])
}

enum AlertType {
  EXPIRY_WARNING
  EXPIRY_EXPIRED
  LOW_STOCK
  STOCKOUT
}

enum AlertChannel {
  TASK      // crea Task en el módulo existente
  EMAIL
  IN_APP    // banner tipo toast persistente
}

model AlertRule {
  id            String         @id @default(uuid())
  type          AlertType
  daysThreshold Int?           // para EXPIRY_WARNING: días antes de vencer
  channels      AlertChannel[] // lista de canales activos
  assignRole    String         @default("ADMIN")  // rol al que se asigna la Task
  enabled       Boolean        @default(true)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}
```

### 3.2 Modificaciones a modelos existentes

```prisma
// Product — flags de tracking:
model Product {
  // ...
  tracksBatches  Boolean   @default(false)
  tracksExpiry   Boolean   @default(false)
  batches        Batch[]
}

// SaleItem — relación a SaleItemBatch:
model SaleItem {
  // ...
  batches        SaleItemBatch[]
}

// InventoryMovement — referencia opcional a Batch:
model InventoryMovement {
  // ...
  batchId        String?
  batch          Batch?     @relation(fields: [batchId], references: [id])
  @@index([batchId])
}

// Supplier — relación inversa:
model Supplier {
  // ...
  batches        Batch[]
}

// PurchaseOrder — relación inversa:
model PurchaseOrder {
  // ...
  batches        Batch[]
}

// Location — relación inversa:
model Location {
  // ... (del Plan 05)
  batches        Batch[]
}

// Settings — configuración de alertas:
model Settings {
  // ...
  expiryWarningDays        Int    @default(30)
  lowStockWarningEnabled   Boolean @default(true)
  stockoutWarningEnabled   Boolean @default(true)
  notifyEmail              String?
}
```

### 3.3 Migración

```bash
cd backend
npx prisma migrate dev --name feat-batches-expiry
```

Seed inicial poblando `AlertRule` default:
```typescript
await prisma.alertRule.createMany({
  data: [
    { type: 'EXPIRY_WARNING', daysThreshold: 7,  channels: ['TASK', 'IN_APP'], assignRole: 'INVENTORY_USER' },
    { type: 'EXPIRY_WARNING', daysThreshold: 30, channels: ['TASK'],           assignRole: 'INVENTORY_USER' },
    { type: 'EXPIRY_EXPIRED',                    channels: ['TASK', 'IN_APP'], assignRole: 'ADMIN' },
    { type: 'LOW_STOCK',                         channels: ['TASK'],           assignRole: 'INVENTORY_USER' },
    { type: 'STOCKOUT',                          channels: ['IN_APP'],         assignRole: 'CASHIER' },
  ],
});
```

---

## 4. Backend — Módulos y Cambios

### 4.1 Nuevo módulo: `batches`

```
backend/src/batches/
├── dto/
│   ├── create-batch.dto.ts
│   ├── update-batch.dto.ts
│   ├── query-batches.dto.ts
│   └── destroy-batch.dto.ts
├── batches.controller.ts
├── batches.service.ts
├── fefo.service.ts          // lógica pura sin DB
└── batches.module.ts
```

### 4.2 BatchesController

```typescript
@Controller('batches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BatchesController {
  @Get()    @Roles('ADMIN', 'INVENTORY_USER', 'CASHIER')
  findAll(@Query() q: QueryBatchesDto) {}

  @Get(':id')  @Roles('ADMIN', 'INVENTORY_USER', 'CASHIER')
  findOne(@Param('id') id: string) {}

  @Post()   @Roles('ADMIN', 'INVENTORY_USER')
  create(@Body() dto: CreateBatchDto) {}

  @Patch(':id')  @Roles('ADMIN', 'INVENTORY_USER')
  update(@Param('id') id: string, @Body() dto: UpdateBatchDto) {}

  @Post(':id/destroy')  @Roles('ADMIN')
  destroy(@Param('id') id: string, @Body() dto: DestroyBatchDto) {}

  @Post(':id/quarantine')  @Roles('ADMIN')
  quarantine(@Param('id') id: string) {}

  @Post(':id/release')  @Roles('ADMIN')
  release(@Param('id') id: string) {}  // sale de cuarentena
}
```

### 4.3 FefoService (lógica pura)

```typescript
// backend/src/batches/fefo.service.ts
import { Injectable } from '@nestjs/common';

export interface BatchForPick {
  id: string;
  quantity: number;
  expiryDate: Date | null;
  createdAt: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'DESTROYED' | 'RECALLED' | 'QUARANTINE';
}

export interface Pick {
  batchId: string;
  quantity: number;
}

@Injectable()
export class FefoService {
  /** Ordena lotes por FEFO y selecciona los necesarios para `qtyNeeded`. */
  pick(batches: BatchForPick[], qtyNeeded: number): Pick[] {
    if (qtyNeeded <= 0) return [];

    const active = batches.filter(b => b.status === 'ACTIVE' && b.quantity > 0);
    const ordered = active.sort((a, b) => {
      if (a.expiryDate === null && b.expiryDate === null) {
        return a.createdAt.getTime() - b.createdAt.getTime();
      }
      if (a.expiryDate === null) return 1;
      if (b.expiryDate === null) return -1;
      const diff = a.expiryDate.getTime() - b.expiryDate.getTime();
      return diff !== 0 ? diff : a.createdAt.getTime() - b.createdAt.getTime();
    });

    const picks: Pick[] = [];
    let remaining = qtyNeeded;
    for (const b of ordered) {
      if (remaining === 0) break;
      const take = Math.min(b.quantity, remaining);
      picks.push({ batchId: b.id, quantity: take });
      remaining -= take;
    }
    if (remaining > 0) {
      throw new Error(`Stock insuficiente: faltan ${remaining} unidades`);
    }
    return picks;
  }
}
```

### 4.4 Cambios en módulos existentes

#### [MODIFY] `backend/src/sales/sales.service.ts`

Al crear una venta, para cada `SaleItem` cuyo producto tiene `tracksBatches=true`:
1. Cargar todos los lotes ACTIVE del producto en la `locationId` de la venta.
2. Llamar `fefoService.pick(batches, qty)` → lista de `[{batchId, quantity}]`.
3. Por cada pick: decrementar `Batch.quantity` (optimistic concurrency sobre `Batch.version`).
4. Crear `SaleItemBatch` por cada pick.
5. Decrementar `ProductStock.quantity` por el total (mantener caché).
6. Crear `InventoryMovement(SALE)` por cada pick (con `batchId` referenciado).

Para productos con `tracksBatches=false`: comportamiento actual (solo `ProductStock`).

```typescript
if (product.tracksBatches) {
  const batches = await tx.batch.findMany({
    where: {
      productId: item.productId,
      locationId: dto.locationId,
      status: 'ACTIVE',
      quantity: { gt: 0 },
    },
    orderBy: [
      { expiryDate: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'asc' },
    ],
  });
  const picks = this.fefoService.pick(batches, item.quantity);
  for (const pick of picks) {
    const b = batches.find(x => x.id === pick.batchId)!;
    const upd = await tx.batch.updateMany({
      where: { id: pick.batchId, version: b.version },
      data: { quantity: b.quantity - pick.quantity, version: { increment: 1 } },
    });
    if (upd.count === 0) throw new ConflictException('Lote modificado concurrentemente');

    await tx.saleItemBatch.create({
      data: { saleItemId, batchId: pick.batchId, quantity: pick.quantity },
    });
    await tx.inventoryMovement.create({
      data: {
        productId: item.productId,
        locationId: dto.locationId,
        batchId: pick.batchId,
        type: 'SALE',
        quantity: pick.quantity,
        reason: `Venta ${saleNumber}`,
      },
    });
  }
  // Sincronizar caché ProductStock
  await tx.productStock.update({
    where: { productId_locationId: { productId: item.productId, locationId: dto.locationId } },
    data: { quantity: { decrement: item.quantity }, version: { increment: 1 } },
  });
}
```

#### [MODIFY] `backend/src/purchase-orders/purchase-orders.service.ts`

Método `receive()` actualiza su DTO. Antes:

```typescript
{ items: [{ purchaseOrderItemId, quantityReceived }] }
```

Ahora (para productos con `tracksBatches=true`):

```typescript
{
  items: [{
    purchaseOrderItemId,
    receivedBatches: [
      { batchNumber, expiryDate?, manufactureDate?, quantity, cost? }
    ]
  }]
}
```

Valida que `sum(receivedBatches.quantity) === quantityReceivedTotal`. Crea filas `Batch` y los movimientos `PURCHASE`, sincroniza `ProductStock`.

#### [MODIFY] `backend/src/products/products.service.ts`

- Campos `tracksBatches`, `tracksExpiry` en DTO de create/update.
- Validación: no se puede pasar `tracksBatches` de `true` → `false` si hay lotes ACTIVE.
- Validación: `tracksExpiry=true` implica `tracksBatches=true`.

#### [MODIFY] `backend/src/inventory-movements/` (si existe, si no crear)

El módulo debe soportar ajustes por lote — `ADJUSTMENT_IN`/`ADJUSTMENT_OUT` con `batchId` opcional.

### 4.5 Nuevo módulo: `alerts` con jobs cron

```
backend/src/alerts/
├── alerts.service.ts           // lógica de generación
├── alerts.module.ts
├── jobs/
│   ├── expire-batches.job.ts
│   ├── expiry-warning.job.ts
│   ├── low-stock.job.ts
│   └── stockout.job.ts
└── alerts.controller.ts        // (opcional) para mutar AlertRule desde Settings
```

Usar `@nestjs/schedule` (instalar: `npm i @nestjs/schedule`).

```typescript
// backend/src/alerts/jobs/expire-batches.job.ts
@Injectable()
export class ExpireBatchesJob {
  constructor(private prisma: PrismaService) {}

  @Cron('0 0 * * *', { name: 'expire-batches', timeZone: 'America/Bogota' })
  async handle() {
    const now = new Date();
    const result = await this.prisma.batch.updateMany({
      where: {
        status: 'ACTIVE',
        expiryDate: { lte: now, not: null },
      },
      data: { status: 'EXPIRED' },
    });
    this.logger.log(`Marked ${result.count} batches as EXPIRED`);
  }
}

// backend/src/alerts/jobs/expiry-warning.job.ts
@Injectable()
export class ExpiryWarningJob {
  constructor(
    private prisma: PrismaService,
    private alertsService: AlertsService,
  ) {}

  @Cron('0 6 * * *', { name: 'expiry-warning', timeZone: 'America/Bogota' })
  async handle() {
    const rules = await this.prisma.alertRule.findMany({
      where: { type: 'EXPIRY_WARNING', enabled: true },
    });
    for (const rule of rules) {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() + (rule.daysThreshold ?? 30));

      const batches = await this.prisma.batch.findMany({
        where: {
          status: 'ACTIVE',
          expiryDate: { lte: threshold, gt: new Date() },
          quantity: { gt: 0 },
        },
        include: { product: true, location: true },
      });
      for (const b of batches) {
        await this.alertsService.dispatch(rule, {
          title: `Lote ${b.batchNumber} de ${b.product.name} vence el ${b.expiryDate?.toISOString().slice(0, 10)}`,
          meta: { batchId: b.id, productId: b.productId, locationId: b.locationId },
          dueDate: b.expiryDate,
        });
      }
    }
  }
}
```

`AlertsService.dispatch()` consulta los `channels` del `AlertRule` y actúa:
- `TASK`: crea `Task` via `TasksService.create()` con deduplicación (no crear task duplicada si ya existe una para ese batch ese día).
- `EMAIL`: envía a `Settings.notifyEmail` usando el servicio de email del proyecto.
- `IN_APP`: persiste en tabla `InAppNotification` (si no existe, crear).

#### [MODIFY] `backend/src/app.module.ts`

```typescript
import { ScheduleModule } from '@nestjs/schedule';
import { BatchesModule } from './batches/batches.module';
import { AlertsModule } from './alerts/alerts.module';

// En imports[]:
ScheduleModule.forRoot(),
BatchesModule,
AlertsModule,
```

---

## 5. Frontend

### 5.1 Páginas nuevas

#### [CREATE] `frontend/src/app/batches/page.tsx`

Lista paginada de lotes con filtros:
- Producto (autocomplete)
- Ubicación (si Plan 05 activo)
- Status (ACTIVE, EXPIRED, DESTROYED, RECALLED, QUARANTINE)
- Rango de vencimiento (ej: "vencen este mes")

Columnas: producto, batchNumber, expiryDate (con colorcode: rojo vencido, ámbar < 30 días, verde > 30), quantity, supplier, ubicación, status, acciones.

Acciones: ver detalle, destruir (con motivo), cuarentena/liberar.

#### [CREATE] `frontend/src/app/batches/[id]/page.tsx`

Detalle de lote con timeline:
- Recibido (PO de origen, cantidad, costo)
- Movimientos (ventas parciales, ajustes, daño)
- Estado actual
- Si vencido: alerta roja persistente con CTA "Destruir"

### 5.2 Cambios en páginas existentes

#### [MODIFY] `frontend/src/app/products/[id]/page.tsx`

Nueva pestaña "Lotes" que muestra tabla con los Batches del producto agrupados por ubicación. Botón "Ver todos los lotes" link a `/batches?productId=...`.

Switches: `tracksBatches` y `tracksExpiry` (ADMIN). Warning si se intenta desactivar con lotes existentes.

#### [MODIFY] `frontend/src/app/purchase-orders/[id]/receive/page.tsx`

Si alguno de los items del PO tiene producto con `tracksBatches=true`, mostrar sub-tabla por item con:
- Input para `batchNumber` (libre o autocompletar históricos).
- DatePicker para `expiryDate` (requerido si `tracksExpiry=true`).
- Input para `manufactureDate` (opcional).
- Input numérico para `quantity`.
- Botón "+ Agregar lote" para split del PO item en varios lotes.
- Validación: suma de batch.quantity === quantityReceived total.

#### [MODIFY] `frontend/src/app/pos/page.tsx`

En POS NO se le pide al cashier elegir lote — FEFO es automático. Pero al agregar un producto `tracksBatches` al carrito, mostrar badge con el próximo lote a vencer ("Próximo lote vence en 12 días").

Al finalizar venta, el recibo muestra por cada item el/los batch(es) descontados (requisito INVIMA para farmacia).

#### [MODIFY] `frontend/src/app/settings/page.tsx`

Nueva sección "Alertas":
- Input `expiryWarningDays` (number)
- Toggle `lowStockWarningEnabled`
- Toggle `stockoutWarningEnabled`
- Input `notifyEmail`
- Tabla editable de `AlertRule` (type, daysThreshold, channels, assignRole, enabled)

### 5.3 Componentes nuevos

- `frontend/src/components/batches/BatchStatusBadge.tsx` — color-coded por status.
- `frontend/src/components/batches/ExpiryBadge.tsx` — muestra "vence en X días" con color.
- `frontend/src/components/batches/BatchTimeline.tsx` — timeline visual de movements de un lote.
- `frontend/src/components/po/ReceiveWithBatchesForm.tsx` — form de recepción con sub-tabla de lotes por item.
- `frontend/src/hooks/useBatches.ts` — wrapper TanStack Query sobre `/api/batches`.

### 5.4 Sidebar

#### [MODIFY] `frontend/src/components/layout/Sidebar.tsx`

```typescript
import { Layers } from 'lucide-react';

// En navItems[], entre Inventario y Proveedores:
{
  label: 'Lotes',
  href: '/batches',
  icon: <Layers className="w-4 h-4" />,
  roles: ['ADMIN', 'INVENTORY_USER', 'CASHIER'],
},
```

---

## 6. APIs REST

| Method | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/api/batches` | todos | Lista con filtros |
| GET | `/api/batches/:id` | todos | Detalle con movements |
| POST | `/api/batches` | ADMIN, INVENTORY_USER | Crear (típicamente via PO receive) |
| PATCH | `/api/batches/:id` | ADMIN, INVENTORY_USER | Editar notas, recall, etc. |
| POST | `/api/batches/:id/destroy` | ADMIN | Destruir con motivo → DAMAGE mov |
| POST | `/api/batches/:id/quarantine` | ADMIN | Marcar QUARANTINE |
| POST | `/api/batches/:id/release` | ADMIN | QUARANTINE → ACTIVE |
| GET | `/api/products/:id/batches` | todos | Lotes del producto |
| GET | `/api/alerts/rules` | ADMIN | Reglas configuradas |
| PUT | `/api/alerts/rules/:id` | ADMIN | Actualizar regla |

Query filters comunes: `?productId=`, `?locationId=`, `?status=`, `?expiringWithinDays=30`, `?batchNumber=`.

---

## 7. Testing

### 7.1 Unit — FefoService

- Ordena por `expiryDate ASC NULLS LAST`, tiebreaker `createdAt ASC`.
- Ignora lotes con status != ACTIVE.
- Ignora lotes con quantity = 0.
- Descuenta de múltiples lotes cuando el más viejo no alcanza.
- Throw si `remaining > 0` al final (stock insuficiente).
- Returns `[]` si `qtyNeeded = 0`.

### 7.2 Unit — BatchesService

- `create` genera `InventoryMovement(ADJUSTMENT_IN)` y sincroniza `ProductStock`.
- `destroy` mueve `Batch.status = DESTROYED` + `InventoryMovement(DAMAGE)` + decrementa `ProductStock`.
- `quarantine` bloquea del FEFO (tests que venta con stock 100% en quarantine falla con 400).

### 7.3 Unit — SalesService (refactor)

- Producto sin `tracksBatches`: comportamiento previo inalterado.
- Producto con `tracksBatches`: descuenta del lote más próximo a vencer.
- Split entre lotes: 70 del lote A (queda con 30), 30 del lote B.
- No toca lotes EXPIRED aunque haya stock.
- Concurrencia: dos ventas del mismo lote → una falla con 409.
- Invariante post-venta: `sum(batches.quantity WHERE productId=X, locationId=Y) === ProductStock(X,Y).quantity`.

### 7.4 Unit — jobs cron

- `ExpireBatchesJob`: marca EXPIRED los con `expiryDate <= now`.
- `ExpiryWarningJob`: genera Tasks para batches que vencen en ≤ threshold, NO duplica si ya existe Task ese día.
- `LowStockJob`: genera Tasks cuando `ProductStock.quantity <= ProductStock.minStock`.
- Todos los jobs son idempotentes.

### 7.5 E2E

- Recibir PO con 2 lotes del mismo producto (vencimientos distintos).
- Vender X unidades donde X > lote más viejo.
- Verificar split correcto entre lotes.
- Avanzar el reloj del sistema a un día después del vencimiento del lote A → cron marca EXPIRED.
- Venta posterior solo descuenta del lote B.
- Recibir más stock del producto → crea lote C.
- Venta descuenta B antes que C (FEFO).

---

## 8. Fases de Implementación

### Fase 1 — Schema + migration + seed (8h)
- [ ] Modelos `Batch`, `SaleItemBatch`, `AlertRule`.
- [ ] Flags en `Product`, relación en `SaleItem`, campos en `Settings`.
- [ ] Seed de `AlertRule` default.

### Fase 2 — BatchesModule + FefoService (12h)
- [ ] Controller, service, DTOs.
- [ ] FefoService con unit tests.
- [ ] Endpoints destroy/quarantine/release.

### Fase 3 — Integración en ventas y compras (15h)
- [ ] Refactor `SalesService` para usar FEFO cuando producto `tracksBatches`.
- [ ] Refactor `PurchaseOrdersService.receive` para aceptar batches.
- [ ] Mantener caché `ProductStock` sincronizado.
- [ ] Tests de regresión y concurrencia.

### Fase 4 — AlertsModule + cron jobs (10h)
- [ ] `@nestjs/schedule` setup.
- [ ] 4 jobs cron.
- [ ] `AlertsService.dispatch` con TASK/EMAIL/IN_APP.
- [ ] Deduplicación de Tasks.

### Fase 5 — Frontend (15h)
- [ ] Páginas `/batches` y `/batches/[id]`.
- [ ] Pestaña "Lotes" en producto.
- [ ] Form de recepción con sub-tabla de lotes.
- [ ] Badge FEFO en POS + recibo con lotes descontados.
- [ ] Settings de alertas.
- [ ] Sidebar.

### Fase 6 — Tests E2E + hardening (5h)
- [ ] E2E flujo completo.
- [ ] Pruebas de carga (1000 lotes por producto).
- [ ] Documentación.

**Total: 65h (margen 50–65h).**

---

## 9. Riesgos y Mitigaciones

### 9.1 Inconsistencia entre `Batch.quantity` y `ProductStock.quantity`

**Riesgo crítico** derivado de la decisión de dual storage. Mitigación:
- **Siempre** actualizar ambos en la misma transacción.
- Test de invariante incluido en suite E2E que se corre en CI.
- Job `reconcile-stock-cache` (cron semanal) detecta divergencias y alerta.
- Script `npm run reconcile-stock` que recomputa `ProductStock.quantity` desde `sum(Batch.quantity)` para productos con `tracksBatches=true`.

### 9.2 Performance con miles de lotes

Productos muy rotativos pueden acumular historial de lotes (aunque con quantity=0). Mitigación:
- Index compuesto `(productId, locationId, status, expiryDate)`.
- Query FEFO filtra `status='ACTIVE' AND quantity > 0`.
- Archivado: lotes con quantity=0 y edad > 1 año pasan a tabla `BatchArchive` (cron mensual).

### 9.3 Activación de tracksBatches sobre producto con stock existente

Producto que ya tiene 100 unidades en `ProductStock`. Al activar `tracksBatches=true`, esas unidades no tienen lote asociado.

Mitigación: al activar, forzar creación de un "lote inicial" `INITIAL-{productCode}` con `expiryDate=null` y `quantity = ProductStock.quantity`. UI guía al admin a luego crear lotes específicos via ajuste.

### 9.4 Pérdida de lote en tránsito (interacción con Plan 05)

Transferencia de un Batch entre ubicaciones: el Batch debería migrar de `locationId` o crearse uno nuevo en destino. **Decisión:** crear nuevo Batch en destino con mismo `batchNumber` + `locationId` nuevo, decrementar origen. El índice `@@unique([productId, locationId, batchNumber])` lo permite (locationId distinto).

### 9.5 POS lento por cálculo FEFO

Cargar todos los lotes activos del producto en cada venta podría tardar. Mitigación:
- Cache de resultados de `findMany` en POS durante la sesión del cashier (30s TTL).
- Index compuesto con `expiryDate` para que la query sea un index-only scan.
- Alternativa si se vuelve problema: pre-computar "nextBatchId" como columna desnormalizada en `ProductStock`.

---

## 10. Checklist de Aceptación

- [ ] Productos con `tracksBatches=false` siguen operando sin cambios.
- [ ] Recepción de PO crea `Batch` correcto con `batchNumber`, `expiryDate?`, `cost?`, `supplierId`, `purchaseOrderId`.
- [ ] Venta POS descuenta del lote por vencer más cercano (FEFO).
- [ ] Venta puede descontar de múltiples lotes.
- [ ] Lotes `EXPIRED` nunca se venden.
- [ ] Lote en `QUARANTINE` no se vende pero puede liberarse.
- [ ] Cron diario marca EXPIRED los vencidos.
- [ ] Cron diario genera Tasks para lotes que vencen en ≤ threshold.
- [ ] Cron diario genera Tasks para productos bajo minStock.
- [ ] Tasks generadas no se duplican en el día.
- [ ] Invariante `sum(batches) === ProductStock.quantity` se cumple siempre.
- [ ] Recibo de venta incluye lote descontado para productos lote-tracked.
- [ ] Devoluciones (Plan 02) referencian el lote original.
- [ ] UI muestra color-code por proximidad de vencimiento.
- [ ] Destruir lote genera `InventoryMovement(DAMAGE)`.

---

_Plan 06 de 7 — roadmap MeperPOS · Fecha: 2026-04-21_
