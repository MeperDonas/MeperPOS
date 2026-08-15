# 🎓 Guía de Presentación - Diagramas de Secuencia

## MeperPOS y Punto de Venta

---

## 📋 ÍNDICE

1. [Introducción a los Diagramas de Secuencia](#1-introducción)
2. [Cómo Explicar Cada Flujo](#2-explicación-por-flujo)
3. [Patrones Clave a Destacar](#3-patrones-importantes)
4. [Preguntas del Jurado y Respuestas](#4-preguntas-frecuentes)
5. [Tips para la Presentación](#5-tips-de-presentación)

---

## 1. INTRODUCCIÓN

### ¿Qué son los Diagramas de Secuencia?

> **"Los diagramas de secuencia muestran CÓMO ocurren las cosas en el tiempo. Nos revelan la interacción paso a paso entre actores, sistemas y bases de datos durante una operación específica."**

### Analogía Perfecta

> "Imaginen una receta de cocina. Los casos de uso nos dicen qué plato preparamos. Los diagramas de secuencia son la receta paso a paso: primero calentar el aceite, luego agregar cebolla, después..."

### Elementos UML Utilizados

| Elemento | Símbolo | Significado |
|----------|---------|-------------|
| **Actor** | 👤 Figura | Usuario o sistema externo |
| **Participante** | 🟦 Rectángulo | Componente del sistema |
| **Línea de vida** | ⬇️ Línea punteada | Tiempo de existencia |
| **Mensaje** | ➡️ Flecha | Llamada entre componentes |
| **Activación** | 🟨 Rectángulo delgado | Período de procesamiento |
| **Fragmento** | ⬜ Caja | Alt, Opt, Loop, Par |

---

## 2. EXPLICACIÓN POR FLUJO

### 💰 FLUJO 1: PROCESO DE VENTA (POS)

**Archivo:** `flujo-venta.puml`

**Tiempo de presentación:** 4-5 minutos

#### ¿Cómo Explicarlo?

**APERTURA IMPACTANTE (30 segundos)**
> "Este es el flujo más crítico del sistema. Aquí procesamos dinero real, así que no puede fallar. Vamos a ver cómo garantizamos que cada venta sea atómica, consistente y auditada."

**FASE 1: INICIAR Y BUSCAR (45 segundos)**

**Participantes:**
- Cajero (Actor humano)
- Frontend (Next.js)
- SalesController (API REST)
- SalesService (Lógica de negocio)
- Prisma (ORM)
- PostgreSQL (Base de datos)
- Cloudinary (Generación de recibos)

**Explicación paso a paso:**

**Paso 1-2: Iniciar y Buscar**
> "El cajero inicia la venta. Cuando busca un producto, hacemos una consulta optimizada con índices. El resultado llega en menos de 100ms."

**Destacar:**
> "Noten la flecha doble al final (DB --> Prisma). Las respuestas usan líneas punteadas en UML para diferenciarlas de las peticiones."

**FASE 2: AGREGAR AL CARRITO (45 segundos)**

**Paso 3: Validación de Stock**
> "Antes de agregar al carrito, validamos stock localmente en el frontend. Esto da feedback inmediato al cajero."

**Pregunta al jurado:**
> "¿Por qué validamos en el frontend si luego validamos en el backend? Respuesta: experiencia de usuario. El cajero sabe inmediatamente si hay stock, sin esperar al servidor."

**FASE 3: CLIENTE Y DESCUENTOS (30 segundos)**

> "Estas son operaciones opcionales. El sistema permite ventas anónimas o asignar un cliente frecuente."

**FASE 4: PAUSAR Y REANUDAR (1 minuto)**

**Esta es TU VENTAJA COMPETITIVA:**

> "Aquí hay algo interesante: el bloque 'opt' (opcional). En una tienda física, el cajero puede tener varias ventas en progreso. Si llega un cliente urgente, pausa la venta actual, la guardamos en localStorage del navegador, atiende al nuevo cliente, y luego reanuda donde estaba."

**Explicar localStorage:**
> "localStorage es una base de datos del navegador. Persiste incluso si cierran la pestaña. Esto permite que el cajero cierre el sistema y al volver, sus ventas pausadas siguen ahí."

**FASE 5: PROCESAR PAGO (30 segundos)**

> "Cálculo de cambio en tiempo real. Soportamos múltiples métodos de pago simultáneos: parte en efectivo, parte con tarjeta."

**FASE 6: LA TRANSACCIÓN (2 minutos) ⭐ MÁS IMPORTANTE**

**Este es el corazón del diagrama:**

```
Cajero confirma venta
    ↓
SalesService inicia transacción
    ↓
PARA CADA PRODUCTO:
    ├─ Buscar producto
    ├─ Validar stock suficiente
    ├─ Actualizar stock (stock - cantidad)
    └─ Registrar movimiento de inventario
    ↓
Calcular totales (subtotal, IVA 19%, total)
    ↓
Crear registro de venta
    ↓
Crear items de venta
    ↓
Guardar métodos de pago
    ↓
COMMIT: Todo se persiste
    ↓
Generar recibo PDF en Cloudinary
    ↓
Cajero recibe confirmación
```

**Explicar la magia:**
> "Todo esto ocurre dentro de prisma.$transaction(). Si en el producto 8 de 10 falla algo, automáticamente se hace ROLLBACK. El stock no se modificó, no hay venta incompleta, el sistema queda consistente."

**Escenario de crisis:**
> "Imaginen: se corta la luz justo después de actualizar el stock del producto 5. ¿Qué pasa? Al restaurar el sistema, no existe la venta, el stock está intacto. La transacción ACID nos salvó."

**FASE 7: CANCELACIÓN (1 minuto)**

**Bloque ALT (alternativa):**

> "El bloque 'alt' muestra dos caminos alternativos. Aquí vemos la cancelación: solo el administrador puede hacerlo, y esto genera un rollback completo del inventario."

**Flujo de cancelación:**
> "1. Cambiar estado de venta a CANCELLED
> 2. Por cada producto: devolver stock al inventario
> 3. Registrar movimiento de cancelación
> 4. Todo en la misma transacción"

#### Puntos Clave a Destacar
- ✅ **Validación doble**: Frontend (rápida) + Backend (segura)
- ✅ **Persistencia local**: Ventas pausadas en localStorage
- ✅ **Transacción ACID**: Todo o nada, nunca inconsistente
- ✅ **Auditoría**: Cada movimiento queda registrado
- ✅ **Rollback**: Cancelaciones restauran todo el estado

---

### 🔐 FLUJO 2: AUTENTICACIÓN

**Archivo:** `flujo-autenticacion.puml`

**Tiempo de presentación:** 3-4 minutos

#### ¿Cómo Explicarlo?

**APERTURA (20 segundos)**
> "La seguridad es el fundamento de todo sistema. Si la autenticación falla, nada más importa."

**FASE 1: LOGIN (2 minutos)**

**Paso a paso detallado:**

```
Usuario ingresa email + contraseña
    ↓
Frontend valida formato (email válido, password no vacío)
    ↓
POST /auth/login → AuthController
    ↓
AuthService.login()
    ↓
Prisma busca usuario por email
    ↓
PostgreSQL retorna usuario (o null)
    ↓
[ALT] Si usuario no existe:
    └─ 401 Unauthorized → "Credenciales inválidas"
    
[ELSE] Usuario encontrado:
    ├─ bcrypt.compare(password, hash_almacenado)
    ├─ [ALT] Contraseña incorrecta:
    │   └─ 401 Unauthorized
    └─ [ELSE] Contraseña correcta:
        ├─ JWT.sign(payload, secreto, expira_en_24h)
        ├─ Retornar access_token
        └─ 200 OK + Token
```

**Explicar bcrypt (crítico):**

> "bcrypt no solo encripta, añade un 'salt' aleatorio único por usuario. Esto significa que dos usuarios con la misma contraseña tienen hashes completamente diferentes. Incluso si un hacker roba la base de datos, no puede usar tablas rainbow."

**FASE 2: OBTENER PERFIL (45 segundos)**

> "Una vez logueado, el frontend obtiene el perfil completo del usuario. Guardamos token y datos en localStorage para persistencia entre sesiones."

**FASE 3: ACCESO A RECURSOS (1 minuto)**

**Protección JWT:**

```
Frontend solicita recurso protegido
    ↓
Header: Authorization: Bearer {token}
    ↓
JwtAuthGuard intercepta la petición
    ↓
JWT.verify(token, secreto)
    ↓
[ALT] Token inválido/expirado:
    ├─ 401 Unauthorized
    ├─ Frontend limpia localStorage
    └─ Redirige a login
    
[ELSE] Token válido:
    └─ Permitir acceso al recurso
```

**Destacar:**
> "El token tiene expiración de 24 horas. Esto balancea seguridad (no son tokens eternos) con usabilidad (no pedimos login cada 5 minutos)."

**FASE 4: VERIFICACIÓN DE ROLES (45 segundos)**

**Control de acceso:**

```
Usuario intenta eliminar producto
    ↓
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
    ↓
JWT verifica autenticación
    ↓
RolesGuard verifica rol del usuario
    ↓
[ALT] Rol = CASHIER:
    └─ 403 Forbidden
    
[ELSE] Rol = ADMIN:
    └─ Permitir operación
```

**Explicar:**
> "Tenemos dos guards: primero verificamos QUE es un usuario válido (JWT), luego verificamos QUÉ puede hacer (Roles). Esto es defensa en profundidad."

**FASE 5: LOGOUT (20 segundos)**

> "Simple pero efectivo: limpiamos localStorage. El token sigue existiendo pero ya no está en el cliente. Expirará en 24 horas naturalmente."

#### Puntos Clave a Destacar
- ✅ **bcrypt**: Hashing seguro con salt aleatorio
- ✅ **JWT**: Tokens stateless firmados digitalmente
- ✅ **Doble validación**: Autenticación + Autorización
- ✅ **Expiración**: Balance seguridad/usabilidad
- ✅ **Graceful degradation**: Limpieza limpia al fallar

---

### 📦 FLUJO 3: GESTIÓN DE PRODUCTOS

**Archivo:** `flujo-gestion-productos.puml`

**Tiempo de presentación:** 3 minutos

#### ¿Cómo Explicarlo?

**APERTURA (20 segundos)**> "Este flujo muestra cómo mantenemos la integridad del catálogo de productos."

**FASE 1: CREAR PRODUCTO (1 minuto)**

```
Usuario ingresa datos del producto
    ↓
Frontend valida campos (nombre, precio > 0, etc.)
    ↓
POST /products → ProductsController
    ↓
ProductsService.create()
    ↓
Validar SKU único:
    ├─ SELECT * FROM products WHERE sku = ?
    ├─ [ALT] SKU existe: 409 Conflict
    └─ [ELSE] SKU disponible: continuar
    ↓
INSERT INTO products
    ↓
Registrar movimiento de creación
    ↓
201 Created + Producto creado
```

**Destacar validación de SKU:**
> "El SKU (Stock Keeping Unit) debe ser único. Antes de crear, verificamos en base de datos. Si existe, rechazamos con 409 Conflict. Esto previene duplicados desde el origen."

**FASE 2: SUBIR IMAGEN (1 minuto)**

**Proceso multimedia:**

```
Usuario selecciona imagen
    ↓
Frontend previsualiza
    ↓
POST /products/{id}/image
    ↓
CloudinaryService.upload()
    ↓
Cloudinary:
    ├─ Recibe imagen
    ├─ Comprime automáticamente
    ├─ Genera múltiples tamaños (thumbnail, full)
    └─ Retorna URL segura
    ↓
UPDATE products SET imageUrl = ?
    ↓
200 OK + URL de imagen
```

**Explicar la magia de Cloudinary:**
> "Subimos una foto de 5MB tomada con el celular. Cloudinary la comprime a 200KB sin pérdida visible, genera versiones thumbnail para listados y full para detalle, y nos da URLs con CDN global para carga rápida."

**FASE 3: ACTUALIZAR STOCK (45 segundos)**

```
Usuario ajusta cantidad de stock
    ↓
PUT /products/{id}
    ↓
Obtener stock actual
    ↓
Calcular diferencia
    ↓
UPDATE products SET stock = nuevo_stock
    ↓
INSERT INTO inventory_movements:
    - type: 'ADJUSTMENT_IN' o 'ADJUSTMENT_OUT'
    - quantity: diferencia
    - previousStock: anterior
    - newStock: actual
    ↓
200 OK
```

**Auditoría completa:**
> "No solo cambiamos un número. Registramos QUIÉN hizo el cambio, CUÁNDO, CUÁNTO tenía antes y CUÁNTO quedó. Esto permite trazabilidad completa."

#### Puntos Clave a Destacar
- ✅ **Validación temprana**: SKU único desde creación
- ✅ **Optimización**: Imágenes comprimidas automáticamente
- ✅ **Auditoría**: Cada cambio de stock registrado
- ✅ **Soft delete**: Eliminación lógica, no física

---

### 📊 FLUJO 4: GENERACIÓN DE REPORTES

**Archivo:** `flujo-reporte-ventas.puml`

**Tiempo de presentación:** 3 minutos

#### ¿Cómo Explicarlo?

**APERTURA (20 segundos)**
> "Los datos sin análisis son solo números. Este flujo muestra cómo transformamos datos en decisiones de negocio."

**FASE 1: DASHBOARD (1 minuto)**

**Estrategia de caché:**

```
Admin carga dashboard
    ↓
GET /reports/dashboard
    ↓
CacheService.get('dashboard:stats')
    ↓
[OPT] Datos en caché (menos de 5 minutos):
    └─ Retornar inmediatamente (5ms)
    
[ELSE] Cache expirado o miss:
    ├─ Consultar múltiples agregaciones:
    │   ├─ Ventas del día (SUM)
    │   ├─ Productos más vendidos (COUNT)
    │   ├─ Alertas de stock bajo (WHERE stock < min)
    │   └─ Clientes nuevos (COUNT)
    ├─ Guardar en caché (TTL: 5 minutos)
    └─ Retornar datos
```

**Explicar el trade-off:**
> "El dashboard cambia cada 5 minutos. Si lo recalculamos cada vez, con 50 usuarios estaríamos sobrecargando PostgreSQL innecesariamente. Con caché, la primera consulta tarda 500ms, las siguientes 5ms durante 5 minutos."

**FASE 2: REPORTE DE VENTAS (45 segundos)**

```
Admin selecciona rango de fechas
    ↓
GET /reports/sales?start=...&end=...
    ↓
Consulta compleja con JOINs:
    - sales
    - sale_items
    - products
    - customers
    - users
    - payments
    ↓
Procesar resultados:
    - Agregar por día
    - Calcular totales
    - Agrupar por método de pago
    ↓
200 OK + Reporte detallado
```

**FASE 3: EXPORTAR A EXCEL (1 minuto)**

```
Admin solicita exportación Excel
    ↓
GET /exports/sales?format=excel
    ↓
Consultar datos (mismos filtros)
    ↓
ExcelGenerator:
    ├─ Crear workbook
    ├─ Agregar worksheet "Ventas"
    ├─ Insertar datos fila por fila
    ├─ Aplicar estilos (encabezados, moneda, fechas)
    ├─ Congelar primera fila
    └─ Generar buffer
    ↓
200 OK + File (application/vnd.openxmlformats)
    ↓
Frontend crea blob y descarga
```

**Destacar experiencia de usuario:**
> "No solo exportamos datos crudos. El Excel tiene encabezados formateados, columnas de moneda con símbolo $, fechas en formato legible, y la primera fila congelada para que al hacer scroll siempre vean los títulos."

**FASE 4: COMPARACIÓN DE PERÍODOS (45 segundos)**

**Procesamiento paralelo:**

```
Admin solicita comparación
    ↓
GET /reports/comparison?p1=...&p2=...
    ↓
[PAR] Consultar período 1
    └─ Agregaciones SQL
    
[PAR] Consultar período 2
    └─ Agregaciones SQL
    
(Ejecutan simultáneamente)
    ↓
Calcular diferencias:
    - Variación porcentual
    - Tendencia (subió/bajó)
    - Factores de crecimiento
    ↓
200 OK + Comparación completa
```

**Explicar paralelismo:**
> "Las dos consultas son independientes, así que las ejecutamos en paralelo con Promise.all(). Esto reduce el tiempo de respuesta a la mitad."

#### Puntos Clave a Destacar
- ✅ **Caché inteligente**: TTL de 5 minutos para datos frecuentes
- ✅ **Agregaciones eficientes**: Procesamiento en base de datos
- ✅ **Exportación profesional**: Excel formateado, no CSV crudo
- ✅ **Paralelismo**: Consultas independientes simultáneas
- ✅ **Escalabilidad**: Cache reduce carga 80%

---

### 👥 FLUJO 5: GESTIÓN DE USUARIOS

**Archivo:** `flujo-gestion-usuarios.puml`

**Tiempo de presentación:** 2-3 minutos

#### ¿Cómo Explicarlo?

**APERTURA (15 segundos)**
> "Este flujo muestra la administración de accesos y permisos."

**FASE 1: CREAR USUARIO (1 minuto)**

```
Admin completa formulario nuevo usuario
    ↓
POST /auth/register
    ↓
Validar email único
    ├─ [ALT] Email existe: 409 Conflict
    └─ [ELSE] Email disponible
        ↓
bcrypt.hash(password, 10)
    ↓
INSERT INTO users
    ├─ email
    ├─ password: hash
    ├─ name
    ├─ role: 'CASHIER' (default)
    └─ active: true
    ↓
201 Created + Usuario (sin password)
```

**Destacar seguridad:**
> "NUNCA almacenamos contraseñas en texto plano. bcrypt.hash con 10 rondas de salt toma aproximadamente 100ms, lo cual es imperceptible para el usuario pero hace que un ataque de fuerza bruta sea computacionalmente inviable."

**FASE 2: ASIGNAR ROL (30 segundos)**

```
Admin cambia rol de usuario
    ↓
PUT /settings/users/{id}/role
    ↓
Verificar usuario existe
    ↓
UPDATE users SET role = nuevo_rol
    ↓
200 OK
```

**FASE 3: ACTIVAR/DESACTIVAR (30 segundos)**

```
Admin cambia estado de usuario
    ↓
UPDATE users SET active = !estado_actual
    ↓
Efecto inmediato:
    - Si desactivado: usuario no puede loguear
    - Token existente: expira naturalmente en 24h
```

**FASE 4: CAMBIAR CONTRASEÑA (45 segundos)**

```
Usuario ingresa:
    - Contraseña actual
    - Nueva contraseña
    - Confirmación nueva
    ↓
PUT /auth/password
    ↓
Verificar contraseña actual:
    ├─ bcrypt.compare(ingresada, hash_almacenado)
    ├─ [ALT] No coincide: 401 Unauthorized
    └─ [ELSE] Coincide
        ↓
Validar nueva contraseña:
    - Mínimo 8 caracteres
    - Al menos una mayúscula
    - Al menos un número
        ↓
bcrypt.hash(nueva_password, 10)
    ↓
UPDATE users SET password = nuevo_hash
    ↓
200 OK
```

**Seguridad adicional:**
> "Requerimos la contraseña actual para cambiarla. Esto previene que alguien que dejó la sesión abierta cambie la contraseña. También forzamos complejidad mínima."

#### Puntos Clave a Destacar
- ✅ **bcrypt**: Hashing robusto con salt
- ✅ **Validación**: Email único, contraseña compleja
- ✅ **Soft delete**: Desactivación, no eliminación
- ✅ **Control de acceso**: Solo ADMIN gestiona usuarios

---

## 3. PATRONES IMPORTANTES

### Patrón 1: Validación en Dos Niveles

**¿Dónde aparece?** Flujo de venta, creación de productos

**Explicación:**
> "Validamos en el frontend para feedback inmediato al usuario, y validamos en el backend para seguridad. Nunca confiamos solo en el cliente."

**Ejemplo:**
```
Frontend: Validar email tiene formato correcto
Backend: Validar email no existe en base de datos
```

### Patrón 2: Transacciones ACID

**¿Dónde aparece?** Módulo de ventas

**Explicación:**
> "Operaciones complejas que deben ser atómicas. Todo se ejecuta o nada. Esto garantiza integridad de datos incluso ante fallos."

### Patrón 3: Caché con TTL

**¿Dónde aparece?** Dashboard y reportes

**Explicación:**
> "Datos que no cambian frecuentemente se cachean por tiempo limitado. Balance entre performance y frescura de datos."

### Patrón 4: Soft Delete

**¿Dónde aparece?** Productos, usuarios

**Explicación:**
> "No eliminamos físicamente los registros, solo marcamos como inactivos. Esto preserva el historial y permite recuperación."

### Patrón 5: Auditoría Automática

**¿Dónde aparece?** Stock, ventas

**Explicación:**
> "Cada operación crítica genera un registro de auditoría. Quién, cuándo, qué cambió. Esencial para compliance y debugging."

---

## 4. PREGUNTAS FRECUENTES DEL JURADO

### ❓ PREGUNTA 1: "¿Por qué validan dos veces (frontend y backend)?"

**RESPUESTA:**
> "Excelente pregunta. Son dos objetivos diferentes:
> 
**Frontend:**
> - Objetivo: Experiencia de usuario
> - Feedback inmediato sin esperar al servidor
> - Reduce tráfico de red
> - Pero NO es seguro (el usuario puede desactivar JavaScript)
> 
**Backend:**
> - Objetivo: Seguridad e integridad
> - Última línea de defensa
> - Nunca confiamos en el cliente
> - Protege contra requests maliciosos
> 
**Ejemplo:**
> Un hacker podría hacer POST directo a /products con precio = 0. El frontend no lo detiene, pero el backend valida que precio > 0 y rechaza."

---

### ❓ PREGUNTA 2: "¿Qué pasa exactamente si falla la conexión a internet durante una transacción?"

**RESPUESTA:**
> "Depende del momento exacto:
> 
**Escenario 1: Antes del commit**
> - La transacción está en memoria del servidor
> - Si se pierde conexión, el cliente no recibe respuesta
> - Pero la transacción nunca se completó
> - Resultado: Nada se guardó. Sistema consistente.
> 
**Escenario 2: Durante el commit**
> - PostgreSQL tiene mecanismos de recuperación
> - Write-ahead logging (WAL) garantiza durabilidad
> - Al reiniciar, PostgreSQL revisa logs y completa o rollback según corresponda
> 
**Escenario 3: Después del commit**
> - La venta se guardó correctamente
> - El cliente no recibió confirmación por timeout
> - Solución: El cajero puede consultar ventas recientes para verificar
> 
**Prevención:**
> - Ventas pausadas se guardan en localStorage
> - Retry automático con backoff exponencial
> - Idempotencia: múltiples clicks no crean duplicados"

---

### ❓ PREGUNTA 3: "¿Por qué usan localStorage y no sessionStorage?"

**RESPUESTA:**> "Buena diferenciación técnica:
> 
**sessionStorage:**
> - Persiste solo durante la sesión de la pestaña
> - Si cierran la pestaña, se pierde todo
> 
**localStorage:**
> - Persiste incluso si cierran el navegador
> - Permanece hasta que se borre explícitamente
> - Ideal para ventas pausadas que pueden durar horas o días
> 
**Caso de uso:**
> Un cajero pausa una venta a las 10am, cierra el sistema, vuelve a abrirlo a las 2pm después del almuerzo. Con localStorage, la venta sigue ahí. Con sessionStorage, se perdió."

---

### ❓ PREGUNTA 4: "¿Qué tan seguro es JWT? ¿No pueden robar el token?"

**RESPUESTA:**
> "JWT es seguro cuando se implementa correctamente:
> 
**Seguridades:**
> 1. **Firmado digitalmente**: El token tiene una firma criptográfica. Si alguien modifica el payload, la firma no coincide y se rechaza.
> 2. **Expiración**: Nuestros tokens duran 24 horas. No son eternos.
> 3. **HTTPS**: Los tokens viajan encriptados en tránsito.
> 4. **localStorage**: Aislado por dominio. Otros sitios web no pueden acceder.
> 
**Riesgos y mitigaciones:**
> - **XSS**: Protegemos contra cross-site scripting
> - **CSRF**: Tokens en header Authorization, no en cookies
> - **Robo físico**: Si alguien accede al computador del cajero, puede usar el token. Mitigación: logout automático después de inactividad.
> 
**Comparación:**
> Es más seguro que sesiones tradicionales en servidor porque no hay estado que secuestrar."

---

### ❓ PREGUNTA 5: "¿Por qué Cloudinary y no guardan las imágenes en su servidor?"

**RESPUESTA:**> "Tres razones principales:
> 
**1. Escalabilidad:**
> - Nuestro servidor: Recurso limitado, costoso escalar
> - Cloudinary: Infraestructura global CDN, escala automáticamente
> - Manejan millones de imágenes sin problemas
> 
**2. Optimización automática:**
> - Subimos 5MB, ellos generan versiones de 200KB
> - Formatos adaptativos (WebP para Chrome, JPEG para Safari)
> - Múltiples tamaños automáticos
> 
**3. Costo:**
> - Servidor propio: Disco + ancho de banda + backup
> - Cloudinary: Plan gratuito generoso, luego pago por uso
> - En la práctica, más económico
> 
**Desventaja:**
> - Dependencia de terceros. Mitigación: backups periódicos."

---

### ❓ PREGUNTA 6: "Si tienen caché, ¿cómo se aseguran que los datos no estén desactualizados?"

**RESPUESTA:**> "Estrategia de invalidación de caché:
> 
**TTL (Time To Live):**
> - Dashboard: 5 minutos de vida
> - Después de 5 minutos, la próxima consulta recalcula
> - Balance entre performance y frescura
> 
**Invalidación proactiva:**
> - Cuando se crea una venta, invalidamos el caché de dashboard
> - Próxima consulta recalcula con datos nuevos
> 
**Estrategia Cache-Aside:**
> 1. Buscar en caché
> 2. Si no está, buscar en base de datos
> 3. Guardar en caché
> 4. Retornar
> 
**Stale data aceptable:**
> - Dashboard de hace 3 minutos es aceptable
> - Reportes históricos (mes pasado) no cambian, cacheamos indefinidamente"

---

### ❓ PREGUNTA 7: "¿Qué es exactamente un 'JOIN' en SQL y por qué lo usan?"

**RESPUESTA:**> "JOIN combina datos de múltiples tablas relacionadas:
> 
**Ejemplo concreto:**
> Queremos mostrar una venta con:
> - Datos de la venta (tabla: sales)
> - Productos comprados (tabla: sale_items)
> - Nombres de productos (tabla: products)
> - Nombre del cliente (tabla: customers)
> 
**Sin JOIN:**
> - Consulta venta → Consulta items → Consulta cada producto → Consulta cliente
> - 1 + N + M consultas = LENTO
> 
**Con JOIN:**
> ```sql
> SELECT s.*, si.*, p.name, c.name
> FROM sales s
> LEFT JOIN sale_items si ON s.id = si.saleId
> LEFT JOIN products p ON si.productId = p.id
> LEFT JOIN customers c ON s.customerId = c.id
> ```
> - Una sola consulta que trae todo relacionado
> - Mucho más eficiente
> 
**Prisma lo hace automáticamente:**
> ```typescript
> prisma.sale.findUnique({
>   include: { items: { include: { product: true } } }
> })
> ```"

---

### ❓ PREGUNTA 8: "¿Cómo se relacionan estos diagramas de secuencia con el código?"

**RESPUESTA:**> "Hay correspondencia directa:
> 
**Diagrama → Código:**
> - Cada participante = Clase o servicio
> - Cada mensaje = Llamada a método
> - Cada línea de activación = Bloque de código ejecutándose
> 
**Ejemplo concreto:**
> ```
> Diagrama: SalesService → Prisma: create()
> 
> Código:
> // sales.service.ts
> async createSale(dto) {
>   return this.prisma.sale.create({ data: dto })
> }
> ```
> 
**Trazabilidad:**
> - Diseño (diagrama) → Implementación (código)
> - Si cambia el código, actualizamos el diagrama
> - Debugging: seguimos el flujo del diagrama en el código
> 
**Valor:**
> - Nuevos desarrolladores entienden el sistema leyendo diagramas
> - Documentación viva del comportamiento del sistema"

---

## 5. TIPS DE PRESENTACIÓN

### ✅ HACER

1. **Sigue las flechas con el dedo**: Guía la vista del jurado
2. **Cuenta una historia**: "Imaginen un cajero en hora pico..."
3. **Destaca momentos críticos**: "Aquí es donde ocurre la magia..."
4. **Usa analogías**: "La transacción es como una transferencia bancaria..."
5. **Anticipa dudas**: "Probablemente se pregunten por qué..."

### ❌ NO HACER

1. ❌ No leas cada mensaje uno por uno
2. ❌ No ignores los bloques ALT/OPT
3. ❌ No asumas que entienden los símbolos UML
4. ❌ No te apresures en las transacciones
5. ❌ No digas "esto es obvio"

### 🎯 FRASES CLAVE

**Para empezar:**
> "Este diagrama muestra paso a paso cómo procesamos una venta, desde que el cajero escanea el primer producto hasta que se genera la recibo."

**En la transacción:**
> "Noten estas líneas paralelas en el centro: es el período donde el servidor está procesando. Todo esto ocurre en una transacción atómica."

**Antes de un ALT:**
> "Aquí el flujo se bifurca. Veamos ambos caminos..."

**Al finalizar:**
> "Como ven, cada paso está diseñado para garantizar integridad de datos y buena experiencia de usuario."

### 📊 TIEMPOS RECOMENDADOS

| Flujo | Tiempo | Prioridad |
|-------|--------|-----------|
| Venta (POS) | 4-5 min | ⭐⭐⭐ Muy alta |
| Autenticación | 3-4 min | ⭐⭐⭐ Muy alta |
| Productos | 2-3 min | ⭐⭐ Media |
| Reportes | 2 min | ⭐⭐ Media |
| Usuarios | 1-2 min | ⭐ Baja |

**Total:** 12-16 minutos

### 🆘 SI TE TRABAS

**Si olvidas un paso:**
> "Luego de validar el stock, el sistema procede a... [continúa]"

**Si te piden profundidad técnica:**
> "Eso implica detalles de implementación. En nuestro código, usamos Prisma con transacciones que internamente usan los mecanismos de PostgreSQL."

**Si el tiempo se acaba:**
> "Permítanme enfocarme en lo más crítico: la transacción de venta que garantiza integridad de datos."

---

## 📝 CHECKLIST PRE-PRESENTACIÓN

- [ ] ¿Puedes explicar cada flujo sin mirar el diagrama?
- [ ] ¿Sabes qué significan ALT, OPT, LOOP, PAR?
- [ ] ¿Puedes explicar transacción ACID en 30 segundos?
- [ ] ¿Tienes analogías listas para conceptos técnicos?
- [ ] ¿Sabes cuánto tiempo te toma cada flujo?
- [ ] ¿Tienes respuestas preparadas para las 8 preguntas?
- [ ] ¿Practicaste señalar el diagrama mientras hablas?
- [ ] ¿Puedes explicar por qué localStorage y no sessionStorage?

---

## 🎓 RECUERDA

> "Los diagramas de secuencia son la evidencia de que tu sistema no solo funciona, sino que está bien diseñado. Muestran que pensaste en todos los escenarios: éxito, fallo, concurrencia, seguridad."

**¡Mucho éxito en tu presentación!** 🚀

---

*Guía creada para el proyecto de MeperPOS y Punto de Venta*
