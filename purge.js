const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Purging all records from Supabase PostgreSQL database...');
  try {
    await prisma.lead.deleteMany({});
    await prisma.deal.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.company.deleteMany({});
    await prisma.quote.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    console.log('SUCCESSFULLY PURGED ALL TABLES IN SUPABASE POSTGRESQL DATABASE!');
  } catch (err) {
    console.error('Error during purge:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
