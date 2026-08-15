# Plan de Despliegue - MeperPOS

**Fecha**: 2026-03-05 (rev. 2026-03-06)
**Estado**: Aprobado - Revision 2 (correccion de hallazgos Codex)
**Autor**: Planificado con Claude Code

---

## 1. Stack de Despliegue

| Componente | Plataforma | Plan Inicial | Plan Futuro | Costo Inicial | Costo Futuro |
|---|---|---|---|---|---|
| **Frontend** | Vercel | Hobby (free) | Pro si escala | $0 | $20/mes |
| **Backend** | Railway | Trial ($5 credito) | Hobby ($5/mes + uso) | $0 | ~$10-15/mes |
| **Database** | Supabase | Free (500 MB) | Pro ($25/mes) | $0 | $25/mes |
| **Imagenes** | Cloudinary | Free (existente) | Paid si escala | $0 | Variable |

**Costo total inicial**: $0
**Costo en Hobby (Railway)**: ~$10-15/mes
**Costo full produccion**: ~$55-60/mes

---

## 2. Justificacion del Stack

### Vercel (Frontend)

- Soporte nativo para Next.js 16 (mismo equipo de desarrollo)
- CDN global con edge network
- Deploys automaticos desde GitHub en cada push
- Zero-config para Next.js: detecta framework, optimiza builds
- Free tier generoso: 100 GB bandwidth, builds ilimitados
- Preview deployments por cada PR

### Railway (Backend)

- Sin cold starts (ni en trial ni en Hobby) a diferencia de Render free
- Nixpacks/Railpack auto-detecta Node.js y configura build
- CLI potente: `railway run npx prisma migrate deploy`
- Dashboard con logs en tiempo real y metricas
- Soporte nativo de monorepos (root directory configurable)
- Upgrade path fluido: Trial -> Hobby -> Pro
- Networking privado entre servicios (futuro)

### Supabase (Database)

- PostgreSQL 15 managed con backups automaticos
- Connection pooling integrado (Supavisor) - necesario para Prisma
- Dashboard visual para inspeccionar datos (Table Editor)
- Free tier: 500 MB storage, 2 proyectos
- SSL por defecto en todas las conexiones
- Facil upgrade a Pro con 8 GB storage y backups diarios
- **Limitacion**: Pausa tras 7 dias de inactividad en free tier

---

## 3. Cambios de Codigo Requeridos

### 3.1 `backend/prisma/schema.prisma` -- Agregar `directUrl`

Supabase usa un pooler de conexiones (Supavisor). Prisma necesita dos URLs separadas:

- `url` -> Session pooler (port 5432) -- para Prisma Client en runtime
- `directUrl` -> Conexion directa -- para migraciones (bypasses pooler)

**Cambio**:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Por que**: Sin `directUrl`, `prisma migrate deploy` falla contra el pooler de Supabase por incompatibilidades con prepared statements.

### 3.2 `backend/src/main.ts` -- Bind a `0.0.0.0`

Railway requiere que el servidor escuche en todas las interfaces de red.

**Cambio**:

```typescript
// Antes:
await app.listen(port);

// Despues:
await app.listen(port, '0.0.0.0');
```

**Por que**: Railway asigna una IP interna dinamica. Sin `0.0.0.0`, el servidor solo escucha en localhost y Railway no puede rutear trafico.

### 3.3 `backend/src/app.controller.ts` -- Health check endpoint

Agregar endpoint `GET /api/health` que verifica conectividad con la base de datos.

**Cambio**:

```typescript
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'disconnected',
      });
    }
  }
}
```

**Por que**: Railway usa health checks para monitorear el servicio. Tambien util para UptimeRobot y debugging de conectividad.

### 3.4 `backend/prisma.config.ts` -- Remover fallback inseguro

El fallback hardcodeado (`postgresql://admin:admin123@localhost:5432/inventario_db`) es un riesgo en produccion.

**Cambio**:

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env["DATABASE_URL"] ??
      (process.env.NODE_ENV === "production"
        ? (() => { throw new Error("DATABASE_URL is required in production"); })()
        : "postgresql://admin:admin123@localhost:5432/inventario_db"),
  },
});
```

**Por que**: En produccion, si falta `DATABASE_URL`, debe fallar ruidosamente en vez de intentar conectar a localhost.

### 3.5 `backend/package.json` -- Scripts `prebuild` y Start Command

Railway ejecuta `npm run build` automaticamente. Prisma Client debe generarse y las migraciones
deben aplicarse antes del build. Ademas, Railway usa `npm start` por defecto, que ejecuta
`nest start` (modo desarrollo con ts-node) en vez de `node dist/main` (produccion compilado).

**Cambio** (agregar/modificar scripts):

```json
"prebuild": "npx prisma generate && npx prisma migrate deploy",
"start:prod": "node dist/main"
```

**Start command en Railway Dashboard**: Configurar explicitamente en
**Settings -> Deploy -> Custom Start Command**: `npm run start:prod`

**Por que**:
- Sin `prisma generate`, `nest build` falla porque no encuentra el Prisma Client generado.
- Sin `prisma migrate deploy` en el build, las migraciones futuras no se aplican automaticamente,
  causando drift entre schema y codigo desplegado.
- Sin start command explicito, Railway ejecuta `npm start` -> `nest start` que usa ts-node
  (lento, consume mas memoria, no es produccion).

### 3.6 Archivos `.env.example`

**`backend/.env.example`**:

```env
# Supabase PostgreSQL - Session pooler (para Prisma Client en runtime)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Supabase PostgreSQL - Conexion directa (para Prisma migraciones)
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@db.[PROJECT-REF].supabase.com:5432/postgres"

# Autenticacion
JWT_SECRET="generate-with: openssl rand -hex 32"

# Servidor
PORT=3001
CORS_ORIGIN="https://tu-app.vercel.app"
NODE_ENV=production

# Cloudinary (imagenes de productos)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

**`frontend/.env.example`**:

```env
NEXT_PUBLIC_API_URL=https://tu-backend.up.railway.app/api
```

### 3.8 `backend/src/app.module.ts` -- ThrottlerGuard global

El `ThrottlerModule.forRoot()` esta registrado pero el `ThrottlerGuard` no esta aplicado
globalmente. Solo el endpoint de login tiene `@Throttle()` (auth.controller.ts:36).
Esto significa que el rate limiting NO protege ningun otro endpoint.

**Cambio** (agregar provider en `app.module.ts`):

```typescript
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  // ... imports existentes ...
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

**Por que**: Sin el guard global, el ThrottlerModule solo declara la configuracion pero no
la aplica. El `@Throttle()` en login funciona pero usa su propio limite (10/60s).
Con el guard global, todos los endpoints quedan protegidos por defecto (100 req/60s)
y endpoints individuales pueden personalizar con `@Throttle()` o excluirse con `@SkipThrottle()`.

### 3.9 Limpieza de `backend/dist/` del tracking de git

El directorio `backend/dist/` contiene archivos compilados que estan versionados en git.
Esto causa bloat en el repositorio y conflictos de build artefacts.

**Cambio** (ejecutar antes del commit):

```bash
git rm -r --cached backend/dist
```

El `.gitignore` del backend ya incluye `dist/`, asi que no se volvera a trackear.

### 3.10 `.gitignore` raiz

```gitignore
# Dependencies
node_modules/

# Environment variables
.env*
!.env.example

# Build outputs
dist/
.next/
out/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Coverage
coverage/

# Logs
*.log
npm-debug.log*

# Prisma generated
generated/
```

---

## 4. Fases de Despliegue

### FASE 0: Preparacion del Codigo

**Objetivo**: Aplicar los 10 cambios de codigo listados en la seccion 3.

**Checklist**:

- [ ] 3.1: Actualizar `schema.prisma` con `directUrl`
- [ ] 3.2: Actualizar `main.ts` con `0.0.0.0`
- [ ] 3.3: Agregar health check en `app.controller.ts`
- [ ] 3.4: Actualizar `prisma.config.ts` sin fallback inseguro
- [ ] 3.5: Agregar scripts `prebuild` (generate + migrate) en `package.json`
- [ ] 3.6: Crear `backend/.env.example`
- [ ] 3.6: Crear `frontend/.env.example`
- [ ] 3.7: NO APLICA (renumerado)
- [ ] 3.8: Registrar `ThrottlerGuard` como `APP_GUARD` global en `app.module.ts`
- [ ] 3.9: Ejecutar `git rm -r --cached backend/dist` para limpiar artefactos
- [ ] 3.10: Crear `.gitignore` raiz
- [ ] Commit y push a GitHub

**Tiempo estimado**: ~30 minutos

---

### FASE 1: Base de Datos (Supabase)

**Objetivo**: Provisionar PostgreSQL y aplicar schema + seed data.

| Paso | Accion | Detalle |
|---|---|---|
| 1.1 | Crear cuenta en [supabase.com](https://supabase.com) | Usar cuenta de GitHub |
| 1.2 | Crear nuevo proyecto | Nombre: `inventario-gestion`, Region: `us-east-1`, Generar password seguro |
| 1.3 | Esperar aprovisionamiento | ~2 minutos para que el proyecto este listo |
| 1.4 | Ir a **Settings -> Database** | Copiar **Session pooler** (port 5432) y **Direct connection** |
| 1.5 | Configurar `.env` local | `DATABASE_URL` = Session pooler, `DIRECT_URL` = Direct connection |
| 1.6 | Ejecutar migraciones | `npx prisma migrate deploy` (aplica las 10 migraciones existentes) |
| 1.7 | Ejecutar seed | `npm run seed` (crea usuarios, categorias, productos, settings) |
| 1.8 | Verificar datos | Supabase Dashboard -> Table Editor -> Confirmar tablas y registros |

**Formato de URLs de Supabase**:

```
# SESSION POOLER (para DATABASE_URL en runtime)
postgresql://postgres.[ref]:[pass]@aws-0-us-east-1.pooler.supabase.com:5432/postgres

# DIRECT CONNECTION (para DIRECT_URL en migraciones)
postgresql://postgres.[ref]:[pass]@db.[ref].supabase.com:5432/postgres
```

**Tiempo estimado**: ~20 minutos

---

### FASE 2: Backend (Railway)

**Objetivo**: Desplegar NestJS API conectado a Supabase.

| Paso | Accion |
|---|---|
| 2.1 | Crear cuenta en [railway.app](https://railway.app) con GitHub |
| 2.2 | **New Project** -> **Deploy from GitHub repo** -> Seleccionar repositorio |
| 2.3 | Railway detecta monorepo -> Configurar **Root Directory**: `/backend` |
| 2.4 | Nixpacks auto-detecta Node.js. Build: `npm ci` -> `npm run prebuild` -> `npm run build` |
| 2.5 | **Settings -> Deploy -> Custom Start Command**: `npm run start:prod` |
| 2.6 | Tab **Variables** -> Agregar env vars (tabla abajo) |
| 2.7 | **Settings -> Networking -> Generate Domain** -> Obtener URL `*.up.railway.app` |
| 2.8 | **Settings -> Deploy -> Health Check Path**: `/api/health` |
| 2.9 | Deploy se ejecuta automaticamente |
| 2.10 | Verificar health: `GET https://[app].up.railway.app/api/health` |
| 2.11 | Verificar Swagger: `https://[app].up.railway.app/api/docs` |

**Variables de entorno en Railway**:

| Variable | Valor | Notas |
|---|---|---|
| `DATABASE_URL` | Session pooler de Supabase (port 5432) | Con password |
| `DIRECT_URL` | Direct connection de Supabase | Para migraciones |
| `JWT_SECRET` | String aleatorio de 64 chars | `openssl rand -hex 32` |
| `CORS_ORIGIN` | (se actualiza en Fase 4) | Dejar vacio o localhost temporalmente |
| `NODE_ENV` | `production` | |
| `CLOUDINARY_CLOUD_NAME` | Tu valor actual | |
| `CLOUDINARY_API_KEY` | Tu valor actual | |
| `CLOUDINARY_API_SECRET` | Tu valor actual | |

**IMPORTANTE**: NO definir `PORT`. Railway lo inyecta automaticamente. Tu `main.ts` ya lee `process.env.PORT`.

**Tiempo estimado**: ~15 minutos

---

### FASE 3: Frontend (Vercel)

**Objetivo**: Desplegar Next.js 16 conectado al backend en Railway.

| Paso | Accion |
|---|---|
| 3.1 | Crear cuenta en [vercel.com](https://vercel.com) con GitHub |
| 3.2 | **Import Project** -> Seleccionar repositorio |
| 3.3 | **Root Directory**: `frontend` |
| 3.4 | Framework Preset: Next.js (auto-detectado) |
| 3.5 | **Environment Variables**: agregar `NEXT_PUBLIC_API_URL` |
| 3.6 | Deploy |
| 3.7 | Vercel asigna URL: `https://[app].vercel.app` |

**Variable de entorno en Vercel**:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://[tu-backend].up.railway.app/api` |

**CRITICO**: Esta variable se incrusta en el JavaScript bundle en BUILD TIME. Si cambias la URL de Railway, debes triggerear un redeploy en Vercel.

**Tiempo estimado**: ~10 minutos

---

### FASE 4: Conexion Cruzada y Verificacion

**Objetivo**: Conectar frontend con backend via CORS y validar todo el flujo.

| Paso | Accion |
|---|---|
| 4.1 | Copiar URL de Vercel: `https://[app].vercel.app` |
| 4.2 | En Railway -> Variables -> `CORS_ORIGIN` = `https://[app].vercel.app` |
| 4.3 | Railway redeploy automaticamente al cambiar variables |
| 4.4 | Esperar ~1-2 min a que el redeploy termine |
| 4.5 | Abrir `https://[app].vercel.app` en el navegador |
| 4.6 | Ejecutar test E2E manual (tabla abajo) |

**Test E2E manual**:

| Test | Flujo | Resultado esperado |
|---|---|---|
| Login | Email: admin@inventory.com, Pass: admin123 | Redirect a /dashboard |
| Dashboard | Ver metricas | Datos de seed visibles |
| Productos | CRUD completo | Crear, editar, buscar, eliminar producto |
| Categorias | Listar | Categorias de seed visibles |
| Clientes | CRUD | Crear y buscar cliente |
| POS | Agregar productos al carrito + venta | Venta completada con numero consecutivo |
| Reportes | Generar reporte de ventas | Datos de la venta recien creada |
| Exportar | Exportar reporte a Excel | Descarga archivo .xlsx |
| Dark mode | Toggle theme | Cambia correctamente |
| Logout | Cerrar sesion | Redirect a /login |

**Tiempo estimado**: ~15 minutos

---

### FASE 5: Monitoreo y Hardening (Post-deploy)

| Accion | Prioridad | Como |
|---|---|---|
| Verificar rate limiting global | Alta | `ThrottlerGuard` ya aplicado en 3.8. Test: >100 GET /api en 60s -> 429 |
| Revisar logs de Railway | Alta | Tab Deployments -> Ver logs del ultimo deploy |
| Verificar health check activo | Alta | Railway Settings -> Deploy -> Confirmar Health Check Path funciona |
| Considerar deshabilitar Swagger en prod | Media | Condicionar con `if (process.env.NODE_ENV !== 'production')` |
| Configurar alertas en Supabase | Media | Dashboard -> Reports -> Database Health |
| GitHub Actions CI (opcional) | Baja | Workflow que ejecute `npm run lint && npm test` en cada push |

---

## 5. Arquitectura de Despliegue

```
                    Internet
                       |
          +-----------+-----------+
          |                       |
    [Vercel CDN]          [Railway Network]
    Edge Network           Private Network
          |                       |
  +-------+-------+      +-------+-------+
  |   Frontend    |      |    Backend    |
  |  Next.js 16  | HTTPS |  NestJS 11   |
  |  React 19    |------>|  Prisma 6    |
  |  TailwindCSS |       |  JWT Auth    |
  |  Hobby Free  |       |  Swagger     |
  +---------------+      +-------+-------+
                                 |
                            SSL (auto)
                                 |
                    +------------+------------+
                    |                         |
            +-------+-------+        +-------+-------+
            |   Supabase    |        |  Cloudinary   |
            |  PostgreSQL   |        |   (Images)    |
            | Session Pooler|        |  Free Tier    |
            |  Free -> Pro  |        +---------------+
            +---------------+
```

---

## 6. Conexiones de Red y Puertos

| Origen | Destino | Protocolo | Puerto | URL Pattern |
|---|---|---|---|---|
| Browser | Vercel | HTTPS | 443 | `https://[app].vercel.app` |
| Vercel (client JS) | Railway | HTTPS | 443 | `https://[app].up.railway.app/api/*` |
| Railway (NestJS) | Supabase Pooler | PostgreSQL+SSL | 5432 | `aws-0-[region].pooler.supabase.com` |
| Railway (Prisma CLI) | Supabase Direct | PostgreSQL+SSL | 5432 | `db.[ref].supabase.com` |
| Railway (NestJS) | Cloudinary | HTTPS | 443 | `api.cloudinary.com` |

---

## 7. Variables de Entorno por Plataforma

### Railway (Backend)

| Variable | Ejemplo | Requerida |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.abc:pass@aws-0-us-east-1.pooler.supabase.com:5432/postgres` | Si |
| `DIRECT_URL` | `postgresql://postgres.abc:pass@db.abc.supabase.com:5432/postgres` | Si |
| `JWT_SECRET` | `a1b2c3...64hexchars` | Si |
| `CORS_ORIGIN` | `https://meperpos.vercel.app` | Si |
| `NODE_ENV` | `production` | Si |
| `CLOUDINARY_CLOUD_NAME` | `dxxxxxx` | Si |
| `CLOUDINARY_API_KEY` | `123456789` | Si |
| `CLOUDINARY_API_SECRET` | `abcdef...` | Si |
| `PORT` | (inyectado por Railway) | NO definir |

### Vercel (Frontend)

| Variable | Ejemplo | Requerida |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://meperpos-api.up.railway.app/api` | Si |

### Supabase (Database)

Configurado via dashboard de Supabase. No requiere variables adicionales.

---

## 8. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|---|---|---|---|
| Supabase pausa DB tras 7 dias inactivo | Media | Alto | Usar la app periodicamente o upgrade a Pro |
| Trial de Railway se agota | Media | Medio | $5 credit dura ~3-5 dias 24/7. Upgrade a Hobby a tiempo |
| CORS mal configurado | Alta | Alto | URL exacta de Vercel sin trailing slash en `CORS_ORIGIN` |
| `NEXT_PUBLIC_API_URL` incorrecto | Alta | Alto | Debe incluir `/api` al final. Verificar en Vercel build logs |
| Prisma migration falla en Supabase | Baja | Alto | Usar `DIRECT_URL` (no pooler) para migraciones |
| Password de Supabase expuesto | Baja | Critico | Solo en env vars de plataformas, nunca en codigo ni git |
| Railway build falla | Media | Medio | Verificar que `prebuild` script existe y `prisma generate` funciona |
| Railway ejecuta `nest start` en vez de `node dist/main` | Alta | Alto | Configurar start command explicito: `npm run start:prod` |
| Schema drift por migracion no aplicada | Media | Alto | `prebuild` incluye `prisma migrate deploy` automatico en cada deploy |

---

## 9. Politica de Migraciones

**Desarrollo local**:
- Usar `npx prisma migrate dev` para crear nuevas migraciones
- Esto genera archivos SQL en `prisma/migrations/` que se commitean a git

**Despliegue (Railway)**:
- El script `prebuild` ejecuta `npx prisma migrate deploy` automaticamente en cada build
- Esto aplica migraciones pendientes ANTES de compilar el codigo
- Si una migracion falla, el build falla y Railway no despliega (comportamiento correcto)

**Rollback**:
- Prisma no soporta rollback automatico de migraciones
- Si una migracion rompe algo, crear una nueva migracion correctiva
- En caso critico: restaurar backup de Supabase + revert del commit en GitHub

**Manual (emergencia)**:
```bash
# Desde local contra Supabase
cd backend
npx prisma migrate deploy

# Via Railway CLI
railway run npx prisma migrate deploy
```

---

## 10. Checklist Final Pre-Deploy

- [ ] `schema.prisma` tiene `directUrl = env("DIRECT_URL")`
- [ ] `main.ts` escucha en `0.0.0.0`
- [ ] Health check endpoint `GET /api/health` funciona
- [ ] `prebuild` script: `npx prisma generate && npx prisma migrate deploy`
- [ ] `prisma.config.ts` sin fallback hardcodeado inseguro
- [ ] `ThrottlerGuard` registrado como `APP_GUARD` global
- [ ] `backend/.env.example` creado
- [ ] `frontend/.env.example` creado
- [ ] `.gitignore` raiz creado
- [ ] `backend/dist/` removido del tracking de git (`git rm -r --cached`)
- [ ] Repo pusheado a GitHub con todos los cambios
- [ ] Supabase: proyecto creado, migraciones aplicadas, seed ejecutado
- [ ] Railway: servicio creado, **start command = `npm run start:prod`**, env vars configuradas
- [ ] Railway: health check configurado en `/api/health`
- [ ] Vercel: proyecto creado, `NEXT_PUBLIC_API_URL` configurada, deploy exitoso
- [ ] `CORS_ORIGIN` actualizado en Railway con URL de Vercel
- [ ] Test E2E manual completo pasando (login con `admin@inventory.com`)

---

## 11. Comandos Utiles Post-Deploy

```bash
# Generar JWT_SECRET seguro
openssl rand -hex 32

# Ejecutar migraciones contra Supabase desde local
cd backend
npx prisma migrate deploy

# Ejecutar seed contra Supabase desde local
cd backend
npm run seed

# Abrir Prisma Studio contra Supabase
cd backend
npx prisma studio

# Ver logs de Railway (requiere Railway CLI)
npm i -g @railway/cli
railway login
railway logs

# Ejecutar comando remoto en Railway
railway run npx prisma migrate deploy

# Forzar redeploy en Vercel (si cambia NEXT_PUBLIC_API_URL)
# -> Vercel Dashboard -> Deployments -> Redeploy
```
