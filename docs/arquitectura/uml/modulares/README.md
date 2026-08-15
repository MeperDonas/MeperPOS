# 📚 Índice de Diagramas UML

MeperPOS y Punto de Venta

---

## 📂 Estructura de Diagramas

Los diagramas están organizados en tres categorías principales:

```
docs/diagramas-uml/
├── casos-de-uso/          # Diagramas de casos de uso por módulo
├── componentes/           # Diagramas de componentes del backend
└── secuencias/           # Diagramas de secuencia de flujos principales
```

---

## 🎯 Diagramas de Casos de Uso

**Ubicación:** `docs/diagramas-uml/casos-de-uso/`

| Archivo | Módulo | Descripción |
|---------|--------|-------------|
| [modulo-auth.md](./casos-de-uso/modulo-auth.md) | Autenticación | Login, registro, recuperación de contraseña |
| [modulo-productos.md](./casos-de-uso/modulo-productos.md) | Productos | CRUD de productos, gestión de stock |
| [modulo-categorias.md](./casos-de-uso/modulo-categorias.md) | Categorías | Organización de productos |
| [modulo-clientes.md](./casos-de-uso/modulo-clientes.md) | Clientes | Gestión de clientes y fidelización |
| [modulo-ventas.md](./casos-de-uso/modulo-ventas.md) | Ventas/POS | Procesamiento de ventas y pagos |
| [modulo-reportes.md](./casos-de-uso/modulo-reportes.md) | Reportes | Estadísticas y análisis |
| [modulo-configuracion.md](./casos-de-uso/modulo-configuracion.md) | Configuración | Ajustes del sistema |

**Documentación:** [README.md](./casos-de-uso/README.md)

### Actores del Sistema
- **👤 Administrador**: Acceso total (CRUD en todos los módulos)
- **💼 Cajero**: Procesamiento de ventas y atención al cliente
- **📦 Usuario de Inventario**: Gestión de productos y stock

---

## 🏗️ Diagramas de Componentes

**Ubicación:** `docs/diagramas-uml/componentes/`

| Archivo | Módulo | Descripción |
|---------|--------|-------------|
| [modulo-auth.md](./componentes/modulo-auth.md) | Autenticación | JWT, Guards, Estrategias |
| [modulo-productos.md](./componentes/modulo-productos.md) | Productos | Controllers, Services, Cloudinary |
| [modulo-categorias.md](./componentes/modulo-categorias.md) | Categorías | Gestión de categorías |
| [modulo-clientes.md](./componentes/modulo-clientes.md) | Clientes | CRUD de clientes |
| [modulo-ventas.md](./componentes/modulo-ventas.md) | Ventas/POS | Transacciones ACID, Auditoría |
| [modulo-reportes.md](./componentes/modulo-reportes.md) | Reportes | Agregaciones y estadísticas |
| [modulo-exportaciones.md](./componentes/modulo-exportaciones.md) | Exportaciones | PDF, Excel, CSV |
| [modulo-configuracion.md](./componentes/modulo-configuracion.md) | Configuración | Settings y usuarios |

**Documentación:** [README.md](./componentes/README.md)

### Arquitectura Backend (NestJS)
```
Módulos
├── Controllers (API REST)
├── Services (Lógica de negocio)
├── DTOs (Validación de datos)
├── Guards (Seguridad)
└── Interceptors (Auditoría)
```

---

## 🔄 Diagramas de Secuencia

**Ubicación:** `docs/diagramas-uml/secuencias/`

| Archivo | Flujo | Descripción |
|---------|-------|-------------|
| [flujo-venta.md](./secuencias/flujo-venta.md) | Venta POS | Proceso completo de venta con transacción ACID |
| [flujo-autenticacion.md](./secuencias/flujo-autenticacion.md) | Autenticación | Login, JWT, roles y permisos |
| [flujo-gestion-productos.md](./secuencias/flujo-gestion-productos.md) | Productos | CRUD y gestión de imágenes |
| [flujo-reporte-ventas.md](./secuencias/flujo-reporte-ventas.md) | Reportes | Dashboard y exportaciones |
| [flujo-gestion-usuarios.md](./secuencias/flujo-gestion-usuarios.md) | Usuarios | Gestión de usuarios y roles |

**Documentación:** [README.md](./secuencias/README.md)

---

## 🚀 Cómo Usar los Diagramas

### Visualización Online

#### Opción 1: PlantUML Server
1. Visita [www.plantuml.com/plantuml](http://www.plantuml.com/plantuml)
2. Copia el contenido del archivo `.md`
3. Pega en el editor
4. El diagrama se genera automáticamente

#### Opción 2: PlantText
1. Visita [www.planttext.com](https://www.planttext.com/)
2. Pega el código PlantUML
3. Descarga como PNG, SVG o PDF

### Visualización Local

#### VS Code
1. Instala la extensión **"PlantUML"** (jebbs)
2. Abre cualquier archivo `.md`
3. Presiona `Alt+D` (Windows/Linux) o `Option+D` (Mac)
4. La vista previa se muestra en tiempo real

#### Intellij IDEA / WebStorm
1. Instala el plugin **"PlantUML integration"**
2. Abre el archivo `.md`
3. El diagrama se renderiza automáticamente

### Exportar Imágenes

Desde VS Code con PlantUML:
```bash
# Exportar a PNG
F1 → PlantUML: Export Current File Diagrams → png

# Exportar a SVG
F1 → PlantUML: Export Current File Diagrams → svg

# Exportar a PDF
F1 → PlantUML: Export Current File Diagrams → pdf
```

---

## 🎨 Convenciones UML Utilizadas

### Casos de Uso
- **Actores**: Representan usuarios del sistema
- **Caso de Uso**: Funcionalidad del sistema (óvalo)
- **Asociación**: Relación actor-caso de uso
- **<<include>>**: Relación obligatoria
- **<<extend>>**: Relación opcional

### Componentes
- **Rectángulos**: Componentes del sistema
- **Interfaces**: Puntos de conexión (círculos)
- **Dependencias**: Flechas entre componentes
- **Base de datos**: Cilindros

### Secuencias
- **Líneas de vida**: Participantes en el tiempo
- **Mensajes**: Llamadas entre participantes
- **Activaciones**: Período de procesamiento
- **Fragmentos**: Alt, opt, loop, par

---

## 📊 Módulos del Sistema

### Backend (NestJS)
```
src/
├── auth/              # Autenticación JWT
├── products/          # Gestión de productos
├── categories/        # Categorías
├── customers/         # Clientes
├── sales/            # Ventas y POS
├── reports/          # Reportes
├── exports/          # Exportaciones
├── settings/         # Configuración
├── cloudinary/       # Almacenamiento de imágenes
└── common/           # Guards, Interceptors, Decorators
```

### Frontend (Next.js)
```
src/
├── app/              # Páginas (App Router)
├── components/       # Componentes React
├── hooks/           # Custom hooks
├── contexts/        # React Contexts
├── lib/             # Utilidades
└── types/           # Tipos TypeScript
```

---

## 🔗 Relaciones entre Diagramas

```
Casos de Uso          Componentes           Secuencias
     │                      │                      │
     ├─ Autenticación ─────├─ AuthModule ────────├─ Login
     │                      │                      │
     ├─ Productos ─────────├─ ProductsModule ────├─ Gestión Productos
     │                      │                      │
     ├─ Ventas ────────────├─ SalesModule ───────├─ Procesar Venta
     │                      │                      │
     ├─ Reportes ──────────├─ ReportsModule ─────├─ Generar Reportes
     │                      │                      │
     └─ Configuración ─────├─ SettingsModule ────├─ Gestión Usuarios
```

---

## 📝 Glosario

| Término | Descripción |
|---------|-------------|
| **ACID** | Atomicity, Consistency, Isolation, Durability |
| **CRUD** | Create, Read, Update, Delete |
| **DTO** | Data Transfer Object |
| **JWT** | JSON Web Token |
| **ORM** | Object-Relational Mapping (Prisma) |
| **POS** | Point of Sale (Punto de Venta) |
| **REST** | Representational State Transfer |
| **UML** | Unified Modeling Language |

---

## 📞 Soporte

Para más información sobre el proyecto, consulta:
- [Guía Maestra del Proyecto](../../guia-maestra-proyecto.md)
- [Diagrama de Casos de Uso General](../generales/diagrama-casos-de-uso.md)
- [Diagrama de Componentes General](../generales/diagrama-de-componentes.md)

---

*Documentación generada para el proyecto de MeperPOS y Punto de Venta*

**Versión:** 1.0  
**Fecha:** 2026-02-05  
**Tecnologías:** PlantUML, NestJS, Next.js, PostgreSQL
