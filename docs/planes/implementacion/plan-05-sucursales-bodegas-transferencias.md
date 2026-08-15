# Plan 05 — Sucursales / Bodegas múltiples + Transferencias de stock

> [!IMPORTANT]
> **Cambio estructural mayor.** Este plan reemplaza el modelo single-location actual (`Product.stock Int`) por un modelo multi-location (`ProductStock` por `(productId, locationId)`). Todos los módulos que hoy leen o escriben `Product.stock` — POS, Sales, Purchase Orders, Reports, Inventory, Imports — deben adaptarse. Leer completo antes de ejecutar la migración.
>
> **Estimación: 70–90 horas de desarrollo + testing. Proyecto de 2–3 meses calendario.**

---

## 1. Contexto y Motivación

### 1.1 Situación actual

El sistema asume una única bodega/tienda. `Product.stock` es un `Int` único por producto. Cuando crece la operación (segunda tienda, bodega central separada de punto de venta, ecommerce + físico), este modelo no escala:

- No hay forma de saber cuánto stock hay "acá" vs "en la bodega".
- Una venta en la tienda 2 descuenta stock "global" aunque físicamente ese stock esté en la tienda 1.
- Reportes de rotación son engañosos: no distinguen ubicación.
- Compras se reciben a la "empresa" sin saber en qué bodega entra la mercancía.
- Auditorías físicas contra stock del sistema son imposibles cuando hay varias ubicaciones.

### 1.2 Lo que resuelve este plan

- Modelo `Location` (STORE, WAREHOUSE) con posibilidad N sucursales + N bodegas.
- `ProductStock (productId, locationId, quantity, minStock, version)` — stock por ubicación.
- `StockTransfer` con flujo DRAFT → SENT → RECEIVED que mueve stock entre `Location` de manera trazable.
- Scoping por rol: `User.defaultLocationId`; un CASHIER ve ventas y stock solo de su ubicación.
- POS opera siempre contra la ubicación activa (selector en topbar).
- Compras y devoluciones se reciben/acreditan a `locationId` específica.
- Alertas de stock bajo por `(productId, locationId)`.
- Reportes filtrables por ubicación.

### 1.3 Fuera de alcance

- Multi-empresa (cada empresa con sus sucursales) — este plan asume una sola empresa.
- Asignación automática de pedidos e-commerce a la sucursal más cercana.
- Reposición automática desde bodega central (sugerida como Plan futuro).
- Distintas listas de precio por ubicación (fase posterior).

---

## 2. Decisiones de Arquitectura

### 2.1 DECISIÓN CRÍTICA: Product.stock vs ProductStock

| Criterio | Opción A — Mantener `Product.stock` como "stock total" + tabla `ProductLocationStock` auxiliar | Opción B — Eliminar `Product.stock` y hacer `ProductStock` la única fuente de verdad |
|---|---|---|
| Simplicidad de lectura | Alta (total visible directo) | Requiere `sum(quantity)` — mitigable con view |
| Riesgo de desincronización | **Alto** — dos fuentes que pueden divergir | Nulo — single source of truth |
| Cambios en queries existentes | Menor | Mayor — pero todas las queries quedan correctas |
| Migración | Simple (agregar tabla, backfill) | Compleja (backfill + drop column) |
| Consistencia a largo plazo | **Frágil** | Robusta |
| Recomendación | No | **Sí** |

**Decisión adoptada: Opción B — eliminar `Product.stock`.**

Justificación: mantener dos fuentes de stock (global + por ubicación) significa que cada operación de inventario debe actualizar ambas, y cualquier bug de concurrencia las desincroniza. El tiempo ahorrado al leer "el total" (una query simple con `sum`) no compensa el riesgo operacional.

### 2.2 Claves primarias de ProductStock

PK compuesta `(productId, locationId)`. Un `Product` tiene exactamente una fila `ProductStock` por `Location` donde haya stock (o se haya reservado minStock). Uniqueness garantizada por la PK compuesta — no necesitamos índice adicional.

### 2.3 Optimistic concurrency en ProductStock

Mismo patrón que `Product.version` actual (ver `backend/src/purchase-orders/purchase-orders.service.ts`):

```typescript
const updated = await tx.productStock.updateMany({
  where: { productId, locationId, version: currentVersion },
  data: { quantity: newQty, version: { increment: 1 } },
});
if (updated.count === 0) throw new ConflictException('Modificación concurrente…');
```

### 2.4 Flujo StockTransfer

```
DRAFT ─┬─► SENT (decrementa ProductStock origen) ─► RECEIVED (incrementa ProductStock destino con quantityReceived)
       │                                         │
       └─► CANCELLED (solo desde DRAFT)          └─► Si quantityReceived < quantitySent: genera InventoryMovement(DAMAGE) en destino por la diferencia
```

- En **SENT**: el stock ya no está en origen (no se puede vender). Está "en tránsito".
- En **RECEIVED**: el stock llega a destino. `quantityReceived` puede ser menor que `quantitySent` (merma en tránsito). La diferencia NO vuelve a origen — queda registrada como movimiento DAMAGE.
- Cancelación solo permitida en `DRAFT`. Un transfer SENT no puede cancelarse porque el stock ya salió de origen.
- Transferencia entre misma `from === to` se rechaza con 400.

### 2.5 Scoping por rol y ubicación activa

- **ADMIN**: ve todas las ubicaciones. Puede cambiar la ubicación activa libremente.
- **CASHIER**: ve solo ventas y stock de su `User.defaultLocationId`. El selector de ubicación está deshabilitado en la UI; el backend rechaza requests con `locationId` distinta (403).
- **INVENTORY_USER**: ve todas las ubicaciones (necesita gestionar transferencias y reposición).

La "ubicación activa" se persiste en `localStorage['active_location_id']` y se envía en query param `?locationId=` o header `X-Location-Id` a las APIs. El backend valida contra el rol del usuario.

### 2.6 Location default

Exactamente una Location debe tener `isDefault = true`. La migración crea `MAIN` como default. Enforced por partial unique index en Postgres:

```prisma
@@unique([isDefault], map: "unique_default_location", where: "isDefault = true")
```

(En Prisma 6: usar `@@index` con condición raw en migración SQL adicional si el generador no lo soporta directamente.)

---

## 3. Modelo de Datos (Prisma)

### 3.1 Nuevos enums y modelos

```prisma
enum LocationType {
  STORE
  WAREHOUSE
}

enum StockTransferStatus {
  DRAFT
  SENT
  RECEIVED
  CANCELLED
}

// Ampliación de InventoryMovement (tipos actuales: PURCHASE, SALE, ADJUSTMENT_IN, ADJUSTMENT_OUT, DAMAGE, RETURN)
enum InventoryMovementType {
  PURCHASE
  SALE
  ADJUSTMENT_IN
  ADJUSTMENT_OUT
  DAMAGE
  RETURN
  TRANSFER_OUT   // nuevo
  TRANSFER_IN    // nuevo
}

model Location {
  id            String        @id @default(uuid())
  code          String        @unique   // "MAIN", "STORE-02", "WH-CENTRAL"
  name          String
  type          LocationType  @default(STORE)
  address       String?
  phone         String?
  isActive      Boolean       @default(true)
  isDefault     Boolean       @default(false)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  stocks        ProductStock[]
  sales         Sale[]
  purchaseOrders PurchaseOrder[]
  transfersFrom StockTransfer[] @relation("TransferFromLocation")
  transfersTo   StockTransfer[] @relation("TransferToLocation")
  users         User[]
  movements     InventoryMovement[]

  @@index([isActive])
  @@index([isDefault])
}

model ProductStock {
  productId   String
  product     Product    @relation(fields: [productId], references: [id], onDelete: Cascade)
  locationId  String
  location    Location   @relation(fields: [locationId], references: [id])

  quantity    Int        @default(0)
  minStock    Int        @default(0)
  version     Int        @default(0)   // optimistic concurrency

  updatedAt   DateTime   @updatedAt

  @@id([productId, locationId])
  @@index([locationId])
  @@index([productId])
}

model StockTransfer {
  id               String               @id @default(uuid())
  code             String               @unique   // TRF-202604-0001 autogen
  fromLocationId   String
  fromLocation     Location             @relation("TransferFromLocation", fields: [fromLocationId], references: [id])
  toLocationId     String
  toLocation       Location             @relation("TransferToLocation", fields: [toLocationId], references: [id])
  status           StockTransferStatus  @default(DRAFT)
  notes            String?
  createdById      String
  createdBy        User                 @relation("TransferCreatedBy", fields: [createdById], references: [id])
  sentAt           DateTime?
  receivedAt       DateTime?
  cancelledAt      DateTime?

  items            StockTransferItem[]

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([status])
  @@index([fromLocationId, status])
  @@index([toLocationId, status])
  @@index([createdAt])
}

model StockTransferItem {
  id                String         @id @default(uuid())
  transferId        String
  transfer          StockTransfer  @relation(fields: [transferId], references: [id], onDelete: Cascade)
  productId         String
  product           Product        @relation(fields: [productId], references: [id])
  quantitySent      Int
  quantityReceived  Int?           // null hasta que status = RECEIVED

  @@index([transferId])
  @@index([productId])
}
```

### 3.2 Extensiones a modelos existentes

```prisma
// MODIFICAR modelo Product:
// REMOVER: stock Int
// El modelo queda sin campo stock. Las operaciones leen sum(ProductStock.quantity)
// o filtran por locationId.
// ⚠ Mantener `version` para compatibilidad con otras operaciones que no sean de stock.

model Product {
  id            String        @id @default(uuid())
  // ... resto de campos actuales ...
  // stock      Int          ← ELIMINADO
  version       Int           @default(0)   // SE MANTIENE (precio, active, etc.)
  stocks        ProductStock[]              // NUEVA relación
  transferItems StockTransferItem[]         // NUEVA relación
}

// MODIFICAR modelo User:
model User {
  // ... campos actuales ...
  defaultLocationId  String?
  defaultLocation    Location?   @relation(fields: [defaultLocationId], references: [id])
  transfersCreated   StockTransfer[] @relation("TransferCreatedBy")
}

// MODIFICAR modelo Sale:
model Sale {
  // ... campos actuales ...
  locationId     String
  location       Location   @relation(fields: [locationId], references: [id])
  @@index([locationId, createdAt])
}

// MODIFICAR modelo PurchaseOrder:
model PurchaseOrder {
  // ... campos actuales ...
  locationId     String
  location       Location   @relation(fields: [locationId], references: [id])
  @@index([locationId])
}

// MODIFICAR modelo InventoryMovement:
model InventoryMovement {
  // ... campos actuales ...
  locationId     String
  location       Location   @relation(fields: [locationId], references: [id])
  @@index([locationId, createdAt])
}
```

### 3.3 Migración de datos

**Archivo:** `backend/prisma/migrations/[ts]_feat_multi_location/migration.sql`

Dos fases — primero agregar todo lo nuevo (no-destructivo), luego una migración separada para dropear `Product.stock` una vez que backfilleamos.

```sql
-- PARTE 1: migración principal (generada por Prisma diff)
CREATE TYPE "LocationType" AS ENUM ('STORE', 'WAREHOUSE');
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'SENT', 'RECEIVED', 'CANCELLED');
ALTER TYPE "InventoryMovementType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "InventoryMovementType" ADD VALUE 'TRANSFER_IN';

CREATE TABLE "Location" (...);
CREATE TABLE "ProductStock" (...);
CREATE TABLE "StockTransfer" (...);
CREATE TABLE "StockTransferItem" (...);

ALTER TABLE "User"              ADD COLUMN "defaultLocationId" TEXT;
ALTER TABLE "Sale"              ADD COLUMN "locationId" TEXT;  -- NULL transitorio
ALTER TABLE "PurchaseOrder"     ADD COLUMN "locationId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "locationId" TEXT;
```

**Archivo:** `backend/prisma/migrations/[ts]_feat_multi_location/backfill.ts` — ejecutado manualmente post-migrate.

```typescript
// Crear MAIN como Location default y poblar ProductStock con Product.stock actual.
async function main() {
  const prisma = new PrismaClient();

  const main = await prisma.location.create({
    data: {
      code: 'MAIN',
      name: 'Sede principal',
      type: 'STORE',
      isActive: true,
      isDefault: true,
    },
  });

  // Backfill ProductStock desde Product.stock
  const products = await prisma.$queryRaw<Array<{ id: string; stock: number }>>`
    SELECT id, stock FROM "Product"
  `;
  for (const p of products) {
    await prisma.productStock.create({
      data: {
        productId: p.id,
        locationId: main.id,
        quantity: p.stock,
        version: 0,
      },
    });
  }

  // Backfill locationId en Sale / PurchaseOrder / InventoryMovement / User
  await prisma.$executeRaw`UPDATE "Sale"              SET "locationId" = ${main.id} WHERE "locationId" IS NULL`;
  await prisma.$executeRaw`UPDATE "PurchaseOrder"     SET "locationId" = ${main.id} WHERE "locationId" IS NULL`;
  await prisma.$executeRaw`UPDATE "InventoryMovement" SET "locationId" = ${main.id} WHERE "locationId" IS NULL`;
  await prisma.$executeRaw`UPDATE "User"              SET "defaultLocationId" = ${main.id} WHERE "defaultLocationId" IS NULL`;
}

main().finally(() => process.exit(0));
```

```bash
cd backend
npx prisma migrate dev --name feat-multi-location
npx ts-node prisma/migrations/[ts]_feat_multi_location/backfill.ts
```

**Archivo:** `backend/prisma/migrations/[ts]_finalize_multi_location/migration.sql` — ejecutada DESPUÉS del backfill.

```sql
-- Hacer locationId NOT NULL ahora que todos los registros tienen valor
ALTER TABLE "Sale"              ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "PurchaseOrder"     ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "InventoryMovement" ALTER COLUMN "locationId" SET NOT NULL;

-- Foreign keys
ALTER TABLE "Sale"              ADD CONSTRAINT "Sale_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id");
ALTER TABLE "PurchaseOrder"     ADD CONSTRAINT "PurchaseOrder_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id");
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id");
ALTER TABLE "User"              ADD CONSTRAINT "User_defaultLocationId_fkey"
  FOREIGN KEY ("defaultLocationId") REFERENCES "Location"("id");

-- Droppear Product.stock ahora que ProductStock es la fuente de verdad
ALTER TABLE "Product" DROP COLUMN "stock";

-- Partial unique index: solo una Location puede ser default
CREATE UNIQUE INDEX "unique_default_location"
  ON "Location" ("isDefault") WHERE ("isDefault" = true);
```

**Plan de rollback:** reverse order — agregar columna `stock` de nuevo, popular desde `sum(ProductStock.quantity)` por producto, droppear FK constraints, droppear tablas nuevas. Guardar el script de rollback junto a la migración.

---

## 4. Backend — Módulos y Cambios

### 4.1 Nuevos módulos

```
backend/src/locations/
├── dto/
│   ├── create-location.dto.ts
│   ├── update-location.dto.ts
│   └── query-locations.dto.ts
├── locations.controller.ts
├── locations.service.ts
└── locations.module.ts

backend/src/stock-transfers/
├── dto/
│   ├── create-transfer.dto.ts
│   ├── send-transfer.dto.ts
│   ├── receive-transfer.dto.ts
│   └── query-transfers.dto.ts
├── stock-transfers.controller.ts
├── stock-transfers.service.ts
└── stock-transfers.module.ts

backend/src/common/
├── decorators/
│   └── active-location.decorator.ts    // Param decorator lee X-Location-Id o ?locationId=
├── guards/
│   └── location-scope.guard.ts         // Valida que CASHIER opera sobre su defaultLocation
```

### 4.2 LocationsController — firma

```typescript
@Controller('locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationsController {
  @Get()    @Roles('ADMIN', 'CASHIER', 'INVENTORY_USER')
  findAll(@Query() q: QueryLocationsDto) {}

  @Get(':id')  @Roles('ADMIN', 'CASHIER', 'INVENTORY_USER')
  findOne(@Param('id') id: string) {}

  @Post()  @Roles('ADMIN')
  create(@Body() dto: CreateLocationDto) {}

  @Patch(':id')  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {}

  @Delete(':id')  @Roles('ADMIN')
  remove(@Param('id') id: string) {}

  @Post(':id/set-default')  @Roles('ADMIN')
  setDefault(@Param('id') id: string) {}
}
```

### 4.3 StockTransfersController — firma

```typescript
@Controller('stock-transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockTransfersController {
  @Get()    @Roles('ADMIN', 'INVENTORY_USER')
  findAll(@Query() q: QueryTransfersDto) {}

  @Get(':id')  @Roles('ADMIN', 'INVENTORY_USER')
  findOne(@Param('id') id: string) {}

  @Post()   @Roles('ADMIN', 'INVENTORY_USER')
  createDraft(@Body() dto: CreateTransferDto, @CurrentUser() user: AuthUser) {}

  @Patch(':id')  @Roles('ADMIN', 'INVENTORY_USER')
  updateDraft(@Param('id') id: string, @Body() dto: UpdateTransferDto) {}

  @Post(':id/send')     @Roles('ADMIN', 'INVENTORY_USER')
  send(@Param('id') id: string, @CurrentUser() user: AuthUser) {}

  @Post(':id/receive')  @Roles('ADMIN', 'INVENTORY_USER')
  receive(@Param('id') id: string, @Body() dto: ReceiveTransferDto, @CurrentUser() user: AuthUser) {}

  @Post(':id/cancel')   @Roles('ADMIN', 'INVENTORY_USER')
  cancel(@Param('id') id: string) {}
}
```

### 4.4 StockTransfersService — lógica crítica

```typescript
@Injectable()
export class StockTransfersService {
  constructor(private prisma: PrismaService) {}

  async createDraft(dto: CreateTransferDto, userId: string) {
    if (dto.fromLocationId === dto.toLocationId)
      throw new BadRequestException('Origen y destino no pueden ser iguales');

    const code = await this.generateTransferCode();
    return this.prisma.stockTransfer.create({
      data: {
        code,
        fromLocationId: dto.fromLocationId,
        toLocationId: dto.toLocationId,
        notes: dto.notes,
        createdById: userId,
        status: 'DRAFT',
        items: {
          create: dto.items.map(it => ({
            productId: it.productId,
            quantitySent: it.quantitySent,
          })),
        },
      },
      include: { items: true },
    });
  }

  /** SEND: decrementa ProductStock del origen. Transaccional. */
  async send(transferId: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUniqueOrThrow({
        where: { id: transferId },
        include: { items: true },
      });
      if (transfer.status !== 'DRAFT')
        throw new ConflictException(`No se puede enviar: status = ${transfer.status}`);

      for (const item of transfer.items) {
        const stock = await tx.productStock.findUnique({
          where: { productId_locationId: {
            productId: item.productId,
            locationId: transfer.fromLocationId,
          }},
        });
        if (!stock || stock.quantity < item.quantitySent) {
          throw new BadRequestException(
            `Stock insuficiente en origen para producto ${item.productId}`
          );
        }
        // Optimistic concurrency
        const updated = await tx.productStock.updateMany({
          where: {
            productId: item.productId,
            locationId: transfer.fromLocationId,
            version: stock.version,
          },
          data: {
            quantity: stock.quantity - item.quantitySent,
            version: { increment: 1 },
          },
        });
        if (updated.count === 0)
          throw new ConflictException('Stock modificado concurrentemente');

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            locationId: transfer.fromLocationId,
            type: 'TRANSFER_OUT',
            quantity: item.quantitySent,
            reason: `Transfer ${transfer.code}`,
          },
        });
      }

      return tx.stockTransfer.update({
        where: { id: transferId },
        data: { status: 'SENT', sentAt: new Date() },
      });
    });
  }

  /** RECEIVE: incrementa ProductStock destino con quantityReceived; diferencia → DAMAGE. */
  async receive(transferId: string, dto: ReceiveTransferDto) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUniqueOrThrow({
        where: { id: transferId },
        include: { items: true },
      });
      if (transfer.status !== 'SENT')
        throw new ConflictException(`Solo se pueden recibir transfers en SENT`);

      for (const item of transfer.items) {
        const received = dto.items.find(r => r.transferItemId === item.id);
        if (!received)
          throw new BadRequestException(`Falta quantityReceived para item ${item.id}`);
        if (received.quantityReceived > item.quantitySent)
          throw new BadRequestException('No se puede recibir más de lo enviado');

        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { quantityReceived: received.quantityReceived },
        });

        // Upsert en destino (puede no existir fila ProductStock para ese producto/ubicación)
        const destStock = await tx.productStock.upsert({
          where: { productId_locationId: {
            productId: item.productId,
            locationId: transfer.toLocationId,
          }},
          update: {
            quantity: { increment: received.quantityReceived },
            version: { increment: 1 },
          },
          create: {
            productId: item.productId,
            locationId: transfer.toLocationId,
            quantity: received.quantityReceived,
            version: 0,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            locationId: transfer.toLocationId,
            type: 'TRANSFER_IN',
            quantity: received.quantityReceived,
            reason: `Transfer ${transfer.code}`,
          },
        });

        const lost = item.quantitySent - received.quantityReceived;
        if (lost > 0) {
          // Pérdida en tránsito: registrar en destino como DAMAGE
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              locationId: transfer.toLocationId,
              type: 'DAMAGE',
              quantity: lost,
              reason: `Merma transfer ${transfer.code}`,
            },
          });
        }
      }

      return tx.stockTransfer.update({
        where: { id: transferId },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });
    });
  }

  private async generateTransferCode(): Promise<string> {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.prisma.stockTransfer.count({
      where: { code: { startsWith: `TRF-${yyyymm}-` } },
    });
    return `TRF-${yyyymm}-${String(count + 1).padStart(4, '0')}`;
  }
}
```

### 4.5 Cambios en módulos existentes

#### [MODIFY] `backend/src/app.module.ts`

```typescript
import { LocationsModule } from './locations/locations.module';
import { StockTransfersModule } from './stock-transfers/stock-transfers.module';

// En imports[]:
LocationsModule,
StockTransfersModule,
```

#### [MODIFY] `backend/src/products/products.service.ts`

- Eliminar todas las referencias a `product.stock`. Las queries de lectura ahora incluyen `stocks: true` o suman via query raw cuando se necesita el total.
- `findAll()` acepta query param `locationId` y retorna `quantity` de la fila `ProductStock` correspondiente. Si se omite: suma global.
- Nuevo endpoint `GET /products/:id/stock` devuelve breakdown: `[{ locationId, locationName, quantity, minStock }, ...]`.
- `create()` NO recibe stock — el stock inicial se crea con 0 en MAIN. Para stock inicial se usa un `InventoryMovement(ADJUSTMENT_IN)` o una orden de compra.

```typescript
async findAll(query: QueryProductsDto) {
  const { locationId, lowStock, ...filters } = query;

  if (locationId) {
    // Filtrar productos que tienen stock en esa ubicación
    return this.prisma.product.findMany({
      where: {
        ...this.buildFilterWhere(filters),
        stocks: { some: { locationId } },
      },
      include: {
        stocks: { where: { locationId } },
        category: true,
      },
    });
  }
  // Sin filtro: devolver todos con breakdown por ubicación
  return this.prisma.product.findMany({
    where: this.buildFilterWhere(filters),
    include: { stocks: { include: { location: true } }, category: true },
  });
}

async getStockByLocation(productId: string) {
  return this.prisma.productStock.findMany({
    where: { productId },
    include: { location: true },
  });
}
```

#### [MODIFY] `backend/src/products/products-search.controller.ts`

- `GET /products/low-stock?locationId=...` ahora filtra por `(ProductStock.quantity <= ProductStock.minStock)` en la ubicación dada.
- Sin `locationId`: devuelve productos con al menos una ubicación bajo mínimo.

#### [MODIFY] `backend/src/sales/sales.service.ts`

- `create()` ahora requiere `locationId` en el DTO (o lee de `@ActiveLocation()` param decorator).
- Al descontar stock usa `ProductStock` de la ubicación específica, no `Product.stock`.
- Optimistic concurrency en `ProductStock.version` en lugar de `Product.version`.

```typescript
// Dentro de la transacción:
for (const item of dto.items) {
  const stock = await tx.productStock.findUnique({
    where: { productId_locationId: {
      productId: item.productId,
      locationId: dto.locationId,
    }},
  });
  if (!stock || stock.quantity < item.quantity) {
    throw new BadRequestException(`Stock insuficiente en ubicación ${dto.locationId}`);
  }
  const updated = await tx.productStock.updateMany({
    where: {
      productId: item.productId,
      locationId: dto.locationId,
      version: stock.version,
    },
    data: {
      quantity: stock.quantity - item.quantity,
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConflictException('Stock modificado');

  await tx.inventoryMovement.create({
    data: {
      productId: item.productId,
      locationId: dto.locationId,
      type: 'SALE',
      quantity: item.quantity,
      reason: `Venta ${saleNumber}`,
    },
  });
}
```

- `buildScopeFilter` extiende el filtro role-based para incluir `locationId = user.defaultLocationId` cuando rol = CASHIER.

#### [MODIFY] `backend/src/purchase-orders/purchase-orders.service.ts`

- `create()` requiere `locationId` (la bodega que recibirá).
- `receive()` incrementa `ProductStock(productId, purchaseOrder.locationId)` en lugar de `Product.stock`.
- Patrón de optimistic concurrency se aplica sobre `ProductStock`.

#### [MODIFY] `backend/src/reports/reports.service.ts`

- Todos los reportes (ventas por día, top products, low stock) aceptan `locationId?` opcional.
- Sin `locationId`: consolidado global.
- Con `locationId`: filtrado por ubicación.
- Dashboard de ADMIN: agregado global + switcher por ubicación.

#### [MODIFY] `backend/src/imports/imports.service.ts`

- Plantilla CSV de productos ya NO incluye columna `stock`. Si se detecta: ignorar con warning.
- Nueva plantilla `stock.csv` con columnas `sku,locationCode,quantity,minStock` para ajustes iniciales.

### 4.6 ActiveLocation decorator + LocationScopeGuard

```typescript
// backend/src/common/decorators/active-location.decorator.ts
import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

export const ActiveLocation = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    const locationId =
      req.headers['x-location-id'] as string |
      req.query.locationId as string;
    if (!locationId) throw new BadRequestException('Se requiere X-Location-Id');
    return locationId;
  },
);
```

```typescript
// backend/src/common/guards/location-scope.guard.ts
@Injectable()
export class LocationScopeGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user: AuthUser = req.user;
    if (user.role === 'ADMIN' || user.role === 'INVENTORY_USER') return true;

    const locationId =
      req.headers['x-location-id'] || req.query.locationId || req.body?.locationId;
    if (user.role === 'CASHIER' && locationId !== user.defaultLocationId) {
      throw new ForbiddenException('No tenés acceso a esta ubicación');
    }
    return true;
  }
}
```

---

## 5. Frontend — Componentes y Páginas

### 5.1 LocationContext

```typescript
// frontend/src/contexts/LocationContext.tsx
"use client";
import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from '@/lib/api';

interface Location {
  id: string;
  code: string;
  name: string;
  type: 'STORE' | 'WAREHOUSE';
  isDefault: boolean;
  isActive: boolean;
}

interface LocationContextValue {
  activeLocationId: string | null;
  setActiveLocation: (id: string) => void;
  locations: Location[];
  activeLocation: Location | null;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get('/locations').then(r => {
      setLocations(r.data.data);
      // Elegir activa: si hay en localStorage + user puede acceder, usarla.
      // Si no, usar defaultLocationId del user o la location default.
      const stored = localStorage.getItem('active_location_id');
      if (user.role === 'CASHIER') {
        setActiveLocationId(user.defaultLocationId ?? null);
      } else if (stored && r.data.data.some((l: Location) => l.id === stored)) {
        setActiveLocationId(stored);
      } else {
        const def = r.data.data.find((l: Location) => l.isDefault);
        setActiveLocationId(def?.id ?? user.defaultLocationId ?? null);
      }
    });
  }, [user]);

  const setActiveLocation = (id: string) => {
    setActiveLocationId(id);
    localStorage.setItem('active_location_id', id);
  };

  const activeLocation = locations.find(l => l.id === activeLocationId) ?? null;

  return (
    <LocationContext.Provider value={{ activeLocationId, setActiveLocation, locations, activeLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be inside LocationProvider');
  return ctx;
}
```

Registrar `LocationProvider` en el árbol de providers dentro de `frontend/src/app/providers.tsx`.

### 5.2 Axios interceptor — inyectar X-Location-Id

```typescript
// frontend/src/lib/api.ts — MODIFY
api.interceptors.request.use((config) => {
  const locationId = localStorage.getItem('active_location_id');
  if (locationId) {
    config.headers['X-Location-Id'] = locationId;
  }
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### 5.3 Selector de ubicación en Sidebar / Topbar

```typescript
// frontend/src/components/layout/LocationSwitcher.tsx
"use client";
import { useLocation } from '@/contexts/LocationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Building2 } from 'lucide-react';

export function LocationSwitcher() {
  const { locations, activeLocationId, setActiveLocation } = useLocation();
  const { user } = useAuth();
  const disabled = user?.role === 'CASHIER';

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-muted/40">
      <Building2 className="w-4 h-4 text-muted-foreground" />
      <select
        className="bg-transparent text-sm outline-none disabled:opacity-60"
        value={activeLocationId ?? ''}
        onChange={(e) => setActiveLocation(e.target.value)}
        disabled={disabled}
      >
        {locations.filter(l => l.isActive).map(l => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
    </div>
  );
}
```

Integrar en `Sidebar.tsx` debajo del bloque de usuario.

### 5.4 Páginas nuevas

#### [CREATE] `frontend/src/app/locations/page.tsx`

Tabla CRUD de ubicaciones (solo ADMIN). Campos: code, name, type, address, phone, isActive, isDefault. Modal para crear/editar. Botón "Marcar como default" que llama POST `/locations/:id/set-default`.

#### [CREATE] `frontend/src/app/stock-transfers/page.tsx`

Lista paginada con filtros (status, from, to, fechas). Link a crear nuevo transfer.

#### [CREATE] `frontend/src/app/stock-transfers/new/page.tsx`

Wizard en 3 pasos:
1. Elegir origen y destino.
2. Agregar productos con cantidad (autocomplete de productos que tengan stock > 0 en origen).
3. Notas + review + crear DRAFT.

#### [CREATE] `frontend/src/app/stock-transfers/[id]/page.tsx`

Detalle del transfer con timeline (DRAFT → SENT → RECEIVED). Botones de acción según status:
- DRAFT: editar, cancelar, "Enviar".
- SENT: "Recibir" (abre modal con items y campo `quantityReceived` por item).
- RECEIVED / CANCELLED: solo lectura.

### 5.5 Cambios en páginas existentes

#### [MODIFY] `frontend/src/components/layout/Sidebar.tsx`

```typescript
import { Building2, ArrowLeftRight } from 'lucide-react';

// En navItems[]:
{
  label: 'Ubicaciones',
  href: '/locations',
  icon: <Building2 className="w-4 h-4" />,
  roles: ['ADMIN'],
},
{
  label: 'Transferencias',
  href: '/stock-transfers',
  icon: <ArrowLeftRight className="w-4 h-4" />,
  roles: ['ADMIN', 'INVENTORY_USER'],
},
```

Agregar `<LocationSwitcher />` debajo del bloque de usuario.

#### [MODIFY] `frontend/src/app/inventory/page.tsx`

Tabla de productos ahora muestra columna "Stock (ubicación activa)" y columna "Stock total" (suma). Al hacer click en un producto abre drawer con breakdown por ubicación.

#### [MODIFY] `frontend/src/app/pos/page.tsx`

Todo el flujo de carrito usa `locationId = activeLocationId`. Búsqueda de productos filtra a productos con stock en esa ubicación. Al pagar, el payload incluye `locationId`.

#### [MODIFY] `frontend/src/hooks/useProducts.ts`, `useSales.ts`, `useReports.ts`

Aceptan `locationId?` opcional y lo agregan al query. El interceptor de axios ya manda `X-Location-Id` — pero para reportes globales se puede pasar `null` explícitamente.

#### [MODIFY] `frontend/src/components/layout/DashboardLayout.tsx`

Rutas nuevas en el role-map: `/locations` = ADMIN, `/stock-transfers` = ADMIN + INVENTORY_USER.

---

## 6. APIs REST

| Method | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/api/locations` | ADMIN, CASHIER, INVENTORY_USER | Lista con filtros |
| GET | `/api/locations/:id` | ADMIN, CASHIER, INVENTORY_USER | Detalle |
| POST | `/api/locations` | ADMIN | Crear |
| PATCH | `/api/locations/:id` | ADMIN | Actualizar |
| DELETE | `/api/locations/:id` | ADMIN | Soft delete (isActive=false) |
| POST | `/api/locations/:id/set-default` | ADMIN | Marcar como default |
| GET | `/api/stock-transfers` | ADMIN, INVENTORY_USER | Lista con filtros |
| GET | `/api/stock-transfers/:id` | ADMIN, INVENTORY_USER | Detalle con items |
| POST | `/api/stock-transfers` | ADMIN, INVENTORY_USER | Crear DRAFT |
| PATCH | `/api/stock-transfers/:id` | ADMIN, INVENTORY_USER | Update DRAFT |
| POST | `/api/stock-transfers/:id/send` | ADMIN, INVENTORY_USER | DRAFT → SENT |
| POST | `/api/stock-transfers/:id/receive` | ADMIN, INVENTORY_USER | SENT → RECEIVED |
| POST | `/api/stock-transfers/:id/cancel` | ADMIN, INVENTORY_USER | DRAFT → CANCELLED |
| GET | `/api/products/:id/stock` | todos | Breakdown por ubicación |
| GET | `/api/products?locationId=...` | todos | Filtrado por ubicación |

DTOs clave:

```typescript
// create-transfer.dto.ts
export class CreateTransferDto {
  @IsUUID() fromLocationId!: string;
  @IsUUID() toLocationId!: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => TransferItemDto)
  items!: TransferItemDto[];
}

export class TransferItemDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantitySent!: number;
}

// receive-transfer.dto.ts
export class ReceiveTransferDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReceiveItemDto)
  items!: ReceiveItemDto[];
}
export class ReceiveItemDto {
  @IsUUID() transferItemId!: string;
  @IsInt() @Min(0) quantityReceived!: number;
}
```

---

## 7. Plan de Testing

### 7.1 Unit tests — StockTransfersService

- `createDraft` rechaza si `from === to`.
- `send` rechaza si stock insuficiente en origen.
- `send` decrementa `ProductStock` origen y crea `InventoryMovement(TRANSFER_OUT)`.
- `send` rechaza si status != DRAFT.
- `receive` rechaza si status != SENT.
- `receive` upsertea `ProductStock` destino si no existía.
- `receive` genera `DAMAGE` por la diferencia cuando `quantityReceived < quantitySent`.
- `receive` rechaza `quantityReceived > quantitySent`.
- `cancel` rechaza si status != DRAFT.
- `generateTransferCode` produce códigos secuenciales sin colisiones (concurrencia con 100 creates paralelos).

### 7.2 Unit tests — SalesService (tras refactor)

- `create` rechaza si stock insuficiente en `dto.locationId`.
- `create` no toca stock de otras ubicaciones.
- Optimistic concurrency: dos ventas concurrentes del último item → una falla con 409.
- CASHIER no puede crear venta con `locationId != defaultLocationId` (403).

### 7.3 E2E tests

- **Flujo completo transferencia**: crear DRAFT, add items, enviar, recibir parcial (80%), verificar stocks en ambos lados + DAMAGE por 20%.
- **Regresión POS**: ventas post-migración siguen funcionando con locationId=MAIN.
- **Multi-ubicación**: crear Location `STORE-02`, dar stock via ADJUSTMENT_IN, vender en STORE-02, verificar que MAIN no cambia.

### 7.4 Tests de migración

- Script de backfill es idempotente (correrlo 2x no duplica `ProductStock`).
- Suma de `Product.stock` pre-migración === suma de `ProductStock.quantity` post-migración para cada producto (invariante).

---

## 8. Fases de Implementación

### Fase 1 — Schema + migración + seed (10h)
- [ ] Agregar modelos al `schema.prisma`.
- [ ] Generar migración Prisma fase 1 (no destructiva).
- [ ] Escribir `backfill.ts`.
- [ ] Generar migración fase 2 (drop `Product.stock` + NOT NULL constraints).
- [ ] Actualizar `backend/prisma/seed.ts` para crear MAIN + un STORE-02 de demo.
- [ ] Correr en local + verificar invariante de stock.

### Fase 2 — Backend: Locations + ProductStock CRUD (15h)
- [ ] `LocationsModule` completo con controller, service, DTOs.
- [ ] Endpoint `GET /products/:id/stock` y adaptar `ProductsService.findAll` para aceptar `locationId`.
- [ ] `ActiveLocation` decorator + `LocationScopeGuard`.
- [ ] Tests unitarios.

### Fase 3 — Adaptar Sales / POs / Reports / Inventory (15h)
- [ ] Refactor `SalesService.create` para usar `ProductStock` con optimistic concurrency.
- [ ] Refactor `PurchaseOrdersService.receive`.
- [ ] Refactor `ReportsService` para aceptar `locationId`.
- [ ] Ajustar `ImportsService`.
- [ ] Ajustar `products-search.controller` low-stock.
- [ ] Tests de regresión.

### Fase 4 — Backend: StockTransfers completo (15h)
- [ ] `StockTransfersModule` con controller, service, DTOs.
- [ ] Lógica de send, receive, cancel con optimistic concurrency y transacciones.
- [ ] `generateTransferCode` con tests de concurrencia.
- [ ] E2E de flujo completo.

### Fase 5 — Frontend (20h)
- [ ] `LocationContext` + `LocationProvider`.
- [ ] Interceptor Axios X-Location-Id.
- [ ] `LocationSwitcher` en Sidebar.
- [ ] Páginas `/locations` (CRUD).
- [ ] Páginas `/stock-transfers` (lista + wizard + detalle).
- [ ] Adaptar `/inventory`, `/pos`, `/sales`, hooks.
- [ ] Drawer "Stock por ubicación" en inventory.

### Fase 6 — Tests E2E + documentación (10h)
- [ ] E2E flujo transferencia.
- [ ] E2E POS con 2 ubicaciones.
- [ ] Documentación de operación (runbook de migración en producción).
- [ ] Checklist de aceptación.

**Total: 85h (con margen 70–90h).**

---

## 9. Riesgos y Mitigaciones

### 9.1 Migración en producción rompe operación

Bajar el sistema, correr migración fase 1 + backfill + fase 2, levantar. Dependiendo del volumen de productos, backfill puede tardar minutos. Alternativa zero-downtime: deploy con código "dual-read" (lee de `Product.stock` si ProductStock no existe, de ProductStock si existe) durante la migración — más complejo, solo si no hay ventana de mantenimiento.

### 9.2 Concurrencia en `send` de transferencia

Dos usuarios intentan enviar el mismo transfer al tiempo o el stock es modificado por una venta simultánea. Mitigación: `ProductStock.version` + `updateMany` pattern. La segunda transacción falla con 409.

### 9.3 Usuario confundido por selector de ubicación

Al cambiar de ubicación, todas las páginas reciben nueva data y el user puede pensar que "se perdieron" sus datos. Mitigación: UI clara con chip persistente "Viendo: Sucursal X"; al cambiar, toast informativo "Mostrando datos de Sucursal Y"; en POS mostrar banner grande cuando la ubicación activa cambia mid-venta.

### 9.4 Reportes globales vs por ubicación inconsistentes

Un admin viendo dashboard global y un cashier viendo solo su ubicación pueden tener números distintos por motivos legítimos. Mitigación: todos los números en UI muestran el scope explícito ("Ventas de HOY · Sucursal Centro").

### 9.5 Import de productos con columna "stock"

CSV legacy que aún trae columna stock. Ignorar con warning y sugerir usar plantilla nueva de ajuste.

---

## 10. Checklist de Aceptación

- [ ] `Product.stock` no existe en schema.
- [ ] Toda venta registra `locationId`.
- [ ] Toda compra registra `locationId`.
- [ ] `ProductStock` tiene una fila por cada `(productId, locationId)` donde haya operado stock.
- [ ] `sum(ProductStock.quantity)` por producto === stock real físico (verificar con inventario físico en al menos una ubicación).
- [ ] CASHIER no puede acceder a ubicación distinta de su `defaultLocationId`.
- [ ] Transferencia DRAFT → SENT → RECEIVED deja stock correcto en ambas ubicaciones.
- [ ] Transferencia con `quantityReceived < quantitySent` genera `InventoryMovement(DAMAGE)` en destino.
- [ ] Cancelar transfer en SENT retorna 409.
- [ ] Dashboard admin tiene switcher por ubicación.
- [ ] Alertas de low-stock funcionan por ubicación.
- [ ] Reportes filtrables por ubicación.
- [ ] Migración idempotente (correrla dos veces no corrompe).
- [ ] Plan de rollback probado en staging.

---

_Plan 05 de 7 — roadmap MeperPOS · Fecha: 2026-04-21_
