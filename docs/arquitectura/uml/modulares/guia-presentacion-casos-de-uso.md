# 🎓 Guía de Presentación - Diagramas de Casos de Uso

## MeperPOS y Punto de Venta

---

## 📋 ÍNDICE

1. [Introducción a los Casos de Uso](#1-introducción)
2. [Cómo Explicar Cada Módulo](#2-explicación-por-módulo)
3. [Guion de Presentación](#3-guion-de-presentación)
4. [Preguntas del Jurado y Respuestas](#4-preguntas-frecuentes)
5. [Tips para la Presentación](#5-tips-de-presentación)

---

## 1. INTRODUCCIÓN

### ¿Qué son los Diagramas de Casos de Uso?

> **"Los diagramas de casos de uso representan las funcionalidades del sistema desde la perspectiva del usuario. Nos muestran QUIÉN (actores) puede hacer QUÉ (casos de uso) en el sistema."**

### Estructura Básica

```
Actor ──────> (Caso de Uso)
  │              │
  │              └─ Funcionalidad específica
  └─ Usuario o sistema externo
```

### Elementos UML Utilizados

| Elemento | Símbolo | Significado |
|----------|---------|-------------|
| **Actor** | 👤 Figura humana | Usuario o sistema externo |
| **Caso de Uso** | 🥚 Óvalo | Funcionalidad del sistema |
| **Asociación** | ➡️ Línea sólida | Relación actor-caso de uso |
| **Include** | ➡️➖➡️ Línea punteada | Relación obligatoria |
| **Extend** | ➡️➖➡️ Línea punteada | Relación opcional |

---

## 2. EXPLICACIÓN POR MÓDULO

### 🔐 MÓDULO 1: AUTENTICACIÓN

**Archivo:** `modulo-auth.puml`

#### ¿Cómo Explicarlo?

**PASO 1 - Introducción (30 segundos)**
> "Este módulo es la puerta de entrada al sistema. Antes de que cualquier usuario pueda realizar operaciones, debe identificarse de manera segura."

**PASO 2 - Actores (20 segundos)**
> "Los tres actores pueden acceder al sistema: Administrador, Cajero y Usuario de Inventario. Todos necesitan autenticarse."

**PASO 3 - Casos de Uso Principales (1 minuto)**

| Caso de Uso | Explicación Rápida |
|-------------|-------------------|
| **UC01: Iniciar Sesión** | "Ingreso con email y contraseña encriptada" |
| **UC02: Cerrar Sesión** | "Finalización segura de la sesión" |
| **UC03: Registrar Usuario** | "Solo el ADMIN puede crear nuevos usuarios" |
| **UC04: Recuperar Contraseña** | "Proceso de restablecimiento seguro" |
| **UC05-07** | "Gestión de perfil personal" |

**PASO 4 - Relaciones (30 segundos)**
> "Observe las relaciones <<include>>: Registrar usuario SIEMPRE incluye iniciar sesión automáticamente después del registro."

#### Puntos Clave a Destacar
- ✅ Seguridad: Contraseñas encriptadas con bcrypt
- ✅ Roles: Tres niveles de acceso diferenciados
- ✅ JWT: Tokens con expiración de 24 horas

---

### 📦 MÓDULO 2: PRODUCTOS

**Archivo:** `modulo-productos.puml`

#### ¿Cómo Explicarlo?

**PASO 1 - Introducción (30 segundos)**
> "Este es el núcleo del sistema de inventario. Aquí gestionamos todo el catálogo de productos disponibles para la venta."

**PASO 2 - Permisos por Rol (45 segundos)**

```
Administrador:  CRUD completo + eliminar
Cajero:         Solo lectura (consultar)
Inv. Usuario:   CRU (Crear, Leer, Actualizar)
```

**PASO 3 - Casos de Uso Destacados (1.5 minutos)**

**UC10: Crear Producto**
> "El sistema valida que el SKU sea único antes de crear el producto. Incluye automáticamente la consulta de categorías disponibles."

**UC16: Gestionar Stock**
> "No es solo cambiar un número. Cada ajuste genera automáticamente un movimiento de inventario para auditoría."

**UC17: Subir Imagen**
> "Las imágenes se procesan y optimizan automáticamente en Cloudinary antes de guardarse."

**PASO 4 - Relaciones Importantes (30 segundos)**
- **Include:** Crear producto requiere consultar categorías
- **Extend:** Subir imagen es opcional al editar

#### Puntos Clave a Destacar
- ✅ Concurrencia: Campo "version" para evitar conflictos
- ✅ Auditoría: Cada movimiento de stock queda registrado
- ✅ Optimización: Imágenes comprimidas automáticamente

---

### 📁 MÓDULO 3: CATEGORÍAS

**Archivo:** `modulo-categorias.puml`

#### ¿Cómo Explicarlo?

**PASO 1 - Contexto (20 segundos)**
> "Las categorías permiten organizar los productos de forma jerárquica, facilitando la búsqueda y los reportes."

**PASO 2 - Simplicidad (30 segundos)**
> "Este es un módulo CRUD estándar, pero con una característica especial: al crear o editar una categoría, el sistema siempre muestra primero las existentes para evitar duplicados."

**PASO 3 - Caso de Uso Especial (30 segundos)**

**UC24: Ver Productos por Categoría**
> "Esta funcionalidad es clave para el inventario. Permite ver instantáneamente qué productos pertenecen a cada categoría."

#### Puntos Clave a Destacar
- ✅ Relación 1:N con productos
- ✅ Validación de nombres únicos
- ✅ Consultas optimizadas con índices

---

### 👥 MÓDULO 4: CLIENTES

**Archivo:** `modulo-clientes.puml`

#### ¿Cómo Explicarlo?

**PASO 1 - Importancia (30 segundos)**
> "El módulo de clientes permite fidelizar compradores y mantener un historial completo de sus transacciones."

**PASO 2 - Diferencias de Acceso (30 segundos)**
> "Tanto Administradores como Cajeros pueden crear y editar clientes, pero solo el Admin puede eliminar registros."

**PASO 3 - Casos de Uso Clave (1 minuto)**

**UC34: Buscar Cliente**
> "Búsqueda por documento de identidad o nombre. Incluye autocompletado para agilizar el proceso de venta."

**UC35: Ver Historial de Compras**
> "Extiende la funcionalidad de ver detalle del cliente. Muestra todas las ventas asociadas al cliente con totales y fechas."

**UC36: Asignar Cliente a Venta**
> "Fundamental en el POS. Incluye la búsqueda previa del cliente."

#### Puntos Clave a Destacar
- ✅ Documento único: Validación de duplicados
- ✅ Segmentación: Clientes ocasionales vs frecuentes
- ✅ Historial: Traza completa de compras

---

### 💰 MÓDULO 5: VENTAS/POS

**Archivo:** `modulo-ventas.puml`

#### ¿Cómo Explicarlo?

**PASO 1 - Introducción Impactante (30 segundos)**
> "Este es el módulo más crítico del sistema. Aquí ocurre la transacción comercial y se procesan los pagos."

**PASO 2 - Complejidad (30 segundos)**
> "Observe la cantidad de casos de uso y relaciones. Esto refleja la complejidad real de un punto de venta profesional."

**PASO 3 - Flujo Principal (1.5 minutos)**

**UC40: Crear Venta**
> "El caso de uso principal. Incluye obligatoriamente:"
> - Agregar productos al carrito
> - Validar stock disponible
> - Procesar el pago

**UC41: Procesar Pago**
> "Soporta múltiples métodos: efectivo, tarjeta, transferencia. Incluye el cálculo del cambio."

**UC43: Aplicar Descuento**
> "Extensión opcional. Solo si el cajero decide aplicar un descuento autorizado."

**PASO 4 - Casos de Uso Especiales (1 minuto)**

**UC47-48: Pausar y Reanudar Venta**
> "Funcionalidad clave en tiendas físicas. Si llega un cliente urgente, el cajero puede pausar la venta actual, atender al nuevo cliente, y luego reanudar donde la dejó."

**UC46: Cancelar Venta**
> "Solo el Administrador puede cancelar. Esto genera un rollback completo del inventario."

#### Puntos Clave a Destacar
- ✅ Transacción ACID: Todo o nada
- ✅ Concurrencia: Control de stock en tiempo real
- ✅ Persistencia: Ventas pausadas en localStorage
- ✅ Auditoría: Cada venta genera movimientos de inventario

---

### 📊 MÓDULO 6: REPORTES

**Archivo:** `modulo-reportes.puml`

#### ¿Cómo Explicarlo?

**PASO 1 - Valor Agregado (30 segundos)**
> "Los reportes transforman datos en decisiones de negocio. Este módulo proporciona inteligencia comercial en tiempo real."

**PASO 2 - Niveles de Acceso (45 segundos)**

```
Administrador:     Todos los reportes
Cajero:           Dashboard básico + ventas propias
Inv. Usuario:     Solo inventario y stock
```

**PASO 3 - Reportes Destacados (1.5 minutos)**

**UC60: Ver Dashboard**
> "Vista general del negocio: ventas del día, productos más vendidos, alertas de stock bajo."

**UC61: Reporte de Ventas**
> "Análisis detallado por período. Incluye filtros obligatorios de fecha para optimizar consultas."

**UC64: Estadísticas de Inventario**
> "Valor total del inventario, rotación de productos, alertas de reorden."

**UC69: Comparar Períodos**
> "Permite comparar ventas de dos períodos diferentes para identificar tendencias."

#### Puntos Clave a Destacar
- ✅ Cache: Reportes frecuentes cacheados 5 minutos
- ✅ Agregaciones: Consultas SQL optimizadas
- ✅ Exportación: PDF, Excel, CSV

---

### ⚙️ MÓDULO 7: CONFIGURACIÓN

**Archivo:** `modulo-configuracion.puml`

#### ¿Cómo Explicarlo?

**PASO 1 - Control del Sistema (30 segundos)**
> "Este módulo es el panel de control del sistema. Aquí se definen los parámetros que afectan todo el negocio."

**PASO 2 - Privilegios (30 segundos)**
> "Casi todas las funcionalidades son exclusivas del Administrador. Cajeros e Inventario solo pueden cambiar el tema visual."

**PASO 3 - Configuraciones Críticas (1 minuto)**

**UC71: Configurar Impuestos**
> "Define la tasa de IVA (19% por defecto en Colombia). Afecta todos los cálculos de ventas."

**UC72: Gestionar Usuarios**
> "Incluye obligatoriamente la asignación de roles. Cada usuario debe tener un rol definido."

**UC74: Configurar Recibo**
> "Personalización de la recibo: encabezado, pie de página, prefijo de numeración."

#### Puntos Clave a Destacar
- ✅ Parámetros globales: Afectan todo el sistema
- ✅ Seguridad: Solo ADMIN puede modificar configuraciones críticas
- ✅ Persistencia: Settings en base de datos con caché

---

## 3. GUION DE PRESENTACIÓN

### Orden Recomendado (10-12 minutos totales)

| Tiempo | Módulo | Duración |
|--------|--------|----------|
| 0:00 | Introducción general | 1 min |
| 1:00 | Autenticación | 1.5 min |
| 2:30 | Productos | 2 min |
| 4:30 | Clientes | 1 min |
| 5:30 | Ventas/POS | 2.5 min |
| 8:00 | Reportes | 1.5 min |
| 9:30 | Configuración | 1 min |
| 10:30 | Cierre y preguntas | 1-2 min |

### Frases de Transición

**Entre módulos:**
> "Ahora que vimos cómo los usuarios se autentican, veamos qué pueden hacer con los productos..."

> "Una vez que tenemos productos organizados, necesitamos clientes para venderles..."

> "Con productos y clientes listos, veamos el corazón del sistema: el punto de venta..."

### Momentos para Preguntar al Jurado

**Pregunta de engagement (minuto 3):**
> "¿Han visto cómo diferenciamos los permisos? ¿Tiene sentido que el Cajero no pueda eliminar productos?"

**Pregunta técnica (minuto 6):**
> "Notaron la relación <<include>> en el proceso de venta. ¿Por qué creen que validar stock es obligatorio y no opcional?"

---

## 4. PREGUNTAS FRECUENTES DEL JURADO

### ❓ PREGUNTA 1: "¿Por qué hay tres roles diferentes?"

**RESPUESTA:**
> "Los tres roles reflejan la separación de responsabilidades en un negocio real:
> - **Administrador**: Control total, gestión estratégica
> - **Cajero**: Operación diaria, ventas y atención al cliente
> - **Inventario**: Gestión de stock, compras y proveedores
> 
> Esta separación sigue el principio de **mínimo privilegio**, donde cada usuario solo tiene acceso a lo que necesita para su trabajo, reduciendo riesgos de errores o fraudes."

**TIP:** Menciona que esto es "Seguridad basada en roles (RBAC)"

---

### ❓ PREGUNTA 2: "¿Qué pasa si dos cajeros venden el mismo producto simultáneamente?"

**RESPUESTA:**
> "Excelente pregunta sobre concurrencia. El sistema implementa **concurrencia optimista** mediante:
> 1. **Transacciones ACID**: Cada venta es una transacción atómica
> 2. **Campo 'version'**: Cada producto tiene un número de versión
> 3. **Validación de stock**: Antes de procesar, se verifica stock disponible
> 
> Si dos cajeros intentan vender el último producto:
> - El primero que complete la transacción tendrá éxito
> - El segundo recibirá un error de 'stock insuficiente'
> - Esto garantiza que nunca vendamos productos que no tenemos"

**TIP:** Si te piden más detalle, menciona "pessimistic locking vs optimistic locking"

---

### ❓ PREGUNTA 3: "¿Por qué usan <<include>> y <<extend>>? ¿Cuál es la diferencia?"

**RESPUESTA:**
> "Son relaciones UML estándar con significados diferentes:
> 
> **<<include>> (Inclusión):**
> - Es **obligatoria**
> - El caso de uso base SIEMPRE incluye el otro
> - Ejemplo: 'Crear Venta' SIEMPRE incluye 'Validar Stock'
> - Sin la inclusión, el caso base no puede completarse
> 
> **<<extend>> (Extensión):**
> - Es **opcional**
> - Solo ocurre bajo ciertas condiciones
> - Ejemplo: 'Aplicar Descuento' extiende 'Crear Venta' solo si el cajero decide aplicar un descuento
> - Sin la extensión, el caso base funciona igual"

**TIP:** Usa un ejemplo de la vida real: "Incluir es como pagar en una compra (obligatorio), extender es como usar un cupón de descuento (opcional)"

---

### ❓ PREGUNTA 4: "El módulo de ventas parece muy complejo. ¿No se puede simplificar?"

**RESPUESTA:**
> "La complejidad refleja la realidad de un negocio retail. Sin embargo, está organizada en capas:
> 
> **Nivel Básico (MVP):**
> - Crear venta + Procesar pago
> - Esto funciona para un negocio simple
> 
> **Nivel Profesional:**
> - Añadimos pausar/reanudar para multitasking
> - Descuentos y promociones
> - Múltiples métodos de pago
> - Generación de Recibos electrónica
> 
> **Nivel Empresarial:**
> - Cancelaciones con rollback
> - Auditoría completa
> - Reportes avanzados
> 
> El sistema es escalable; se pueden desactivar funcionalidades avanzadas si no se necesitan."

**TIP:** Menciona que esto es "diseño escalable y modular"

---

### ❓ PREGUNTA 5: "¿Por qué el Cajero no puede eliminar productos ni cancelar ventas?"

**RESPUESTA:**
> "Son medidas de **control interno** estándar en retail:
> 
> **Eliminar productos:**
> - Podría ser un error accidental con impacto grave
> - El inventario es responsabilidad del área de inventario
> - Previene fraudes
> 
> **Cancelar ventas:**
> - Una cancelación afecta el inventario y las métricas del día
> - Podría usarse para ocultar errores o fraudes
> - Requiere autorización de supervisor (Admin)
> 
> Esto sigue el principio de **segregación de funciones** en auditoría."

---

### ❓ PREGUNTA 6: "¿Cómo se relacionan estos casos de uso con el código real?"

**RESPUESTA:**
> "Cada caso de uso se implementa mediante:
> 
> **Backend (NestJS):**
> - Un endpoint REST por caso de uso principal
> - Servicios que implementan la lógica
> - DTOs que validan los datos de entrada
> 
> **Ejemplo concreto:**
> - UC40 'Crear Venta' → POST /sales en SalesController
> - Implementado en SalesService.createSale()
> - Validado por CreateSaleDto
> 
> **Frontend (Next.js):**
> - Páginas que corresponden a casos de uso
> - Hooks personalizados (useSales, useProducts)
> - Interfaces de usuario específicas
> 
> Hay trazabilidad directa desde el análisis hasta el código."

---

### ❓ PREGUNTA 7: "¿Qué pasa si el sistema se queda sin internet durante una venta?"

**RESPUESTA:**
> "El sistema maneja estados offline:
> 
> **Ventas pausadas:**
> - Se guardan en localStorage del navegador
> - El cajero puede reanudarlas al restaurar conexión
> 
> **Diseño offline-first:**
> - Cache de productos frecuentes
> - Validaciones locales de stock
> - Cola de sincronización
> 
> **Limitaciones:**
> - No se pueden procesar pagos sin conexión
> - No se generan recibos en tiempo real
> - Se requiere sincronización posterior
> 
> Esto es crítico en entornos con conectividad inestable."

---

## 5. TIPS DE PRESENTACIÓN

### ✅ HACER

1. **Mira al jurado**, no solo a la pantalla
2. **Usa ejemplos concretos**: "Imaginen un cajero en hora pico..."
3. **Destaca el valor**: "Esto permite...", "El beneficio es..."
4. **Anticipa preguntas**: "Probablemente se pregunten por qué..."
5. **Practica los tiempos**: No te excedas en ningún módulo

### ❌ NO HACER

1. ❌ No leas directamente del diagrama
2. ❌ No uses jerga técnica sin explicarla
3. ❌ No ignores las relaciones <<include>> y <<extend>>
4. ❌ No te quedes callado si te interrumpen
5. ❌ No digas "esto es obvio" o "básico"

### 🎯 FRASES CLAVE PARA MEMORIZAR

**Apertura fuerte:**
> "Este sistema no es solo una lista de funcionalidades, es una solución completa para la gestión comercial."

**Antes de mostrar el diagrama de ventas:**
> "Ahora llegamos al corazón del sistema..."

**Cierre:**
> "Como ven, cada funcionalidad está diseñada pensando en el usuario final y las necesidades reales del negocio."

### 📱 MANEJO DE LA TECNOLOGÍA

**Si la proyección falla:**
> "Mientras resolvemos el técnico, permítanme describir lo que veríamos..." (sigue con tu guion)

**Si te pierdes:**
> "Permítanme retomar desde el punto clave aquí..."

**Si no entienden algo:**
> "Permítanme explicarlo de otra forma..." (usa analogía)

---

## 📝 CHECKLIST PRE-PRESENTACIÓN

- [ ] ¿Practicaste el guion completo al menos 3 veces?
- [ ] ¿Conoces cada caso de uso por su número (UCXX)?
- [ ] ¿Puedes explicar <<include>> vs <<extend>> sin dudar?
- [ ] ¿Tienes ejemplos concretos listos para cada módulo?
- [ ] ¿Sabes cuánto tiempo te toma cada sección?
- [ ] ¿Tienes respuestas preparadas para las 7 preguntas frecuentes?
- [ ] ¿Sabes manejar la proyección/el cambio de slides?
- [ ] ¿Tienes agua cerca?
- [ ] ¿Estás listo para sonreír y respirar?

---

## 🎓 RECUERDA

> "No estás presentando código, estás presentando una **solución de negocio**. Los casos de uso muestran que entiendes las necesidades del usuario y cómo el sistema las resuelve."

**¡Mucho éxito en tu presentación!** 🚀

---

*Guía creada para el proyecto de MeperPOS y Punto de Venta*
