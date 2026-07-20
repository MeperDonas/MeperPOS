/**
 * Script de ping para mantener Supabase activo
 * Evita que el proyecto se pause por inactividad (7 días en Free tier)
 * 
 * Uso:
 *   node scripts/ping-supabase.js
 * 
 * Para automatizar (Windows Task Scheduler):
 *   - Crear tarea que corra cada 2-3 días
 *   - Programa: node.exe
 *   - Argumentos: scripts/ping-supabase.js
 *   - Directorio: C:\Users\meper\Desktop\Proyecto de Grado\gestion-inventario-app\backend
 */

const { Pool } = require('pg');

// Cargar variables de entorno del archivo .env.production
require('dotenv').config({ path: '.env.production' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no encontrada en .env.production');
  console.error('   Asegurate de tener el archivo .env.production configurado');
  process.exit(1);
}

async function pingDatabase() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Necesario para Supabase
    },
  });

  try {
    const client = await pool.connect();
    
    // Consulta simple para mantener la DB activa
    const result = await client.query('SELECT COUNT(*) as total_users FROM "User"');
    const count = result.rows[0].total_users;
    
    console.log(`✅ Ping exitoso - ${new Date().toISOString()}`);
    console.log(`   Usuarios en DB: ${count}`);
    console.log(`   Siguiente ping recomendado: dentro de 2-3 días`);
    
    client.release();
  } catch (error) {
    console.error(`❌ Ping fallido - ${new Date().toISOString()}`);
    console.error(`   Error: ${error.message}`);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('   💡 Posible causa: Proyecto pausado o sin internet');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar
pingDatabase();
