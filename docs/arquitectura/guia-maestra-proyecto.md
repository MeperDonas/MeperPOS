# 📚 GUÍA MAESTRA DEL PROYECTO
## MeperPOS y Punto de Venta

---

## 📋 ÍNDICE

1. [Visión General del Proyecto](#1-visión-general-del-proyecto)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Backend (NestJS)](#3-backend-nestjs)
4. [Frontend (Next.js + React)](#4-frontend-nextjs--react)
5. [Base de Datos (PostgreSQL + Prisma)](#5-base-de-datos-postgresql--prisma)
6. [APIs y Comunicación](#6-apis-y-comunicación)
7. [Componentes Reutilizables](#7-componentes-reutilizables)
8. [Hooks Personalizados](#8-hooks-personalizados)
9. [Flujos de Negocio](#9-flujos-de-negocio)
10. [Patrones y Buenas Prácticas](#10-patrones-y-buenas-prácticas)

---

## 1. VISIÓN GENERAL DEL PROYECTO

### ¿Qué es este proyecto?

Es un **sistema integral de gestión comercial** que combina:
- 📦 **Gestión de Inventario**: Control de productos, stock, categorías
- 💰 **Punto de Venta (POS)**: Procesamiento de ventas en tiempo real
- 👥 **Gestión de Clientes**: Base de datos de clientes con segmentación
- 📊 **Reportes y Analytics**: Estadísticas de ventas, productos más vendidos
- 🏢 **Multi-usuario**: Diferentes roles (Admin, Cajero, Inventario)

### Tecnologías Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    STACK TECNOLÓGICO                        │
├─────────────────────────────────────────────────────────────┤
│  FRONTEND          │  BACKEND           │  DATABASE        │
│  ─────────         │  ───────           │  ─────────       │
│  • Next.js 16      │  • NestJS 11       │  • PostgreSQL    │
│  • React 19        │  • TypeScript      │  • Prisma ORM    │
│  • TypeScript      │  • JWT Auth        │  • Redis (cache) │
│  • Tailwind v4     │  • Swagger Docs    │                  │
│  • TanStack Query  │  • Cloudinary      │                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. ARQUITECTURA DEL SISTEMA

### 2.1 Arquitectura General

```
┌──────────────────────────────────────────────────────────────┐
│                         CLIENTE                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Web App   │  │  Mobile     │  │  Third-party Apps   │  │
│  │  (Next.js)  │  │  (PWA)      │  │  (API Integration)  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          └────────────────┴────────────────────┘
                           │
                    HTTP/HTTPS
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      API GATEWAY                             │
│  • Rate Limiting    • CORS    • JWT Validation              │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    BACKEND (NestJS)                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │   Auth       │ │   Products   │ │    Sales     │         │
│  │   Module     │ │   Module     │ │   Module     │         │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘         │
│         │                │                │                  │
│  ┌──────▼───────┐ ┌──────▼───────┐ ┌──────▼───────┐         │
│  │  Services    │ │  Services    │ │  Services    │         │
│  │  • Auth      │ │  • Products  │ │  • Sales     │         │
│  │  • JWT       │ │  • Categories│ │  • Payments  │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              CAPA DE DATOS E INFRAESTRUCTURA                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │   Prisma     │ │    Redis     │ │  Cloudinary  │         │
│  │   ORM        │ │   (Cache)    │ │   (Images)   │         │
│  └──────┬───────┘ └──────────────┘ └──────────────┘         │
│         │                                                    │
│  ┌──────▼───────┐                                           │
│  │  PostgreSQL  │                                           │
│  │  Database    │                                           │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Patrón de Arquitectura: MVC + Modular

El backend usa **NestJS** que implementa una arquitectura **MVC (Model-View-Controller)** con inyección de dependencias:

```
┌─────────────────────────────────────────────────────────┐
│  REQUEST → CONTROLLER → SERVICE → REPOSITORY → DATABASE │
│                                                         │
│  • Controller: Maneja HTTP requests/responses          │
│  • Service:    Lógica de negocio                       │
│  • Repository: Acceso a datos (Prisma)                 │
│  • DTOs:       Transferencia de datos                  │
│  • Guards:     Autenticación/Autorización              │
└─────────────────────────────────────────────────────────┘
```

---

## 3. BACKEND (NestJS)

### 3.1 Estructura de Carpetas

```
backend/
├── src/
│   ├── auth/                    # Módulo de autenticación
│   │   ├── auth.controller.ts   # Endpoints de login/register
│   │   ├── auth.service.ts      # Lógica de auth
│   │   ├── auth.module.ts       # Configuración del módulo
│   │   ├── dto/                 # Data Transfer Objects
│   │   │   ├── login.dto.ts
│   │   │   └── register.dto.ts
│   │   └── guards/              # Protección de rutas
│   │       ├── jwt-auth.guard.ts
│   │       └── roles.guard.ts
│   │
│   ├── products/                # Módulo de productos
│   │   ├── products.controller.ts
│   │   ├── products.service.ts
│   │   ├── products-search.controller.ts
│   │   └── dto/
│   │       ├── create-product.dto.ts
│   │       └── update-product.dto.ts
│   │
│   ├── sales/                   # Módulo de ventas
│   │   ├── sales.controller.ts
│   │   ├── sales.service.ts     # ¡613 líneas! Lógica compleja
│   │   └── dto/
│   │
│   ├── customers/               # Módulo de clientes
│   ├── categories/              # Módulo de categorías
│   ├── reports/                 # Módulo de reportes
│   ├── settings/                # Configuraciones del sistema
│   ├── exports/                 # Exportación de datos (PDF, Excel)
│   ├── imports/                 # Importación masiva de datos
│   │
│   ├── common/                  # Código compartido
│   │   ├── filters/             # Filtros de excepciones
│   │   │   └── http-exception.filter.ts
│   │   ├── guards/              # Guards reutilizables
│   │   ├── interceptors/        # Interceptores (audit logging)
│   │   │   └── audit.interceptor.ts
│   │   └── services/            # Servicios compartidos
│   │       └── cache.service.ts
│   │
│   ├── prisma/                  # Configuración de Prisma
│   │   └── prisma.service.ts
│   │
│   ├── cloudinary/              # Integración con Cloudinary
│   │   └── cloudinary.service.ts
│   │
│   ├── app.module.ts            # Módulo raíz
│   └── main.ts                  # Punto de entrada
│
├── prisma/
│   └── schema.prisma            # Esquema de base de datos
│
└── test/                        # Tests (¡BÁSICOS!)
```

### 3.2 Conceptos Fundamentales

#### 3.2.1 Decoradores de NestJS

Los decoradores son funciones especiales que añaden metadata a clases, métodos o propiedades:

```typescript
// @Controller() - Define un controlador REST
@Controller('products')  // La ruta base será /products
export class ProductsController {

  // @Get() - Maneja peticiones GET
  @Get()  // GET /products
  findAll() {
    return this.productsService.findAll();
  }

  // @Get(':id') - GET con parámetro
  @Get(':id')  // GET /products/123
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  // @Post() - Maneja peticiones POST
  @Post()  // POST /products
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  // @UseGuards() - Protege la ruta
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')  // Solo admins pueden eliminar
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
```

**Decoradores más usados:**
- `@Controller()` - Define ruta base
- `@Get()`, `@Post()`, `@Put()`, `@Delete()`, `@Patch()` - Métodos HTTP
- `@Param()` - Extrae parámetros de URL
- `@Query()` - Extrae query strings
- `@Body()` - Extrae body de la petición
- `@Headers()` - Extrae headers
- `@UseGuards()` - Aplica guards de autenticación
- `@UseInterceptors()` - Aplica interceptores

#### 3.2.2 Inyección de Dependencias (DI)

NestJS usa un contenedor de inyección de dependencias. Esto significa que no creas instancias manualmente, NestJS las crea y las "inyecta" donde las necesites:

```typescript
// products.service.ts
@Injectable()  // Marca la clase como inyectable
export class ProductsService {
  constructor(
    private prisma: PrismaService,  // NestJS inyecta automáticamente
    private cache: CacheService,     // NestJS inyecta automáticamente
  ) {}
  
  // Ahora puedes usar this.prisma y this.cache
}
```

**¿Por qué es importante?**
- ✅ Desacoplamiento: No dependes de implementaciones específicas
- ✅ Testeabilidad: Puedes mockear dependencias fácilmente
- ✅ Mantenibilidad: Cambiar una dependencia no afecta al resto
- ✅ Singleton: Por defecto, NestJS crea una sola instancia (singleton)

#### 3.2.3 Módulos (@Module)

Los módulos organizan el código en bloques funcionales:

```typescript
// products.module.ts
@Module({
  imports: [
    // Otros módulos que necesita este módulo
    PrismaModule,
    CacheModule,
  ],
  controllers: [
    // Controladores de este módulo
    ProductsController,
    ProductsSearchController,
  ],
  providers: [
    // Servicios que provee este módulo
    ProductsService,
    ProductsSearchService,
  ],
  exports: [
    // Servicios que otros módulos pueden usar
    ProductsService,
  ],
})
export class ProductsModule {}
```

### 3.3 Flujo de una Petición

Vamos a seguir una petición paso a paso: **"Crear un producto"**

```
1. CLIENTE envía POST /products
   Body: { name: "Laptop", price: 1000, stock: 10 }

2. MIDDLEWARE (main.ts)
   ↓ CORS check
   ↓ Helmet headers
   ↓ Rate limiting
   ↓ Body parsing (JSON)

3. GUARDS (JwtAuthGuard)
   ↓ Extrae token del header
   ↓ Verifica JWT signature
   ↓ Decodifica payload (userId, role)
   ↓ Adjunza user al request

4. INTERCEPTOR (AuditInterceptor)
   ↓ Registra: "Usuario X creó producto Y a las Z"

5. CONTROLLER (ProductsController.create)
   ↓ @Body() extrae el body
   ↓ ValidationPipe valida el DTO
   ↓ Llama a productsService.create()

6. SERVICE (ProductsService.create)
   ↓ Lógica de negocio:
     - Verifica si SKU ya existe
     - Calcula precios con impuestos
     - Valida stock mínimo
   ↓ Llama a prisma.product.create()

7. REPOSITORY (PrismaService)
   ↓ Genera SQL INSERT
   ↓ Ejecuta en PostgreSQL
   ↓ Retorna el producto creado

8. RESPONSE
   ↓ Service retorna al Controller
   ↓ Controller retorna al Cliente
   ↓ JSON: { id: "123", name: "Laptop", ... }
```

### 3.4 Servicios Clave

#### 3.4.1 AuthService (Autenticación)

```typescript
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,  // De @nestjs/jwt
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    // 1. Buscar usuario por email
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    // 2. Verificar contraseña (bcrypt)
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3. Generar JWT
    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: '24h',
    });

    return { access_token };
  }
}
```

**Conceptos clave:**
- **JWT (JSON Web Token)**: Token firmado digitalmente que contiene claims (userId, role, exp)
- **bcrypt**: Algoritmo de hashing para contraseñas (irreversible)
- **Payload**: Datos que viajan en el token (NO información sensible)

#### 3.4.2 SalesService (Ventas) - Lógica Compleja

Este es el servicio más complejo (613 líneas). Maneja:
- Creación de ventas
- Procesamiento de pagos mixtos
- Actualización de inventario
- Generación de recibos PDF
- Cálculo de impuestos y descuentos

```typescript
@Injectable()
export class SalesService {
  async createSale(createSaleDto: CreateSaleDto, userId: string) {
    // 1. INICIAR TRANSACCIÓN (todo o nada)
    return this.prisma.$transaction(async (tx) => {
      
      // 2. VALIDAR STOCK de cada producto
      for (const item of createSaleDto.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para ${product.name}`
          );
        }
      }

      // 3. CALCULAR TOTALES
      let subtotal = 0;
      for (const item of createSaleDto.items) {
        subtotal += item.quantity * item.unitPrice;
      }
      const taxAmount = subtotal * 0.19;  // 19% IVA
      const total = subtotal + taxAmount - createSaleDto.discountAmount;

      // 4. CREAR LA VENTA
      const sale = await tx.sale.create({
        data: {
          subtotal,
          taxAmount,
          total,
          discountAmount: createSaleDto.discountAmount,
          customerId: createSaleDto.customerId,
          userId,
          items: {
            create: createSaleDto.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
            })),
          },
          payments: {
            create: createSaleDto.payments,
          },
        },
      });

      // 5. ACTUALIZAR STOCK
      for (const item of createSaleDto.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { 
            stock: { decrement: item.quantity } 
          },
        });

        // Registrar movimiento de inventario
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: 'SALE',
            quantity: -item.quantity,
            saleId: sale.id,
          },
        });
      }

      // 6. RETORNAR VENTA CREADA
      return sale;
    });
  }
}
```

**Conceptos clave:**
- **Transacciones**: Garantizan atomicidad (todo se ejecuta o nada)
- **Concurrencia optimista**: Campo `version` en Product para evitar race conditions
- **Movimientos de inventario**: Auditoría de cada cambio de stock

### 3.5 Guards (Protección de Rutas)

#### 3.5.1 JwtAuthGuard

```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    try {
      // Verificar y decodificar JWT
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
      
      // Adjuntar usuario al request para uso posterior
      request.user = payload;
      
      return true;  // Permitir acceso
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

#### 3.5.2 RolesGuard

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Obtener roles requeridos del decorador @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;  // No se requieren roles específicos
    }

    const { user } = context.switchToHttp().getRequest();
    
    // Verificar si el usuario tiene alguno de los roles requeridos
    return requiredRoles.some((role) => user.role === role);
  }
}
```

**Uso combinado:**
```typescript
@Controller('products')
@UseGuards(JwtAuthGuard)  // Primero verifica JWT
export class ProductsController {
  
  @Delete(':id')
  @UseGuards(RolesGuard)   // Luego verifica roles
  @Roles('ADMIN')          // Solo ADMIN puede eliminar
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
```

### 3.6 DTOs (Data Transfer Objects)

Los DTOs definen la forma de los datos que entran/salen de la API:

```typescript
// create-product.dto.ts
export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Laptop Dell XPS' })
  name: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'LAP-DELL-001', required: false })
  sku?: string;

  @IsNumber()
  @Min(0)
  @ApiProperty({ example: 1000 })
  salePrice: number;

  @IsNumber()
  @Min(0)
  @ApiProperty({ example: 10 })
  stock: number;

  @IsUUID()
  @IsOptional()
  @ApiProperty({ example: 'cat-123', required: false })
  categoryId?: string;
}
```

**Decoradores de validación:**
- `@IsString()`, `@IsNumber()`, `@IsBoolean()` - Tipo de dato
- `@IsNotEmpty()` - No puede ser vacío
- `@IsOptional()` - Campo opcional
- `@Min(0)`, `@Max(100)` - Rango numérico
- `@IsEmail()` - Formato de email
- `@IsUUID()` - Formato UUID
- `@ValidateNested()` - Validar objetos anidados

---

## 4. FRONTEND (Next.js + React)

### 4.1 Estructura de Carpetas

```
frontend/
├── src/
│   ├── app/                          # App Router (Next.js 13+)
│   │   ├── layout.tsx               # Layout raíz (providers, theme)
│   │   ├── page.tsx                 # Página de login
│   │   ├── globals.css              # Estilos globales
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx             # /dashboard
│   │   ├── inventory/
│   │   │   └── page.tsx             # /inventory
│   │   ├── pos/
│   │   │   └── page.tsx             # /pos (Punto de Venta)
│   │   ├── sales/
│   │   │   └── page.tsx             # /sales
│   │   ├── customers/
│   │   │   └── page.tsx             # /customers
│   │   ├── categories/
│   │   │   └── page.tsx             # /categories
│   │   ├── reports/
│   │   │   └── page.tsx             # /reports
│   │   ├── settings/
│   │   │   └── page.tsx             # /settings
│   │   └── profile/
│   │       └── page.tsx             # /profile
│   │
│   ├── components/                   # Componentes React
│   │   ├── layout/                  # Componentes de layout
│   │   │   ├── DashboardLayout.tsx  # Layout con sidebar
│   │   │   └── Sidebar.tsx          # Menú lateral
│   │   │
│   │   ├── ui/                      # Componentes UI reutilizables
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   └── ImageUpload.tsx
│   │   │
│   │   └── pos/                     # Componentes específicos del POS
│   │       ├── PaymentConfirmationModal.tsx
│   │       ├── PaymentMethodCards.tsx
│   │       └── QuickAmountButtons.tsx
│   │
│   ├── hooks/                        # Hooks personalizados
│   │   ├── useAuth.ts
│   │   ├── useProducts.ts
│   │   ├── useSales.ts
│   │   ├── useCustomers.ts
│   │   ├── useCategories.ts
│   │   ├── useReports.ts
│   │   ├── useSettings.ts
│   │   ├── useProfile.ts
│   │   ├── useReceipt.ts
│   │   ├── useUsers.ts
│   │   └── usePausedSales.ts
│   │
│   ├── contexts/                     # React Contexts
│   │   ├── AuthContext.tsx          # Estado de autenticación
│   │   └── ThemeContext.tsx         # Tema claro/oscuro
│   │
│   ├── lib/                          # Utilidades y configuración
│   │   ├── api.ts                   # Cliente HTTP (Axios)
│   │   └── utils.ts                 # Funciones utilitarias
│   │
│   └── types/                        # Tipos TypeScript
│       └── index.ts
│
├── public/                          # Archivos estáticos
├── next.config.ts                   # Configuración de Next.js
├── tailwind.config.ts               # Configuración de Tailwind
└── package.json
```

### 4.2 App Router vs Pages Router

Este proyecto usa **App Router** (Next.js 13+), la forma moderna de enrutar:

```
Pages Router (Antiguo)          App Router (Nuevo)
─────────────────────          ─────────────────
pages/index.tsx      →         app/page.tsx
pages/dashboard.tsx  →         app/dashboard/page.tsx
pages/api/users.ts   →         app/api/users/route.ts

Ventajas del App Router:
✅ Server Components por defecto (menos JS al cliente)
✅ Layouts anidados
✅ Loading states integrados
✅ Error boundaries integrados
✅ Streaming de datos
```

### 4.3 Server Components vs Client Components

**Server Components (por defecto):**
- Se ejecutan en el servidor
- No tienen acceso a APIs del navegador (window, document)
- No pueden usar hooks de React (useState, useEffect)
- Menor bundle size (no envían JS al cliente)
- Acceso directo a base de datos

**Client Components:**
- Se ejecutan en el navegador
- Tienen acceso a todas las APIs del navegador
- Pueden usar hooks de React
- Necesitan `"use client"` al inicio del archivo

```typescript
// Server Component (default)
// app/dashboard/page.tsx
export default async function DashboardPage() {
  // ¡Esto se ejecuta en el servidor!
  const data = await fetch('https://api.example.com/data');
  
  return <div>{data}</div>;
}

// Client Component
// app/pos/page.tsx
"use client";

import { useState } from 'react';

export default function POSPage() {
  // ¡Esto se ejecuta en el navegador!
  const [cart, setCart] = useState([]);
  
  return <div>...</div>;
}
```

### 4.4 Sistema de Componentes UI

#### 4.4.1 Button.tsx - Anatomía de un Componente

```typescript
"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";  // Utilidad para combinar clases

// 1. DEFINIR VARIANTES (Tipado estricto)
type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

// 2. INTERFAZ DE PROPS (Qué acepta el componente)
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;    // Estilo visual
  size?: ButtonSize;          // Tamaño
  loading?: boolean;          // Estado de carga
  fullWidth?: boolean;        // Ancho completo
}

// 3. MAPEO DE VARIANTES A CLASES (Tailwind)
const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  outline: "border border-input bg-background hover:bg-accent",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 py-2",
  lg: "h-12 px-6 text-lg",
};

// 4. COMPONENTE CON forwardRef (para poder usar ref)
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { 
      className,           // Clases adicionales
      variant = "primary", // Valor por defecto
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      ...props            // Resto de props nativas de button
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Clases base (siempre aplicadas)
          "inline-flex items-center justify-center rounded-lg font-medium",
          "transition-colors focus-visible:outline-none",
          "disabled:pointer-events-none disabled:opacity-50",
          
          // Clases según variantes
          variantStyles[variant],
          sizeStyles[size],
          
          // Clases condicionales
          fullWidth && "w-full",
          loading && "opacity-70 cursor-wait",
          
          // Clases adicionales del usuario
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <span className="animate-spin mr-2">⏳</span>
            Cargando...
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
```

**Conceptos clave:**
- **`forwardRef`**: Permite que el componente acepte una referencia (ref)
- **`cn()`**: Función utilitaria que combina clases de Tailwind de forma inteligente
- **Variant Pattern**: Sistema de diseño consistente con variantes predefinidas
- **Extensión de HTMLAttributes**: Hereda todas las props nativas de `<button>`

#### 4.4.2 Input.tsx - Componente Controlado

```typescript
"use client";

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;           // Etiqueta del campo
  error?: string;           // Mensaje de error
  helperText?: string;      // Texto de ayuda
  textarea?: boolean;       // ¿Es textarea?
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, textarea, className, ...props }, ref) => {
    const inputClasses = cn(
      "flex w-full rounded-lg border border-input bg-background px-3 py-2",
      "text-sm ring-offset-background",
      "placeholder:text-muted-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
      error && "border-red-500 focus-visible:ring-red-500",
      className
    );

    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium leading-none">
            {label}
          </label>
        )}
        
        {textarea ? (
          <textarea
            ref={ref as React.RefObject<HTMLTextAreaElement>}
            className={cn(inputClasses, "min-h-[80px] resize-y")}
            {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input ref={ref} className={inputClasses} {...props} />
        )}
        
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
        
        {helperText && !error && (
          <p className="text-sm text-muted-foreground">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
```

**Uso:**
```tsx
<Input
  label="Nombre del producto"
  placeholder="Ej: Laptop Dell"
  value={name}
  onChange={(e) => setName(e.target.value)}
  error={errors.name}
  helperText="Mínimo 3 caracteres"
/>
```

### 4.5 Hooks Personalizados (Custom Hooks)

Los hooks son funciones que encapsulan lógica reutilizable de React.

#### 4.5.1 useProducts.ts - Hook de Datos

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Product, CreateProductInput } from "@/types";

// CLAVE DE QUERY: Identifica únicamente cada consulta
const PRODUCTS_KEY = "products";

// Hook para obtener productos (READ)
export function useProducts(options?: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
}) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, options],  // Clave única + dependencias
    queryFn: async () => {
      const response = await api.get("/products", { params: options });
      return response.data;
    },
    staleTime: 1000 * 60 * 5,  // Datos frescos por 5 minutos
    gcTime: 1000 * 60 * 30,    // Garbage collection después de 30 min
  });
}

// Hook para buscar productos
export function useSearchProducts(query: string, limit = 20) {
  return useQuery({
    queryKey: ["products", "search", query, limit],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const response = await api.get("/products/search", {
        params: { q: query, limit },
      });
      return response.data;
    },
    enabled: query.length >= 2,  // Solo ejecutar si query >= 2 chars
    staleTime: 1000 * 60,        // 1 minuto
  });
}

// Hook para crear producto (CREATE)
export function useCreateProduct() {
  const queryClient = useQueryClient();  // Para invalidar caché

  return useMutation({
    mutationFn: async (data: CreateProductInput) => {
      const response = await api.post("/products", data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidar caché de productos para recargar la lista
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] });
    },
  });
}

// Hook para actualizar producto (UPDATE)
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateProductInput>;
    }) => {
      const response = await api.put(`/products/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidar tanto la lista como el detalle
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] });
      queryClient.invalidateQueries({
        queryKey: [PRODUCTS_KEY, variables.id],
      });
    },
  });
}

// Hook para eliminar producto (DELETE)
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] });
    },
  });
}
```

**Conceptos clave:**
- **`useQuery`**: Para leer datos (GET). Maneja caché, loading, error automáticamente.
- **`useMutation`**: Para modificar datos (POST, PUT, DELETE). No usa caché.
- **`queryKey`**: Array que identifica únicamente cada consulta. Al cambiar, se re-ejecuta.
- **`queryClient.invalidateQueries`**: Marca datos como "stale" para forzar recarga.
- **`staleTime`**: Tiempo que los datos se consideran frescos (no se re-fetch).

#### 4.5.2 useAuth.ts - Hook de Autenticación

```typescript
"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export function useLogin() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await api.post("/auth/login", credentials);
      return response.data;
    },
    onSuccess: (data) => {
      // Guardar token en localStorage
      localStorage.setItem("token", data.access_token);
      // Redirigir al dashboard
      router.push("/dashboard");
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (data: { name: string; email: string; password: string }) => {
      const response = await api.post("/auth/register", data);
      return response.data;
    },
  });
}
```

#### 4.5.3 usePausedSales.ts - Hook con LocalStorage

```typescript
"use client";

import { useState, useEffect } from "react";
import type { CartItem } from "@/types";

interface PausedSale {
  id: string;
  cart: CartItem[];
  customerId: string;
  discountAmount: number;
  pausedAt: string;
  customerName?: string;
}

const PAUSED_SALES_KEY = "paused_sales";

export function usePausedSales() {
  const [pausedSales, setPausedSales] = useState<PausedSale[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cargar desde localStorage al montar
  useEffect(() => {
    const saved = localStorage.getItem(PAUSED_SALES_KEY);
    if (saved) {
      try {
        setPausedSales(JSON.parse(saved));
      } catch {
        console.error("Error loading paused sales");
      }
    }
    setIsLoaded(true);
  }, []);

  // Guardar en localStorage cuando cambia
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(PAUSED_SALES_KEY, JSON.stringify(pausedSales));
    }
  }, [pausedSales, isLoaded]);

  const pauseSale = (
    cart: CartItem[],
    customerId: string,
    discountAmount: number,
    customerName?: string
  ) => {
    const pausedSale: PausedSale = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      cart,
      customerId,
      discountAmount,
      pausedAt: new Date().toISOString(),
      customerName,
    };

    setPausedSales((prev) => [...prev, pausedSale]);
    return pausedSale.id;
  };

  const resumeSale = (id: string) => {
    const sale = pausedSales.find((s) => s.id === id);
    if (!sale) throw new Error("Paused sale not found");

    setPausedSales((prev) => prev.filter((s) => s.id !== id));
    return sale;
  };

  const deletePausedSale = (id: string) => {
    setPausedSales((prev) => prev.filter((s) => s.id !== id));
  };

  return {
    pausedSales,
    pauseSale,
    resumeSale,
    deletePausedSale,
    isLoaded,
  };
}
```

**Conceptos clave:**
- **`useEffect`**: Ejecuta código side effects (localStorage, suscripciones, timers)
- **Sincronización estado-localStorage**: Mantiene datos persistentes entre sesiones
- **Generación de IDs únicos**: Combina timestamp + random para IDs únicos

### 4.6 Contextos de React (Global State)

Los Contexts permiten compartir estado entre componentes sin prop drilling.

#### 4.6.1 AuthContext.tsx - Estado Global de Autenticación

```typescript
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

// 1. DEFINIR INTERFAZ DE USUARIO
export interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "CASHIER" | "INVENTORY_USER";
  active: boolean;
}

// 2. DEFINIR INTERFAZ DEL CONTEXT
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
  isAuthenticated: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
}

// 3. CREAR EL CONTEXT
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 4. PROVIDER COMPONENT
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Efecto: Cargar usuario al iniciar (de localStorage)
  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    try {
      if (token && savedUser) {
        const parsedUser = JSON.parse(savedUser) as User;
        setUser(parsedUser);
      }
    } catch (e) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } finally {
      setLoading(false);
    }
  }, []);

  // Login con useCallback (memoización)
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await api.post<{ access_token: string }>("/auth/login", {
          email,
          password,
        });

        const token = response.data.access_token;
        localStorage.setItem("token", token);

        // Obtener perfil del usuario
        const profileResponse = await api.get<User>("/auth/profile");
        setUser(profileResponse.data);
        localStorage.setItem("user", JSON.stringify(profileResponse.data));

        router.push("/dashboard");
      } catch (error) {
        console.error("Login error:", error);
        throw error;
      }
    },
    [router]
  );

  // Logout con useCallback
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    router.push("/login");
  }, [router]);

  // Register con useCallback
  const register = useCallback(async (data: RegisterData) => {
    try {
      await api.post("/auth/register", data);
    } catch (error) {
      console.error("Register error:", error);
      throw error;
    }
  }, []);

  // Memoizar el value para evitar re-renders innecesarios
  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      register,
      isAuthenticated: !!user,
    }),
    [user, loading, login, logout, register]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// 5. HOOK PARA CONSUMIR EL CONTEXT
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
```

**Conceptos clave:**
- **`createContext`**: Crea un contexto vacío
- **`useContext`**: Consume el valor del contexto
- **`Provider`**: Componente que provee el valor a sus hijos
- **`useCallback`**: Memoiza funciones para evitar recreación
- **`useMemo`**: Memoiza objetos/arrays para evitar recreación
- **Por qué memoizar**: Evita que los consumidores del contexto se re-rendericen innecesariamente

**Uso en componentes:**
```tsx
// Cualquier componente dentro del árbol puede usar:
const { user, login, logout, isAuthenticated } = useAuth();
```

### 4.7 Cliente HTTP (api.ts)

```typescript
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

// Crear instancia de Axios con configuración base
const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  headers: {
    "Content-Type": "application/json",
  },
});

// INTERCEPTOR DE REQUEST
// Se ejecuta antes de cada petición
api.interceptors.request.use(
  (config) => {
    // Agregar token de autenticación si existe
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// INTERCEPTOR DE RESPONSE
// Se ejecuta después de cada respuesta
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Manejar errores globales
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Métodos helper con tipado
export const apiClient = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    api.get<T>(url, config),
  
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.post<T>(url, data, config),
  
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.put<T>(url, data, config),
  
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.patch<T>(url, data, config),
  
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    api.delete<T>(url, config),
  
  postWithFormData: <T>(url: string, formData: FormData) =>
    api.post<T>(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export default api;
```

**Conceptos clave:**
- **Interceptors**: Funciones que se ejecutan antes/después de cada petición
- **Base URL**: Configuración centralizada del endpoint del backend
- **Automatic token injection**: El token se agrega automáticamente a cada request
- **Global error handling**: Manejo centralizado de errores (ej: 401 → logout)

---

## 5. BASE DE DATOS (PostgreSQL + Prisma)

### 5.1 ¿Qué es Prisma?

Prisma es un ORM (Object-Relational Mapping) moderno que:
- Genera tipos TypeScript automáticamente
- Proporciona un cliente type-safe
- Maneja migraciones de base de datos
- Optimiza queries automáticamente

### 5.2 Schema de Base de Datos

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                 String             @id @default(uuid())
  email              String             @unique
  password           String             // Hasheado con bcrypt
  name               String
  role               Role               @default(CASHIER)
  active             Boolean            @default(true)
  settings           Settings[]
  sales              Sale[]
  inventoryMovements InventoryMovement[]
  auditLogs          AuditLog[]
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
}
enum Role {
  ADMIN
  CASHIER
  INVENTORY_USER
}
// Categorías de productos
model Category {
  id          String    @id @default(uuid())
  name        String    @unique
  description String?
  active      Boolean   @default(true)
  products    Product[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
// Productos
model Product {
  id            String              @id @default(uuid())
  name          String
  sku           String              @unique
  barcode       String?             @unique
  description   String?
  costPrice     Decimal             @db.Decimal(10, 2)
  salePrice     Decimal             @db.Decimal(10, 2)
  taxRate       Decimal             @db.Decimal(5, 2) @default(0)
  stock         Int                 @default(0)
  minStock      Int                 @default(0)
  imageUrl      String?
  categoryId    String
  category      Category            @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  active        Boolean             @default(true)
  version       Int                 @default(0) // Para concurrencia optimista
  movements     InventoryMovement[]
  saleItems     SaleItem[]
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
}
// Movimientos de inventario
model InventoryMovement {
  id            String       @id @default(uuid())
  productId     String
  product       Product      @relation(fields: [productId], references: [id])
  type          MovementType
  quantity      Int
  previousStock Int
  newStock      Int
  reason        String
  userId        String
  user          User         @relation(fields: [userId], references: [id])
  saleId        String?      // Referencia si es una salida por venta
  sale          Sale?        @relation(fields: [saleId], references: [id])
  createdAt     DateTime     @default(now())

  @@index([productId, createdAt])
}
enum MovementType {
  PURCHASE        // Compra
  SALE            // Salida por venta
  ADJUSTMENT_IN   // Ajuste de entrada
  ADJUSTMENT_OUT  // Ajuste de salida
  DAMAGE          // Daño/Pérdida
  RETURN          // Devolución
}
// Clientes
model Customer {
  id             String    @id @default(uuid())
  name           String
  documentType   String    // CC, NIT, CE, etc.
  documentNumber String    @unique
  email          String?
  phone          String?
  address        String?
  segment        CustomerSegment @default(OCCASIONAL)
  active         Boolean   @default(true)
  sales          Sale[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}
enum CustomerSegment {
  VIP
  FREQUENT
  OCCASIONAL
  INACTIVE
}
// Ventas
model Sale {
  id             String       @id @default(uuid())
  saleNumber     Int          @unique @default(autoincrement()) // Consecutivo
  customerId     String?
  customer       Customer?    @relation(fields: [customerId], references: [id])
  subtotal       Decimal      @db.Decimal(10, 2)
  taxAmount      Decimal      @db.Decimal(10, 2)
  discountAmount Decimal      @db.Decimal(10, 2) @default(0)
  total          Decimal      @db.Decimal(10, 2)
  amountPaid     Decimal      @db.Decimal(10, 2)
  change         Decimal?     @db.Decimal(10, 2)
  status         SaleStatus   @default(COMPLETED)
  userId         String
  user           User         @relation(fields: [userId], references: [id])
  items          SaleItem[]
  payments       Payment[]
  inventoryMovements InventoryMovement[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([createdAt, status])
}
enum PaymentMethod {
  CASH
  CARD
  TRANSFER
}
enum SaleStatus {
  COMPLETED
  CANCELLED
  RETURNED_PARTIAL
}
// Pagos de venta (para soportar pagos divididos)
model Payment {
  id             String        @id @default(uuid())
  saleId         String
  sale           Sale          @relation(fields: [saleId], references: [id])
  method         PaymentMethod
  amount         Decimal       @db.Decimal(10, 2)
  createdAt      DateTime      @default(now())

  @@index([saleId])
}
// Items de venta
model SaleItem {
  id             String  @id @default(uuid())
  saleId         String
  sale           Sale    @relation(fields: [saleId], references: [id])
  productId      String
  product        Product @relation(fields: [productId], references: [id], onDelete: Restrict)
  quantity       Int
  unitPrice      Decimal @db.Decimal(10, 2)
  taxRate        Decimal @db.Decimal(5, 2)
  discountAmount Decimal @db.Decimal(10, 2) @default(0)
  subtotal       Decimal @db.Decimal(10, 2)
  total          Decimal @db.Decimal(10, 2)

  @@index([saleId])
  @@index([productId])
}
// Logs de auditoría
model AuditLog {
  id         String   @id @default(uuid())
  userId     String?
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  action     String   // LOGIN_SUCCESS, LOGIN_FAILED, PRICE_CHANGE, etc.
  resource   String   // Product, Sale, Customer, etc.
  resourceId String?
  metadata   Json?
  createdAt  DateTime @default(now())
}
// Configuración global del sistema
model Settings {
  id              String   @id @default(uuid())
  companyName     String   @default("Mi Negocio")
  currency        String   @default("COP")
  taxRate        Decimal   @db.Decimal(5, 2) @default(19)
  receiptPrefix  String   @default("REC-")
  printHeader    String?
  printFooter    String?
  logoUrl        String?
  userId          String?  // Ultimo usuario que actualizo configuracion
  user            User?    @relation(fields: [userId], references: [id])
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}
```

### 5.3 Conceptos de Prisma

#### 5.3.1 Relaciones

```prisma
// 1:1 Relación (Uno a Uno)
model User {
  id      String  @id @default(uuid())
  profile Profile?  // Un usuario tiene un perfil opcional
}

model Profile {
  id     String @id @default(uuid())
  userId String @unique  // Unique para 1:1
  user   User   @relation(fields: [userId], references: [id])
}

// 1:N Relación (Uno a Muchos)
model Category {
  id       String    @id @default(uuid())
  products Product[]  // Una categoría tiene muchos productos
}

model Product {
  id         String    @id @default(uuid())
  categoryId String?   // Opcional (producto puede no tener categoría)
  category   Category? @relation(fields: [categoryId], references: [id])
}

// N:M Relación (Muchos a Muchos)
model Sale {
  id    String     @id @default(uuid())
  items SaleItem[]  // Una venta tiene muchos items
}

model Product {
  id        String     @id @default(uuid())
  saleItems SaleItem[]  // Un producto puede estar en muchas ventas
}

model SaleItem {
  id        String  @id @default(uuid())
  saleId    String
  sale      Sale    @relation(fields: [saleId], references: [id])
  productId String
  product   Product @relation(fields: [productId], references: [id])
}
```

#### 5.3.2 Índices

```prisma
model Product {
  id   String @id @default(uuid())
  sku  String @unique
  name String

  // Índices para búsquedas frecuentes
  @@index([name])      // Búsqueda por nombre
  @@index([sku])       // Búsqueda por SKU
  @@index([categoryId, name])  // Índice compuesto
}
```

#### 5.3.3 Migraciones

```bash
# Crear migración después de cambiar schema.prisma
npx prisma migrate dev --name add_user_preferences

# Aplicar migraciones en producción
npx prisma migrate deploy

# Generar cliente de Prisma (tipos TypeScript)
npx prisma generate

# Abrir Prisma Studio (UI para ver/editar datos)
npx prisma studio
```

### 5.4 Uso del Cliente Prisma

```typescript
// services/products.service.ts
@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(options: QueryOptions) {
    // SELECT con filtros, paginación e includes
    return this.prisma.product.findMany({
      where: {
        active: true,
        stock: { gt: 0 },  // stock > 0
        name: { contains: options.search, mode: 'insensitive' },
      },
      include: {
        category: true,  // JOIN con categoría
      },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateProductDto) {
    // INSERT
    return this.prisma.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        salePrice: data.salePrice,
        stock: data.stock,
        category: {
          connect: { id: data.categoryId },  // Relación existente
        },
      },
    });
  }

  async update(id: string, data: UpdateProductDto) {
    // UPDATE
    return this.prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        stock: { increment: data.stockToAdd },  // stock = stock + X
      },
    });
  }

  async remove(id: string) {
    // DELETE (hard delete)
    return this.prisma.product.delete({
      where: { id },
    });
  }

  async transactionExample() {
    // TRANSACCIÓN (todo o nada)
    return this.prisma.$transaction(async (tx) => {
      // 1. Crear producto
      const product = await tx.product.create({ data: { ... } });
      
      // 2. Registrar movimiento
      await tx.inventoryMovement.create({
        data: { productId: product.id, ... },
      });
      
      // 3. Actualizar estadísticas
      await tx.statistics.update({ ... });
      
      return product;
    });
  }
}
```

---

## 6. APIS Y COMUNICACIÓN

### 6.1 REST API Endpoints

```
AUTENTICACIÓN
─────────────
POST   /auth/login           → Login con email/password
POST   /auth/register        → Registrar nuevo usuario
GET    /auth/profile         → Obtener perfil del usuario actual
PUT    /auth/profile         → Actualizar perfil
PUT    /auth/change-password → Cambiar contraseña

PRODUCTOS
─────────
GET    /products             → Listar productos (con filtros, paginación)
GET    /products/:id         → Obtener un producto
GET    /products/search      → Buscar productos (autocomplete)
POST   /products             → Crear producto
PUT    /products/:id         → Actualizar producto
DELETE /products/:id         → Eliminar producto
POST   /products/:id/image   → Subir imagen del producto

VENTAS
──────
GET    /sales                → Listar ventas
GET    /sales/:id            → Obtener venta
POST   /sales                → Crear venta
PUT    /sales/:id/status     → Cambiar estado (cancelar)
POST   /sales/:id/receipt    → Generar recibo PDF

CLIENTES
────────
GET    /customers            → Listar clientes
GET    /customers/:id        → Obtener cliente
POST   /customers            → Crear cliente
PUT    /customers/:id        → Actualizar cliente
DELETE /customers/:id        → Eliminar cliente

REPORTES
────────
GET    /reports/dashboard    → Estadísticas del dashboard
GET    /reports/sales-by-payment-method
GET    /reports/sales-by-category
GET    /reports/top-products
GET    /reports/customer-statistics

EXPORTACIONES
─────────────
POST   /exports/sales        → Exportar ventas (PDF/Excel/CSV)
POST   /exports/products     → Exportar productos
POST   /exports/customers    → Exportar clientes
POST   /exports/inventory    → Exportar inventario
```

### 6.2 Formato de Respuesta Estándar

```typescript
// Éxito
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Producto",
    ...
  },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Stock insuficiente para el producto",
    "statusCode": 409,
    "timestamp": "2024-01-30T10:00:00Z",
    "path": "/api/sales"
  }
}
```

### 6.3 Autenticación con JWT

```
1. Login
   POST /auth/login
   Body: { email: "user@example.com", password: "123456" }
   
   Response: { access_token: "eyJhbGciOiJIUzI1NiIs..." }

2. Usar token en peticiones
   Header: Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

3. El backend verifica el token
   - Decodifica el JWT
   - Verifica firma
   - Verifica expiración
   - Adjunza user al request

4. Si el token es inválido/expirado
   Response: 401 Unauthorized
```

---

## 7. COMPONENTES REUTILIZABLES

### 7.1 Sistema de Diseño (Design System)

El proyecto usa un sistema de diseño basado en **Tailwind CSS** con:

```css
/* Colores principales definidos en globals.css */
:root {
  --primary: 139 92 246;        /* Violeta */
  --terracotta: 224 122 95;     /* Terracota */
  --background: 255 255 255;    /* Blanco */
  --foreground: 15 23 42;       /* Slate 900 */
  /* ... más variables */
}
```

### 7.2 Componentes UI Disponibles

| Componente | Props principales | Uso |
|------------|------------------|-----|
| **Button** | `variant`, `size`, `loading`, `fullWidth` | Acciones del usuario |
| **Input** | `label`, `error`, `helperText`, `textarea` | Formularios |
| **Card** | `children`, `className` | Contenedores de contenido |
| **Modal** | `isOpen`, `onClose`, `title`, `size` | Diálogos y overlays |
| **Badge** | `variant` | Estados y etiquetas |
| **Select** | `options`, `value`, `onChange` | Dropdowns |
| **ConfirmDialog** | `isOpen`, `onConfirm`, `message` | Confirmaciones |
| **ImageUpload** | `value`, `onChange`, `onUpload` | Subida de imágenes |

### 7.3 Ejemplo de Uso Combinado

```tsx
// Página de creación de producto
export default function CreateProductPage() {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = () => {
    if (!name || !price) {
      setErrors({
        name: !name ? "Nombre requerido" : undefined,
        price: !price ? "Precio requerido" : undefined,
      });
      return;
    }
    setShowConfirm(true);
  };

  return (
    <DashboardLayout>
      <Card>
        <CardHeader>
          <h2>Nuevo Producto</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <Input
            label="Precio"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            error={errors.price}
          />
          <Button onClick={handleSubmit} fullWidth>
            Crear Producto
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          // Crear producto
          setShowConfirm(false);
        }}
        title="Confirmar creación"
        message={`¿Crear el producto "${name}" por $${price}?`}
      />
    </DashboardLayout>
  );
}
```

---

## 8. FLUJOS DE NEGOCIO

### 8.1 Flujo de Venta Completo

```
1. CLIENTE LLEGA AL POS
   ↓
2. CAJERO AGREGA PRODUCTOS AL CARRITO
   - Escanear código de barras
   - Buscar producto por nombre
   - Seleccionar de la lista
   ↓
3. SISTEMA VALIDA STOCK
   - Verifica que haya suficiente stock
   - Si no hay stock → Error
   ↓
4. CAJERO SELECCIONA CLIENTE (opcional)
   - Cliente general (por defecto)
   - Buscar cliente existente
   - Crear cliente nuevo
   ↓
5. SISTEMA CALCULA TOTALES
   - Subtotal: suma de items
   - Impuestos: 19% por defecto
   - Descuentos: si aplica
   - Total: subtotal + impuestos - descuentos
   ↓
6. CAJERO SELECCIONA MÉTODO DE PAGO
   - Efectivo
   - Tarjeta
   - Transferencia
   - Mixto (combinación)
   ↓
7. SI ES EFECTIVO: CAJERO INGRESA MONTO RECIBIDO
   - Sistema calcula cambio
   - Botón "Monto Exacto" para rapidez
   ↓
8. CAJERO CONFIRMA VENTA
   - Modal de confirmación muestra resumen
   - Click en "Confirmar Pago"
   ↓
9. SISTEMA PROCESA LA VENTA (Transacción)
   a) Crear registro de venta en DB
   b) Crear items de venta
   c) Crear pagos
   d) Actualizar stock de productos
   e) Registrar movimientos de inventario
   f) Generar número de recibo
   ↓
10. SISTEMA GENERA FACTURA PDF
    - Descargable
    - Imprimible
    ↓
11. VENTA COMPLETADA
    - Carrito se limpia
    - Se muestra confirmación
    - Listo para siguiente venta
```

### 8.2 Flujo de Gestión de Inventario

```
1. PRODUCTO NUEVO
   ↓
2. ADMIN/INVENTARIO CREA PRODUCTO
   - Nombre, SKU, código de barras
   - Precio de costo y venta
   - Stock inicial
   - Categoría
   - Imagen (opcional)
   ↓
3. SISTEMA VALIDA
   - SKU único
   - Código de barras único (si aplica)
   - Precio de venta > costo
   ↓
4. PRODUCTO CREADO
   - Disponible para ventas
   - Aparece en inventario
   ↓
5. ACTUALIZACIONES DE STOCK
   a) Venta automática: stock disminuye
   b) Compra/Reabastecimiento: stock aumenta
   c) Ajuste manual: por daños, pérdidas
   d) Devolución: stock aumenta
   ↓
6. ALERTAS DE STOCK BAJO
   - Sistema monitorea stock <= minStock
   - Muestra alertas en dashboard
   - Lista de productos a reabastecer
   ↓
7. REPORTES DE INVENTARIO
   - Valor total del inventario
   - Productos más vendidos
   - Rotación de inventario
   - Pérdidas y ajustes
```

---

## 9. PATRONES Y BUENAS PRÁCTICAS

### 9.1 Patrones Implementados

#### ✅ Dependency Injection (Inyección de Dependencias)
```typescript
// NestJS maneja las dependencias automáticamente
@Injectable()
class Service {
  constructor(
    private repo: Repository,  // Inyectado
    private cache: Cache,      // Inyectado
  ) {}
}
```

#### ✅ Repository Pattern (Patrón Repositorio)
```typescript
// Prisma actúa como repositorio
this.prisma.product.findMany()  // Abstracción de queries SQL
```

#### ✅ DTO Pattern (Data Transfer Object)
```typescript
// Define contratos de entrada/salida
class CreateProductDto {
  name: string;
  price: number;
}
```

#### ✅ Custom Hooks (React)
```typescript
// Encapsulan lógica reutilizable
const { data, isLoading } = useProducts();
```

#### ✅ Context API (Estado Global)
```typescript
// AuthContext comparte estado de autenticación
const { user, login } = useAuth();
```

### 9.2 Principios SOLID Aplicados

| Principio | Aplicación |
|-----------|-----------|
| **S**ingle Responsibility | Cada servicio hace una cosa (AuthService, ProductsService) |
| **O**pen/Closed | Extensible mediante decoradores e interceptores |
| **L**iskov Substitution | Interfaces de repositorio permiten cambiar implementación |
| **I**nterface Segregation | DTOs específicos para cada operación |
| **D**ependency Inversion | Dependencias inyectadas, no creadas directamente |

### 9.3 Seguridad Implementada

```
✅ Autenticación JWT
✅ Autorización basada en roles (RBAC)
✅ Rate limiting (100 req/min)
✅ CORS habilitado
✅ Validación de inputs (class-validator)
✅ SQL Injection protection (Prisma ORM)
✅ XSS protection (React escaping)
✅ HTTPS en producción
```

### 9.4 Performance Optimizations

```
✅ TanStack Query caching
✅ React.memo en componentes pesados
✅ useCallback/useMemo donde aplica
✅ Paginación en listas grandes
✅ Lazy loading de imágenes
✅ Responsive design (mobile-first)
```

---

## 10. GLOSARIO DE TÉRMINOS

| Término | Significado |
|---------|-------------|
| **API** | Application Programming Interface - Interfaz para comunicación entre sistemas |
| **CRUD** | Create, Read, Update, Delete - Operaciones básicas de datos |
| **DTO** | Data Transfer Object - Objeto para transferir datos entre capas |
| **Hook** | Función especial de React para usar estado y efectos |
| **JWT** | JSON Web Token - Token firmado para autenticación |
| **Middleware** | Función que se ejecuta entre request y response |
| **ORM** | Object-Relational Mapping - Mapeo objeto-relacional |
| **POS** | Point of Sale - Punto de venta |
| **Query** | Consulta a base de datos |
| **REST** | Representational State Transfer - Estilo arquitectónico para APIs |
| **SKU** | Stock Keeping Unit - Código único de producto |
| **SSR** | Server-Side Rendering - Renderizado en servidor |
| **Transaction** | Operación atómica (todo o nada) |

---

## 📚 RECURSOS ADICIONALES

### Documentación Oficial
- [NestJS](https://docs.nestjs.com/)
- [Next.js](https://nextjs.org/docs)
- [React](https://react.dev/)
- [Prisma](https://www.prisma.io/docs)
- [TanStack Query](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Comandos Útiles

```bash
# Backend
npm run start:dev      # Iniciar en modo desarrollo
npm run build          # Compilar para producción
npm run test           # Ejecutar tests
npx prisma migrate dev # Crear migración
npx prisma studio      # UI de base de datos

# Frontend
npm run dev            # Iniciar servidor de desarrollo
npm run build          # Compilar para producción
npm run lint           # Verificar linting
npm run test           # Ejecutar tests
```

---

**Documentación creada por:** Tu Asistente AI  
**Fecha:** Enero 2026  
**Versión:** 1.0  
**Para:** MeperPOS y Punto de Venta
