const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Para cada org, contar ventas y actualizar la secuencia
  const orgs = await prisma.organization.findMany();
  
  for (const org of orgs) {
    const saleCount = await prisma.sale.count({
      where: { organizationId: org.id }
    });
    
    await prisma.organizationSequence.updateMany({
      where: { organizationId: org.id, type: 'SALE' },
      data: { currentNumber: saleCount }
    });
    
    console.log(`✅ ${org.name}: secuencia SALE actualizada a ${saleCount}`);
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
