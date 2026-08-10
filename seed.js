const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getSeqUuid(categoryNum, indexNum) {
  const catStr = categoryNum.toString().padStart(4, '0');
  const idxStr = indexNum.toString().padStart(12, '0');
  return `00000000-0000-4000-${catStr}-${idxStr}`;
}

async function main() {
  console.log('Seeding Supabase database with neat, sequential UUIDs...');
  
  // Category 1000: Users
  const initialUsers = [
    { id: getSeqUuid(1000, 1), fullName: 'KP Sumanth', email: 'sumanth@anveshakhub.com', role: 'SALES_REP', isActive: true, assignedCount: 4 },
    { id: getSeqUuid(1000, 2), fullName: 'Balasaraswathi', email: 'balu@anveshakhub.com', role: 'MANAGER', isActive: true, assignedCount: 12 },
    { id: getSeqUuid(1000, 3), fullName: 'System Administrator', email: 'admin@anveshakhub.com', role: 'ADMIN', isActive: true, assignedCount: 0 }
  ];

  // Category 2000: Companies
  const initialCompanies = [
    { id: getSeqUuid(2000, 1), name: 'Derbi Foundation', industry: 'Incubation & Accelerator', website: 'derbifoundation.com', city: 'Bengaluru', state: 'Karnataka', contactsCount: 2, totalDealValue: 4500000 },
    { id: getSeqUuid(2000, 2), name: 'Agro Precision Ltd', industry: 'AgriTech', website: 'agroprecision.in', city: 'Mysore', state: 'Karnataka', contactsCount: 3, totalDealValue: 1200000 },
    { id: getSeqUuid(2000, 3), name: 'Metro Valve Systems', industry: 'Industrial Automation', website: 'metrovalves.com', city: 'Chennai', state: 'Tamil Nadu', contactsCount: 1, totalDealValue: 850000 }
  ];

  // Category 3000: Leads
  const initialLeads = [
    { id: getSeqUuid(3000, 1), name: 'Sathyanarayana B V', company: 'Derbi Foundation', email: 'ceo@derbifoundation.com', phone: '+91 99800 03627', status: 'Qualified', score: 85, owner: 'Balasaraswathi' },
    { id: getSeqUuid(3000, 2), name: 'Ramesh Kumar', company: 'Agro Precision Ltd', email: 'ramesh@agroprecision.in', phone: '+91 98450 12345', status: 'New', score: 35, owner: 'KP Sumanth' },
    { id: getSeqUuid(3000, 3), name: 'Anita Desai', company: 'Metro Valve Systems', email: 'anita@metrovalves.com', phone: '+91 97400 55443', status: 'Contacted', score: 60, owner: 'Riya Sharma' }
  ];

  // Category 4000: Deals
  const initialDeals = [
    { id: getSeqUuid(4000, 1), name: 'Derbi Enterprise Incubator Suite', company: 'Derbi Foundation', value: 4500000, probability: 85, stage: 'Negotiation', owner: 'Balasaraswathi', daysInStage: 4 },
    { id: getSeqUuid(4000, 2), name: 'Agro IoT Sensor Deployment', company: 'Agro Precision Ltd', value: 1200000, probability: 60, stage: 'Proposal Sent', owner: 'KP Sumanth', daysInStage: 2 }
  ];

  // Category 5000: Tasks
  const initialTasks = [
    { id: getSeqUuid(5000, 1), title: 'Send revised commercial quote to Sathyanarayana B V', description: 'Include 18% GST calculation', assignee: 'Balasaraswathi', priority: 'High', status: 'Open', linkedTo: 'Derbi Foundation' },
    { id: getSeqUuid(5000, 2), title: 'Schedule product demo with Ramesh Kumar', description: 'Focus on sensor telemetry features', assignee: 'KP Sumanth', priority: 'Medium', status: 'Open', linkedTo: 'Agro Precision Ltd' }
  ];

  try {
    console.log('Clearing existing records...');
    await prisma.lead.deleteMany({});
    await prisma.deal.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.company.deleteMany({});
    await prisma.quote.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});

    console.log('Inserting Users...');
    await prisma.user.createMany({ data: initialUsers });

    console.log('Inserting Companies...');
    await prisma.company.createMany({ data: initialCompanies });

    console.log('Inserting Leads...');
    await prisma.lead.createMany({ data: initialLeads });

    console.log('Inserting Deals...');
    await prisma.deal.createMany({ data: initialDeals });

    console.log('Inserting Tasks...');
    await prisma.task.createMany({ data: initialTasks });

    console.log('SUCCESSFULLY RE-SEEDED SUPABASE DATABASE WITH NEAT SEQUENTIAL UUIDs!');
  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
