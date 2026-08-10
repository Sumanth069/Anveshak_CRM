const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding default Admin user in Supabase PostgreSQL...');
  try {
    const admin = await prisma.user.upsert({
      where: { email: 'admin@anveshak.com' },
      update: {
        fullName: 'KP Sumanth',
        password: '12345678',
        role: 'ADMIN',
        isActive: true
      },
      create: {
        fullName: 'KP Sumanth',
        email: 'admin@anveshak.com',
        password: '12345678',
        role: 'ADMIN',
        isActive: true,
        assignedCount: 0
      }
    });
    console.log('SUCCESSFULLY CREATED DEFAULT ADMIN USER IN SUPABASE:', admin);
  } catch (err) {
    console.error('Error seeding admin user:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
