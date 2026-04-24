# Checklist de Pruebas Manuales — Multi-Tenant Fases 0, 1 y 2

## Credenciales de Acceso

### SuperAdmin (acceso global)
| Campo | Valor |
|-------|-------|
| Email | `admin@sistema.com` |
| Password | `admin123` |
| Rol | SUPER_ADMIN |
| Organización | Ninguna (acceso a todas) |

### Administradores de Organización

| Organización | Plan | Email | Password | Rol |
|--------------|------|-------|----------|-----|
| **Cafetería Demo** | BASIC | `admin@cafeteria-demo.com` | `admin123` | OWNER (equivalente a ADMIN) |
| **Supermercado Demo** | PRO | `admin@supermercado-demo.com` | `admin123` | OWNER (equivalente a ADMIN) |

### Usuarios Miembros (Cajeros)

| Organización | Email | Password | Rol |
|--------------|-------|----------|-----|
| Cafetería Demo | `cajero1@<dominio-random>.com` | `cajero123` | MEMBER (equivalente a CASHIER) |
| Cafetería Demo | `cajero2@<dominio-random>.com` | `cajero123` | MEMBER (equivalente a CASHIER) |
| Cafetería Demo | `cajero3@<dominio-random>.com` | `cajero123` | MEMBER (equivalente a CASHIER) |
| Supermercado Demo | `cajero1@<dominio-random>.com` | `cajero123` | MEMBER (equivalente a CASHIER) |
| Supermercado Demo | `cajero2@<dominio-random>.com` | `cajero123` | MEMBER (equivalente a CASHIER) |
| Supermercado Demo | ... (hasta 5 cajeros) | `cajero123` | MEMBER (equivalente a CASHIER) |

> **Nota:** Los emails de los cajeros se generan con dominios aleatorios de faker. Si necesitás saber los emails exactos, consultá la base de datos con Prisma Studio (`npm run studio` en backend).

---

## Preparación

Antes de empezar las pruebas, asegurate de:

1. **Base de datos actualizada:**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

2. **Seed ejecutado:**
   ```bash
   cd backend
   npm run seed
   ```

3. **Servidores corriendo:**
   ```bash
   # Terminal 1 (Backend)
   cd backend
   npm run start:dev
   
   # Terminal 2 (Frontend)
   cd frontend
   npm run dev
   ```

4. **URLs:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001/api

---

## Pruebas de Fase 0 — Fundamentos del Tenant

### 1. Schema y Base de Datos

- [ ] **Verificar tablas creadas:** Abrir Prisma Studio (`npm run studio`) y confirmar que existen:
  - [ ] `Organization` (con campos: name, slug, status, plan, trialEndsAt, billingStatus, taxId, settings, active)
  - [ ] `User` (con campo `isSuperAdmin`)
  - [ ] `OrganizationUser` (con campos: role, isPrimaryOwner, invitedById, joinedAt)
  - [ ] `OrganizationSequence` (con campos: type, prefix, currentNumber, year)
  - [ ] `RefreshToken` (con campos: token, expiresAt, revokedAt)

- [ ] **Verificar enums:**
  - [ ] `OrgStatus`: TRIAL, ACTIVE, PAST_DUE, SUSPENDED
  - [ ] `PlanType`: BASIC, PRO
  - [ ] `BillingStatus`: PENDING, PAID, OVERDUE
  - [ ] `OrgRole`: OWNER, ADMIN, MEMBER, CASHIER, INVENTORY_USER

### 2. Seed de Datos

- [ ] **Verificar SuperAdmin creado:** En Prisma Studio, buscar User con email `admin@sistema.com` y confirmar que `isSuperAdmin = true`.
- [ ] **Verificar organizaciones demo:** Confirmar que existen 2 organizaciones:
  - [ ] "Cafetería Demo" (plan: BASIC, status: ACTIVE, billingStatus: PAID)
  - [ ] "Supermercado Demo" (plan: PRO, status: ACTIVE, billingStatus: PAID)
- [ ] **Verificar admins de org:** Confirmar que cada org tiene un OrganizationUser con role = OWNER e isPrimaryOwner = true.
- [ ] **Verificar secuencias:** Cada org debe tener 2 OrganizationSequence (SALE y PO).
- [ ] **Verificar usuarios miembros:** Cafetería tiene 3 cajeros, Supermercado tiene 5.

### 3. Auth — SuperAdmin

- [ ] **Login SuperAdmin:**
  - [ ] Ir a http://localhost:3000/login
  - [ ] Ingresar: `admin@sistema.com` / `admin123`
  - [ ] **Esperado:** Login exitoso, redirige a `/admin` (panel de SuperAdmin)
  - [ ] **Esperado:** NO debe requerir selección de organización

- [ ] **Token JWT de SuperAdmin:**
  - [ ] Abrir DevTools → Application → LocalStorage
  - [ ] Verificar que el token existe
  - [ ] Decodificar el token (jwt.io) y verificar que payload contiene:
    - [ ] `role: "SUPER_ADMIN"`
    - [ ] `organizationId: null`

### 4. Auth — Usuario Normal

- [ ] **Login Admin de Org:**
  - [ ] Ir a http://localhost:3000/login
  - [ ] Ingresar: `admin@cafeteria-demo.com` / `admin123`
  - [ ] **Esperado:** Login exitoso, redirige a `/dashboard`
  - [ ] **Esperado:** Token JWT debe tener `organizationId` y `role: "OWNER"`

- [ ] **Login con organizationId explícito:**
  - [ ] Si el usuario pertenece a múltiples orgs, verificar que puede seleccionar org

---

## Pruebas de Fase 1 — Aislamiento de Datos

### 5. Aislamiento de Productos

- [ ] **Crear producto en Org A:**
  - [ ] Loguearse como `admin@cafeteria-demo.com`
  - [ ] Ir a Inventario → Crear Producto
  - [ ] Crear producto "Café Especial" con SKU `CAF-001`
  - [ ] **Esperado:** Producto creado exitosamente

- [ ] **Verificar que Org B no ve el producto:**
  - [ ] Loguearse como `admin@supermercado-demo.com`
  - [ ] Ir a Inventario
  - [ ] **Esperado:** "Café Especial" NO aparece en la lista
  - [ ] Buscar por SKU `CAF-001`
  - [ ] **Esperado:** No encontrado o vacío

- [ ] **Verificar que SuperAdmin no ve productos (por diseño):**
  - [ ] Loguearse como SuperAdmin
  - [ ] Ir a Inventario (si es accesible)
  - [ ] **Esperado:** Sin datos o redirección (SuperAdmin no tiene org asignada)

### 6. Aislamiento de Ventas

- [ ] **Crear venta en Org A:**
  - [ ] Loguearse como `admin@cafeteria-demo.com`
  - [ ] Ir a POS → Vender productos
  - [ ] Completar venta #1
  - [ ] **Esperado:** Venta creada con número de recibo (ej: REC-0001)

- [ ] **Verificar numeración por tenant:**
  - [ ] Loguearse como `admin@supermercado-demo.com`
  - [ ] Ir a POS → Crear venta
  - [ ] **Esperado:** Venta #1 también (numeración independiente por org)

- [ ] **Verificar que Org B no ve ventas de Org A:**
  - [ ] En Supermercado Demo, ir a Ventas
  - [ ] **Esperado:** Solo ventas de Supermercado Demo, ninguna de Cafetería Demo

### 7. Aislamiento de Clientes

- [ ] **Crear cliente en Org A:**
  - [ ] Loguearse como `admin@cafeteria-demo.com`
  - [ ] Ir a Clientes → Crear Cliente
  - [ ] Crear cliente "Juan Pérez" con documento `12345678`

- [ ] **Verificar aislamiento:**
  - [ ] Loguearse como `admin@supermercado-demo.com`
  - [ ] Ir a Clientes
  - [ ] **Esperado:** "Juan Pérez" NO aparece

### 8. Aislamiento de Categorías

- [ ] **Crear categoría en Org A:**
  - [ ] Loguearse como `admin@cafeteria-demo.com`
  - [ ] Ir a Categorías → Crear "Bebidas Calientes"

- [ ] **Verificar aislamiento:**
  - [ ] Loguearse como `admin@supermercado-demo.com`
  - [ ] Ir a Categorías
  - [ ] **Esperado:** "Bebidas Calientes" NO aparece

### 9. Cross-Tenant Security (CRÍTICO)

> **Advertencia:** Estas pruebas verifican que NO se pueda acceder a datos de otros tenants.

- [ ] **Intentar acceder a producto de otra org por ID:**
  - [ ] En Org A, obtener el ID de un producto (desde DevTools Network o UI)
  - [ ] En Org B, intentar usar ese ID para crear una venta
  - [ ] **Esperado:** Error 404 o "Product not found" (no debe permitir usar productos de otra org)

- [ ] **Intentar acceder a cliente de otra org por ID:**
  - [ ] Similar al anterior, pero con clientes
  - [ ] **Esperado:** Error o no encontrado

---

## Pruebas de Fase 2 — SuperAdmin & Onboarding

### 10. Panel SuperAdmin — Dashboard

- [ ] **Acceso al panel:**
  - [ ] Loguearse como `admin@sistema.com`
  - [ ] **Esperado:** Redirige a `/admin`
  - [ ] Verificar que se ven métricas:
    - [ ] Total de organizaciones (mínimo 2)
    - [ ] Organizaciones activas
    - [ ] Organizaciones en trial
    - [ ] Organizaciones suspendidas
    - [ ] Total de usuarios
    - [ ] Organizaciones por plan (BASIC, PRO)

- [ ] **Navegación:**
  - [ ] Hacer clic en "Gestionar Organizaciones"
  - [ ] **Esperado:** Navega a `/admin/organizations`

### 11. Panel SuperAdmin — Listado de Organizaciones

- [ ] **Ver listado:**
  - [ ] En `/admin/organizations`, verificar tabla con:
    - [ ] Nombre de cada org
    - [ ] Slug
    - [ ] Status (badge: ACTIVE, TRIAL, etc.)
    - [ ] Plan (badge: BASIC, PRO)
    - [ ] Cantidad de usuarios
    - [ ] Fecha de creación
    - [ ] Acciones (Ver detalle, Cambiar status, Cambiar plan)

- [ ] **Crear nueva organización:**
  - [ ] Hacer clic en "Crear Organización"
  - [ ] Completar formulario:
    - [ ] Nombre: "Tienda de Prueba"
    - [ ] Slug: `tienda-prueba`
    - [ ] Plan: BASIC
    - [ ] Admin: nombre "Carlos Test", email `carlos@test.com`
  - [ ] Enviar
  - [ ] **Esperado:** Organización creada, aparece en la lista
  - [ ] **Esperado:** Se muestra password temporal (solo UNA vez)
  - [ ] **Guardar password temporal mostrado**

- [ ] **Crear org con email existente:**
  - [ ] Intentar crear org con admin `carlos@test.com` (mismo email)
  - [ ] **Esperado:** Mensaje indicando que se reutilizó el usuario existente

- [ ] **Crear org con slug duplicado:**
  - [ ] Intentar crear org con slug `tienda-prueba`
  - [ ] **Esperado:** Error "Organization slug already exists"

### 12. Panel SuperAdmin — Detalle de Organización

- [ ] **Ver detalle:**
  - [ ] Hacer clic en "Ver" de una organización
  - [ ] **Esperado:** Página de detalle con:
    - [ ] Información general (nombre, slug, status, plan)
    - [ ] Fechas (creada, trialEndsAt si aplica)
    - [ ] Datos de facturación (billingStatus, taxId)
    - [ ] Lista de usuarios (nombre, email, rol)
    - [ ] Secuencias (SALE, PO)

- [ ] **Cambiar status:**
  - [ ] En detalle de org, cambiar status a SUSPENDED
  - [ ] **Esperado:** Status actualizado
  - [ ] **Esperado:** Tokens de todos los usuarios de esa org revocados

- [ ] **Cambiar plan:**
  - [ ] Cambiar plan de BASIC a PRO
  - [ ] **Esperado:** Plan actualizado

### 13. Verificar Suspensión de Organización

- [ ] **Suspender org:**
  - [ ] Como SuperAdmin, suspender "Tienda de Prueba"

- [ ] **Intentar login con usuario de org suspendida:**
  - [ ] Intentar loguearse con `carlos@test.com`
  - [ ] **Esperado:** Error "Invalid credentials" o "Organization suspended" (el token fue revocado)

- [ ] **Reactivar org:**
  - [ ] Como SuperAdmin, cambiar status a ACTIVE
  - [ ] Intentar login nuevamente
  - [ ] **Esperado:** Login exitoso

### 14. Reglas de Negocio — Usuarios

- [ ] **No eliminar último ADMIN:**
  - [ ] Loguearse como admin de una org con un solo ADMIN
  - [ ] Ir a Usuarios → intentar eliminar el único admin
  - [ ] **Esperado:** Error "Cannot remove the last admin of an organization"

- [ ] **No eliminar primary owner:**
  - [ ] Intentar eliminar el usuario con isPrimaryOwner = true
  - [ ] **Esperado:** Error "Cannot remove the primary owner. Transfer ownership first."

- [ ] **No auto-eliminación:**
  - [ ] Intentar eliminar tu propia cuenta
  - [ ] **Esperado:** Error "Admins cannot delete their own account"

### 15. Protección de Rutas

- [ ] **Usuario normal intenta acceder a /admin:**
  - [ ] Loguearse como `admin@cafeteria-demo.com`
  - [ ] Navegar manualmente a http://localhost:3000/admin
  - [ ] **Esperado:** Redirección a `/dashboard` o mensaje de acceso denegado

- [ ] **API sin autenticación:**
  - [ ] Hacer POST a http://localhost:3001/api/admin/organizations sin token
  - [ ] **Esperado:** Error 401 Unauthorized

- [ ] **API con usuario normal:**
  - [ ] Hacer POST a http://localhost:3001/api/admin/organizations con token de admin de org
  - [ ] **Esperado:** Error 403 Forbidden

---

## Pruebas de Regresión (Funcionalidades existentes)

### 16. CRUD Básico

- [ ] **Productos:** Crear, leer, actualizar, eliminar producto
- [ ] **Categorías:** Crear, leer, actualizar, eliminar categoría
- [ ] **Clientes:** Crear, leer, actualizar, eliminar cliente
- [ ] **Proveedores:** Crear, leer, actualizar, eliminar proveedor
- [ ] **Ventas:** Crear venta, ver detalle, cancelar
- [ ] **Órdenes de Compra:** Crear OC, recibir, cancelar

### 17. Reportes

- [ ] **Dashboard:** Ver métricas del dashboard
- [ ] **Reportes:** Generar reportes de ventas, inventario

### 18. Perfil y Configuración

- [ ] **Perfil:** Actualizar nombre y email
- [ ] **Cambiar password:** Cambiar contraseña actual
- [ ] **Configuración:** Ver/actualizar settings de la organización

---

## Reporte de Issues

Si encontrás algún bug durante las pruebas, documentalo acá:

| # | Descripción | Pasos para reproducir | Resultado esperado | Resultado actual | Severidad |
|---|-------------|----------------------|-------------------|------------------|-----------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

---

## Checklist Final

- [ ] Todas las pruebas de Fase 0 pasaron
- [ ] Todas las pruebas de Fase 1 pasaron
- [ ] Todas las pruebas de Fase 2 pasaron
- [ ] No se encontraron bugs críticos
- [ ] Bugs encontrados documentados en tabla de issues

**Fecha de prueba:** ___________
**Tester:** ___________
**Resultado general:** ✅ PASS / ❌ FAIL

---

## Notas Adicionales

- **Prisma Studio:** Para inspeccionar la BD, correr `npm run studio` en backend/
- **Logs del backend:** Revisar la terminal donde corre `npm run start:dev` para ver errores del servidor
- **DevTools:** Usar Chrome DevTools → Network para ver las llamadas API y sus respuestas
- **LocalStorage:** Verificar token JWT en Application → LocalStorage → `token`

> **Recordá:** Si el seed se corre de nuevo, los datos de faker (nombres de cajeros, clientes, etc.) pueden cambiar, pero las credenciales de admin y SuperAdmin se mantienen.
