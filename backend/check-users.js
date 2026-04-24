const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, name: true, active: true, isSuperAdmin: true }
  });
  console.log('Usuarios encontrados:', users.length);
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
