const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@cafeteria-demo.com' },
  });
  
  if (!user) {
    console.log('Usuario NO encontrado');
    await prisma.$disconnect();
    return;
  }
  
  console.log('Usuario encontrado:', user.email);
  console.log('Hash en BD:', user.password.substring(0, 20) + '...');
  
  const isValid = await bcrypt.compare('admin123', user.password);
  console.log('Password admin123 válido?', isValid);
  
  // También probar con hash fresco
  const freshHash = await bcrypt.hash('admin123', 10);
  console.log('Hash fresco:', freshHash.substring(0, 20) + '...');
  const isValidFresh = await bcrypt.compare('admin123', freshHash);
  console.log('Password con hash fresco válido?', isValidFresh);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
