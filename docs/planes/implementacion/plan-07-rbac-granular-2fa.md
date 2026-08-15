# Plan 07 — RBAC granular + 2FA + endurecimiento de autenticación

> [!IMPORTANT]
> **Cambio en el núcleo de autenticación y autorización.** Reemplaza el `enum Role` hardcodeado (ADMIN | CASHIER | INVENTORY_USER) por un modelo `Role` + `Permission` en DB. Agrega 2FA (TOTP + recovery codes), refresh tokens, políticas de contraseña y bloqueo por intentos fallidos. Toda la aplicación usa `JwtAuthGuard + RolesGuard` — cualquier regresión aquí afecta TODOS los endpoints.
>
> **Estimación: 60–80 horas. Proyecto de 1.5–2 meses calendario. La migración enum → FK es el paso más riesgoso.**

---

## 1. Contexto y Motivación

### 1.1 Estado actual

- `User.role` es un enum Postgres con 3 valores fijos: `ADMIN`, `CASHIER`, `INVENTORY_USER`.
- Permisos se chequean con `@Roles('ADMIN', 'CASHIER')` en controllers. El mapeo "qué puede hacer cada rol" está duplicado/disperso en decoradores de cada endpoint.
- JWT: access token largo (1 día típico), sin refresh token.
- Autenticación es email + password (bcrypt rounds=10).
- No hay 2FA, no hay política de contraseña, no hay lockout por intentos fallidos, no hay historial de contraseñas.
- JWT payload: `{ sub, email, role }` — cualquier cambio de permisos requiere esperar expiración (o forzar logout manual).

### 1.2 Problemas que resuelve

- **Permisos granulares**: "¿Puede este usuario anular ventas?", "¿Puede ver reportes financieros?", "¿Puede editar productos pero no crearlos?". Hoy esas decisiones son todo-o-nada por rol.
- **Segregación de funciones**: un gerente de local puede necesitar permisos que ADMIN tiene y CASHIER no, sin darle acceso total.
- **Creación de roles custom**: el dueño quiere un rol "Supervisor" con mezcla de permisos. Hoy requiere cambio de código.
- **Auditoría y compliance**: regulaciones (ISO 27001, política de datos del negocio) exigen 2FA para roles privilegiados.
- **Credenciales filtradas**: sin 2FA, password leak = acceso total.
- **Revocación inmediata**: con refresh tokens cortos + lista de revocación, un despido toma efecto en minutos.

### 1.3 Fuera de alcance

- SSO / SAML / OIDC con Google/Microsoft — otro plan.
- WebAuthn / passkeys — otro plan.
- Magic link sin password — otro plan.
- Audit log extendido con diff de permisos — parcialmente cubierto por AuditLog existente.
- MFA por SMS (desaconsejado por SIM swapping; usar TOTP).

---

## 2. Decisiones de Arquitectura

### 2.1 Modelo de permisos: Role + Permission + RolePermission

Tabla `Permission` con `code` único (ej: `sales:create`, `sales:cancel`, `reports:view-financial`). Tabla `Role` reemplaza al enum, con `code` (ej: `ADMIN`, `CASHIER`). Tabla pivot `RolePermission`.

`User.roleId` apunta a `Role.id` (FK). El enum queda eliminado.

Seed inicial replica los 3 roles actuales con sus permisos implícitos para no romper nada.

### 2.2 DECISIÓN CRÍTICA: ¿permisos en JWT o lookup en DB?

| Opción | Pros | Contras |
|---|---|---|
| **A — Embed permissions en JWT** (`{ sub, email, role, permissions: [...] }`) | Zero DB lookup por request. Rápido. | JWT invalidation imposible hasta expirar. Revocación tarda hasta 1 día. |
| **B — Lookup en DB por request** | Siempre actualizado. Revocación inmediata. | DB hit por request autenticado. |
| **C (elegida) — JWT con roleId + cache in-memory de permisos** | Solo DB miss cuando no está en cache (TTL 5 min). Revocación en ≤ 5 min (o invalidación explícita). | Complejidad media. |

**Decisión adoptada: Opción C — JWT lleva solo `{ sub, email, roleId }`. Los permisos se cargan desde el `CacheService` existente (`backend/src/common/services/cache.service.ts`) con TTL 5 min y cache key `permissions:{userId}`. Se invalida explícitamente al cambiar permisos del rol o cambiar rol del usuario.**

Justificación: el proyecto ya tiene `CacheService` (Map en memoria). Agregar DB lookup sin cache agregaría ~20ms por request con ~500 permisos; con cache es ~0. JWT con permissions embedded hace imposible revocar sin esperar la expiración — inaceptable en producción.

### 2.3 Access token + Refresh token

- **Access token**: JWT firmado, TTL 15 minutos. Lleva `{ sub, email, roleId, tokenVersion }`.
- **Refresh token**: JWT firmado con secret DISTINTO, TTL 7 días. Almacenado también en tabla `RefreshToken` con flag `revoked`.
- Endpoint `POST /auth/refresh` intercambia refresh → nuevo access (+ nuevo refresh con rotación).
- **Rotación de refresh tokens**: cada uso invalida el refresh anterior y emite uno nuevo (previene replay si se filtra uno).
- Logout: setea `revoked=true` en el refresh token activo e incrementa `User.tokenVersion` para invalidar todos los access tokens emitidos.

### 2.4 2FA con TOTP (otplib)

- Librería: **`otplib`** v12 (RFC 6238, TypeScript-native, mantenida activamente). No usar `speakeasy`.
- Secret TOTP (16–32 bytes) cifrado con AES-256-GCM con clave del `ENCRYPTION_KEY` env var. Almacenado en `TwoFactorAuth.secretCipher`.
- QR generado con `qrcode` npm lib al activar (mostrar una sola vez).
- Recovery codes: 10 UUIDs v4, hasheados con bcrypt antes de guardar. Se le muestran una sola vez al usuario. Se pueden regenerar (invalida los anteriores).
- Flujo login con 2FA: email + password → si `user.twoFactorEnabled=true`, el backend responde `{ requires2FA: true, preAuthToken }`. Frontend pide el TOTP 6-digit → `POST /auth/2fa/verify { preAuthToken, code }` → emite access + refresh.
- El `preAuthToken` es un JWT corto (2 min, secret distinto) para evitar ataques de reemplazo.
- **2FA obligatorio para `ADMIN`**. Opcional para otros roles (con toggle en perfil).

### 2.5 Política de contraseña

- Mínimo 10 caracteres.
- Al menos 1 mayúscula, 1 minúscula, 1 dígito, 1 símbolo.
- No puede coincidir con las últimas 5 contraseñas (`PasswordHistory` con bcrypt hashes).
- Validación cliente + servidor (zod schema compartido).
- Expiración: no implementar rotación forzada (práctica obsoleta según NIST SP 800-63B).

### 2.6 Lockout por intentos fallidos

- Tabla `LoginAttempt` con `email`, `ip`, `success`, `createdAt`.
- Si `count(LoginAttempt WHERE email=X AND success=false AND createdAt > now()-15min) >= 5` → cuenta bloqueada 15 min.
- El response del endpoint de login NO distingue entre "password incorrecta" vs "cuenta bloqueada" (evita enumeration) — siempre 401.
- Unlock automático después de 15 min. Admin puede unlock manual via `POST /users/:id/unlock`.
- Lock attempts por IP también (rate limiting con `@nestjs/throttler` ya presente).

---

## 3. Modelo de Datos

### 3.1 Nuevos modelos

```prisma
model Role {
  id             String            @id @default(uuid())
  code           String            @unique   // "ADMIN", "CASHIER", "INVENTORY_USER", "SUPERVISOR"
  name           String
  description    String?
  isSystem       Boolean           @default(false)   // true para los 3 originales; no se pueden borrar
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  users          User[]
  permissions    RolePermission[]
}

model Permission {
  id             String            @id @default(uuid())
  code           String            @unique   // "sales:create", "products:delete"
  resource       String            // "sales", "products", "reports"
  action         String            // "create", "read", "update", "delete", "cancel", "view-financial"
  description    String?

  roles          RolePermission[]

  @@index([resource])
  @@index([action])
}

model RolePermission {
  roleId        String
  role          Role         @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permissionId  String
  permission    Permission   @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  grantedAt     DateTime     @default(now())
  grantedById   String?

  @@id([roleId, permissionId])
  @@index([permissionId])
}

model TwoFactorAuth {
  id            String    @id @default(uuid())
  userId        String    @unique
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  secretCipher  String    // AES-256-GCM ciphertext del TOTP secret
  enabled       Boolean   @default(false)
  verifiedAt    DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model RecoveryCode {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash    String    // bcrypt
  usedAt      DateTime?

  @@index([userId])
}

model RefreshToken {
  id            String     @id @default(uuid())
  userId        String
  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash     String     @unique   // SHA-256 del JWT (no guardar el JWT en claro)
  userAgent     String?
  ip            String?
  expiresAt     DateTime
  revoked       Boolean    @default(false)
  revokedAt     DateTime?
  replacedById  String?    // para trazar la cadena de rotación
  createdAt     DateTime   @default(now())

  @@index([userId])
  @@index([tokenHash])
  @@index([revoked, expiresAt])
}

model PasswordHistory {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  passwordHash String
  createdAt   DateTime  @default(now())

  @@index([userId, createdAt])
}

model LoginAttempt {
  id          String    @id @default(uuid())
  email       String
  ip          String?
  userAgent   String?
  success     Boolean
  reason      String?   // "invalid_password", "2fa_invalid", "account_locked", etc.
  createdAt   DateTime  @default(now())

  @@index([email, createdAt])
  @@index([ip, createdAt])
}
```

### 3.2 Modificaciones a User

```prisma
model User {
  id                  String         @id @default(uuid())
  email               String         @unique
  password            String
  name                String
  // role             Role           ← ELIMINAR el campo enum
  roleId              String
  role                Role           @relation(fields: [roleId], references: [id])

  twoFactorEnabled    Boolean        @default(false)
  tokenVersion        Int            @default(0)   // incrementa para invalidar todos los access tokens
  lockedUntil         DateTime?
  passwordChangedAt   DateTime       @default(now())

  twoFactorAuth       TwoFactorAuth?
  recoveryCodes       RecoveryCode[]
  refreshTokens       RefreshToken[]
  passwordHistory     PasswordHistory[]

  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt
}
```

### 3.3 Migración enum → FK (paso crítico)

Dividir en 3 migraciones secuenciales:

**Migración 1: `feat-rbac-tables-create`** (no destructiva)

```sql
CREATE TABLE "Role" (...);
CREATE TABLE "Permission" (...);
CREATE TABLE "RolePermission" (...);
CREATE TABLE "TwoFactorAuth" (...);
CREATE TABLE "RecoveryCode" (...);
CREATE TABLE "RefreshToken" (...);
CREATE TABLE "PasswordHistory" (...);
CREATE TABLE "LoginAttempt" (...);

ALTER TABLE "User" ADD COLUMN "roleId" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP;
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP NOT NULL DEFAULT now();
```

**Script de backfill** `backend/prisma/migrations/[ts]_feat_rbac_tables_create/backfill.ts`:

```typescript
// 1) Crear roles system con mismos codes que el enum actual
const adminRole = await prisma.role.create({
  data: { code: 'ADMIN', name: 'Administrador', isSystem: true },
});
const cashierRole = await prisma.role.create({
  data: { code: 'CASHIER', name: 'Cajero', isSystem: true },
});
const invRole = await prisma.role.create({
  data: { code: 'INVENTORY_USER', name: 'Inventario', isSystem: true },
});

// 2) Insertar todos los permissions
const permissions = [
  { code: 'products:create', resource: 'products', action: 'create' },
  { code: 'products:read',   resource: 'products', action: 'read'   },
  { code: 'products:update', resource: 'products', action: 'update' },
  { code: 'products:delete', resource: 'products', action: 'delete' },
  { code: 'sales:create',    resource: 'sales',    action: 'create' },
  { code: 'sales:read',      resource: 'sales',    action: 'read'   },
  { code: 'sales:cancel',    resource: 'sales',    action: 'cancel' },
  { code: 'sales:refund',    resource: 'sales',    action: 'refund' },
  { code: 'customers:create',resource: 'customers',action: 'create' },
  { code: 'customers:read',  resource: 'customers',action: 'read'   },
  { code: 'customers:update',resource: 'customers',action: 'update' },
  { code: 'customers:delete',resource: 'customers',action: 'delete' },
  { code: 'reports:view',    resource: 'reports',  action: 'view'   },
  { code: 'reports:view-financial', resource: 'reports', action: 'view-financial' },
  { code: 'users:manage',    resource: 'users',    action: 'manage' },
  { code: 'roles:manage',    resource: 'roles',    action: 'manage' },
  { code: 'settings:manage', resource: 'settings', action: 'manage' },
  { code: 'suppliers:manage',resource: 'suppliers',action: 'manage' },
  { code: 'purchase-orders:manage', resource: 'purchase-orders', action: 'manage' },
  { code: 'inventory:adjust',resource: 'inventory',action: 'adjust' },
  { code: 'tasks:manage',    resource: 'tasks',    action: 'manage' },
];
await prisma.permission.createMany({ data: permissions });

// 3) Asignar permissions a roles (replicar comportamiento actual)
const all = await prisma.permission.findMany();
const toCode = (p: string) => all.find(x => x.code === p)!.id;

const adminPerms = all.map(p => ({ roleId: adminRole.id, permissionId: p.id }));
const cashierPerms = [
  'sales:create', 'sales:read', 'products:read', 'customers:create',
  'customers:read', 'customers:update',
].map(c => ({ roleId: cashierRole.id, permissionId: toCode(c) }));
const invPerms = [
  'products:create', 'products:read', 'products:update',
  'inventory:adjust', 'suppliers:manage', 'purchase-orders:manage', 'tasks:manage',
].map(c => ({ roleId: invRole.id, permissionId: toCode(c) }));

await prisma.rolePermission.createMany({ data: adminPerms });
await prisma.rolePermission.createMany({ data: cashierPerms });
await prisma.rolePermission.createMany({ data: invPerms });

// 4) Backfill User.roleId desde User.role enum
await prisma.$executeRaw`
  UPDATE "User" SET "roleId" = CASE "role"
    WHEN 'ADMIN' THEN ${adminRole.id}
    WHEN 'CASHIER' THEN ${cashierRole.id}
    WHEN 'INVENTORY_USER' THEN ${invRole.id}
  END
  WHERE "roleId" IS NULL
`;
```

Correr:
```bash
cd backend
npx prisma migrate dev --name feat-rbac-tables-create
npx ts-node prisma/migrations/[ts]_feat_rbac_tables_create/backfill.ts
```

**Migración 2: `feat-rbac-finalize`** (post-backfill)

```sql
ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id");
```

**Migración 3: `feat-rbac-drop-enum`** (destructiva, después de validar en staging)

```sql
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role";   -- droppear el enum Postgres
```

> [!IMPORTANT]
> **La migración 3 no tiene rollback simple.** Solo ejecutar después de validar en staging que todo el sistema funciona con roleId. Hacer backup de DB antes.

---

## 4. Backend — Cambios

### 4.1 Nuevos módulos

```
backend/src/roles/
├── dto/
│   ├── create-role.dto.ts
│   ├── update-role.dto.ts
│   └── assign-permissions.dto.ts
├── roles.controller.ts
├── roles.service.ts
└── roles.module.ts

backend/src/permissions/
├── permissions.controller.ts    // solo GET
├── permissions.service.ts
└── permissions.module.ts

backend/src/auth/
├── 2fa/
│   ├── two-factor.service.ts
│   ├── two-factor.controller.ts   // /auth/2fa/setup, /verify, /disable, /recovery-codes
│   └── two-factor.module.ts
├── refresh-token.service.ts
├── password-policy.service.ts
├── login-attempts.service.ts
└── (archivos existentes modificados: auth.service.ts, auth.controller.ts, jwt.strategy.ts, jwt-auth.guard.ts, roles.guard.ts)
```

### 4.2 PermissionsGuard (reemplaza RolesGuard)

```typescript
// backend/src/common/guards/permissions.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../services/cache.service';
import { PrismaService } from '../../prisma/prisma.service';

export const REQUIRE_PERMISSIONS_KEY = 'requirePermissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private cache: CacheService,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const userId = req.user?.sub;
    if (!userId) return false;

    const userPerms = await this.getUserPermissions(userId);
    return required.every(p => userPerms.has(p));
  }

  private async getUserPermissions(userId: string): Promise<Set<string>> {
    const key = `permissions:${userId}`;
    const cached = this.cache.get<Set<string>>(key);
    if (cached) return cached;

    const rows = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: {
          select: {
            permissions: { select: { permission: { select: { code: true } } } },
          },
        },
      },
    });
    const set = new Set<string>(
      rows?.role.permissions.map(rp => rp.permission.code) ?? []
    );
    this.cache.set(key, set, 5 * 60 * 1000); // 5 min TTL
    return set;
  }
}
```

### 4.3 Decorator RequirePermissions

```typescript
// backend/src/common/decorators/require-permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { REQUIRE_PERMISSIONS_KEY } from '../guards/permissions.guard';

export const RequirePermissions = (...perms: string[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, perms);
```

### 4.4 Migrar controllers: `@Roles(...)` → `@RequirePermissions(...)`

Cada controller que hoy usa `@Roles('ADMIN')` debe convertirse a `@RequirePermissions('sales:cancel')` (o el permiso relevante).

**Estrategia de migración con compatibilidad:** mantener `@Roles` funcionando durante la transición. Crear un `RolesGuard` que resuelve `role.code` y sigue funcionando como antes. Nuevo código usa `@RequirePermissions`. Migración gradual de todos los endpoints en Phase D.

Ejemplo:

```typescript
// ANTES
@Post('cancel/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
cancelSale() {}

// DESPUÉS
@Post('cancel/:id')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('sales:cancel')
cancelSale() {}
```

### 4.5 Invalidación de cache al cambiar permisos

```typescript
// RolesService.assignPermissions
async assignPermissions(roleId: string, permissionIds: string[]) {
  await this.prisma.$transaction([
    this.prisma.rolePermission.deleteMany({ where: { roleId } }),
    this.prisma.rolePermission.createMany({
      data: permissionIds.map(pid => ({ roleId, permissionId: pid })),
    }),
  ]);

  // Invalidar cache para todos los usuarios con este rol
  const users = await this.prisma.user.findMany({
    where: { roleId },
    select: { id: true },
  });
  for (const u of users) this.cache.delete(`permissions:${u.id}`);
}
```

### 4.6 AuthService — login con 2FA

```typescript
async login(dto: LoginDto, ip: string, userAgent?: string) {
  const user = await this.prisma.user.findUnique({
    where: { email: dto.email },
    include: { role: true, twoFactorAuth: true },
  });

  // Lockout check
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await this.attempts.record(dto.email, ip, false, 'account_locked', userAgent);
    throw new UnauthorizedException('Credenciales inválidas');  // misma respuesta
  }

  if (!user || !(await bcrypt.compare(dto.password, user.password))) {
    await this.attempts.record(dto.email, ip, false, 'invalid_password', userAgent);
    await this.lockoutIfNeeded(dto.email, user?.id);
    throw new UnauthorizedException('Credenciales inválidas');
  }

  if (user.twoFactorEnabled) {
    const preAuthToken = this.jwt.sign(
      { sub: user.id, stage: 'pre-2fa' },
      { secret: this.config.get('PRE_AUTH_SECRET'), expiresIn: '2m' },
    );
    return { requires2FA: true, preAuthToken };
  }

  return this.issueTokens(user, ip, userAgent);
}

async verify2FA(preAuthToken: string, code: string, ip: string, userAgent?: string) {
  const payload = this.jwt.verify(preAuthToken, {
    secret: this.config.get('PRE_AUTH_SECRET'),
  });
  if (payload.stage !== 'pre-2fa') throw new UnauthorizedException();

  const user = await this.prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: true, twoFactorAuth: true, recoveryCodes: true },
  });
  if (!user?.twoFactorAuth?.enabled) throw new UnauthorizedException();

  // Check TOTP primero
  const secret = this.crypto.decrypt(user.twoFactorAuth.secretCipher);
  const valid = authenticator.verify({ token: code, secret });

  if (!valid) {
    // Fallback: recovery code
    const unusedCodes = user.recoveryCodes.filter(c => c.usedAt === null);
    let recoveryMatch = null;
    for (const rc of unusedCodes) {
      if (await bcrypt.compare(code, rc.codeHash)) { recoveryMatch = rc; break; }
    }
    if (!recoveryMatch) {
      await this.attempts.record(user.email, ip, false, '2fa_invalid', userAgent);
      throw new UnauthorizedException('Código inválido');
    }
    await this.prisma.recoveryCode.update({
      where: { id: recoveryMatch.id },
      data: { usedAt: new Date() },
    });
  }

  return this.issueTokens(user, ip, userAgent);
}

private async issueTokens(user: UserWithRole, ip: string, userAgent?: string) {
  const access = this.jwt.sign(
    { sub: user.id, email: user.email, roleId: user.roleId, tokenVersion: user.tokenVersion },
    { expiresIn: '15m' },
  );
  const refreshRaw = crypto.randomBytes(48).toString('hex');
  const refreshHash = crypto.createHash('sha256').update(refreshRaw).digest('hex');
  const refresh = this.jwt.sign(
    { sub: user.id, jti: refreshHash },
    { secret: this.config.get('REFRESH_SECRET'), expiresIn: '7d' },
  );

  await this.prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshHash,
      userAgent,
      ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await this.attempts.record(user.email, ip, true, null, userAgent);
  return { access, refresh, user: this.sanitize(user) };
}
```

### 4.7 Endpoints nuevos

| Method | Path | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/refresh` | refresh token | Intercambia refresh → access+refresh nuevos, rota |
| POST | `/api/auth/logout` | access token | Revoca refresh actual, increment tokenVersion |
| POST | `/api/auth/logout-all` | access token | Revoca TODOS los refresh + increment tokenVersion |
| POST | `/api/auth/2fa/setup` | access token | Devuelve `{ otpauthUrl, qrDataUrl }`; genera secret |
| POST | `/api/auth/2fa/verify` | access token | Verifica primer código; activa 2FA; devuelve recoveryCodes |
| POST | `/api/auth/2fa/disable` | access token + password | Desactiva 2FA |
| POST | `/api/auth/2fa/recovery-codes/regenerate` | access token + password | Regenera 10 códigos nuevos |
| POST | `/api/auth/2fa/login` | pre-auth token | Segundo paso del login |
| GET | `/api/permissions` | ADMIN | Lista todos los permissions |
| GET | `/api/roles` | ADMIN | Lista roles |
| POST | `/api/roles` | ADMIN + `roles:manage` | Crear rol custom |
| PATCH | `/api/roles/:id` | ADMIN + `roles:manage` | Editar rol (no system) |
| DELETE | `/api/roles/:id` | ADMIN + `roles:manage` | Eliminar rol (no system, sin users) |
| PUT | `/api/roles/:id/permissions` | ADMIN + `roles:manage` | Asignar/reasignar permissions |
| POST | `/api/users/:id/unlock` | ADMIN + `users:manage` | Quita lockout |
| POST | `/api/users/:id/force-logout` | ADMIN + `users:manage` | Incrementa tokenVersion |

### 4.8 Two-factor service

```typescript
// backend/src/auth/2fa/two-factor.service.ts
import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TwoFactorService {
  constructor(
    private prisma: PrismaService,
    private cryptoSvc: CryptoService,
    private config: ConfigService,
  ) {}

  async setup(userId: string, userEmail: string) {
    const secret = authenticator.generateSecret();
    const cipher = this.cryptoSvc.encrypt(secret);
    await this.prisma.twoFactorAuth.upsert({
      where: { userId },
      update: { secretCipher: cipher, enabled: false },
      create: { userId, secretCipher: cipher, enabled: false },
    });

    const appName = this.config.get('APP_NAME') ?? 'Inventario';
    const otpauth = authenticator.keyuri(userEmail, appName, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    return { otpauthUrl: otpauth, qrDataUrl };
  }

  async verifyAndActivate(userId: string, code: string) {
    const tfa = await this.prisma.twoFactorAuth.findUniqueOrThrow({ where: { userId } });
    const secret = this.cryptoSvc.decrypt(tfa.secretCipher);
    if (!authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException('Código inválido');
    }
    await this.prisma.twoFactorAuth.update({
      where: { userId },
      data: { enabled: true, verifiedAt: new Date() },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
    return this.regenerateRecoveryCodes(userId);
  }

  async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    await this.prisma.recoveryCode.deleteMany({ where: { userId } });
    const codes = Array.from({ length: 10 }, () =>
      crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
    );
    await this.prisma.recoveryCode.createMany({
      data: await Promise.all(
        codes.map(async c => ({
          userId,
          codeHash: await bcrypt.hash(c, 10),
        })),
      ),
    });
    return codes;  // se muestran UNA VEZ; el usuario debe guardarlos
  }

  async disable(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!await bcrypt.compare(password, user.password)) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }
    if (user.role && (await this.prisma.role.findUnique({ where: { id: user.roleId } }))?.code === 'ADMIN') {
      throw new BadRequestException('ADMIN no puede desactivar 2FA');
    }
    await this.prisma.twoFactorAuth.delete({ where: { userId } });
    await this.prisma.recoveryCode.deleteMany({ where: { userId } });
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false },
    });
  }
}
```

### 4.9 PasswordPolicyService + zod schema

```typescript
// backend/src/auth/password-policy.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const MIN_LENGTH = 10;
const HISTORY_COUNT = 5;

@Injectable()
export class PasswordPolicyService {
  constructor(private prisma: PrismaService) {}

  validate(password: string): void {
    const errors: string[] = [];
    if (password.length < MIN_LENGTH) errors.push(`Mínimo ${MIN_LENGTH} caracteres`);
    if (!/[A-Z]/.test(password)) errors.push('Al menos 1 mayúscula');
    if (!/[a-z]/.test(password)) errors.push('Al menos 1 minúscula');
    if (!/[0-9]/.test(password)) errors.push('Al menos 1 dígito');
    if (!/[^A-Za-z0-9]/.test(password)) errors.push('Al menos 1 símbolo');
    if (errors.length) throw new BadRequestException(errors.join('. '));
  }

  async ensureNotInHistory(userId: string, newPassword: string): Promise<void> {
    const history = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_COUNT,
    });
    for (const h of history) {
      if (await bcrypt.compare(newPassword, h.passwordHash)) {
        throw new BadRequestException(
          `No puede repetir las últimas ${HISTORY_COUNT} contraseñas`
        );
      }
    }
  }

  async recordHash(userId: string, hash: string): Promise<void> {
    await this.prisma.passwordHistory.create({
      data: { userId, passwordHash: hash },
    });
    // Limpiar historial excedente
    const old = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: HISTORY_COUNT,
    });
    if (old.length) {
      await this.prisma.passwordHistory.deleteMany({
        where: { id: { in: old.map(h => h.id) } },
      });
    }
  }
}
```

### 4.10 CryptoService — AES-256-GCM

```typescript
// backend/src/common/services/crypto.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(private config: ConfigService) {
    const hex = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    if (hex.length !== 64) throw new Error('ENCRYPTION_KEY must be 32 bytes hex (64 chars)');
    this.key = Buffer.from(hex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, tagHex, dataHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}
```

### 4.11 JwtStrategy — check tokenVersion

```typescript
// backend/src/auth/jwt.strategy.ts — MODIFY
async validate(payload: { sub: string; tokenVersion: number }) {
  const user = await this.prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: true },
  });
  if (!user) throw new UnauthorizedException();
  if (user.tokenVersion !== payload.tokenVersion) {
    throw new UnauthorizedException('Sesión invalidada');
  }
  return { sub: user.id, email: user.email, roleId: user.roleId, tokenVersion: user.tokenVersion };
}
```

---

## 5. Frontend

### 5.1 Login con 2FA

#### [MODIFY] `frontend/src/app/login/page.tsx`

Estado: `step: 'credentials' | '2fa'`. Primer submit con email+password. Si response tiene `requires2FA`, cambiar a step `2fa` con input de 6 dígitos + link "Usar código de recuperación". Segundo submit a `/auth/2fa/login` con `preAuthToken + code`.

### 5.2 AuthContext — refresh automático

#### [MODIFY] `frontend/src/contexts/AuthContext.tsx`

- Guarda `access` y `refresh` en memoria (o `access` en memoria + `refresh` en httpOnly cookie si el backend lo soporta; por ahora localStorage para simplicidad).
- Interceptor de response en `api.ts`: si recibe 401 con código `TOKEN_EXPIRED`, llama `/auth/refresh`, actualiza tokens y reintenta la request.
- Si `/auth/refresh` falla → logout.

```typescript
// frontend/src/lib/api.ts — MODIFY
let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  r => r,
  async (err: AxiosError) => {
    const original = err.config!;
    if (err.response?.status === 401 && !(original as any)._retry) {
      (original as any)._retry = true;
      try {
        refreshPromise = refreshPromise ?? refreshAccessToken();
        const newAccess = await refreshPromise;
        refreshPromise = null;
        original.headers!.Authorization = `Bearer ${newAccess}`;
        return api.request(original);
      } catch (e) {
        refreshPromise = null;
        logout();
        window.location.href = '/login';
        return Promise.reject(e);
      }
    }
    return Promise.reject(err);
  },
);
```

### 5.3 Páginas nuevas

#### [CREATE] `frontend/src/app/profile/security/page.tsx`

Sección "Seguridad" en el perfil:
- Toggle "Activar 2FA": abre modal con QR + input de verificación.
- Si activo: mostrar "Activo desde X" + botón "Ver códigos de recuperación" (requiere password) + "Desactivar".
- Cambio de contraseña con indicador de fortaleza (zod + regex).
- Lista de "Sesiones activas" (refresh tokens): user-agent, ip, last used. Botón "Revocar" por sesión + "Cerrar todas las sesiones".

#### [CREATE] `frontend/src/app/roles/page.tsx`

Lista de roles con CRUD (ADMIN + `roles:manage`). Al editar un rol: matriz de checkboxes con todos los permissions agrupados por `resource`. Warning si se edita un system role.

### 5.4 Componentes

- `frontend/src/components/auth/TwoFactorSetupModal.tsx` — flujo QR + input.
- `frontend/src/components/auth/RecoveryCodesModal.tsx` — muestra 10 códigos con botón "Copiar todos" y advertencia de guardarlos.
- `frontend/src/components/roles/PermissionMatrix.tsx` — grilla de checkboxes por `(resource, action)`.
- `frontend/src/components/auth/PasswordStrengthMeter.tsx` — medidor visual.
- `frontend/src/hooks/usePermissions.ts` — `hasPermission(code): boolean` consultando `user.permissions` (pre-cargado en login).

### 5.5 Protección condicional en UI

```typescript
// Uso en componentes:
const { hasPermission } = usePermissions();
return (
  <>
    {hasPermission('sales:cancel') && <Button onClick={handleCancel}>Anular</Button>}
  </>
);
```

#### [MODIFY] `frontend/src/components/layout/Sidebar.tsx`

El array `navItems` ya tiene `roles?: string[]`. Cambiar a `permissions?: string[]` y filtrar con `hasPermission`. Mantener retro-compat durante migración.

---

## 6. Dependencias NPM

### 6.1 Backend

```bash
cd backend
npm install otplib qrcode
npm install -D @types/qrcode
```

### 6.2 Frontend

```bash
cd frontend
npm install qrcode.react
```

### 6.3 Variables de entorno

```env
# backend/.env — agregar:
JWT_SECRET="..."              # ya existe, para access tokens
REFRESH_SECRET="..."          # nuevo, distinto de JWT_SECRET
PRE_AUTH_SECRET="..."         # nuevo, distinto de los otros dos
ENCRYPTION_KEY="..."          # 32 bytes hex (64 caracteres) para AES-256-GCM
APP_NAME="Inventario Mi Empresa"   # para el otpauth URL
```

---

## 7. Testing

### 7.1 Unit tests

- **PasswordPolicyService**: todos los casos de violación de política individualmente.
- **CryptoService**: encrypt/decrypt roundtrip; distintos ciphertexts para mismo plaintext; falla con key incorrecta.
- **TwoFactorService**: setup genera secret único; verify con code válido activa; verify con code inválido rechaza; recovery code se marca usado.
- **LoginAttemptsService**: 5 fallos en 15min lockean; unlock automático después de 15min; success resetea counter.
- **PermissionsGuard**: cache hit no toca DB; cache miss carga de DB; invalidación explícita refresca; usuario con permission passes; sin permission falla.

### 7.2 E2E tests

- Login exitoso sin 2FA → tokens válidos.
- Login con 2FA → flujo de 2 pasos funcional.
- Login con password incorrecto 5 veces → lockout.
- 2FA con recovery code → code consumido, no se puede reusar.
- Refresh token rota → token anterior inválido.
- Logout revoca refresh.
- Cambiar permissions del rol invalida cache → próxima request refleja cambios.
- `force-logout` de un usuario invalida access tokens al instante (via tokenVersion mismatch).
- ADMIN intenta desactivar su 2FA → 400.
- Reutilizar recovery code → 401.

### 7.3 Tests de regresión

Endpoint-by-endpoint verificar que los 3 roles originales siguen teniendo el mismo acceso que antes de la migración. Matriz exhaustiva (ADMIN, CASHIER, INVENTORY_USER) x (cada endpoint protegido) = expected status code.

---

## 8. Fases de Implementación

### Fase A — Password policy + lockout (8h)
- [ ] `PasswordPolicyService` + `LoginAttemptsService`.
- [ ] Aplicar en register y change-password.
- [ ] Frontend con password strength meter.

### Fase B — 2FA (12h)
- [ ] `TwoFactorService` + `CryptoService`.
- [ ] Endpoints setup/verify/disable/regenerate.
- [ ] UI de activación con QR.
- [ ] Login flow en 2 pasos.
- [ ] Forzar 2FA para ADMIN en seed.

### Fase C — Refresh tokens (10h)
- [ ] `RefreshTokenService` con rotación.
- [ ] Endpoints `/auth/refresh` y `/auth/logout`.
- [ ] Interceptor Axios frontend.
- [ ] Listado de sesiones activas.

### Fase D — Migración enum → FK + RBAC granular (20h)
- [ ] Migración 1: crear tablas Role/Permission/RolePermission.
- [ ] Script de backfill.
- [ ] Migración 2: NOT NULL + FK.
- [ ] `PermissionsGuard` + decorator.
- [ ] Migrar TODOS los controllers de `@Roles` → `@RequirePermissions`.
- [ ] Migración 3: drop enum `Role` y columna `User.role`.

### Fase E — Frontend RBAC (10h)
- [ ] `usePermissions` hook.
- [ ] Página `/roles` con matriz de permissions.
- [ ] Ajustar `Sidebar` y rutas protegidas.
- [ ] Página `/profile/security`.

### Fase F — Cleanup + E2E tests (10h)
- [ ] Matriz exhaustiva de tests por rol.
- [ ] Documentación de operaciones (crear rol custom, revocar acceso).
- [ ] Dashboard ADMIN: últimos logins fallidos, sesiones activas por usuario.

**Total: 70h (margen 60–80h).**

---

## 9. Riesgos y Gotchas

### 9.1 Migración enum → FK

**Riesgo alto**. Hacer en ventana de mantenimiento. Pasos:
1. Deploy con ambos (enum + FK, lee FK, escribe ambos).
2. Backfill.
3. Deploy solo FK (ignora enum).
4. Validar en staging con matriz de roles.
5. Migración 3 para droppear enum.

**Rollback:** revertir deploys pasos 1-3, restaurar schema Prisma previo.

### 9.2 JWT antiguos después del refactor

Después de cambiar el payload del JWT a `{ sub, email, roleId, tokenVersion }`, tokens emitidos con el payload viejo (`{ sub, email, role }`) fallarán. Forzar re-login con mensaje "Sesión caducada, por favor ingresá de nuevo".

### 9.3 Pérdida de dispositivo 2FA del único ADMIN

Si el único ADMIN pierde su teléfono Y sus recovery codes → no hay forma de recuperar. Mitigación:
- Exigir al menos 2 usuarios ADMIN activos en producción.
- Provisión de emergencia: script `npm run admin-2fa-reset -- --email=...` ejecutable directamente en el server con backup verbal / password de sistema.

### 9.4 Rate limit en `/auth/refresh`

Un atacante que roba un refresh podría intentar millones de refreshes. Aplicar `@Throttle({ default: { limit: 20, ttl: 60000 } })`.

### 9.5 Replay de recovery codes

Un user guarda 10 códigos, alguien le roba el archivo. Mitigación: códigos se consumen al uso; admin puede regenerar invalidando los antiguos; tras N usos (ej: 3) enviar email alertando al user.

### 9.6 Time skew en TOTP

Celular desincronizado del servidor falla la verificación. `otplib` tolera ±1 step (30s) por default. Considerar ampliar `authenticator.options = { window: 2 }` en contextos de tolerancia alta.

### 9.7 Performance del cache de permissions

Map en memoria por nodo — no escala en multi-instance. Mitigación futura: mover cache a Redis compartido (el mismo Redis del Plan 04). Por ahora, con single node, es suficiente.

---

## 10. Checklist de Aceptación

- [ ] `User.role` enum eliminado; `roleId` FK funcionando.
- [ ] 3 roles system (ADMIN, CASHIER, INVENTORY_USER) con permissions equivalentes al comportamiento previo.
- [ ] Se pueden crear roles custom vía UI.
- [ ] Matriz de permissions editable en UI.
- [ ] `@RequirePermissions` reemplaza `@Roles` en todos los controllers.
- [ ] Cache de permissions invalida al cambiar.
- [ ] Access token TTL 15 min, refresh token TTL 7 días con rotación.
- [ ] `/auth/refresh` emite nuevo par de tokens y marca el anterior como replaced.
- [ ] `/auth/logout` revoca refresh + incrementa tokenVersion.
- [ ] 2FA TOTP funcional (Google Authenticator, Authy testeados).
- [ ] 10 recovery codes generados; consumibles una sola vez.
- [ ] ADMIN obligatoriamente con 2FA.
- [ ] 5 fallos de password en 15 min → lockout 15 min.
- [ ] Política de contraseña validada server-side y client-side.
- [ ] Historial de 5 passwords bloqueado en cambio.
- [ ] Listado de sesiones activas visible al usuario.
- [ ] Revocación de sesión individual funciona.
- [ ] Crypto de TOTP secret usa AES-256-GCM con IV único por registro.
- [ ] E2E test suite cubre matriz de roles × endpoints sin regresiones.

---

_Plan 07 de 7 — roadmap MeperPOS · Fecha: 2026-04-21_
