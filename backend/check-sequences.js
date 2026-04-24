const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sequences = await prisma.organizationSequence.findMany({
    where: { type: 'SALE' },
    include: { organization: { select: { name: true } } }
  });
  
  console.log('Secuencias de SALE:');
  sequences.forEach(s => {
    console.log(`  Org: ${s.organization.name}, CurrentNumber: ${s.currentNumber}, Prefix: ${s.prefix}`);
  });

  // También verificar las ventas existentes
  const orgs = await prisma.organization.findMany({
    include: {
      _count: { select: { sales: true } }
    }
  });
  
  console.log('\nVentas por org:');
  orgs.forEach(o => {
    console.log(`  ${o.name}: ${o._count.sales} ventas`);
  });

  // Venta con saleNumber más alto
  const maxSale = await prisma.sale.findFirst({
    orderBy: { saleNumber: 'desc' },
    select: { saleNumber: true, organizationId: true },
    include: { organization: { select: { name: true } } }
  });
  
  console.log('\nVenta con saleNumber más alto:', maxSale?.saleNumber, 'en', maxSale?.organization?.name);
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
