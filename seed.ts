import { prisma } from './lib/prisma';

async function main() {
  console.log('Seeding Supabase database via Prisma ORM...');
  
  const initialCompanies = [
    { id: 'CO-001', name: 'Derbi Foundation', industry: 'Incubation & Accelerator', website: 'derbifoundation.com', city: 'Bengaluru', state: 'Karnataka', contactsCount: 2, totalDealValue: 4500000 },
    { id: 'CO-002', name: 'Agro Precision Ltd', industry: 'AgriTech', website: 'agroprecision.in', city: 'Mysore', state: 'Karnataka', contactsCount: 3, totalDealValue: 1200000 },
    { id: 'CO-003', name: 'Metro Valve Systems', industry: 'Industrial Automation', website: 'metrovalves.com', city: 'Chennai', state: 'Tamil Nadu', contactsCount: 1, totalDealValue: 850000 }
  ];

  const initialLeads = [
    { id: 'LED-001', name: 'Sathyanarayana B V', company: 'Derbi Foundation', email: 'ceo@derbifoundation.com', phone: '+91 99800 03627', status: 'Qualified', score: 85, owner: 'Balasaraswathi' },
    { id: 'LED-002', name: 'Ramesh Kumar', company: 'Agro Precision Ltd', email: 'ramesh@agroprecision.in', phone: '+91 98450 12345', status: 'New', score: 35, owner: 'KP Sumanth' },
    { id: 'LED-003', name: 'Anita Desai', company: 'Metro Valve Systems', email: 'anita@metrovalves.com', phone: '+91 97400 55443', status: 'Contacted', score: 60, owner: 'Riya Sharma' }
  ];

  const initialDeals = [
    { id: 'DL-001', name: 'Derbi Enterprise Incubator Suite', company: 'Derbi Foundation', value: 4500000, probability: 85, stage: 'Negotiation', owner: 'Balasaraswathi', daysInStage: 4 },
    { id: 'DL-002', name: 'Agro IoT Sensor Deployment', company: 'Agro Precision Ltd', value: 1200000, probability: 60, stage: 'Proposal Sent', owner: 'KP Sumanth', daysInStage: 2 }
  ];

  const initialTasks = [
    { id: 'TSK-001', title: 'Send revised commercial quote to Sathyanarayana B V', description: 'Include 18% GST calculation', assignee: 'Balasaraswathi', priority: 'High', status: 'Open', linkedTo: 'Derbi Foundation' },
    { id: 'TSK-002', title: 'Schedule product demo with Ramesh Kumar', description: 'Focus on sensor telemetry features', assignee: 'KP Sumanth', priority: 'Medium', status: 'Open', linkedTo: 'Agro Precision Ltd' }
  ];

  const initialUsers = [
    { fullName: 'KP Sumanth', email: 'sumanth@anveshakhub.com', role: 'SALES_REP', isActive: true, assignedCount: 4 },
    { fullName: 'Balasaraswathi', email: 'balu@anveshakhub.com', role: 'MANAGER', isActive: true, assignedCount: 12 },
    { fullName: 'System Administrator', email: 'admin@anveshakhub.com', role: 'ADMIN', isActive: true, assignedCount: 0 }
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
    await (prisma as any).contact?.deleteMany?.({}).catch?.(() => {});
    await (prisma as any).communication?.deleteMany?.({}).catch?.(() => {});
    await (prisma as any).importBatch?.deleteMany?.({}).catch?.(() => {});

    console.log('Inserting Companies...');
    await prisma.company.createMany({ data: initialCompanies });

    console.log('Inserting Leads...');
    await prisma.lead.createMany({ data: initialLeads });

    console.log('Inserting Deals...');
    await prisma.deal.createMany({ data: initialDeals });

    console.log('Inserting Tasks...');
    await prisma.task.createMany({ data: initialTasks });

    console.log('Inserting Users...');
    await prisma.user.createMany({ data: initialUsers });

    try {
      console.log('Inserting Centralized Contacts...');
      await (prisma as any).contact?.createMany?.({
        data: [
          {
            name: 'Sathyanarayana B V',
            preferredPhone: '+919980003627',
            alternatePhones: ['+918023456789'],
            email: 'ceo@derbifoundation.com',
            company: 'Derbi Foundation',
            designation: 'Chief Executive Officer',
            city: 'Bengaluru',
            state: 'Karnataka',
            category: 'Customer',
            sourceType: 'Visiting Card',
            sourceEvent: 'Bengaluru Tech Summit 2026',
            notes: 'Met at incubation accelerator summit. Looking for IoT infrastructure.',
            owner: 'Balasaraswathi'
          },
          {
            name: 'Ramesh Patel',
            preferredPhone: '+919845011223',
            email: 'ramesh@patellogistics.in',
            company: 'Patel Logistics Solutions',
            designation: 'Managing Director',
            city: 'Bengaluru',
            state: 'Karnataka',
            category: 'Prospect',
            sourceType: 'Visiting Card',
            notes: 'Interested in fleet telemetry.',
            owner: 'KP Sumanth'
          },
          {
            name: 'Ananya Deshmukh',
            preferredPhone: '+919988765432',
            email: 'ananya@deshmukh.co.in',
            company: 'Deshmukh Innovations Ltd',
            designation: 'VP Procurement',
            city: 'Mumbai',
            state: 'Maharashtra',
            category: 'VIP',
            sourceType: 'Event / Expo',
            sourceEvent: 'AgriTech Expo 2026',
            notes: 'Key decision maker for multi-site deployments.',
            owner: 'KP Sumanth'
          }
        ]
      });
    } catch (cErr) {
      console.warn('Note: Contacts table insert skipped if client not yet regenerated:', cErr);
    }

    console.log('SUCCESSFULLY SEEDED SUPABASE POSTGRESQL DATABASE VIA PRISMA ORM!');
  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
