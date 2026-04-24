const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulateLogin(email, password) {
  console.log(`\n--- Simulando login para: ${email} ---`);
  
  // Paso 1: Buscar usuario
  const user = await prisma.user.findUnique({ where: { email } });
  console.log('Usuario encontrado:', !!user);
  
  if (!user) {
    console.log('❌ FAIL: Usuario no existe');
    return;
  }
  
  console.log('Usuario activo:', user.active);
  console.log('isSuperAdmin:', user.isSuperAdmin);
  
  // Paso 2: Validar password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  console.log('Password válido:', isPasswordValid);
  
  if (!isPasswordValid) {
    console.log('❌ FAIL: Password incorrecto');
    return;
  }
  
  // Paso 3: Si no es SuperAdmin, buscar OrganizationUser
  if (!user.isSuperAdmin) {
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: 'asc' },
    });
    
    console.log('OrganizationUser encontrado:', !!orgUser);
    
    if (!orgUser) {
      console.log('❌ FAIL: No tiene organizaciones');
      return;
    }
    
    console.log('Org ID:', orgUser.organizationId);
    console.log('Rol:', orgUser.role);
  }
  
  console.log('✅ SUCCESS: Login debería funcionar');
}

async function main() {
  await simulateLogin('admin@sistema.com', 'admin123');
  await simulateLogin('admin@cafeteria-demo.com', 'admin123');
  await simulateLogin('admin@supermercado-demo.com', 'admin123');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
