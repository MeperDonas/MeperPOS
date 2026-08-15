# 📊 Diagramas de Casos de Uso por Módulo

Esta carpeta contiene los diagramas de casos de uso del MeperPOS y Punto de Venta, organizados por módulo funcional.

## 📁 Estructura de Archivos

### Módulos Disponibles

1. **modulo-auth.puml** - Módulo de Autenticación
   - Login, logout, registro de usuarios
   - Recuperación de contraseña
   - Gestión de perfiles

2. **modulo-productos.puml** - Módulo de Productos
   - CRUD de productos
   - Gestión de stock e inventario
   - Subida de imágenes
   - Historial de movimientos

3. **modulo-categorias.puml** - Módulo de Categorías
   - CRUD de categorías
   - Organización de productos por categoría

4. **modulo-clientes.puml** - Módulo de Clientes
   - Gestión de clientes
   - Historial de compras
   - Asignación a ventas

5. **modulo-ventas.puml** - Módulo de Ventas/POS
   - Procesamiento de ventas
   - Gestión de pagos
   - Carrito de compras
   - Generación de Recibos

6. **modulo-reportes.puml** - Módulo de Reportes
   - Dashboard y estadísticas
   - Reportes de ventas, productos e inventario
   - Comparación de períodos

7. **modulo-importaciones.puml** - Módulo de Importaciones
   - Descarga de plantilla Excel/CSV
   - Subida y procesamiento de archivo
   - Monitoreo de estado
   - Reintento de filas fallidas

8. **modulo-configuracion.puml** - Módulo de Configuración
   - Configuración de empresa
   - Gestión de usuarios y roles
   - Configuración fiscal

## 🎨 Convenciones UML

### Actores
| Actor | Color | Descripción |
|-------|-------|-------------|
| Administrador | Azul (#E3F2FD) | Acceso total al sistema |
| Cajero | Naranja (#FFF3E0) | Procesamiento de ventas |
| Usuario de Inventario | Verde (#E8F5E9) | Gestión de productos |

### Relaciones
- **Asociación** (`-->`): Conexión entre actor y caso de uso
- **Inclusión** (`..>`): Caso de uso obligatorio <<include>>
- **Extensión** (`.->`): Caso de uso opcional <<extend>>

### Colores de Casos de Uso
| Color | Significado |
|-------|-------------|
| Verde (#E8F5E9) | Caso de uso principal |
| Azul (#E3F2FD) | Inclusión (obligatorio) |
| Naranja (#FFF3E0) | Extensión (opcional) |

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

## 📋 Módulos y Casos de Uso

### Módulo de Autenticación (UC01-UC07)
| ID | Caso de Uso | Actores |
|----|-------------|---------|
| UC01 | Iniciar Sesión | Todos |
| UC02 | Cerrar Sesión | Todos |
| UC03 | Registrar Usuario | Admin |
| UC04 | Recuperar Contraseña | Todos |
| UC05 | Editar Perfil | Todos |
| UC06 | Ver Perfil | Todos |
| UC07 | Cambiar Contraseña | Todos |

### Módulo de Productos (UC10-UC19)
| ID | Caso de Uso | Actores |
|----|-------------|---------|
| UC10 | Crear Producto | Admin, Inventario |
| UC11 | Editar Producto | Admin, Inventario |
| UC12 | Eliminar Producto | Admin |
| UC13 | Consultar Productos | Todos |
| UC14 | Buscar Productos | Todos |
| UC15 | Ver Detalle de Producto | Todos |
| UC16 | Gestionar Stock | Admin, Inventario |
| UC17 | Subir Imagen de Producto | Admin, Inventario |
| UC18 | Ajustar Inventario | Admin, Inventario |
| UC19 | Ver Historial de Movimientos | Admin, Inventario |

### Módulo de Categorías (UC20-UC25)
| ID | Caso de Uso | Actores |
|----|-------------|---------|
| UC20 | Crear Categoría | Admin, Inventario |
| UC21 | Editar Categoría | Admin, Inventario |
| UC22 | Eliminar Categoría | Admin |
| UC23 | Consultar Categorías | Todos |
| UC24 | Ver Productos por Categoría | Todos |
| UC25 | Reorganizar Categorías | Admin |

### Módulo de Clientes (UC30-UC37)
| ID | Caso de Uso | Actores |
|----|-------------|---------|
| UC30 | Crear Cliente | Admin, Cajero |
| UC31 | Editar Cliente | Admin, Cajero |
| UC32 | Eliminar Cliente | Admin |
| UC33 | Consultar Clientes | Todos |
| UC34 | Buscar Cliente | Todos |
| UC35 | Ver Historial de Compras | Admin, Cajero |
| UC36 | Asignar Cliente a Venta | Admin, Cajero |
| UC37 | Ver Detalle de Cliente | Admin, Cajero |

### Módulo de Ventas/POS (UC40-UC52)
| ID | Caso de Uso | Actores |
|----|-------------|---------|
| UC40 | Crear Venta | Admin, Cajero |
| UC41 | Procesar Pago | Admin, Cajero |
| UC42 | Agregar Producto al Carrito | Admin, Cajero |
| UC43 | Aplicar Descuento | Admin, Cajero |
| UC44 | Consultar Ventas | Admin, Cajero |
| UC45 | Ver Detalle de Venta | Admin, Cajero |
| UC46 | Cancelar Venta | Admin |
| UC47 | Pausar Venta | Admin, Cajero |
| UC48 | Reanudar Venta | Admin, Cajero |
| UC49 | Generar Recibo | Admin, Cajero |
| UC50 | Imprimir Recibo | Admin, Cajero |
| UC51 | Calcular Cambio | Admin, Cajero |
| UC52 | Validar Stock | Admin, Cajero |

### Módulo de Reportes (UC60-UC69)
| ID | Caso de Uso | Actores |
|----|-------------|---------|
| UC60 | Ver Dashboard | Todos |
| UC61 | Generar Reporte de Ventas | Admin |
| UC62 | Generar Reporte de Productos | Admin, Inventario |
| UC63 | Generar Reporte de Clientes | Admin |
| UC64 | Ver Estadísticas de Inventario | Admin, Inventario |
| UC65 | Filtrar Reporte por Fecha | Admin |
| UC66 | Exportar Reporte | Admin |
| UC67 | Ver Productos Más Vendidos | Admin |
| UC68 | Ver Alertas de Stock | Admin, Inventario |
| UC69 | Comparar Períodos | Admin |

### Módulo de Importaciones (UC80-UC83)
| ID | Caso de Uso | Actores |
|----|-------------|---------|
| UC80 | Descargar Plantilla | Admin, Inventario |
| UC81 | Importar Archivo Excel/CSV | Admin, Inventario |
| UC82 | Ver Estado de Importación | Admin, Inventario |
| UC83 | Reintentar Fila Fallida | Admin, Inventario |

### Módulo de Configuración (UC70-UC77)
| ID | Caso de Uso | Actores |
|----|-------------|---------|
| UC70 | Configurar Empresa | Admin |
| UC71 | Configurar Impuestos | Admin |
| UC72 | Gestionar Usuarios | Admin |
| UC73 | Cambiar Tema | Todos |
| UC74 | Configurar Recibo | Admin |
| UC75 | Subir Logo Empresa | Admin |
| UC76 | Activar/Desactivar Usuario | Admin |
| UC77 | Asignar Roles | Admin |

## 🔑 Matriz de Permisos

| Funcionalidad | Administrador | Cajero | Usuario Inventario |
|--------------|---------------|--------|-------------------|
| **Autenticación** | Completo | Completo | Completo |
| **Productos** | CRUD | R | CRU |
| **Categorías** | CRUD | R | CRU |
| **Clientes** | CRUD | CRU | - |
| **Ventas** | CRUD | CR | - |
| **Reportes** | Todos | Dashboard | Inventario |
| **Importaciones** | Todos | - | CR |
| **Configuración** | Todos | Tema | Tema |

**Leyenda:** C=Crear, R=Leer, U=Actualizar, D=Eliminar

---

*Documentación generada para el proyecto de MeperPOS y Punto de Venta*
