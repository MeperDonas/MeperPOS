# 🏗️ Diagramas de Componentes por Módulo

Esta carpeta contiene los diagramas de componentes del MeperPOS y Punto de Venta, organizados según la arquitectura del backend en NestJS.

## 📁 Estructura de Archivos

### Módulos Backend

1. **modulo-auth.puml** - Módulo de Autenticación
   - AuthController, AuthService
   - JWT Strategy y Guards
   - DTOs y Decoradores

2. **modulo-productos.puml** - Módulo de Productos
   - ProductsController, ProductsSearchController
   - ProductsService
   - Integración con Cloudinary

3. **modulo-categorias.puml** - Módulo de Categorías
   - CategoriesController, CategoriesService
   - Relaciones con productos

4. **modulo-clientes.puml** - Módulo de Clientes
   - CustomersController, CustomersService
   - Gestión de historial de compras

5. **modulo-ventas.puml** - Módulo de Ventas/POS
   - SalesController, SalesService
   - Transacciones ACID
   - AuditInterceptor

6. **modulo-reportes.puml** - Módulo de Reportes
   - ReportsController, ReportsService
   - Agregaciones y estadísticas

7. **modulo-exportaciones.puml** - Módulo de Exportaciones
   - ExportsController, ExportsService
   - Generadores PDF, Excel, CSV

8. **modulo-configuracion.puml** - Módulo de Configuración
   - SettingsController, SettingsService
   - Configuración de empresa y usuarios

## 🎨 Convenciones de Componentes

### Colores por Tipo
| Color | Tipo | Descripción |
|-------|------|-------------|
| Azul (#E3F2FD) | Controller | API REST Endpoints |
| Verde (#E8F5E9) | Service | Lógica de negocio |
| Naranja (#FFF3E0) | Strategy/Config | Configuraciones JWT |
| Rojo (#FFEBEE) | Guard | Seguridad y autorización |
| Púrpura (#F3E5F5) | DTO | Data Transfer Objects |
| Gris (#E0E0E0) | Dependencias | Servicios externos |
| Azul claro (#BBDEFB) | Base de Datos | PostgreSQL |
| Naranja claro (#FFE0B2) | Almacenamiento | Cloudinary, Redis |

### Símbolos
- **Rectángulos**: Componentes y clases
- **Círculos**: Interfaces/Endpoints
- **Base de datos**: Almacenamiento persistente
- **Nube**: Servicios externos

## 🏛️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                      │
│                    React + TypeScript                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY                               │
│         CORS → Rate Limiting → JWT Validation               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (NestJS)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │   Auth   │ │ Products │ │  Sales   │ │  Reports │       │
│  │  Module  │ │  Module  │ │  Module  │ │  Module  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              CAPA DE DATOS E INFRAESTRUCTURA                 │
│        PostgreSQL ← Prisma → Redis → Cloudinary             │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Cómo Visualizar

### Opción 1: PlantUML Online
1. Visita [PlantUML Online](http://www.plantuml.com/plantuml/uml/)
2. Copia y pega el contenido del archivo .puml
3. El diagrama se generará automáticamente

### Opción 2: Extensión VS Code
1. Instala la extensión "PlantUML" de jebbs
2. Abre el archivo .puml
3. Usa `Alt+D` para previsualizar

### Opción 3: PlantText
1. Visita [PlantText](https://www.planttext.com/)
2. Pega el código PlantUML
3. Descarga la imagen generada

## 📋 Detalle de Componentes

### Módulo de Autenticación
```
AuthController
├── AuthService
│   ├── PrismaService
│   ├── JwtService
│   ├── ConfigService
│   └── bcrypt
├── JwtAuthGuard
│   └── JwtStrategy
└── RolesGuard
    └── @Roles Decorator
```

**Endpoints:**
- POST /auth/login
- POST /auth/register
- GET /auth/profile
- POST /auth/refresh

### Módulo de Productos
```
ProductsController
├── ProductsService
│   ├── PrismaService
│   ├── CacheService
│   └── CloudinaryService
└── DTOs (Create, Update, Upload)

ProductsSearchController
└── ProductsService
```

**Endpoints:**
- GET /products
- GET /products/:id
- GET /products/search?q=
- POST /products
- PUT /products/:id
- DELETE /products/:id
- POST /products/:id/image

### Módulo de Ventas
```
SalesController
├── @UseInterceptors(AuditInterceptor)
├── SalesService
│   ├── PrismaService (Transacción ACID)
│   │   ├── Validar Stock
│   │   ├── Calcular Totales
│   │   ├── Crear Venta
│   │   ├── Actualizar Stock
│   │   └── Registrar Movimiento
│   └── CacheService
└── DTOs (CreateSale, SaleItem, Payment)
```

**Endpoints:**
- GET /sales
- GET /sales/:id
- POST /sales
- PUT /sales/:id/status
- POST /sales/:id/receipt

### Módulo de Importaciones
```
ImportsController
├── ImportsService
│   └── PrismaService
└── DTOs (Import, RetryRow)
```

**Endpoints:**
- GET /imports/products/template
- POST /imports/products
- GET /imports/:jobId/status
- POST /imports/:jobId/retry-row

### Módulo de Reportes
```
ReportsController
├── ReportsService
│   ├── PrismaService
│   │   ├── aggregate()
│   │   ├── groupBy()
│   │   └── findMany()
│   └── CacheService
└── DTOs (Filter, Sales, Inventory, Dashboard)
```

**Endpoints:**
- GET /reports/dashboard
- GET /reports/sales
- GET /reports/products
- GET /reports/customers
- GET /reports/inventory

## 🔗 Dependencias entre Módulos

```
app.module.ts
├── AuthModule
├── ProductsModule
│   └── CloudinaryModule
├── CategoriesModule
├── CustomersModule
├── SalesModule
├── ReportsModule
├── ExportsModule
│   └── CloudinaryModule
├── ImportsModule
├── SettingsModule
├── CloudinaryModule
└── CommonModule
    ├── Guards
    ├── Interceptors
    └── Decorators
```

## 📊 Patrones de Diseño Utilizados

### 1. Inyección de Dependencias (DI)
```typescript
@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}
}
```

### 2. Decoradores
```typescript
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  @Get()
  findAll() { ... }
}
```

### 3. DTOs (Data Transfer Objects)
```typescript
export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;
  
  @IsNumber()
  @Min(0)
  price: number;
}
```

### 4. Repository Pattern (Prisma)
```typescript
// Abstracción de acceso a datos
this.prisma.product.findMany({
  where: { active: true },
  include: { category: true }
})
```

## 🛡️ Seguridad

### Guards Implementados
- **JwtAuthGuard**: Verifica tokens JWT válidos
- **RolesGuard**: Verifica roles requeridos

### Interceptores
- **AuditInterceptor**: Registra operaciones en audit_logs

### Decoradores de Seguridad
- **@Roles('ADMIN', 'CASHIER')**: Restringe por rol
- **@Public()**: Excluye de autenticación
- **@CurrentUser()**: Inyecta usuario actual

---

*Documentación generada para el proyecto de MeperPOS y Punto de Venta*
