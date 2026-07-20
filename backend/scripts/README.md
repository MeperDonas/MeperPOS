# Ping Supabase — Mantener proyecto activo

## 🎯 Propósito

Supabase Free tier pausa los proyectos después de **7 días de inactividad**. Este script hace una consulta simple a tu base de datos cada 2-3 días para evitar que se pause.

## 📁 Archivos

- `scripts/ping-supabase.js` — Script de ping
- `scripts/README.md` — Este archivo

## 🚀 Uso manual

```bash
# Desde la carpeta /backend
node scripts/ping-supabase.js
```

**Output esperado:**
```
✅ Ping exitoso - 2026-05-01T21:30:00.000Z
   Usuarios en DB: 42
   Siguiente ping recomendado: dentro de 2-3 días
```

## ⏰ Automatización (Windows)

### Opción A: Programador de Tareas (Task Scheduler)

1. Abrir "Task Scheduler" (programador de tareas)
2. Crear tarea básica:
   - **Nombre**: `Supabase Ping`
   - **Trigger**: Cada 2 días
   - **Acción**: Iniciar programa
   - **Programa**: `C:\Program Files\nodejs\node.exe`
   - **Argumentos**: `scripts/ping-supabase.js`
   - **Iniciar en**: `C:\Users\meper\Desktop\Proyecto de Grado\gestion-inventario-app\backend`

### Opción B: Script de inicio de sesión

Agregar al script `ping-supabase.js` al inicio de Windows para que corra cada vez que prendés la PC:

```bash
# Copiar acceso directo a carpeta de inicio
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
```

### Opción C: GitHub Actions (si tenés repo privado)

```yaml
# .github/workflows/ping-supabase.yml
name: Ping Supabase
on:
  schedule:
    - cron: '0 0 */2 * *'  # Cada 2 días
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install pg dotenv
      - run: node scripts/ping-supabase.js
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## ⚠️ Notas importantes

1. **No compartas `.env.production`** — Contiene credenciales de tu base de datos
2. **El script usa `.env.production`** — Asegurate de tenerlo configurado
3. **Si el proyecto ya está pausado** — Tenés que ir al dashboard de Supabase y hacer clic en "Restore"
4. **Free tier limitado** — 500MB de DB, 1GB storage. Monitoreá tu uso.

## 🔧 Troubleshooting

### Error: `ECONNREFUSED`
```
❌ Ping fallido
   Error: connect ECONNREFUSED
```
**Solución**: Tu proyecto está pausado o no tenés internet. Andá a https://supabase.com/dashboard y restauralo.

### Error: `pg NOT installed`
```bash
npm install pg dotenv --save-dev
```

### Error: `DATABASE_URL no encontrada`
Asegurate de tener el archivo `.env.production` en la carpeta `/backend` con la URL de Supabase.

## 📊 Monitoreo

Podés verificar cuándo fue el último ping revisando los logs de Supabase:
1. Andá a https://supabase.com/dashboard
2. Seleccioná tu proyecto
3. Andá a "Logs" > "Postgres"
4. Filtrá por la consulta `SELECT COUNT(*) as total_users FROM "User"`
