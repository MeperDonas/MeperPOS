const dns = require('dns');
const https = require('https');

console.log('=== DIAGNÓSTICO DE RED ===\n');

// 1. Verificar DNS
dns.lookup('api.cloudinary.com', (err, address) => {
  if (err) {
    console.log('❌ DNS: api.cloudinary.com NO resuelve');
    console.log('   Error:', err.message);
  } else {
    console.log('✅ DNS: api.cloudinary.com →', address);
  }
  console.log();
});

// 2. Verificar DNS de Google
dns.lookup('google.com', (err, address) => {
  if (err) {
    console.log('❌ DNS: google.com NO resuelve');
    console.log('   Error:', err.message);
  } else {
    console.log('✅ DNS: google.com →', address);
  }
  console.log();
});

// 3. Verificar conectividad HTTPS a Cloudinary
setTimeout(() => {
  console.log('🔍 Probando conexión HTTPS a Cloudinary...');
  const req = https.get('https://api.cloudinary.com/v1_1/test/image/upload', (res) => {
    console.log('✅ HTTPS: Conexión establecida');
    console.log('   Status:', res.statusCode);
    console.log('   Esto significa que el firewall NO bloquea Cloudinary');
  });
  
  req.on('error', (err) => {
    console.log('❌ HTTPS: No se puede conectar');
    console.log('   Error:', err.message);
    if (err.code === 'ENOTFOUND') {
      console.log('   💡 Problema: DNS no resuelve el dominio');
    } else if (err.code === 'ECONNREFUSED') {
      console.log('   💡 Problema: Conexión rechazada (firewall/proxy)');
    } else if (err.code === 'ETIMEDOUT') {
      console.log('   💡 Problema: Timeout (sin internet o muy lento)');
    }
  });
  
  req.setTimeout(5000, () => {
    console.log('❌ HTTPS: Timeout después de 5 segundos');
    req.destroy();
  });
}, 1000);
