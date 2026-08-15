# 🔄 Diagramas de Secuencia

Esta carpeta contiene los diagramas de secuencia que ilustran los flujos principales del MeperPOS y Punto de Venta.

## 📁 Estructura de Archivos

### Flujos Principales

1. **flujo-venta.puml** - Proceso Completo de Venta (POS)
   - Búsqueda de productos
   - Gestión del carrito
   - Procesamiento de pagos
   - Transacción ACID
   - Generación de recibo

2. **flujo-autenticacion.puml** - Autenticación y Autorización
   - Login con JWT
   - Verificación de tokens
   - Control de acceso por roles
   - Logout

3. **flujo-gestion-productos.puml** - Gestión de Productos
   - Creación de productos
   - Subida de imágenes
   - Actualización de stock
   - Eliminación lógica

4. **flujo-reporte-ventas.puml** - Generación de Reportes
   - Dashboard en tiempo real
   - Reportes de ventas
   - Exportación a Excel/PDF
   - Comparación de períodos

5. **flujo-gestion-usuarios.puml** - Gestión de Usuarios y Permisos
   - Creación de usuarios
   - Asignación de roles
   - Activación/desactivación
   - Cambio de contraseña

## 🎨 Convenciones de Secuencia

### Participantes
| Tipo | Color | Descripción |
|------|-------|-------------|
| Actor | #F5F5F5 | Usuario del sistema |
| Frontend | #E3F2FD | Next.js / React |
| Controller | #E8F5E9 | NestJS Controllers |
| Service | #FFF3E0 | NestJS Services |
| Database | #BBDEFB | PostgreSQL |
| External | #FFE0B2 | Servicios externos |

### Mensajes
- **Flecha sólida (`->`)**: Llamada síncrona
- **Flecha punteada (`-->`)**: Retorno/Respuesta
- **Línea activa**: El participante está procesando

### Estructuras de Control
- **alt/else**: Condicionales alternativas
- **opt**: Opcional (puede o no ocurrir)
- **loop**: Iteración
- **par**: Procesamiento paralelo
- **activate/deactivate**: Inicio/fin de procesamiento

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

## 📋 Descripción de Flujos

### 1. Flujo de Venta (POS)

**Participantes:**
- Cajero (Actor)
- Frontend (Next.js)
- SalesController (NestJS)
- SalesService (NestJS)
- PrismaService (ORM)
- PostgreSQL (Base de datos)
- Cloudinary (Generación de recibos)

**Fases:**
1. **Iniciar Venta**: El cajero inicia una nueva transacción
2. **Buscar Productos**: Búsqueda en tiempo real con filtros
3. **Agregar al Carrito**: Validación de stock local
4. **Seleccionar Cliente**: Asignación opcional de cliente
5. **Aplicar Descuento**: Cálculo de totales
6. **Pausar/Reanudar**: Persistencia en localStorage
7. **Procesar Pago**: Múltiples métodos de pago
8. **Confirmar Venta**: Transacción ACID completa
   - Validar stock de cada producto
   - Calcular subtotal, impuestos (19% IVA), total
   - Crear registro de venta
   - Actualizar stock de productos
   - Registrar movimientos de inventario
   - Guardar métodos de pago
9. **Generar Recibo**: PDF en Cloudinary
10. **Cancelación**: Rollback completo (solo Admin)

**Características Clave:**
- Transacción atómica (todo o nada)
- Concurrencia optimista (campo version)
- Validación de stock antes de procesar
- Auditoría automática de movimientos

---

### 2. Flujo de Autenticación

**Participantes:**
- Usuario (Actor)
- Frontend (Next.js)
- AuthController (NestJS)
- AuthService (NestJS)
- PrismaService (ORM)
- PostgreSQL (Base de datos)
- JWTService (Generación de tokens)

**Fases:**
1. **Login**: Validación de credenciales
   - Buscar usuario por email
   - Verificar contraseña con bcrypt
   - Generar JWT token
   - Almacenar en localStorage
2. **Obtener Perfil**: Datos del usuario autenticado
3. **Acceso a Recursos**: Verificación de token en cada request
4. **Verificación de Roles**: Control de acceso por rol
5. **Logout**: Limpieza de localStorage

**Características Clave:**
- Tokens JWT con expiración (24 horas)
- Password hashing con bcrypt
- Guards para protección de rutas
- Roles: ADMIN, CASHIER, INVENTORY_USER

---

### 3. Flujo de Gestión de Productos

**Participantes:**
- Usuario de Inventario (Actor)
- Frontend (Next.js)
- ProductsController (NestJS)
- ProductsService (NestJS)
- CloudinaryService (Almacenamiento)
- PrismaService (ORM)
- PostgreSQL (Base de datos)

**Fases:**
1. **Crear Producto**: Validación de SKU único
2. **Subir Imagen**: Optimización en Cloudinary
3. **Consultar Productos**: Filtros y paginación
4. **Actualizar Stock**: Movimientos de inventario
5. **Eliminar Producto**: Eliminación lógica (soft delete)

**Características Clave:**
- Validación de SKU único
- Optimización de imágenes
- Cache de consultas frecuentes
- Auditoría de movimientos

---

### 4. Flujo de Reportes

**Participantes:**
- Administrador (Actor)
- Frontend (Next.js)
- ReportsController (NestJS)
- ReportsService (NestJS)
- CacheService (Redis)
- PrismaService (ORM)
- PostgreSQL (Base de datos)

**Fases:**
1. **Dashboard**: Estadísticas en tiempo real
   - Cache de 5 minutos
   - Ventas del día
   - Productos más vendidos
   - Alertas de stock bajo
2. **Reporte de Ventas**: Agregaciones por período
3. **Exportar a Excel**: Generación de archivos
4. **Reporte de Inventario**: Estado del stock
5. **Comparación de Períodos**: Análisis temporal

**Características Clave:**
- Cache de reportes para mejorar performance
- Agregaciones SQL eficientes
- Múltiples formatos de exportación
- Procesamiento paralelo para comparaciones

---

### 5. Flujo de Gestión de Usuarios

**Participantes:**
- Administrador (Actor)
- Frontend (Next.js)
- AuthController (NestJS)
- SettingsController (NestJS)
- AuthService (NestJS)
- SettingsService (NestJS)
- PrismaService (ORM)
- PostgreSQL (Base de datos)

**Fases:**
1. **Crear Usuario**: Validación de email único
2. **Asignar Rol**: Cambio de permisos
3. **Activar/Desactivar**: Control de acceso
4. **Listar Usuarios**: Filtros por rol y estado
5. **Editar Perfil**: Actualización de datos
6. **Cambiar Contraseña**: Verificación de contraseña actual

**Características Clave:**
- Email único por usuario
- Roles predefinidos
- Activación/desactivación de usuarios
- Seguridad en cambio de contraseña

## 🔑 Patrones Comunes en Secuencias

### 1. Validación de Entrada
```
Frontend -> Frontend: Validar datos
alt Datos válidos
    Frontend -> Controller: Enviar request
else Datos inválidos
    Frontend --> Usuario: Mostrar errores
end
```

### 2. Transacción ACID
```
Service -> Prisma: $transaction.begin()
loop Operaciones
    Service -> Prisma: Operación 1
    Service -> Prisma: Operación 2
end
alt Éxito
    Service -> Prisma: $transaction.commit()
else Error
    Service -> Prisma: $transaction.rollback()
end
```

### 3. Cache Strategy
```
Service -> Cache: get(key)
alt Cache hit
    Cache --> Service: Datos cacheados
else Cache miss
    Service -> Database: Consultar
    Database --> Service: Datos
    Service -> Cache: set(key, data)
end
```

### 4. Autorización
```
Controller -> JWT: verify(token)
alt Token inválido
    JWT --> Controller: Error
    Controller --> Frontend: 401 Unauthorized
else Token válido
    Controller -> Controller: Verificar rol
    alt Rol no autorizado
        Controller --> Frontend: 403 Forbidden
    else Rol autorizado
        Controller -> Service: Procesar
    end
end
```

## 📊 Métricas de Performance

| Operación | Tiempo Esperado | Estrategia |
|-----------|----------------|------------|
| Login | < 200ms | bcrypt + JWT |
| Búsqueda de productos | < 100ms | Índices + Cache |
| Crear venta | < 500ms | Transacción ACID |
| Generar reporte | < 1s | Agregaciones SQL |
| Exportar Excel | < 2s | Streaming |

---

*Documentación generada para el proyecto de MeperPOS y Punto de Venta*
