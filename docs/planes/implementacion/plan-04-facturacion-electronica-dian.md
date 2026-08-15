# Plan 04 — Facturación Electrónica DIAN

> [!IMPORTANT]
> **Este es el plan más complejo del roadmap.** Involucra legislación colombiana vigente (Decreto 358/2020, Resolución DIAN 000042/2020 y sus modificaciones), firma digital XAdES-EPES, el estándar UBL 2.1 con extensiones DIAN, procesamiento asíncrono con colas, y coordinación obligatoria con entidades externas (DIAN, PSE certificado, autoridad certificadora). Leer completo antes de escribir una sola línea de código.
>
> **Estimación realista: 80–150 horas de desarrollo con testing. Proyecto de 3–6 meses en realidad de negocio.**

---

## 1. Contexto y Motivación

### 1.1 Mandato legal DIAN

Colombia exige facturación electrónica obligatoria para todos los contribuyentes del régimen común desde 2019. El calendario de obligatoriedad se amplió progresivamente; a 2024 **todos los vendedores de bienes y servicios** deben emitir factura electrónica de venta bajo UBL 2.1 según la Resolución DIAN 000042 de 2020 y sus modificaciones (Resolución 000085/2024, Resolución 000167/2021).

### 1.2 Consecuencias del incumplimiento

| Infracción | Sanción base |
|---|---|
| No expedir factura electrónica | Cierre del establecimiento (3–10 días) o multa de 1 UVT por cada factura no emitida |
| Emitir sin CUFE válido | Hasta 15.000 UVT (~$700M COP en 2024) |
| No conservar XML por 5 años | Multa hasta 100 UVT por período |
| Consecutivo con gaps | Investigación por defraudación fiscal |

> UVT 2024 = $47.065 COP.

### 1.3 Estado actual del sistema

El sistema emite recibos PDF locales generados con `jsPDF` en `backend/src/sales/sales.service.ts` (método `generateReceipt`). Estos comprobantes son **documentos equivalentes de POS**, no facturas electrónicas. No tienen CUFE, no se transmiten a la DIAN, y no cumplen con UBL 2.1.

### 1.4 Alcance de este plan

- Facturas Electrónicas de Venta (FE) para ventas al consumidor final y a empresas.
- Notas Crédito (NC) para devoluciones (coordinado con Plan 02 — Devoluciones y Notas Crédito).
- Documento Soporte POS para ventas menores a 5 UVT sin identificación de comprador.
- **Fuera de alcance:** nómina electrónica, facturación de exportaciones, documentos de importación, Nota Débito.

---

## 2. Decisiones de Arquitectura

### 2.1 DECISIÓN CRÍTICA: Integración directa vs. PSE

Esta es la decisión más importante de todo el plan. Afecta tiempo de desarrollo, costo recurrente, riesgo legal y complejidad técnica.

| Criterio | Integración directa DIAN | Via PSE |
|---|---|---|
| Tiempo de desarrollo | 6–12 meses (XAdES, SOAP WS-Security, UBL completo) | 2–4 meses (REST API sobre PSE) |
| Costo de setup | Solo certificado digital (~$400K–$800K COP/año) | Certificado + fee PSE (~$80K–$200K COP/mes + volumen) |
| Costo por factura | $0 marginal | ~$150–$500 COP/factura según PSE |
| Complejidad técnica | Muy alta (XAdES-EPES, WS-Security, SOAP MTOM) | Baja (HTTP REST o SOAP simple) |
| Riesgo de rechazo DIAN | Alto (responsabilidad propia de validación) | Bajo (PSE absorbe cambios normativos) |
| Actualizaciones normativas | Responsabilidad propia | Responsabilidad del PSE |
| Disponibilidad | Depende de DIAN directa (SLA no garantizado) | PSE con SLA propio (~99.5%) |
| Habilitación DIAN | Proceso directo (2–4 semanas) | PSE gestiona habilitación |
| Idoneidad para MVP | No recomendable | **RECOMENDADO** |

**Decisión adoptada: Integración via PSE para MVP, con capa de abstracción `ElectronicInvoiceProvider` que permite migrar a integración directa sin cambiar el núcleo del sistema.**

**PSE recomendados para evaluar:** The Factory HKA, Facture (Siigo), Carvajal, Edicom. Para prototipo/tesis: HKA y Facture tienen sandbox gratuito con documentación REST limpia.

### 2.2 Patrón de abstracción — Provider Interface

```typescript
// backend/src/einvoices/providers/electronic-invoice-provider.interface.ts

export interface SubmissionResult {
  providerReference: string;
  cufe: string;
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  xmlSigned?: string;
  dianAcuse?: Record<string, unknown>;
  rejectionReason?: string;
}

export interface SellerInfo {
  nit: string;
  nitVerificationDigit: string;
  razonSocial: string;
  nombreComercial: string;
  personType: string;        // "1" = Jurídica, "2" = Natural
  tipoContribuyente: string;
  regimenFiscal: string;     // "48" | "49"
  municipio: string;
  municipioDaneCode: string;
  departamento: string;
  departamentoDaneCode: string;
  direccion: string;
  telefono?: string;
  email: string;
}

export interface BuyerInfo {
  documentType: string;      // "13" = CC, "31" = NIT, "22" = CE
  documentNumber: string;
  verificationDigit?: string;
  name: string;
  fiscalRegime: string;
  email: string;
  address?: string;
  cityDaneCode?: string;
  phone?: string;
}

export interface InvoiceItem {
  productId: string;
  sku?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  taxRate: number;
}

export interface PaymentInfo {
  method: string;   // "10" = Efectivo, "48" = Tarjeta, "42" = Transferencia
  amount: number;
  dueDate?: string;
}

export interface ResolutionInfo {
  number: string;
  date: string;
  rangeFrom: number;
  rangeTo: number;
  prefix: string;
  validFrom: string;
  validTo: string;
}

export interface InvoicePayload {
  consecutive: number;
  prefix: string;
  fullNumber: string;
  issueDate: string;
  dueDate?: string;
  documentType: 'FE' | 'NC' | 'ND' | 'DS';
  environment: 'HABILITACION' | 'PRODUCCION';
  seller: SellerInfo;
  buyer: BuyerInfo;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  payments: PaymentInfo[];
  resolution: ResolutionInfo;
  cufe?: string;
  notes?: string;
  creditNoteReference?: string;
}

export interface ElectronicInvoiceProvider {
  submit(payload: InvoicePayload): Promise<SubmissionResult>;
  getStatus(providerReference: string): Promise<SubmissionResult>;
  cancel(providerReference: string, reason: string): Promise<void>;
  testConnection(): Promise<boolean>;
}
```

### 2.3 Procesamiento asíncrono con BullMQ

Emitir una factura puede tomar 2–30 segundos dependiendo del PSE y la DIAN. Hacerlo síncronamente en el endpoint de creación de venta bloquearía el POS. La arquitectura:

1. La venta se crea y confirma inmediatamente (`Sale.status = COMPLETED`).
2. Un registro `EInvoice` se crea con `status = DRAFT` en transacción separada post-commit.
3. Un job BullMQ se encola: `{ name: 'emit', data: { einvoiceId } }`.
4. El worker BullMQ procesa asincrónicamente: construye UBL → calcula CUFE → llama PSE → actualiza DB.
5. El frontend muestra el status via polling (TanStack Query `refetchInterval`).

**Infraestructura requerida:** Redis. Agregar al `docker-compose.yml`.

### 2.4 Event sourcing para auditoría de estado

Todo cambio de estado de `EInvoice` genera un `EInvoiceEvent`. Exigido implícitamente por la DIAN (trazabilidad fiscal) y necesario para depuración de rechazos.

### 2.5 Numeración DIAN — secuencial sin gaps

El consecutivo de facturación electrónica es **independiente** de `Sale.saleNumber`. La DIAN asigna un rango (ej: FE00001–FE50000) que debe usarse sin saltos.

El consecutivo se asigna en el worker BullMQ con `SELECT FOR UPDATE` atómico — NO en el momento de crear el DRAFT. Esto evita que un DRAFT nunca transmitido consuma un número de la resolución.

### 2.6 CUFE calculado localmente como defensa en profundidad

Aunque el PSE calcula el CUFE, se calcula localmente en `CufeService` para: verificar que el PSE devuelve el correcto, incluirlo en el QR del PDF anticipadamente, y tener registro local independiente del PSE.

---

## 3. Modelo de Datos (Prisma)

### 3.1 Nuevos modelos — agregar al final de `backend/prisma/schema.prisma`

```prisma
enum DianEnvironment {
  HABILITACION
  PRODUCCION
}

enum EInvoiceDocumentType {
  FE   // Factura Electrónica de Venta
  NC   // Nota Crédito
  ND   // Nota Débito
  DS   // Documento Soporte POS
}

enum EInvoiceStatus {
  DRAFT
  QUEUED
  SENT
  ACCEPTED
  REJECTED
  CONTINGENCY
  CANCELLED
}

enum EInvoiceEventType {
  CREATED
  QUEUED
  SUBMITTED
  ACCEPTED
  REJECTED
  RETRIED
  CANCELLED
  CONTINGENCY_ACTIVATED
  SYNCED_FROM_CONTINGENCY
}

model EInvoiceConfig {
  id                    String          @id @default(uuid())
  provider              String          // "FACTURE" | "HKA" | "CARVAJAL" | "DIRECT_DIAN"
  environment           DianEnvironment @default(HABILITACION)
  providerApiUrl        String
  providerApiKey        String          // Encriptado AES-256
  providerApiSecret     String?

  dianResolutionNumber  String
  dianResolutionDate    DateTime
  rangeFrom             Int
  rangeTo               Int
  prefix                String
  techKey               String          // Clave técnica SHA-384
  nextConsecutive       Int             @default(1)

  certificatePath       String?
  certificatePassword   String?

  validFrom             DateTime
  validTo               DateTime

  active                Boolean         @default(false)
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt

  @@index([active])
}

model EInvoice {
  id                  String               @id @default(uuid())
  saleId              String?
  sale                Sale?                @relation(fields: [saleId], references: [id])
  creditNoteForId     String?
  creditNoteFor       EInvoice?            @relation("CreditNoteRelation", fields: [creditNoteForId], references: [id])
  creditNotes         EInvoice[]           @relation("CreditNoteRelation")

  documentType        EInvoiceDocumentType @default(FE)
  consecutive         Int?
  prefix              String               @default("")
  fullNumber          String               @unique @default("")
  issueDate           DateTime
  cufe                String?
  cude                String?

  xmlContent          String?              @db.Text
  xmlSigned           String?              @db.Text
  pdfPath             String?
  qrContent           String?

  status              EInvoiceStatus       @default(DRAFT)
  dianAcuse           Json?
  rejectionReason     String?
  contingencyReason   String?

  submittedAt         DateTime?
  acceptedAt          DateTime?
  providerReference   String?
  retries             Int                  @default(0)

  events              EInvoiceEvent[]

  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt

  @@index([saleId])
  @@index([status])
  @@index([consecutive])
  @@index([fullNumber])
  @@index([createdAt])
}

model EInvoiceEvent {
  id          String             @id @default(uuid())
  einvoiceId  String
  einvoice    EInvoice           @relation(fields: [einvoiceId], references: [id], onDelete: Cascade)
  type        EInvoiceEventType
  payload     Json?
  createdAt   DateTime           @default(now())

  @@index([einvoiceId, createdAt])
}

model CompanyFiscalInfo {
  id                    String   @id @default(uuid())
  nit                   String
  nitVerificationDigit  String
  razonSocial           String
  nombreComercial       String?
  tipoPersona           String   // "1" = Jurídica, "2" = Natural
  tipoContribuyente     String
  responsabilidadesFiscales String[]
  regimenFiscal         String   // "48" | "49"
  actividadEconomica    String   // CIIU
  direccion             String
  municipio             String
  municipioDaneCode     String
  departamento          String
  departamentoDaneCode  String
  codigoPais            String   @default("CO")
  telefono              String?
  email                 String
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

### 3.2 Extensiones a modelos existentes

```prisma
// MODIFICAR modelo Customer:
  fiscalRegime          String?   // "48" | "49"
  emailForEInvoice      String?   // Email obligatorio para FE
  cityDaneCode          String?
  departmentDaneCode    String?
  taxResponsibility     String?   // Ej: "R-99-PN"

// MODIFICAR modelo Sale — agregar en relaciones:
  einvoice              EInvoice?
```

### 3.3 Migración

```bash
cd backend && npx prisma migrate dev --name feat-einvoice-core
```

---

## 4. Backend — Módulos Nuevos

### 4.1 Estructura de directorios

```
backend/src/einvoices/
├── dto/
│   ├── emit-einvoice.dto.ts
│   ├── query-einvoices.dto.ts
│   ├── upsert-config.dto.ts
│   └── upsert-company-fiscal.dto.ts
├── providers/
│   ├── electronic-invoice-provider.interface.ts
│   ├── facture.adapter.ts
│   ├── hka.adapter.ts
│   └── direct-dian.adapter.ts
├── ubl/
│   ├── ubl-builder.service.ts
│   ├── cufe.service.ts
│   └── xades-signer.service.ts
├── queue/
│   ├── einvoice.processor.ts
│   └── einvoice-retry.strategy.ts
├── einvoices.controller.ts
├── einvoices.service.ts
├── einvoice-config.service.ts
├── company-fiscal-info.service.ts
└── einvoices.module.ts
```

### 4.2 EInvoicesModule

```typescript
// backend/src/einvoices/einvoices.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EInvoicesController } from './einvoices.controller';
import { EInvoicesService } from './einvoices.service';
import { EInvoiceConfigService } from './einvoice-config.service';
import { CompanyFiscalInfoService } from './company-fiscal-info.service';
import { UblBuilderService } from './ubl/ubl-builder.service';
import { CufeService } from './ubl/cufe.service';
import { XadesSignerService } from './ubl/xades-signer.service';
import { EInvoiceProcessor } from './queue/einvoice.processor';
import { FactureAdapter } from './providers/facture.adapter';
import { HkaAdapter } from './providers/hka.adapter';
import { DirectDianAdapter } from './providers/direct-dian.adapter';

export const EINVOICE_QUEUE = 'einvoice-emit';

@Module({
  imports: [
    BullModule.registerQueue({ name: EINVOICE_QUEUE }),
  ],
  controllers: [EInvoicesController],
  providers: [
    EInvoicesService,
    EInvoiceConfigService,
    CompanyFiscalInfoService,
    UblBuilderService,
    CufeService,
    XadesSignerService,
    EInvoiceProcessor,
    FactureAdapter,
    HkaAdapter,
    DirectDianAdapter,
  ],
  exports: [EInvoicesService],
})
export class EInvoicesModule {}
```

#### [MODIFY] `backend/src/app.module.ts`

```typescript
import { BullModule } from '@nestjs/bullmq';
import { EInvoicesModule } from './einvoices/einvoices.module';

// En imports[]:
BullModule.forRoot({
  connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
}),
EInvoicesModule,
```

### 4.3 EInvoicesController — firma completa

```typescript
@Controller('einvoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EInvoicesController {
  @Get()          @Roles('ADMIN', 'CASHIER')
  findAll(@Query() q: QueryEInvoicesDto) {}

  @Get('config')  @Roles('ADMIN')
  getConfig() {}

  @Put('config')  @Roles('ADMIN')
  upsertConfig(@Body() dto: UpsertEInvoiceConfigDto) {}

  @Get('company-fiscal')  @Roles('ADMIN')
  getCompanyFiscal() {}

  @Put('company-fiscal')  @Roles('ADMIN')
  upsertCompanyFiscal(@Body() dto: UpsertCompanyFiscalDto) {}

  @Get(':id')     @Roles('ADMIN', 'CASHIER')
  findOne(@Param('id') id: string) {}

  @Get(':id/xml') @Roles('ADMIN')
  downloadXml(@Param('id') id: string, @Res() res: Response) {}

  @Get(':id/pdf') @Roles('ADMIN', 'CASHIER')
  downloadPdf(@Param('id') id: string, @Res() res: Response) {}

  @Post('emit/:saleId')  @Roles('ADMIN')
  emitForSale(@Param('saleId') saleId: string) {}

  @Post(':id/retry')  @Roles('ADMIN')
  retry(@Param('id') id: string) {}

  @Get(':id/dian-status')  @Roles('ADMIN')
  getDianStatus(@Param('id') id: string) {}
}
```

### 4.4 EInvoicesService — métodos clave

```typescript
@Injectable()
export class EInvoicesService {
  constructor(
    private prisma: PrismaService,
    private configSvc: EInvoiceConfigService,
    private ublBuilder: UblBuilderService,
    private cufeSvc: CufeService,
    @InjectQueue(EINVOICE_QUEUE) private queue: Queue,
    private factureAdapter: FactureAdapter,
    private hkaAdapter: HkaAdapter,
    private directDianAdapter: DirectDianAdapter,
  ) {}

  /** Crear EInvoice DRAFT post-commit de venta. No asigna consecutivo. */
  async createDraftForSale(saleId: string): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const einvoice = await tx.eInvoice.create({
        data: {
          saleId,
          documentType: 'FE',
          issueDate: new Date(),
          status: 'DRAFT',
        },
      });
      await tx.eInvoiceEvent.create({
        data: { einvoiceId: einvoice.id, type: 'CREATED' },
      });
      return einvoice;
    });
  }

  async enqueueEmission(einvoiceId: string): Promise<void> {
    await this.prisma.eInvoice.update({
      where: { id: einvoiceId },
      data: { status: 'QUEUED' },
    });
    await this.queue.add('emit', { einvoiceId }, {
      jobId: einvoiceId,         // Idempotencia
      attempts: 5,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    await this.prisma.eInvoiceEvent.create({
      data: { einvoiceId, type: 'QUEUED' },
    });
  }

  /** Llamado por BullMQ worker. IDEMPOTENTE. */
  async processEmission(einvoiceId: string): Promise<void> {
    const einvoice = await this.prisma.eInvoice.findUniqueOrThrow({
      where: { id: einvoiceId },
      include: {
        sale: {
          include: {
            items: { include: { product: { include: { category: true } } } },
            customer: true,
            payments: true,
          },
        },
      },
    });

    if (['ACCEPTED', 'CANCELLED'].includes(einvoice.status)) return;

    // Recovery: ya fue enviado, consultar estado al PSE
    if (einvoice.status === 'SENT' && einvoice.providerReference) {
      const provider = this.resolveProvider();
      const result = await provider.getStatus(einvoice.providerReference);
      await this.applyResult(einvoiceId, result);
      return;
    }

    const config = await this.configSvc.getActiveConfig();
    const company = await this.prisma.companyFiscalInfo.findFirst();
    if (!company) throw new Error('CompanyFiscalInfo not configured');

    const { consecutive, prefix, fullNumber } = await this.assignConsecutive(config.id);

    await this.prisma.eInvoice.update({
      where: { id: einvoiceId },
      data: { consecutive, prefix, fullNumber },
    });

    const payload = this.ublBuilder.buildPayload(
      { ...einvoice, consecutive, prefix, fullNumber },
      config,
      company,
    );
    const cufe = this.cufeSvc.computeCufe(payload, config.techKey);
    await this.prisma.eInvoice.update({
      where: { id: einvoiceId },
      data: { cufe },
    });

    const xmlContent = this.ublBuilder.buildXml({ ...payload, cufe });
    await this.prisma.eInvoice.update({
      where: { id: einvoiceId },
      data: { xmlContent, status: 'SENT', submittedAt: new Date() },
    });

    await this.prisma.eInvoiceEvent.create({
      data: { einvoiceId, type: 'SUBMITTED', payload: { fullNumber, cufe } },
    });

    const provider = this.resolveProvider();
    let result: SubmissionResult;
    try {
      result = await provider.submit({ ...payload, cufe });
    } catch (err) {
      await this.prisma.eInvoice.update({
        where: { id: einvoiceId },
        data: { retries: { increment: 1 } },
      });
      await this.prisma.eInvoiceEvent.create({
        data: { einvoiceId, type: 'RETRIED', payload: { error: String(err) } },
      });
      throw err; // BullMQ reintenta
    }

    await this.applyResult(einvoiceId, result);
  }

  /** Asigna consecutivo atómicamente con SELECT FOR UPDATE. */
  private async assignConsecutive(configId: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ nextConsecutive: number; prefix: string }>>`
        SELECT "nextConsecutive", prefix
        FROM "EInvoiceConfig"
        WHERE id = ${configId}
        FOR UPDATE
      `;
      if (!rows[0]) throw new Error('EInvoiceConfig not found');
      const consecutive = rows[0].nextConsecutive;
      const prefix = rows[0].prefix;
      await tx.$executeRaw`
        UPDATE "EInvoiceConfig"
        SET "nextConsecutive" = "nextConsecutive" + 1
        WHERE id = ${configId}
      `;
      const fullNumber = `${prefix}${String(consecutive).padStart(8, '0')}`;
      return { consecutive, prefix, fullNumber };
    });
  }

  private resolveProvider(): ElectronicInvoiceProvider {
    const providerName = process.env.DIAN_PROVIDER ?? 'FACTURE';
    const map: Record<string, ElectronicInvoiceProvider> = {
      FACTURE: this.factureAdapter,
      HKA: this.hkaAdapter,
      DIRECT_DIAN: this.directDianAdapter,
    };
    const provider = map[providerName];
    if (!provider) throw new Error(`Unknown provider: ${providerName}`);
    return provider;
  }
}
```

### 4.5 CufeService — SHA-384 DIAN

```typescript
// backend/src/einvoices/ubl/cufe.service.ts
import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InvoicePayload } from '../providers/electronic-invoice-provider.interface';

@Injectable()
export class CufeService {
  /**
   * CUFE = SHA-384( concatenación campos Anexo Técnico DIAN, Res 000042/2020, 8.1 )
   * Campos: NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + CodImp2
   *       + ValImp2 + CodImp3 + ValImp3 + ValTot + NitOFE + NumAdq + ClTec + TipoAmb
   */
  computeCufe(payload: InvoicePayload, techKey: string): string {
    const NumFac  = payload.fullNumber;
    const FecFac  = payload.issueDate.split('T')[0];
    const HorFac  = (payload.issueDate.split('T')[1] ?? '00:00:00').slice(0, 8);
    const ValFac  = payload.totals.subtotal.toFixed(2);
    const CodImp1 = '01'; // IVA
    const ValImp1 = payload.totals.taxAmount.toFixed(2);
    const CodImp2 = '04'; // INC
    const ValImp2 = '0.00';
    const CodImp3 = '03'; // ICA
    const ValImp3 = '0.00';
    const ValTot  = payload.totals.total.toFixed(2);
    const NitOFE  = payload.seller.nit;
    const NumAdq  = payload.buyer.documentNumber || '222222222222';
    const ClTec   = techKey;
    const TipoAmb = payload.environment === 'PRODUCCION' ? '1' : '2';

    const raw = [NumFac, FecFac, HorFac, ValFac, CodImp1, ValImp1, CodImp2, ValImp2,
      CodImp3, ValImp3, ValTot, NitOFE, NumAdq, ClTec, TipoAmb].join('');
    return createHash('sha384').update(raw, 'utf8').digest('hex');
  }

  computeCude(payload: InvoicePayload, techKey: string): string {
    return this.computeCufe(payload, techKey);
  }

  /** Valida DV del NIT — usar en CustomersController al guardar. */
  calcDvNit(nit: string): number {
    const primes = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];
    const padded = nit.replace(/\D/g, '').padStart(15, '0');
    const sum = padded.split('').reduce(
      (acc, d, i) => acc + Number(d) * primes[i], 0
    );
    const remainder = sum % 11;
    return remainder > 1 ? 11 - remainder : remainder;
  }
}
```

### 4.6 UblBuilderService — generador XML UBL 2.1

Usa `xmlbuilder2`. El método `buildXml(payload)` genera el XML completo con namespaces `fe/cac/cbc/ext`, sección de extensiones para firma XAdES, encabezado con `UBLVersionID=UBL 2.1`, `CustomizationID=10` (FE), `ProfileID=DIAN 2.1`, `ProfileExecutionID=1|2` según ambiente, `InvoiceTypeCode=01` para FE de venta consumidor.

Incluye:
- `cbc:UUID` con el CUFE y `schemeID=2`
- `cac:AuthorizationProvider` con NIT DIAN `800197268`
- `cac:AccountingSupplierParty` con NIT del emisor + DV, régimen fiscal, dirección con DANE
- `cac:AccountingCustomerParty` con NIT/CC del comprador (para consumidor final usar `222222222222`)
- `cac:PaymentMeans` por cada método de pago
- `cac:TaxTotal` con IVA y subtotales
- `cac:LegalMonetaryTotal` con `LineExtensionAmount`, `TaxExclusiveAmount`, `TaxInclusiveAmount`, `AllowanceTotalAmount`, `PayableAmount`
- `cac:InvoiceLine` por cada item con `InvoicedQuantity`, `LineExtensionAmount`, `AllowanceCharge`, `TaxTotal` por línea, `cac:Item.Description`, `cac:Price.PriceAmount`

`xmlbuilder2` escapa automáticamente `&`, `<`, `>`, `"`, `'` en contenido de texto — no concatenar strings manualmente.

### 4.7 BullMQ Processor

```typescript
// backend/src/einvoices/queue/einvoice.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor(EINVOICE_QUEUE, {
  limiter: { max: 5, duration: 1000 },
})
export class EInvoiceProcessor extends WorkerHost {
  private readonly logger = new Logger(EInvoiceProcessor.name);

  private static readonly FATAL_ERROR_CODES = [
    'INVALID_NIT', 'INVALID_DATE_RANGE', 'DUPLICATE_INVOICE',
    'RESOLUTION_EXPIRED', 'RESOLUTION_EXHAUSTED',
  ];

  constructor(private readonly einvoicesService: EInvoicesService) { super(); }

  async process(job: Job<{ einvoiceId: string }>): Promise<void> {
    const { einvoiceId } = job.data;
    this.logger.log(`Processing EInvoice ${einvoiceId} attempt ${job.attemptsMade + 1}`);
    try {
      await this.einvoicesService.processEmission(einvoiceId);
    } catch (err) {
      const errorCode = (err as { code?: string }).code;
      if (EInvoiceProcessor.FATAL_ERROR_CODES.includes(errorCode ?? '')) {
        throw new UnrecoverableError(`DIAN fatal: ${errorCode}`);
      }
      throw err; // BullMQ reintenta con backoff exponencial
    }
  }
}
```

### 4.8 Integración con SalesService

```typescript
// [MODIFY] backend/src/sales/sales.service.ts

constructor(
  private prisma: PrismaService,
  private cache: CacheService,
  private einvoicesService: EInvoicesService,
) {}

async create(createSaleDto: CreateSaleDto, userId: string) {
  // ... lógica existente hasta la transacción que crea la venta ...
  this.cache.clear('dashboard:');

  // Emisión electrónica asíncrona post-commit.
  // NO lanzar excepción si falla: la venta ya está guardada.
  try {
    const einvoice = await this.einvoicesService.createDraftForSale(sale.id);
    await this.einvoicesService.enqueueEmission(einvoice.id);
  } catch (err) {
    console.error(`Failed to queue EInvoice for sale ${sale.id}:`, err);
  }

  return this.findOne(sale.id);
}
```

#### [MODIFY] `backend/src/sales/sales.module.ts`

```typescript
import { EInvoicesModule } from '../einvoices/einvoices.module';

@Module({
  imports: [EInvoicesModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
```

---

## 5. Frontend — Páginas y Componentes

### 5.1 EInvoiceStatusBadge

```typescript
// frontend/src/components/einvoices/EInvoiceStatusBadge.tsx
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

type EInvoiceStatus = 'DRAFT' | 'QUEUED' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONTINGENCY' | 'CANCELLED';

const STATUS_CONFIG: Record<EInvoiceStatus, { label: string; variant: string }> = {
  DRAFT:       { label: 'Borrador',      variant: 'default'   },
  QUEUED:      { label: 'En cola',       variant: 'secondary' },
  SENT:        { label: 'Enviada',       variant: 'warning'   },
  ACCEPTED:    { label: 'Aceptada DIAN', variant: 'success'   },
  REJECTED:    { label: 'Rechazada',     variant: 'danger'    },
  CONTINGENCY: { label: 'Contingencia',  variant: 'warning'   },
  CANCELLED:   { label: 'Anulada',       variant: 'default'   },
};

export function EInvoiceStatusBadge({ status, className }:
  { status: EInvoiceStatus; className?: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: 'default' };
  return <Badge variant={cfg.variant as never} className={cn(className)}>{cfg.label}</Badge>;
}
```

### 5.2 useEInvoices hook con polling

```typescript
// frontend/src/hooks/useEInvoices.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface EInvoice {
  id: string;
  saleId: string | null;
  fullNumber: string;
  documentType: 'FE' | 'NC' | 'ND' | 'DS';
  status: 'DRAFT' | 'QUEUED' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONTINGENCY' | 'CANCELLED';
  cufe: string | null;
  issueDate: string;
  retries: number;
  rejectionReason: string | null;
  dianAcuse: Record<string, unknown> | null;
  submittedAt: string | null;
  acceptedAt: string | null;
  providerReference: string | null;
}

const EINVOICES_KEY = ['einvoices'] as const;
const PENDING_STATUSES: EInvoice['status'][] = ['QUEUED', 'SENT'];

export function useEInvoices(params?: { status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: [...EINVOICES_KEY, params],
    queryFn: () => api.get('/einvoices', { params }).then(r => r.data),
    refetchInterval: (query) => {
      const hasPending = query.state.data?.data.some(
        (e: EInvoice) => PENDING_STATUSES.includes(e.status)
      );
      return hasPending ? 5000 : false;
    },
  });
}

export function useRetryEInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/einvoices/${id}/retry`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: EINVOICES_KEY }),
  });
}

export function useEmitForSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (saleId: string) => api.post(`/einvoices/emit/${saleId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EINVOICES_KEY });
      qc.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}
```

### 5.3 EInvoiceBanner — integración en detalle de venta

Componente que muestra estado FE en `frontend/src/app/sales/[id]/page.tsx`. Colores por estado (verde ACCEPTED, rojo REJECTED, ámbar QUEUED/SENT). Botón "Reintentar" si REJECTED, botón "PDF FE" si ACCEPTED.

### 5.4 Sidebar — agregar "Facturación"

#### [MODIFY] `frontend/src/components/layout/Sidebar.tsx`

```typescript
import { FileCheck } from 'lucide-react';

// En navItems[], después de "Ventas":
{
  label: 'Facturación',
  href: '/einvoices',
  icon: <FileCheck className="w-4 h-4" />,
  roles: ['ADMIN'],
},
```

### 5.5 Configuración DIAN en Settings

#### [MODIFY] `frontend/src/app/settings/page.tsx`

Agregar dos secciones: (1) "Información Fiscal" con `CompanyFiscalForm` (GET/PUT `/api/einvoices/company-fiscal`), (2) "Facturación Electrónica DIAN" con `ResolutionForm` (GET/PUT `/api/einvoices/config`), incluyendo selector PSE, selector ambiente, campos de resolución, botón "Probar conexión".

---

## 6. Dependencias NPM

### 6.1 Backend

```bash
cd backend
npm install @nestjs/bullmq bullmq ioredis xmlbuilder2 qrcode node-forge
npm install xml-crypto            # Phase E — XAdES
npm install -D @types/qrcode @types/node-forge
```

### 6.2 Frontend

```bash
cd frontend
npm install qrcode.react
```

### 6.3 Variables de entorno — `backend/.env`

```env
REDIS_URL="redis://localhost:6379"
DIAN_ENV="HABILITACION"
DIAN_PROVIDER="FACTURE"
PSE_API_URL="https://sandbox.facture.co/api/v1"
PSE_API_KEY="sk_test_xxxxxxxxxxxxxxxx"
PSE_API_SECRET=""
DIAN_CERT_PATH="/app/certs/certificado.p12"
DIAN_CERT_PASSWORD=""
DIAN_TECH_KEY=""
ENCRYPTION_KEY=""   # 32 bytes hex para AES-256-CBC
```

### 6.4 Docker Compose — agregar Redis

```yaml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redis_data:/data]
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
volumes:
  redis_data:
```

---

## 7. Migraciones y Backfill

No hay datos históricos de FE. Los POS receipts previos son documentos equivalentes válidos pre-activación. FE aplica únicamente a ventas **nuevas** post-activación.

Secuencia de activación en producción:
1. Registrar empresa en PSE elegido.
2. Obtener `dianResolutionNumber`, `techKey`, rango autorizado.
3. Crear registro `EInvoiceConfig` con `active = false`.
4. `npx prisma migrate deploy`.
5. Pruebas de emisión en ambiente `HABILITACION`.
6. DIAN confirma habilitación → `environment = PRODUCCION`, `active = true`.

---

## 8. Plan de Testing

### 8.1 UblBuilderService — unit tests

- Genera UBL 2.1 con namespaces correctos.
- Incluye CUFE en `cbc:UUID` con `schemeID="2"`.
- Una `cac:InvoiceLine` por item.
- `ProfileExecutionID = "2"` para HABILITACION, `"1"` para PRODUCCION.
- Matchea fixture XML oficial DIAN (tabla 5 Anexo Técnico).

### 8.2 CufeService — vectores de prueba DIAN

- Computa CUFE correcto para vectores del Anexo Técnico (hash SHA-384, 96 chars hex).
- `calcDvNit` devuelve DV correcto para NITs de prueba conocidos.

### 8.3 FactureAdapter — contract tests

- ACCEPTED con `providerReference` y `cufe`.
- REJECTED con `rejectionReason`.
- Propaga timeout/error para que BullMQ reintente.

### 8.4 EInvoicesService — idempotencia

- No re-envía si ya ACCEPTED.
- Si SENT con `providerReference`, consulta `getStatus` en lugar de re-enviar (recovery).

### 8.5 E2E — flujo venta → FE ACCEPTED

Mock PSE con `nock`. Crear venta, esperar FE procesada con polling (timeout 15s), verificar CUFE de 96 chars y `fullNumber` formato `FE00000001`.

---

## 9. Rollout por Fases

### Phase A — Core backend sin transmisión
**2–3 semanas** — Instalar deps, migración Prisma, UblBuilder, CufeService, config/company endpoints, tests unitarios con vectores DIAN, registrar módulo en AppModule.

### Phase B — Provider + Queue + Retry
**2–3 semanas** — Requiere registro PSE + habilitación DIAN. FactureAdapter, EInvoiceProcessor, idempotencia, integración SalesService, pruebas reales en Habilitación.

### Phase C — Frontend
**1–2 semanas** — Hooks con polling, StatusBadge, páginas `/einvoices` y `/einvoices/[id]`, EInvoiceBanner, CompanyFiscalForm, ResolutionForm, Sidebar.

### Phase D — Notas Crédito
**1–2 semanas** — Depende del Plan 02. CufeService.computeCude, UBL extendido para NC (`InvoiceTypeCode = 91`), `cac:BillingReference` referenciando CUFE de FE original.

### Phase E — Contingencia y monitoreo
**1 semana** — Job cron alertas de consecutivo/vencimiento, modo contingencia si PSE falla > 24h, job de sync post-contingencia, dashboard.

---

## 10. Riesgos y Gotchas

### 10.1 Gap en consecutivos — RIESGO CRÍTICO

Mitigación: consecutivo se asigna en worker BullMQ con `SELECT FOR UPDATE`, nunca al crear DRAFT.

### 10.2 Pérdida de certificado .p12

Almacenar en HashiCorp Vault o AWS Secrets Manager. Backup cifrado offline. Nunca en código ni env sin cifrar.

### 10.3 Rechazos DIAN por datos del cliente

Validar NIT + DV con `calcDvNit()` en `CustomersController` antes de guardar. Hacer `emailForEInvoice` requerido cuando `documentType = 'NIT'`. Incluir tabla de códigos DANE.

### 10.4 Idempotencia — no duplicar emisión

Worker envía al PSE, PSE acepta, proceso cae antes de update DB → al reintentar consulta `getStatus(providerReference)`. Usar `jobId: einvoiceId` en BullMQ.

### 10.5 Throttling PSE/DIAN

`limiter: { max: 5, duration: 1000 }` en worker. Jobs se acumulan en Redis respetando el límite.

### 10.6 Expiración de resolución o agotamiento de rango

Cron diario: alertar cuando `rangeTo - nextConsecutive < 500` o `validTo - now() < 30 días`.

### 10.7 XML con caracteres especiales

`xmlbuilder2` escapa automáticamente. NO concatenar strings manualmente.

---

## 11. Compliance Checklist

| Requisito DIAN | Cubierto | Fase |
|---|---|---|
| UBL 2.1 con namespaces correctos | Sí | A |
| CUFE SHA-384 según Anexo Técnico | Sí | A |
| CUDE para Notas Crédito | Sí | D |
| Firma XAdES-EPES | Solo PSE | E para DirectDian |
| Transmisión HTTPS a DIAN/PSE | Sí | B |
| Consecutivo sin gaps | Sí | B (SELECT FOR UPDATE) |
| Resolución DIAN en XML | Sí | A |
| ProfileExecutionID Hab/Prod | Sí | A |
| Datos emisor completos | Sí | A |
| Datos receptor completos | Sí | A |
| DV NIT validado | Sí | A (`calcDvNit`) |
| QR con CUFE en PDF | Sí | B |
| Acuse DIAN conservado | Sí | B |
| Conservación XML 5 años | Parcial | B (backup pendiente) |
| Modo contingencia | Sí | E |
| Nota Crédito referenciando FE | Sí | D |
| Nota Débito | No | Fuera de alcance |
| Factura exportación | No | Fuera de alcance |
| Nómina electrónica | No | Fuera de alcance |
| Documento Soporte POS | Sí | B |

---

## 12. Archivos a Crear / Modificar

### Backend — Nuevos

| Archivo | Tipo |
|---|---|
| `backend/src/einvoices/einvoices.module.ts` | [CREATE] |
| `backend/src/einvoices/einvoices.controller.ts` | [CREATE] |
| `backend/src/einvoices/einvoices.service.ts` | [CREATE] |
| `backend/src/einvoices/einvoice-config.service.ts` | [CREATE] |
| `backend/src/einvoices/company-fiscal-info.service.ts` | [CREATE] |
| `backend/src/einvoices/dto/*.dto.ts` (4 archivos) | [CREATE] |
| `backend/src/einvoices/providers/electronic-invoice-provider.interface.ts` | [CREATE] |
| `backend/src/einvoices/providers/facture.adapter.ts` | [CREATE] |
| `backend/src/einvoices/providers/hka.adapter.ts` | [CREATE] |
| `backend/src/einvoices/providers/direct-dian.adapter.ts` | [CREATE] stub |
| `backend/src/einvoices/ubl/ubl-builder.service.ts` | [CREATE] |
| `backend/src/einvoices/ubl/cufe.service.ts` | [CREATE] |
| `backend/src/einvoices/ubl/xades-signer.service.ts` | [CREATE] stub |
| `backend/src/einvoices/queue/einvoice.processor.ts` | [CREATE] |
| `backend/src/einvoices/queue/einvoice-retry.strategy.ts` | [CREATE] |
| `backend/src/einvoices/ubl/ubl-builder.service.spec.ts` | [CREATE] |
| `backend/src/einvoices/ubl/cufe.service.spec.ts` | [CREATE] |
| `backend/src/einvoices/providers/facture.adapter.spec.ts` | [CREATE] |
| `backend/test/einvoice.e2e-spec.ts` | [CREATE] |
| `backend/prisma/migrations/[ts]_feat_einvoice_core/` | [CREATE] |

### Backend — Modificados

| Archivo | Cambio |
|---|---|
| `backend/prisma/schema.prisma` | +4 modelos, +5 enums, +5 cols Customer, +rel Sale |
| `backend/src/app.module.ts` | +BullModule.forRoot, +EInvoicesModule |
| `backend/src/sales/sales.service.ts` | +EInvoicesService inject, +createDraft+enqueue |
| `backend/src/sales/sales.module.ts` | +import EInvoicesModule |
| `backend/package.json` | +5 deps |
| `docker-compose.yml` | +Redis service |
| `backend/.env` | +8 env vars DIAN/Redis |

### Frontend — Nuevos

| Archivo | Tipo |
|---|---|
| `frontend/src/app/einvoices/page.tsx` | [CREATE] |
| `frontend/src/app/einvoices/[id]/page.tsx` | [CREATE] |
| `frontend/src/components/einvoices/EInvoiceStatusBadge.tsx` | [CREATE] |
| `frontend/src/components/einvoices/DianAcuseViewer.tsx` | [CREATE] |
| `frontend/src/components/einvoices/EInvoiceBanner.tsx` | [CREATE] |
| `frontend/src/components/einvoices/ResolutionForm.tsx` | [CREATE] |
| `frontend/src/components/einvoices/CompanyFiscalForm.tsx` | [CREATE] |
| `frontend/src/components/einvoices/CertificateUpload.tsx` | [CREATE] |
| `frontend/src/hooks/useEInvoices.ts` | [CREATE] |
| `frontend/src/hooks/useEInvoiceConfig.ts` | [CREATE] |

### Frontend — Modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/components/layout/Sidebar.tsx` | +navItem "Facturación" (ADMIN) |
| `frontend/src/app/settings/page.tsx` | +secciones DIAN |
| `frontend/src/app/sales/[id]/page.tsx` | +EInvoiceBanner |
| `frontend/package.json` | +qrcode.react |

---

## 13. Dependencias Externas

| Dependencia | Responsable | Tiempo | Requerido para |
|---|---|---|---|
| RUT actualizado DIAN | Empresa / contador | Ya debe existir | Habilitación |
| Resolución de facturación DIAN | Empresa | 5–15 días hábiles | Phase B |
| Cuenta PSE sandbox (Facture/HKA/Carvajal) | Empresa | 1–3 días | Phase B |
| Habilitación DIAN via PSE | PSE + empresa | 5–10 días hábiles | Phase B |
| Certificado digital X.509 (Certicámara/Andes SCD) | Empresa | 2–5 días | Solo Phase E DirectDian |
| Habilitación Producción | PSE + empresa | 5–15 días hábiles | Post Phase B |

> [!IMPORTANT]
> **Iniciar registro en PSE y solicitud de resolución DIAN en paralelo con Phase A.** El proceso externo puede tomar hasta 4 semanas y es el camino crítico real — no el código.

---

## 14. Estimación Realista

| Fase | Desarrollo | Testing | Bloqueos externos |
|---|---|---|---|
| A — Core backend | 25–35h | 10–15h | 5h |
| B — Provider + Queue | 20–30h | 10–15h | 15–20h |
| C — Frontend | 20–25h | 5–8h | 2h |
| D — Notas Crédito | 10–15h | 5–8h | Plan 02 |
| E — Contingencia + monitoreo | 10–15h | 5–8h | 5h |
| **Total** | **85–120h** | **35–54h** | **27–32h** |

**Rango total: 147–206 horas. Conservador: 150 horas.**
**Tiempo calendario:** Parcial (proyecto de grado): 4–6 meses. Equipo senior dedicado: 2–3 meses.

---

_Plan 04 de 7 — roadmap MeperPOS · Fecha: 2026-04-21_
