# Plan 02 — Notas Crédito / Devoluciones Formales

> **Principio rector:** El módulo de notas crédito es un agregado independiente que referencia ventas existentes, nunca las muta directamente excepto por su `status`. Toda operación financiera que afecte stock o contabilidad se ejecuta dentro de una sola transacción Prisma.

---

## 1. Contexto y motivación

### ¿Qué falta hoy?

El sistema registra ventas con `SaleStatus { COMPLETED, CANCELLED, RETURNED_PARTIAL }` pero no existe ningún mecanismo formal para:

1. Emitir una nota crédito con numeración consecutiva independiente de la factura de venta.
2. Registrar el motivo legal de la devolución según los códigos DIAN.
3. Vincular la nota crédito a la venta original con trazabilidad completa.
4. Restaurar stock de forma auditada por ítem devuelto.
5. Registrar el método de reembolso (efectivo, reversa tarjeta, saldo a favor).

El flujo actual de cancelación en `sales.service.ts → update()` que maneja `CANCELLED` restituye stock pero no genera ningún documento formal, no tiene numeración propia y no distingue devolución parcial de anulación total.

### Driver legal (Colombia — DIAN)

La Resolución DIAN 000012/2021 y sus anexos técnicos UBL exigen que toda corrección a una factura de venta se documente mediante una **Nota Crédito Electrónica** con:

- Numeración consecutiva propia (independiente del consecutivo de ventas).
- Código de concepto de corrección (`cbc:DiscrepancyResponse/cbc:Description`).
- Referencia al CUFE de la factura original.
- Detalle de líneas corregidas con cantidades y valores.
- Firma del autorizador.

El sistema no emite facturas electrónicas DIAN aún (es una POS de tiquete térmico), pero la estructura de datos debe ser compatible para una futura integración con un proveedor tecnológico DIAN (ver plan 04). Además, operacionalmente el negocio necesita el documento para conciliar caja y justificar ajustes de inventario ante una auditoría.

---

## 2. Decisiones de arquitectura

| # | Decisión | Opciones consideradas | Elegida | Rationale |
|---|----------|-----------------------|---------|-----------|
| 1 | ¿Agregar `RETURNED_FULL` al enum `SaleStatus` o usar flag booleano? | (a) nuevo valor enum, (b) campo `fullyReturned: Boolean` | **(a) nuevo valor enum `RETURNED_FULL`** | Consistente con el patrón existente; queries por status son directas; no requiere campo adicional. El enum ya tiene `RETURNED_PARTIAL`. |
| 2 | ¿`CreditNote` como modelo separado o campo en `Sale`? | (a) tabla propia `CreditNote`, (b) campo JSON en `Sale` | **(a) tabla propia `CreditNote`** | Una venta puede tener múltiples notas crédito parciales. La tabla propia permite relaciones, indexes, y es consultable de forma independiente. |
| 3 | ¿Las notas crédito son inmutables después de `AUTHORIZED`? | (a) sí, inmutables; (b) permitir edición con versionado | **(a) inmutables post-autorización** | Equivale a un documento contable firmado. Solo se puede anular (`VOID`) y emitir una nueva. Evita doble-gasto y es coherente con los principios DIAN. |
| 4 | ¿Quién puede autorizar? | (a) solo ADMIN, (b) ADMIN + CASHIER supervisor | **(a) solo ADMIN** | Separación de responsabilidades. El cajero crea el borrador; el admin lo aprueba. Refleja el principio de "cuatro ojos" para operaciones que afectan caja. |
| 5 | ¿Cómo modelar el reembolso? | (a) tabla `CreditNoteRefund` separada, (b) campo enum en `CreditNote`, (c) JSON | **(a) tabla `CreditNoteRefund`** | Un reembolso puede ser mixto (parte efectivo, parte saldo a favor). Mismo patrón que `Payment` en `Sale`. |
| 6 | ¿Concurrencia en restauración de stock? | (a) `updateMany` con `where: { id, version }` igual que purchase-orders; (b) SELECT FOR UPDATE | **(a) `updateMany` con `version`** | Patrón ya establecido en `purchase-orders.service.ts → receive()`. Lanza `ConflictException` si otra operación modificó el producto en paralelo. |
| 7 | ¿Módulo propio o extender `SalesModule`? | (a) módulo `credit-notes` independiente, (b) métodos adicionales en `SalesService` | **(a) módulo `credit-notes` independiente** | Screaming Architecture: el módulo grita su propio propósito. `SalesModule` no debería crecer indefinidamente. Solo exporta `CreditNotesService` para que `ReportsModule` pueda consumirlo. |
| 8 | ¿PDF de nota crédito en backend o frontend? | (a) backend genera PDF (patrón existente `sales.service.ts → generateReceipt`), (b) frontend con jsPDF | **(a) backend genera PDF** | Consistente con el patrón de recibo. El endpoint `GET /credit-notes/:id/pdf` devuelve `application/pdf`. |

---

## 3. Modelo de datos (Prisma)

### 3.1 Cambios al schema existente

#### Archivo: `backend/prisma/schema.prisma`

**Agregar `RETURNED_FULL` al enum `SaleStatus`:**

```prisma
enum SaleStatus {
  COMPLETED
  CANCELLED
  RETURNED_PARTIAL
  RETURNED_FULL    // ← NUEVO: todos los ítems devueltos vía nota crédito
}
```

**Agregar relación inversa en `Sale`:**

```prisma
model Sale {
  // ... campos existentes sin cambio ...
  creditNotes        CreditNote[]       // ← NUEVO: relación inversa
}
```

**Agregar relación inversa en `User`:**

```prisma
model User {
  // ... campos existentes sin cambio ...
  authorizedCreditNotes CreditNote[] @relation("AuthorizedBy")  // ← NUEVO
}
```

**Agregar `creditNoteId` en `InventoryMovement`:**

```prisma
model InventoryMovement {
  // ... campos existentes ...
  creditNoteId  String?
  creditNote    CreditNote? @relation(fields: [creditNoteId], references: [id])
}
```

### 3.2 Nuevos modelos

```prisma
// ─── Enums de Nota Crédito ───────────────────────────────────────────────────

enum CreditNoteReason {
  DEVOLUCION_PRODUCTOS   // Devolución de mercancía
  ANULACION              // Anulación de la operación
  REBAJA                 // Rebaja de precio
  DESCUENTO              // Descuento posterior
  OTROS                  // Otros (requiere campo notes)
}

enum CreditNoteStatus {
  DRAFT       // Creada, pendiente de autorización
  AUTHORIZED  // Autorizada por ADMIN, stock restaurado
  VOID        // Anulada (no genera efectos contables ni de inventario)
}

enum RefundMethod {
  CASH_RETURN      // Devolución en efectivo
  CARD_REVERSAL    // Reversión a tarjeta
  STORE_CREDIT     // Saldo a favor del cliente
  BANK_TRANSFER    // Transferencia bancaria
}

// ─── Nota Crédito ────────────────────────────────────────────────────────────

model CreditNote {
  id                 String           @id @default(uuid())
  creditNoteNumber   Int              @unique @default(autoincrement())
  originalSaleId     String
  originalSale       Sale             @relation(fields: [originalSaleId], references: [id], onDelete: Restrict)
  reason             CreditNoteReason
  notes              String?
  status             CreditNoteStatus @default(DRAFT)
  subtotal           Decimal          @db.Decimal(10, 2)
  taxAmount          Decimal          @db.Decimal(10, 2)
  totalAmount        Decimal          @db.Decimal(10, 2)
  createdById        String
  createdBy          User             @relation(fields: [createdById], references: [id])
  authorizedById     String?
  authorizedBy       User?            @relation("AuthorizedBy", fields: [authorizedById], references: [id])
  authorizedAt       DateTime?
  voidedAt           DateTime?
  voidReason         String?
  items              CreditNoteItem[]
  refunds            CreditNoteRefund[]
  inventoryMovements InventoryMovement[]
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  @@index([originalSaleId])
  @@index([status])
  @@index([createdAt])
  @@index([createdById])
  @@index([authorizedById])
}

// ─── Ítem de Nota Crédito ────────────────────────────────────────────────────

model CreditNoteItem {
  id             String     @id @default(uuid())
  creditNoteId   String
  creditNote     CreditNote @relation(fields: [creditNoteId], references: [id], onDelete: Cascade)
  originalItemId String
  originalItem   SaleItem   @relation(fields: [originalItemId], references: [id], onDelete: Restrict)
  productId      String
  product        Product    @relation(fields: [productId], references: [id], onDelete: Restrict)
  quantity       Int
  unitPrice      Decimal    @db.Decimal(10, 2)
  taxRate        Decimal    @db.Decimal(5, 2)
  subtotal       Decimal    @db.Decimal(10, 2)
  total          Decimal    @db.Decimal(10, 2)

  @@index([creditNoteId])
  @@index([originalItemId])
  @@index([productId])
}

// ─── Reembolso de Nota Crédito ───────────────────────────────────────────────

model CreditNoteRefund {
  id           String       @id @default(uuid())
  creditNoteId String
  creditNote   CreditNote   @relation(fields: [creditNoteId], references: [id], onDelete: Cascade)
  method       RefundMethod
  amount       Decimal      @db.Decimal(10, 2)
  reference    String?
  createdAt    DateTime     @default(now())

  @@index([creditNoteId])
}
```

**Agregar relaciones inversas:**

```prisma
model SaleItem {
  // ... campos existentes ...
  creditNoteItems CreditNoteItem[]
}

model Product {
  // ... campos existentes ...
  creditNoteItems CreditNoteItem[]
}
```

### 3.3 Nombre de migración

```
npx prisma migrate dev --name add_credit_notes_module
```

### 3.4 Consideraciones sobre autoincrement de `creditNoteNumber`

`@default(autoincrement())` en PostgreSQL usa una secuencia separada por tabla. Garantiza consecutividad sin gaps en condiciones normales. El prefijo `NC-` se aplica en la capa de presentación, no en BD.

---

## 4. Backend — Módulo `credit-notes`

### 4.1 Estructura de archivos

```
backend/src/credit-notes/
├── credit-notes.module.ts
├── credit-notes.controller.ts
├── credit-notes.service.ts
└── dto/
    ├── create-credit-note.dto.ts
    ├── authorize-credit-note.dto.ts
    ├── void-credit-note.dto.ts
    ├── query-credit-notes.dto.ts
    ├── credit-note-item.dto.ts
    └── refund.dto.ts
```

### 4.2 `credit-notes.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service';
import { CreditNotesController } from './credit-notes.controller';

@Module({
  controllers: [CreditNotesController],
  providers: [CreditNotesService],
  exports: [CreditNotesService],  // exportado para ReportsModule
})
export class CreditNotesModule {}
```

Registrar en `app.module.ts`: `imports: [..., CreditNotesModule]`.

### 4.3 `credit-notes.controller.ts`

```typescript
@ApiTags('CreditNotes')
@Controller('credit-notes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CreditNotesController {
  constructor(private creditNotesService: CreditNotesService) {}

  @Post()
  @Roles('ADMIN', 'CASHIER')
  create(@Body() dto: CreateCreditNoteDto, @Request() req) {
    return this.creditNotesService.create(dto, req.user.sub);
  }

  @Get()
  @Roles('ADMIN', 'CASHIER')
  findAll(@Query() query: QueryCreditNotesDto) {
    return this.creditNotesService.findAll(query);
  }

  @Get(':id')
  @Roles('ADMIN', 'CASHIER')
  findOne(@Param('id') id: string) {
    return this.creditNotesService.findOne(id);
  }

  @Post(':id/authorize')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  authorize(@Param('id') id: string, @Body() dto: AuthorizeCreditNoteDto, @Request() req) {
    return this.creditNotesService.authorize(id, dto, req.user.sub);
  }

  @Post(':id/void')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  void(@Param('id') id: string, @Body() dto: VoidCreditNoteDto, @Request() req) {
    return this.creditNotesService.voidCreditNote(id, dto, req.user.sub);
  }

  @Get(':id/pdf')
  @Roles('ADMIN', 'CASHIER')
  pdf(@Param('id') id: string, @Res() res: Response) {
    return this.creditNotesService.generatePdf(id, res);
  }
}
```

### 4.4 DTOs principales

```typescript
// create-credit-note.dto.ts
export class CreateCreditNoteDto {
  @IsUUID() originalSaleId: string;
  @IsEnum(CreditNoteReasonDto) reason: CreditNoteReasonDto;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => CreditNoteItemDto) items: CreditNoteItemDto[];
}

// credit-note-item.dto.ts
export class CreditNoteItemDto {
  @IsUUID() originalItemId: string;
  @IsInt() @Min(1) quantity: number;
}

// authorize-credit-note.dto.ts
export class AuthorizeCreditNoteDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => RefundDto) refunds: RefundDto[];
  @IsOptional() @IsString() authorizationNote?: string;
}

// refund.dto.ts
export class RefundDto {
  @IsEnum(RefundMethodDto) method: RefundMethodDto;
  @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsString() reference?: string;
}

// void-credit-note.dto.ts
export class VoidCreditNoteDto {
  @IsString() @MinLength(5) reason: string;
}

// query-credit-notes.dto.ts
export class QueryCreditNotesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsUUID() originalSaleId?: string;
  @IsOptional() @IsEnum(['DRAFT', 'AUTHORIZED', 'VOID']) status?: CreditNoteStatus;
  @IsOptional() @IsUUID() createdById?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsString() q?: string;
}
```

### 4.5 `credit-notes.service.ts` — Firmas y flujos

```typescript
@Injectable()
export class CreditNotesService {
  constructor(private prisma: PrismaService) {}

  private readonly defaultInclude = {
    originalSale: { include: { customer: true, payments: true } },
    items: { include: { product: true, originalItem: true } },
    refunds: true,
    createdBy: { select: { id: true, name: true, email: true } },
    authorizedBy: { select: { id: true, name: true, email: true } },
  };

  async create(dto: CreateCreditNoteDto, userId: string): Promise<CreditNote>
  async findAll(query: QueryCreditNotesDto): Promise<PaginatedResponse<CreditNote>>
  async findOne(id: string): Promise<CreditNote>
  async authorize(id: string, dto: AuthorizeCreditNoteDto, adminId: string): Promise<CreditNote>
  async voidCreditNote(id: string, dto: VoidCreditNoteDto, adminId: string): Promise<CreditNote>
  async generatePdf(id: string, response: Response): Promise<void>
}
```

#### Flujo `create(dto, userId)`

1. Buscar la venta `originalSaleId` con `include: { items: true }`. Lanzar `NotFoundException` si no existe.
2. Validar que `sale.status === 'COMPLETED' || sale.status === 'RETURNED_PARTIAL'`. Si es `CANCELLED` o `RETURNED_FULL`, `BadRequestException('La venta no admite devoluciones')`.
3. Calcular cantidades ya devueltas: sumar por `originalItemId` todas las `CreditNoteItem` con `creditNote.status !== 'VOID'`.
4. Para cada ítem en `dto.items`:
   - Encontrar `SaleItem` correspondiente. `NotFoundException` si no pertenece a la venta.
   - Calcular `remainingQty = saleItem.quantity - qtyCreditedSoFar`. `BadRequestException` si `dto.quantity > remainingQty`.
   - Usar `unitPrice`, `taxRate` del `SaleItem` original (no recalcular).
5. Si `dto.reason === 'OTROS'` y `!dto.notes` → `BadRequestException`.
6. Calcular totales.
7. Crear `CreditNote` + `CreditNoteItem[]` en `$transaction`. No toca stock ni venta.
8. `AuditLog.create({ action: 'CREDIT_NOTE_CREATED', ... })`.
9. `return this.findOne(creditNote.id)`.

#### Flujo `authorize(id, dto, adminId)`

**Todo dentro de `this.prisma.$transaction(async (tx) => { ... })`:**

1. Cargar la nota crédito con items y producto.
2. Validar `status === 'DRAFT'`. Si `AUTHORIZED` → `ConflictException`. Si `VOID` → `BadRequestException`.
3. Validar `sum(dto.refunds.map(r => r.amount)) === creditNote.totalAmount` (±0.01).
4. Validar requisito de `reference` para `CARD_REVERSAL` y `BANK_TRANSFER`.
5. Para cada ítem — restauración de stock con concurrencia optimista:
   ```typescript
   const product = await tx.product.findUnique({ where: { id: item.productId } });
   const previousStock = product.stock;
   const newStock = previousStock + item.quantity;
   const currentVersion = product.version;

   const updated = await tx.product.updateMany({
     where: { id: item.productId, version: currentVersion },
     data: {
       stock: { increment: item.quantity },
       version: { increment: 1 },
     },
   });

   if (updated.count === 0) {
     throw new ConflictException(
       `Modificación concurrente en producto ${item.productId}`,
     );
   }

   await tx.inventoryMovement.create({
     data: {
       productId: item.productId,
       type: 'RETURN',
       quantity: item.quantity,
       previousStock,
       newStock,
       reason: `NC-${creditNote.creditNoteNumber}`,
       userId: adminId,
       saleId: creditNote.originalSaleId,
       creditNoteId: creditNote.id,
     },
   });
   ```
6. Recalcular `sale.status`:
   - Todas las líneas devueltas completamente → `RETURNED_FULL`.
   - Parcial → `RETURNED_PARTIAL`.
7. Crear `CreditNoteRefund[]` según `dto.refunds`.
8. Actualizar `CreditNote`: `status: AUTHORIZED, authorizedById, authorizedAt`.
9. `AuditLog.create({ action: 'CREDIT_NOTE_AUTHORIZED', ... })`.
10. `this.cache.clear('dashboard:')`.
11. `return this.findOne(id)`.

#### Flujo `voidCreditNote(id, dto, adminId)`

1. Cargar nota. `NotFoundException` si no existe.
2. Si `status === 'AUTHORIZED'` → `BadRequestException('Una NC autorizada no se anula; emita una correctiva')`.
3. Si `status === 'VOID'` → `BadRequestException('Ya anulada')`.
4. Si `status === 'DRAFT'`:
   - `update({ status: 'VOID', voidedAt, voidReason })`.
   - `AuditLog.create(...)`.

#### Flujo `generatePdf(id, response)`

Espejo de `sales.service.ts → generateReceipt()`. Formato 80mm x 200mm vía `jsPDF`:
- Encabezado empresa (de `Settings`).
- `NOTA CRÉDITO NC-${creditNoteNumber}`.
- `Venta origen: #${originalSale.saleNumber}`.
- Razón.
- Tabla ítems.
- Totales.
- Reembolsos.
- Fecha autorización + autorizador.
- Headers `application/pdf`.

---

## 5. Frontend — Páginas y componentes

### 5.1 Sidebar — nuevo ítem

`frontend/src/components/layout/Sidebar.tsx`, después de "Ventas":

```typescript
{
  label: "Notas Crédito",
  href: "/credit-notes",
  icon: <FileMinus className="w-4 h-4" />,
  roles: ["ADMIN", "CASHIER"],
},
```

### 5.2 Tipos TypeScript

```typescript
export type CreditNoteStatus = 'DRAFT' | 'AUTHORIZED' | 'VOID';
export type CreditNoteReason = 'DEVOLUCION_PRODUCTOS' | 'ANULACION' | 'REBAJA' | 'DESCUENTO' | 'OTROS';
export type RefundMethod = 'CASH_RETURN' | 'CARD_REVERSAL' | 'STORE_CREDIT' | 'BANK_TRANSFER';

export interface CreditNoteItem { /* id, creditNoteId, originalItemId, productId, quantity, unitPrice, taxRate, subtotal, total */ }
export interface CreditNoteRefund { /* id, creditNoteId, method, amount, reference?, createdAt */ }
export interface CreditNote { /* id, creditNoteNumber, originalSaleId, originalSale, reason, notes?, status, subtotal, taxAmount, totalAmount, createdBy, authorizedBy?, authorizedAt?, voidedAt?, voidReason?, items, refunds, createdAt */ }
```

### 5.3 Hook `useCreditNotes.ts`

Espejo de `usePurchaseOrders.ts` con queries/mutations:

- `useCreditNotes(params?)` — lista paginada.
- `useCreditNote(id)` — detalle.
- `useCreateCreditNote()` — mutation POST.
- `useAuthorizeCreditNote()` — mutation POST :id/authorize.
- `useVoidCreditNote()` — mutation POST :id/void.
- `downloadCreditNotePdf(id)` — helper `window.open` al endpoint PDF.

Invalida `['credit-notes']`, `['credit-note', id]`, `['sales']`, `['products']`, `['dashboard']` en onSuccess.

### 5.4 Componentes de feature

- `credit-notes/CreditNoteStatusBadge.tsx` — espejo de `PurchaseOrderStatusBadge.tsx`. Config: `DRAFT: neutral`, `AUTHORIZED: success`, `VOID: danger`.
- `credit-notes/CreditNoteItemsTable.tsx` — columnas: Producto | Precio | Disponible | A devolver (editable o readonly) | Subtotal | Total.
- `credit-notes/AuthorizeCreditNoteModal.tsx` — lista editable de reembolsos, validación en tiempo real de que la suma cuadre con `totalAmount`, input de referencia obligatorio para `CARD_REVERSAL`/`BANK_TRANSFER`.

### 5.5 Páginas

#### `/credit-notes/page.tsx` (lista)

Filtros `status`, `dateFrom`, `dateTo`, `q`. Columnas: NC# | Venta origen | Razón | Total | Estado | Creada por | Fecha | Acciones. Botón "Nueva nota crédito" → `/credit-notes/new`. Paginación.

#### `/credit-notes/new/page.tsx` (creación)

- Input búsqueda de venta origen. Si viene `?saleId=...`, pre-carga.
- Carga ítems de la venta + cantidades ya devueltas.
- Select razón + textarea notas (obligatoria si `OTROS`).
- `CreditNoteItemsTable` editable.
- Resumen de totales en tiempo real.
- Botón "Crear (borrador)".

#### `/credit-notes/[id]/page.tsx` (detalle)

Espejo de `/purchase-orders/[id]/page.tsx`:
- Header: `NC-${number}` + badge + fecha.
- Info: venta origen (link), motivo, notas, creado por, autorizado por.
- `CreditNoteItemsTable` readonly.
- Tabla de reembolsos.
- Acciones:
  - `DRAFT` + ADMIN: "Autorizar" (modal) / "Anular" (confirm).
  - `AUTHORIZED`: "Descargar PDF".

### 5.6 Integración en `/sales/[id]/page.tsx`

```typescript
{sale.status !== 'CANCELLED' && sale.status !== 'RETURNED_FULL' && (
  <Button
    variant="secondary"
    onClick={() => router.push(`/credit-notes/new?saleId=${sale.id}`)}
  >
    <FileMinus className="w-4 h-4" /> Emitir nota crédito
  </Button>
)}
```

Sección "Notas crédito relacionadas" al final:

```typescript
const { data } = useCreditNotes({ originalSaleId: saleId });
// Renderizar lista con NC#, estado, monto, link al detalle
```

---

## 6. Integraciones cross-cutting

### 6.1 Módulo de reportes

`backend/src/reports/reports.service.ts` — agregar:

```typescript
async getCreditNoteSummary(dateFrom?: string, dateTo?: string) {
  const where: Record<string, unknown> = { status: 'AUTHORIZED' };
  if (dateFrom || dateTo) {
    const authorizedAt: Record<string, Date> = {};
    if (dateFrom) authorizedAt.gte = parseBogotaStartOfDay(dateFrom);
    if (dateTo) authorizedAt.lte = parseBogotaEndOfDay(dateTo);
    where.authorizedAt = authorizedAt;
  }
  const [count, aggregate] = await Promise.all([
    this.prisma.creditNote.count({ where: where as never }),
    this.prisma.creditNote.aggregate({
      where: where as never,
      _sum: { totalAmount: true, taxAmount: true },
    }),
  ]);
  return {
    count,
    totalReturned: Number(aggregate._sum.totalAmount ?? 0),
    totalTaxReturned: Number(aggregate._sum.taxAmount ?? 0),
  };
}
```

Exponer en controller: `GET /reports/credit-notes-summary`.

### 6.2 Integración en POS

Modal post-venta: botón secundario "Emitir nota crédito" → navega a `/credit-notes/new?saleId=${completedSaleId}`.

### 6.3 Dashboard

Stat card "Devoluciones hoy" consumiendo `GET /reports/credit-notes-summary?dateFrom=today&dateTo=today`.

---

## 7. Migraciones y backfill

### 7.1 Pasos

```bash
cd backend
npx prisma migrate dev --name add_credit_notes_module
```

### 7.2 Zero-downtime

La migración es solo aditiva:
- Nuevas tablas, nuevos enums, nuevo valor en `SaleStatus`, columna nullable en `InventoryMovement`.
- **Atención:** `ALTER TYPE "SaleStatus" ADD VALUE 'RETURNED_FULL'` es no-transaccional en PostgreSQL. Verificar que la migración generada lo ejecute fuera del bloque de transacción DDL.

### 7.3 Backfill

No se requiere. Campo `creditNoteId` en `InventoryMovement` es nullable y solo se pobla en movimientos nuevos.

---

## 8. Plan de testing

### 8.1 Unit — `credit-notes.service.spec.ts`

| Test | Invariante |
|------|-----------|
| `create` — venta COMPLETED | Status DRAFT, ítems desde SaleItem |
| `create` — venta CANCELLED | BadRequestException |
| `create` — cantidad excede disponible | BadRequestException |
| `create` — reason OTROS sin notes | BadRequestException |
| `authorize` — suma reembolsos no cuadra | BadRequestException |
| `authorize` — concurrencia optimista | ConflictException |
| `authorize` — actualiza sale.status a RETURNED_FULL | Correcto |
| `authorize` — RETURNED_PARTIAL | Correcto |
| `authorize` — doble autorización | ConflictException |
| `voidCreditNote` — AUTHORIZED | BadRequestException |
| `voidCreditNote` — DRAFT | Cambia a VOID |

### 8.2 E2E — `backend/test/credit-notes.e2e-spec.ts`

```
1. Login CASHIER → token
2. Crear venta con 2 ítems
3. Crear NC con 1 ítem (DRAFT) → 201
4. GET NC → status DRAFT
5. Login ADMIN → token
6. POST authorize → 200, status AUTHORIZED
7. GET sale → status RETURNED_PARTIAL
8. GET inventory movements → tipo RETURN con qty correcto
9. GET NC pdf → Content-Type application/pdf
10. POST void → 400 (ya autorizada)
```

### 8.3 Frontend

- `/credit-notes/page.behavior.test.tsx` — lista, filtros, navegación.
- `AuthorizeCreditNoteModal.test.tsx` — validación de suma, llamado al mutation.

---

## 9. Rollout — fases

### Fase A — Modelo + Borrador

- [ ] Schema: enum `RETURNED_FULL` + modelos + relaciones.
- [ ] Migración `add_credit_notes_module`.
- [ ] Módulo backend con `create`, `findAll`, `findOne`.
- [ ] Tipos TS + hook básico frontend.
- [ ] `CreditNoteStatusBadge`, `CreditNoteItemsTable`.
- [ ] Páginas `/credit-notes/page.tsx`, `/credit-notes/new/page.tsx`.
- [ ] Sidebar + botón en `/sales/[id]`.

### Fase B — Autorización + Reembolso + Stock

- [ ] `authorize()` y `voidCreditNote()` con transacciones.
- [ ] Hook: `useAuthorizeCreditNote`, `useVoidCreditNote`.
- [ ] `AuthorizeCreditNoteModal`.
- [ ] `/credit-notes/[id]/page.tsx`.
- [ ] Sección "NC relacionadas" en `/sales/[id]`.
- [ ] Tests unitarios + e2e.
- [ ] `getCreditNoteSummary` en reports.

### Fase C — PDF + Integración extendida

- [ ] `generatePdf()`.
- [ ] Botón PDF en detalle.
- [ ] Stat card dashboard.
- [ ] Integración POS post-venta.
- [ ] Tests frontend.

---

## 10. Riesgos y gotchas

### R1 — Concurrencia en autorización simultánea

Dos admins autorizan en paralelo dos NC distintas sobre la misma venta.

**Mitigación:** Dentro de `authorize()` tx, validar cantidad ya autorizada por `originalItemId`:

```typescript
const alreadyAuthorized = await tx.creditNoteItem.aggregate({
  where: {
    originalItemId: item.originalItemId,
    creditNote: { status: 'AUTHORIZED' },
  },
  _sum: { quantity: true },
});
const authorizedQty = alreadyAuthorized._sum.quantity ?? 0;
if (authorizedQty + item.quantity > item.originalItem.quantity) {
  throw new ConflictException('Ítem ya devuelto completamente por otra NC');
}
```

### R2 — Double-spending de reembolsos

Sin integración con sistemas de pago externos, `reference` en `CreditNoteRefund` es el anclaje. Validar:

```typescript
if ((refund.method === 'CARD_REVERSAL' || refund.method === 'BANK_TRANSFER') && !refund.reference) {
  throw new BadRequestException(`Método ${refund.method} requiere referencia`);
}
```

### R3 — Gaps en `creditNoteNumber`

DRAFT anuladas ocupan consecutivos. Documentar que `creditNoteNumber` es tracking interno; el consecutivo DIAN real se asigna en integración de facturación electrónica (plan 04).

### R4 — Venta COMPLETED con NC en DRAFT

Avisar en frontend:

```typescript
{related.some(nc => nc.status === 'DRAFT') && (
  <div className="bg-yellow-50 ...">
    Esta venta tiene una NC pendiente de autorización.
  </div>
)}
```

### R5 — Productos inactivos

`updateMany` en restauración de stock no filtra por `active` — permite restaurar a productos desactivados. Patrón consistente con `purchase-orders`.

---

## 11. Archivos a crear / modificar

| Archivo | Acción | Propósito |
|---------|--------|-----------|
| `backend/prisma/schema.prisma` | [MODIFY] | Enums + modelos + relaciones |
| `backend/prisma/migrations/[timestamp]_add_credit_notes_module/` | [CREATE] | Migración |
| `backend/src/credit-notes/credit-notes.module.ts` | [CREATE] | Módulo |
| `backend/src/credit-notes/credit-notes.controller.ts` | [CREATE] | 6 endpoints REST |
| `backend/src/credit-notes/credit-notes.service.ts` | [CREATE] | Lógica + transacciones + PDF |
| `backend/src/credit-notes/dto/create-credit-note.dto.ts` | [CREATE] | DTO |
| `backend/src/credit-notes/dto/authorize-credit-note.dto.ts` | [CREATE] | DTO |
| `backend/src/credit-notes/dto/void-credit-note.dto.ts` | [CREATE] | DTO |
| `backend/src/credit-notes/dto/query-credit-notes.dto.ts` | [CREATE] | DTO filtros |
| `backend/src/credit-notes/dto/credit-note-item.dto.ts` | [CREATE] | DTO ítem |
| `backend/src/credit-notes/dto/refund.dto.ts` | [CREATE] | DTO reembolso |
| `backend/src/credit-notes/credit-notes.service.spec.ts` | [CREATE] | Tests unitarios |
| `backend/src/app.module.ts` | [MODIFY] | Registrar módulo |
| `backend/src/reports/reports.service.ts` | [MODIFY] | `getCreditNoteSummary()` |
| `backend/src/reports/reports.controller.ts` | [MODIFY] | Endpoint resumen |
| `backend/test/credit-notes.e2e-spec.ts` | [CREATE] | Test E2E |
| `frontend/src/types/index.ts` | [MODIFY] | Tipos TS |
| `frontend/src/hooks/useCreditNotes.ts` | [CREATE] | Hook completo |
| `frontend/src/components/layout/Sidebar.tsx` | [MODIFY] | Ítem "Notas Crédito" |
| `frontend/src/components/credit-notes/CreditNoteStatusBadge.tsx` | [CREATE] | Badge |
| `frontend/src/components/credit-notes/CreditNoteItemsTable.tsx` | [CREATE] | Tabla ítems |
| `frontend/src/components/credit-notes/AuthorizeCreditNoteModal.tsx` | [CREATE] | Modal autorización |
| `frontend/src/app/credit-notes/page.tsx` | [CREATE] | Lista |
| `frontend/src/app/credit-notes/new/page.tsx` | [CREATE] | Creación |
| `frontend/src/app/credit-notes/[id]/page.tsx` | [CREATE] | Detalle |
| `frontend/src/app/sales/[id]/page.tsx` | [MODIFY] | Botón emitir + NC relacionadas |
| `frontend/src/app/dashboard/page.tsx` | [MODIFY] | Stat card devoluciones |
| `frontend/src/app/credit-notes/page.behavior.test.tsx` | [CREATE] | Test integración |
| `frontend/src/components/credit-notes/AuthorizeCreditNoteModal.test.tsx` | [CREATE] | Test modal |

**Total: 10 archivos a modificar, 19 a crear.**

---

## 12. Dependencias entre tareas

```
[Fase A]
schema.prisma → migración → credit-notes.module → service (create/findAll/findOne) → controller → app.module
types → useCreditNotes (create/find) → StatusBadge, ItemsTable → /credit-notes + /new → Sidebar, /sales/[id] botón

[Fase B — requiere Fase A]
service (authorize, void) → controller (endpoints) → useCreditNotes (mutations) → AuthorizeModal → /credit-notes/[id]
/sales/[id] sección NC relacionadas (requiere /[id]/page.tsx)
reports.service (summary) → reports.controller
Tests unit + e2e

[Fase C — requiere Fase B]
service generatePdf → /credit-notes/[id] botón PDF → useCreditNotes helper
dashboard stat card (requiere endpoint summary)
POS integración
Tests frontend
```

---

## 13. Estimación

| Fase | Alcance | Estimación |
|------|---------|------------|
| **Fase A** | Schema + migración + módulo backend básico + tipos + hook + 3 componentes + 2 páginas + sidebar | **6–8 h** |
| **Fase B** | authorize + void + modal + detalle + integración sales + reports + tests unit + e2e | **8–10 h** |
| **Fase C** | PDF + botón + dashboard + POS + tests frontend | **4–5 h** |
| **Total** | | **18–23 h** |

---

*Documento generado: 2026-04-21. Referencia: proyecto `MeperPOS`, rama `master`.*
